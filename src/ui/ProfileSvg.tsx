import { profilePoints } from '../engine/sequence'
import type { Part } from '../engine/types'
import { fmt } from './fields'

/** Finished-part cross section with flange dimensions. */
export function ProfileSvg({ part }: { part: Part }) {
  const dirs = part.bends.map((b) => (b.dir === 'up' ? 1 : -1))
  const pts = profilePoints(part.flanges, dirs, part.bends.map((b) => b.angle))
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const size = Math.max(maxX - minX, maxY - minY, 20)
  const pad = size * 0.22
  const stroke = Math.max(part.thickness, size / 90)
  const font = size / 13
  const vb = `${minX - pad} ${-maxY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  return (
    <svg className="profile-svg" viewBox={vb} role="img" aria-label="Part profile">
      <polyline
        points={pts.map((p) => `${p.x},${-p.y}`).join(' ')}
        fill="none"
        stroke="var(--part)"
        strokeWidth={stroke}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.slice(0, -1).map((a, i) => {
        const b = pts[i + 1]
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        // push the label away from the part's centre
        let nx = -(b.y - a.y)
        let ny = b.x - a.x
        const l = Math.hypot(nx, ny) || 1
        nx /= l
        ny /= l
        if (nx * (mx - cx) + ny * (my - cy) < 0) {
          nx = -nx
          ny = -ny
        }
        const off = font * 1.1
        return (
          <text key={i} x={mx + nx * off} y={-(my + ny * off)} fontSize={font} className="dim" textAnchor="middle" dominantBaseline="middle">
            {fmt(part.flanges[i])}
          </text>
        )
      })}
      {pts.slice(1, -1).map((p, i) => (
        <circle key={i} cx={p.x} cy={-p.y} r={stroke * 0.9} className="bend-dot" />
      ))}
    </svg>
  )
}
