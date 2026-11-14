import type { Analysis } from '../engine/bend'
import { TEMPLATES, newId, newPart } from '../engine/defaults'
import type { Bend, Machine, Material, Part } from '../engine/types'
import type { AppState } from '../store'
import { Chips, NumberField, Segmented, fmt } from './fields'
import { ProfileSvg } from './ProfileSvg'
import { Issues } from './Issues'

interface Props {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  part: Part
  analysis: Analysis
  updatePart: (patch: Partial<Part>) => void
}

const THICKNESSES = [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12]

export function PartTab({ state, setState, part, analysis, updatePart }: Props) {
  const setFlange = (i: number, v: number) => updatePart({ flanges: part.flanges.map((f, j) => (j === i ? v : f)) })
  const setBend = (i: number, patch: Partial<Bend>) =>
    updatePart({ bends: part.bends.map((b, j) => (j === i ? { ...b, ...patch } : b)) })

  const addFlange = () =>
    updatePart({ flanges: [...part.flanges, 50], bends: [...part.bends, { angle: 90, dir: 'up' }], sequence: null })

  const removeFlange = (i: number) => {
    if (part.flanges.length <= 1) return
    const bi = i === 0 ? 0 : i - 1
    updatePart({
      flanges: part.flanges.filter((_, j) => j !== i),
      bends: part.bends.filter((_, j) => j !== bi),
      sequence: null,
    })
  }

  return (
    <>
      <PartPicker state={state} setState={setState} part={part} />

      <section className="card">
        <label className="field">
          <span className="field-label">Name</span>
          <span className="field-input">
            <input value={part.name} onChange={(e) => updatePart({ name: e.target.value })} enterKeyHint="done" />
          </span>
        </label>
        <label className="field">
          <span className="field-label">Material</span>
          <span className="field-input">
            <select value={part.materialId} onChange={(e) => updatePart({ materialId: e.target.value })}>
              {state.materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.tensile} MPa
                </option>
              ))}
            </select>
          </span>
        </label>
        <NumberField label="Thickness" unit="mm" min={0.1} value={part.thickness} onChange={(thickness) => updatePart({ thickness })} />
        <Chips values={THICKNESSES} current={part.thickness} onPick={(thickness) => updatePart({ thickness })} />
        <div className="row2">
          <NumberField label="Bend length" unit="mm" min={1} value={part.length} onChange={(length) => updatePart({ length })} />
          <NumberField label="Quantity" unit="pcs" min={1} value={part.qty} onChange={(qty) => updatePart({ qty: Math.round(qty) })} />
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Profile</h2>
          <span className="muted small">outside dimensions</span>
        </div>
        <div className="chips scroll">
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              type="button"
              className="chip"
              onClick={() => updatePart({ flanges: [...t.flanges], bends: t.bends.map((b) => ({ ...b })), sequence: null })}
            >
              {t.name}
            </button>
          ))}
        </div>
        <ProfileSvg part={part} />
        <ol className="profile-editor">
          {part.flanges.map((f, i) => (
            <li key={i}>
              <div className="flange-row">
                <NumberField compact label={`Flange ${i + 1}`} unit="mm" min={0.1} value={f} onChange={(v) => setFlange(i, v)} />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove flange ${i + 1}`}
                  disabled={part.flanges.length <= 1}
                  onClick={() => removeFlange(i)}
                >
                  ✕
                </button>
              </div>
              {i < part.bends.length && (
                <div className="bend-row">
                  <span className="bend-tag">Bend {i + 1}</span>
                  <NumberField compact label="Angle" unit="°" min={1} max={179} value={part.bends[i].angle} onChange={(angle) => setBend(i, { angle })} />
                  <Segmented
                    label={`Bend ${i + 1} direction`}
                    value={part.bends[i].dir}
                    onChange={(dir) => setBend(i, { dir })}
                    options={[
                      { value: 'up', label: '↶ Up' },
                      { value: 'down', label: '↷ Down' },
                    ]}
                  />
                </div>
              )}
            </li>
          ))}
        </ol>
        <button type="button" className="btn wide" onClick={addFlange}>
          + Add bend & flange
        </button>
      </section>

      <Results analysis={analysis} part={part} machine={state.machine} material={state.materials.find((m) => m.id === part.materialId)} updatePart={updatePart} />
    </>
  )
}

function PartPicker({ state, setState, part }: { state: AppState; setState: Props['setState']; part: Part }) {
  const add = () => {
    const p = newPart(`Part ${state.parts.length + 1}`)
    setState((s) => ({ ...s, parts: [...s.parts, p], activeId: p.id }))
  }
  const duplicate = () => {
    const p = { ...structuredClone(part), id: newId(), name: `${part.name} copy` }
    setState((s) => ({ ...s, parts: [...s.parts, p], activeId: p.id }))
  }
  const remove = () => {
    if (state.parts.length <= 1) return
    if (!confirm(`Delete "${part.name}"?`)) return
    setState((s) => {
      const parts = s.parts.filter((p) => p.id !== part.id)
      return { ...s, parts, activeId: parts[0].id }
    })
  }
  return (
    <section className="card picker">
      <div className="chips scroll">
        {state.parts.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip ${p.id === part.id ? 'on' : ''}`}
            onClick={() => setState((s) => ({ ...s, activeId: p.id }))}
          >
            {p.name || 'Untitled'}
          </button>
        ))}
      </div>
      <div className="btn-row">
        <button type="button" className="btn" onClick={add}>
          + New
        </button>
        <button type="button" className="btn" onClick={duplicate}>
          Duplicate
        </button>
        <button type="button" className="btn danger" onClick={remove} disabled={state.parts.length <= 1}>
          Delete
        </button>
      </div>
    </section>
  )
}

