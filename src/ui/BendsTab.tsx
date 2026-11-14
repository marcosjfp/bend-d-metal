import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { Analysis } from '../engine/bend'
import { evaluateSequence, planSequence } from '../engine/sequence'
import type { Machine, Part } from '../engine/types'
import { fmt } from './fields'
import { SimSvg } from './SimSvg'

interface Props {
  part: Part
  machine: Machine
  analysis: Analysis
  updatePart: (patch: Partial<Part>) => void
}

const isPermutation = (seq: number[] | null, n: number): seq is number[] =>
  !!seq && seq.length === n && new Set(seq).size === n && seq.every((i) => i >= 0 && i < n)

export function BendsTab({ part: livePart, machine, analysis, updatePart }: Props) {
  const part = useDeferredValue(livePart)
  const v = analysis.v
  const n = part.bends.length

  const plan = useMemo(() => planSequence(part, machine, v), [part, machine, v])
  const custom = isPermutation(part.sequence, n)
  const order = custom ? (part.sequence as number[]) : plan.order
  const steps = useMemo(() => evaluateSequence(part, machine, v, order), [part, machine, v, order])

  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(1)
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)

  const safeIndex = Math.min(index, Math.max(0, n - 1))

  useEffect(() => {
    if (!playing) return
    let start: number | null = null
    let i = safeIndex
    setProgress(0)
    const tick = (ts: number) => {
      if (start === null) start = ts
      const p = Math.min(1, (ts - start) / 1100)
      setProgress(p)
      if (p >= 1) {
        if (i < n - 1) {
          i += 1
          setIndex(i)
          start = ts + 350
          setProgress(0)
        } else {
          setPlaying(false)
          return
        }
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  const go = (i: number) => {
    setPlaying(false)
    setIndex(Math.max(0, Math.min(n - 1, i)))
    setProgress(1)
  }

  const move = (pos: number, delta: number) => {
    const next = [...order]
    const j = pos + delta
    if (j < 0 || j >= next.length) return
    ;[next[pos], next[j]] = [next[j], next[pos]]
    updatePart({ sequence: next })
  }

  if (n === 0) {
    return (
      <section className="card">
        <h2>Bending order</h2>
        <p className="muted">This part has no bends. Add bends on the Part tab.</p>
      </section>
    )
  }

  const collisions = steps.filter((s) => s.hit).length
  const step = steps[safeIndex]

  return (
    <>
      <section className="card sim-card">
        <div className="card-head">
          <h2>
            Step {safeIndex + 1}/{n} · Bend {order[safeIndex] + 1}
          </h2>
          <span className="muted small">
            V{v} · {machine.punchType} punch
          </span>
        </div>
        <SimSvg part={part} machine={machine} v={v} order={order} steps={steps} index={safeIndex} progress={progress} />
        <input
          className="slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={progress}
          aria-label="Bend progress"
          onChange={(e) => {
            setPlaying(false)
            setProgress(Number(e.target.value))
          }}
        />
        <div className="player">
          <button type="button" className="btn" onClick={() => go(safeIndex - 1)} disabled={safeIndex === 0} aria-label="Previous step">
            ◀
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              if (playing) setPlaying(false)
              else {
                if (safeIndex === n - 1 && progress >= 1) setIndex(0)
                setPlaying(true)
              }
            }}
          >
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <button type="button" className="btn" onClick={() => go(safeIndex + 1)} disabled={safeIndex === n - 1} aria-label="Next step">
            ▶
          </button>
        </div>
        {step && <StepInstruction part={part} step={step} index={safeIndex} />}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Bending order</h2>
          {custom && (
            <button type="button" className="btn small" onClick={() => updatePart({ sequence: null })}>
              Use suggested
            </button>
          )}
        </div>
        <p className={`issue ${collisions ? 'error' : 'ok'}`}>
          {collisions
            ? `⛔ ${collisions > 1 ? `${collisions} steps collide` : '1 step collides'} with the tools in this order.`
            : `✅ No collisions found · ${steps.filter((s) => s.turnOver).length} turn-over(s).`}
        </p>
        {!plan.feasible && (
          <p className="issue warn">
            ⚠️ No collision-free order exists with the current tooling.
            {machine.punchType === 'straight' ? ' Try a gooseneck punch (Machine tab) or shorter flanges.' : ' Try taller tooling or shorter flanges.'}
          </p>
        )}
        <ol className="order-list">
          {order.map((k, pos) => {
            const s = steps[pos]
            return (
              <li key={k} className={`${pos === safeIndex ? 'current' : ''} ${s?.hit ? 'hit' : ''}`}>
                <button type="button" className="order-main" onClick={() => go(pos)}>
                  <span className="order-num">{pos + 1}</span>
                  <span>
                    Bend {k + 1} · {part.bends[k].angle}° {part.bends[k].dir}
                    <small className="muted">
                      {s?.hit ? ` · hits ${s.hit.where}` : ''}
                      {s?.turnOver ? ' · turn over' : ''}
                    </small>
                  </span>
                </button>
                <button type="button" className="icon-btn" aria-label="Move earlier" disabled={pos === 0} onClick={() => move(pos, -1)}>
                  ↑
                </button>
                <button type="button" className="icon-btn" aria-label="Move later" disabled={pos === n - 1} onClick={() => move(pos, 1)}>
                  ↓
                </button>
              </li>
            )
          })}
        </ol>
        <p className="muted tiny">
          Simplified 2D check of the punch, die and beams. Back gauge fingers and side frames are not modelled.
        </p>
      </section>
    </>
  )
}

function StepInstruction({ part, step, index }: { part: Part; step: ReturnType<typeof evaluateSequence>[number]; index: number }) {
  const b = part.bends[step.bend]
  return (
    <ul className="instructions">
      {index === 0 && <li>Place the blank {b.dir === 'up' ? 'top face up' : 'top face down'}.</li>}
      {step.turnOver && <li>↻ Turn the part over.</li>}
      {step.mirror && <li>⇄ Swap ends (flange {step.gaugeFlange + 1} side toward the back).</li>}
      <li>
        Back gauge on flange {step.gaugeFlange + 1} side · ≈ {fmt(step.gaugeDistance, 0)} mm from bend line
      </li>
      <li>
        Bend to {b.angle}°
      </li>
      {step.hit && <li className="bad">⛔ Collides with the {step.hit.where} — change the order or tooling.</li>}
    </ul>
  )
}
