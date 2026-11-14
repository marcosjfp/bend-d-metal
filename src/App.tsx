import { useCallback, useEffect, useMemo, useState } from 'react'
import { analyzePart, type Analysis } from './engine/bend'
import type { Part } from './engine/types'
import { useAppState, type Stock } from './store'
import { BendsTab } from './ui/BendsTab'
import { CutTab } from './ui/CutTab'
import { MachineTab } from './ui/MachineTab'
import { PartTab } from './ui/PartTab'
import { fmt } from './ui/fields'

type Tab = 'part' | 'bends' | 'cut' | 'machine'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'part', label: 'Part', icon: '⌐' },
  { id: 'bends', label: 'Bends', icon: '⤾' },
  { id: 'cut', label: 'Cut list', icon: '▦' },
  { id: 'machine', label: 'Machine', icon: '⚙' },
]

export default function App() {
  const [state, setState] = useAppState()
  const [tab, setTabState] = useState<Tab>(() => {
    const h = window.location.hash.slice(1)
    return TABS.some((t) => t.id === h) ? (h as Tab) : 'part'
  })
  const setTab = (t: Tab) => {
    setTabState(t)
    history.replaceState(null, '', `#${t}`)
  }
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.slice(1)
      if (TABS.some((t) => t.id === h)) setTabState(h as Tab)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const part = state.parts.find((p) => p.id === state.activeId) ?? state.parts[0]

  const analyses = useMemo(() => {
    const map = new Map<string, Analysis>()
    for (const p of state.parts) {
      const mat = state.materials.find((m) => m.id === p.materialId) ?? state.materials[0]
      map.set(p.id, analyzePart(p, mat, state.machine))
    }
    return map
  }, [state.parts, state.materials, state.machine])
  const analysis = analyses.get(part.id)!

  const updatePartById = useCallback(
    (id: string, patch: Partial<Part>) =>
      setState((s) => ({ ...s, parts: s.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
    [setState],
  )
  const updatePart = useCallback((patch: Partial<Part>) => updatePartById(part.id, patch), [updatePartById, part.id])
  const setStock = useCallback((patch: Partial<Stock>) => setState((s) => ({ ...s, stock: { ...s.stock, ...patch } })), [setState])

  const errors = analysis.issues.filter((i) => i.level === 'error').length

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <strong>Bend Planner</strong>
          <span className="muted small">{state.machine.name}</span>
        </div>
        {tab !== 'machine' && tab !== 'cut' && (
          <div className={`pill ${errors ? 'bad' : 'ok'}`} title="Flat blank of the current part">
            {fmt(analysis.flatLength)} mm
          </div>
        )}
      </header>

      <main className="content">
        {tab === 'part' && <PartTab state={state} setState={setState} part={part} analysis={analysis} updatePart={updatePart} />}
        {tab === 'bends' && <BendsTab part={part} machine={state.machine} analysis={analysis} updatePart={updatePart} />}
        {tab === 'cut' && <CutTab state={state} analyses={analyses} setStock={setStock} updatePartById={updatePartById} />}
        {tab === 'machine' && <MachineTab state={state} setState={setState} />}
      </main>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'on' : ''}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              setTab(t.id)
              window.scrollTo({ top: 0 })
            }}
          >
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            <span>{t.label}</span>
            {t.id === 'part' && errors > 0 && <span className="badge">{errors}</span>}
          </button>
        ))}
      </nav>
    </div>
  )
}
