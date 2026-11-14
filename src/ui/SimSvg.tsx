import { currentAngles, pose, toolGeometry, type SequenceStep } from '../engine/sequence'
import type { Machine, Part, Pt } from '../engine/types'
import { fmt } from './fields'

interface Props {
  part: Part
  machine: Machine
  v: number
  order: number[]
  steps: SequenceStep[]
  index: number
  progress: number
}

const P = (pts: Pt[]) => pts.map((p) => `${p.x},${-p.y}`).join(' ')

/** Side view of the press brake at one step of the bending order. */
export function SimSvg({ part, machine, v, order, steps, index, progress }: Props) {
  const t = part.thickness
  const tools = toolGeometry(machine, v, t)
  const step = steps[index]
  if (!step) return <div className="sim-empty">No bends — this part is a flat blank.</div>

  const done = new Set(order.slice(0, index))
  const k = order[index]
  const pts = pose(part, currentAngles(part, done, k, progress), k, step.mirror)
  const flat = pose(part, currentAngles(part, done, k, 0), k, step.mirror)
  const fin = pose(part, currentAngles(part, done, k, 1), k, step.mirror)

  const all = [...flat, ...fin]
  const reach = Math.max(150, ...all.map((p) => Math.abs(p.x))) + 20
  const yTop = Math.max(machine.punchHeight + 60, ...all.map((p) => p.y + 20))
  const yBot = -(machine.dieHeight + 70)
  const vb = `${-reach} ${-yTop} ${2 * reach} ${yTop - yBot}`
  const hit = step.hit && progress >= 0.5 ? step.hit : null
  const stroke = Math.max(t, reach / 160)
  const font = reach / 14
  const gaugeX = step.gaugeDistance

  return (
    <svg className="sim-svg" viewBox={vb} role="img" aria-label={`Bend ${k + 1} on the press brake`}>
      <polygon points={P(tools.upperBeam)} className="tool beam" />
      <polygon points={P(tools.lowerBeam)} className="tool beam" />
      <polygon points={P(tools.die)} className="tool" />
      <polygon points={P(tools.punch)} className="tool punch" />
      {gaugeX < reach && (
        <g className="gauge">
          <rect x={gaugeX} y={-25} width={Math.max(6, reach / 40)} height={50} />
        </g>
      )}
      <polyline
        points={P(pts)}
        fill="none"
        className={`sim-part ${hit ? 'hit' : ''}`}
        strokeWidth={stroke}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {hit && <circle cx={hit.at.x} cy={-hit.at.y} r={Math.max(8, reach / 25)} className="hit-ring" />}
      <text x={-reach + 8} y={-yBot - 12} fontSize={font} className="sim-label">
        FRONT
      </text>
      <text x={reach - 8} y={-yBot - 12} fontSize={font} className="sim-label" textAnchor="end">
        BACK
      </text>
      <text x={0} y={-yTop + font * 1.2} fontSize={font} className="sim-label" textAnchor="middle">
        {fmt(180 - (180 - part.bends[k].angle) * progress, 0)}°
      </text>
    </svg>
  )
}
