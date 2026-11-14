import { useState } from 'react'
import { DEFAULT_MACHINE, DEFAULT_MATERIALS, newId } from '../engine/defaults'
import type { Machine, Material } from '../engine/types'
import type { AppState } from '../store'
import { NumberField, Segmented, parseNum } from './fields'

interface Props {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
}

export function MachineTab({ state, setState }: Props) {
  const m = state.machine
  const set = (patch: Partial<Machine>) => setState((s) => ({ ...s, machine: { ...s.machine, ...patch } }))
  const setMat = (id: string, patch: Partial<Material>) =>
    setState((s) => ({ ...s, materials: s.materials.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
  const [newV, setNewV] = useState('')

  const addV = () => {
    const v = parseNum(newV)
    if (!(v > 0) || m.vOpenings.includes(v)) return
    set({ vOpenings: [...m.vOpenings, v].sort((a, b) => a - b) })
    setNewV('')
  }

  return (
    <>
      <section className="card">
        <h2>Machine</h2>
        <label className="field">
          <span className="field-label">Model</span>
          <span className="field-input">
            <input value={m.name} onChange={(e) => set({ name: e.target.value })} />
          </span>
        </label>
        <div className="row2">
          <NumberField label="Bending length" unit="mm" min={1} value={m.maxLength} onChange={(maxLength) => set({ maxLength })} />
          <NumberField label="Capacity" unit="t" min={1} value={m.capacityTon} onChange={(capacityTon) => set({ capacityTon })} />
        </div>
        <p className="muted tiny">
          From the nameplate: serial {m.serial}, approach speed {m.approachSpeed} mm/s, 22 kW, 400 V.
        </p>
      </section>

      <section className="card">
        <h2>Dies (V openings)</h2>
        <div className="chips">
          {m.vOpenings.map((v) => (
            <button
              key={v}
              type="button"
              className="chip removable"
              aria-label={`Remove V${v}`}
              onClick={() => set({ vOpenings: m.vOpenings.filter((x) => x !== v) })}
            >
              V{v} <span aria-hidden>✕</span>
            </button>
          ))}
        </div>
        <div className="add-row">
          <span className="field-input">
            <input inputMode="decimal" placeholder="Add V opening, mm" value={newV} onChange={(e) => setNewV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addV()} />
          </span>
          <button type="button" className="btn" onClick={addV}>
            Add
          </button>
        </div>
        <div className="row2">
          <NumberField label="Die height" unit="mm" min={1} value={m.dieHeight} onChange={(dieHeight) => set({ dieHeight })} />
          <NumberField label="Tool rating" unit="t/m" min={1} value={m.toolLoadLimit} onChange={(toolLoadLimit) => set({ toolLoadLimit })} />
        </div>
      </section>

      <section className="card">
        <h2>Punch</h2>
        <Segmented
          label="Punch type"
          value={m.punchType}
          onChange={(punchType) => set({ punchType })}
          options={[
            { value: 'straight', label: 'Straight' },
            { value: 'gooseneck', label: 'Gooseneck' },
          ]}
        />
        <div className="row3">
          <NumberField label="Tip angle" unit="°" min={10} max={179} value={m.punchAngle} onChange={(punchAngle) => set({ punchAngle })} />
          <NumberField label="Tip radius" unit="mm" min={0} value={m.punchRadius} onChange={(punchRadius) => set({ punchRadius })} />
          <NumberField label="Height" unit="mm" min={20} value={m.punchHeight} onChange={(punchHeight) => set({ punchHeight })} />
        </div>
      </section>

      <section className="card">
        <h2>Materials</h2>
        {state.materials.map((mat) => (
          <div key={mat.id} className="material">
            <div className="material-head">
              <span className="field-input">
                <input value={mat.name} aria-label="Material name" onChange={(e) => setMat(mat.id, { name: e.target.value })} />
              </span>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Delete ${mat.name}`}
                disabled={state.materials.length <= 1 || state.parts.some((p) => p.materialId === mat.id)}
                onClick={() => setState((s) => ({ ...s, materials: s.materials.filter((x) => x.id !== mat.id) }))}
              >
                ✕
              </button>
            </div>
            <div className="row3">
              <NumberField compact label="Tensile Rm" unit="MPa" min={1} value={mat.tensile} onChange={(tensile) => setMat(mat.id, { tensile })} />
              <NumberField compact label="Radius ÷ V" min={0.01} max={1} value={mat.radiusFactor} onChange={(radiusFactor) => setMat(mat.id, { radiusFactor })} />
              <NumberField compact label="Density" unit="g/cm³" min={0.1} value={mat.density ?? 7.85} onChange={(density) => setMat(mat.id, { density })} />
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn wide"
          onClick={() =>
            setState((s) => ({ ...s, materials: [...s.materials, { id: newId(), name: 'New material', tensile: 450, radiusFactor: 0.16, density: 7.85 }] }))
          }
        >
          + Add material
        </button>
      </section>

      <section className="card">
        <button
          type="button"
          className="btn danger wide"
          onClick={() => {
            if (confirm('Reset the machine, dies and materials to the defaults? Your parts are kept.'))
              setState((s) => ({
                ...s,
                machine: { ...DEFAULT_MACHINE },
                materials: DEFAULT_MATERIALS.map((x) => ({ ...x })),
                parts: s.parts.map((p) => (DEFAULT_MATERIALS.some((x) => x.id === p.materialId) ? p : { ...p, materialId: DEFAULT_MATERIALS[0].id })),
              }))
          }}
        >
          Reset machine & materials
        </button>
      </section>
    </>
  )
}