function Results({
  analysis: a,
  part,
  machine,
  material,
  updatePart,
}: {
  analysis: Analysis
  part: Part
  machine: Machine
  material?: Material
  updatePart: Props['updatePart']
}) {
  const pct = Math.min(100, a.loadPct)
  const level = a.loadPct > 100 ? 'bad' : a.loadPct > 85 ? 'warn' : 'ok'
  return (
    <section className="card results">
      <div className="card-head">
        <h2>Result</h2>
        <span className="muted small">{material?.name}</span>
      </div>
      <div className="blank">
        <span className="muted small">Flat blank</span>
        <strong>
          {fmt(a.flatLength)} × {fmt(part.length, 0)} mm
        </strong>
        <span className="muted small">
          × {part.qty} pcs · ≈ {fmt(a.flatLength * part.length * part.thickness * (material?.density ?? 7.85) * 1e-6, 2)} kg each
        </span>
      </div>

      <div className="stats">
        <label className="stat">
          <span>V die</span>
          <select
            value={part.vOverride ?? ''}
            onChange={(e) => updatePart({ vOverride: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Auto (V{a.v})</option>
            {machine.vOpenings.map((v) => (
              <option key={v} value={v}>
                V{v}
              </option>
            ))}
          </select>
        </label>
        <div className="stat">
          <span>V / t</span>
          <strong>{fmt(a.ratio)}×</strong>
        </div>
        <div className="stat">
          <span>Inner radius</span>
          <strong>≈ {fmt(a.radius)} mm</strong>
        </div>
        <div className="stat">
          <span>K-factor</span>
          <strong>{fmt(a.k, 2)}</strong>
        </div>
        <div className="stat">
          <span>Min flange</span>
          <strong>{fmt(a.minFlange)} mm</strong>
        </div>
        <div className="stat">
          <span>Force</span>
          <strong>{fmt(a.tonPerMeter)} t/m</strong>
        </div>
      </div>

      {part.bends.length > 0 && (
        <div className="load">
          <div className="load-head">
            <span>Press load</span>
            <strong>
              {fmt(a.totalTon)} / {machine.capacityTon} t
            </strong>
          </div>
          <div className={`bar ${level}`}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <span className="muted small">
            Max length at full capacity with V{a.v}: {fmt(Math.min(a.maxLengthAtCapacity, machine.maxLength), 0)} mm
          </span>
        </div>
      )}

      {part.bends.length > 0 && (
        <details className="deductions">
          <summary>Bend deductions</summary>
          <ul>
            {a.deductions.map((d, i) => (
              <li key={i}>
                Bend {i + 1} ({part.bends[i].angle}°): {fmt(d, 2)} mm
              </li>
            ))}
          </ul>
        </details>
      )}

      <Issues issues={a.issues} />
      <p className="muted tiny">
        Estimates for air bending. Confirm the angle and blank on a test piece; the machine controller compensates springback.
      </p>
    </section>
  )
}
