/**
 * 2D side-view simulation of the bending order.
 * The part is drawn by its centre line using outside dimensions (virtual sharps),
 * posed on the die with the bend being made at the origin and its inside facing the punch.
 * Collision checks are an approximation meant for planning, not a replacement for the controller.
 */
import { DEG } from './bend'
import type { Machine, Part, Pt } from './types'

export function profilePoints(flanges: number[], dirs: number[], angles: number[]): Pt[] {
  const pts: Pt[] = [{ x: 0, y: 0 }]
  let h = 0
  for (let i = 0; i < flanges.length; i++) {
    const p = pts[pts.length - 1]
    pts.push({ x: p.x + flanges[i] * Math.cos(h * DEG), y: p.y + flanges[i] * Math.sin(h * DEG) })
    if (i < angles.length) h += dirs[i] * (180 - angles[i])
  }
  return pts
}

const dirSign = (part: Part) => part.bends.map((b) => (b.dir === 'up' ? 1 : -1))

/** Included angles at a given moment: done bends at target, current bend partly bent, the rest flat. */
export function currentAngles(part: Part, done: Set<number>, current: number | null, progress: number): number[] {
  return part.bends.map((b, i) => {
    if (done.has(i)) return b.angle
    if (i === current) return 180 - (180 - b.angle) * progress
    return 180
  })
}

/** Place the part so that bend `k` sits on the die with its inside up toward the punch. */
export function pose(part: Part, angles: number[], k: number, mirror: boolean): Pt[] {
  const dirs = dirSign(part)
  const pts = profilePoints(part.flanges, dirs, angles)
  let h = 0
  for (let i = 0; i < k; i++) h += dirs[i] * (180 - angles[i])
  const beta = 180 - angles[k]
  const theta = h + dirs[k] * (90 + beta / 2)
  const r = (90 - theta) * DEG
  const c = Math.cos(r)
  const s = Math.sin(r)
  const v = pts[k + 1]
  return pts.map((p) => {
    const dx = p.x - v.x
    const dy = p.y - v.y
    const x = dx * c - dy * s
    const y = dx * s + dy * c
    return { x: mirror ? -x : x, y }
  })
}

export interface Tools {
  punch: Pt[]
  die: Pt[]
  lowerBeam: Pt[]
  upperBeam: Pt[]
}

/** Tool outlines in the posed frame (part centre line passes through the origin). */
export function toolGeometry(machine: Machine, v: number, t: number): Tools {
  const top = t / 2
  const H = machine.punchHeight
  const half = Math.tan((machine.punchAngle / 2) * DEG)
  let punch: Pt[]
  if (machine.punchType === 'gooseneck') {
    // Throat (recess) toward the front for return flanges, bulge toward the back.
    const g = (x: number, y: number) => ({ x, y: top + y })
    const f = 9 * half
    punch = [
      g(0, 0),
      g(-f, 9),
      g(-f, 0.18 * H),
      g(10, 0.38 * H),
      g(10, 0.6 * H),
      g(-15, 0.8 * H),
      g(-15, H),
      g(15, H),
      g(15, 0.8 * H),
      g(50, 0.62 * H),
      g(50, 0.45 * H),
      g(22, 0.3 * H),
      g(22, 9 + (22 - f) / half),
      g(f, 9),
    ]
  } else {
    const w = 13
    const yw = w / half
    punch = [
      { x: 0, y: top },
      { x: -w, y: top + yw },
      { x: -w, y: top + H },
      { x: w, y: top + H },
      { x: w, y: top + yw },
    ]
  }
  const dieTop = -t / 2
  const dieW = Math.max(v + 40, 60)
  const depth = (v / 2) * 0.9
  const die: Pt[] = [
    { x: -dieW / 2, y: dieTop },
    { x: -v / 2, y: dieTop },
    { x: 0, y: dieTop - depth },
    { x: v / 2, y: dieTop },
    { x: dieW / 2, y: dieTop },
    { x: dieW / 2, y: dieTop - machine.dieHeight },
    { x: -dieW / 2, y: dieTop - machine.dieHeight },
  ]
  const lbTop = dieTop - machine.dieHeight
  const lowerBeam: Pt[] = [
    { x: -50, y: lbTop },
    { x: 50, y: lbTop },
    { x: 50, y: lbTop - 2000 },
    { x: -50, y: lbTop - 2000 },
  ]
  const ubBottom = top + H
  const upperBeam: Pt[] = [
    { x: -110, y: ubBottom },
    { x: 110, y: ubBottom },
    { x: 110, y: ubBottom + 2000 },
    { x: -110, y: ubBottom + 2000 },
  ]
  return { punch, die, lowerBeam, upperBeam }
}

function inPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const u = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
  return Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy)
}

function nearPolygon(p: Pt, poly: Pt[], tol: number): boolean {
  if (inPolygon(p, poly)) return true
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (distToSeg(p, poly[j], poly[i]) < tol) return true
  }
  return false
}

export type HitWhere = 'punch' | 'die' | 'lower beam' | 'upper beam'

export interface Hit {
  where: HitWhere
  at: Pt
}

/** First collision between the posed part and the tools, or null. */
export function findCollision(pts: Pt[], tools: Tools, t: number, ignoreRadius: number, bend = -1): Hit | null {
  let total = 0
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  const ds = Math.max(1, total / 240)
  const tol = t * 0.45
  const zones = (
    [
      ['punch', tools.punch],
      ['die', tools.die],
      ['upper beam', tools.upperBeam],
      ['lower beam', tools.lowerBeam],
    ] as [HitWhere, Pt[]][]
  ).map(([where, poly]) => {
    const xs = poly.map((p) => p.x)
    const ys = poly.map((p) => p.y)
    return { where, poly, x0: Math.min(...xs) - tol, x1: Math.max(...xs) + tol, y0: Math.min(...ys) - tol, y1: Math.max(...ys) + tol }
  })
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.ceil(len / ds))
    // The two flanges forming the current bend rest on the punch flanks and die shoulders by design.
    const adjacent = i === bend + 1 || i === bend + 2
    for (let j = 0; j <= n; j++) {
      const p = { x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n }
      if (Math.hypot(p.x, p.y) < ignoreRadius) continue
      for (const z of zones) {
        if (adjacent && (z.where === 'punch' || z.where === 'die')) continue
        if (p.x < z.x0 || p.x > z.x1 || p.y < z.y0 || p.y > z.y1) continue
        if (nearPolygon(p, z.poly, tol)) return { where: z.where, at: p }
      }
    }
  }
  return null
}

export interface StepCheck {
  bend: number
  mirror: boolean
  hit: Hit | null
}

function checkStep(part: Part, machine: Machine, v: number, done: Set<number>, k: number, mirror: boolean): Hit | null {
  const t = part.thickness
  const tools = toolGeometry(machine, v, t)
  const ignore = Math.max(2 * t, 3)
  for (const progress of [0.5, 1]) {
    const pts = pose(part, currentAngles(part, done, k, progress), k, mirror)
    const hit = findCollision(pts, tools, t, ignore, k)
    if (hit) return hit
  }
  return null
}

/** Check a step, choosing the end-for-end orientation (mirror) that avoids collisions if one exists. */
export function checkBestStep(part: Part, machine: Machine, v: number, done: Set<number>, k: number, prefer = false): StepCheck {
  const first = checkStep(part, machine, v, done, k, prefer)
  if (!first) return { bend: k, mirror: prefer, hit: null }
  if (machine.punchType === 'straight') return { bend: k, mirror: prefer, hit: first }
  const second = checkStep(part, machine, v, done, k, !prefer)
  if (!second) return { bend: k, mirror: !prefer, hit: null }
  return { bend: k, mirror: prefer, hit: first }
}

export interface SequenceStep extends StepCheck {
  /** The part has to be turned over (top face down) compared with the previous bend */
  turnOver: boolean
  /** Flange index facing the back gauge */
  gaugeFlange: number
  /** Distance from the bend line to the back-gauge side edge, mm (flat projection) */
  gaugeDistance: number
}

export function evaluateSequence(part: Part, machine: Machine, v: number, order: number[]): SequenceStep[] {
  const done = new Set<number>()
  const steps: SequenceStep[] = []
  let prevMirror = false
  order.forEach((k, i) => {
    const check = checkBestStep(part, machine, v, done, k, prevMirror)
    const up = part.bends[k].dir === 'up'
    const turnOver = i > 0 && part.bends[order[i - 1]].dir !== part.bends[k].dir
    // Unmirrored: an "up" bend has the outgoing flange (k+1) at the back, a "down" bend the incoming one (k).
    const backIsOutgoing = up !== check.mirror
    // Gauge is set while the bend line is still flat
    const pts = pose(part, currentAngles(part, done, k, 0), k, check.mirror)
    const end = backIsOutgoing ? pts[pts.length - 1] : pts[0]
    steps.push({
      ...check,
      turnOver,
      gaugeFlange: backIsOutgoing ? k + 1 : k,
      gaugeDistance: Math.abs(end.x),
    })
    prevMirror = check.mirror
    done.add(k)
  })
  return steps
}

export interface Plan {
  order: number[]
  feasible: boolean
  turnOvers: number
}

/**
 * Search for a collision-free order with the fewest turn-overs.
 * Exact search (DP over bend subsets) up to 9 bends; above that keep the natural order.
 */
export function planSequence(part: Part, machine: Machine, v: number): Plan {
  const n = part.bends.length
  const natural = part.bends.map((_, i) => i)
  if (n === 0) return { order: [], feasible: true, turnOvers: 0 }
  if (n > 9) {
    const steps = evaluateSequence(part, machine, v, natural)
    return { order: natural, feasible: steps.every((s) => !s.hit), turnOvers: steps.filter((s) => s.turnOver).length }
  }

  const ok = new Map<number, boolean>()
  const feasible = (mask: number, k: number) => {
    const key = mask * 16 + k
    let r = ok.get(key)
    if (r === undefined) {
      const done = new Set<number>()
      for (let i = 0; i < n; i++) if (mask & (1 << i)) done.add(i)
      r = !checkBestStep(part, machine, v, done, k).hit
      ok.set(key, r)
    }
    return r
  }

  const full = (1 << n) - 1
  // best[mask][last] = cost; tie-break on preferring outer bends first is implicit in index order
  const INF = 1e9
  const cost: number[][] = Array.from({ length: full + 1 }, () => new Array(n).fill(INF))
  const prev: number[][] = Array.from({ length: full + 1 }, () => new Array(n).fill(-1))
  for (let k = 0; k < n; k++) if (feasible(0, k)) cost[1 << k][k] = 0

  const masks = Array.from({ length: full + 1 }, (_, m) => m).sort((a, b) => popcount(a) - popcount(b))
  for (const mask of masks) {
    for (let last = 0; last < n; last++) {
      const c = cost[mask][last]
      if (c >= INF) continue
      for (let k = 0; k < n; k++) {
        if (mask & (1 << k)) continue
        if (!feasible(mask, k)) continue
        const nc = c + (part.bends[k].dir !== part.bends[last].dir ? 1 : 0)
        const nm = mask | (1 << k)
        if (nc < cost[nm][k]) {
          cost[nm][k] = nc
          prev[nm][k] = last
        }
      }
    }
  }

  let bestLast = -1
  for (let k = 0; k < n; k++) if (cost[full][k] < INF && (bestLast < 0 || cost[full][k] < cost[full][bestLast])) bestLast = k
  if (bestLast < 0) {
    const steps = evaluateSequence(part, machine, v, natural)
    return { order: natural, feasible: false, turnOvers: steps.filter((s) => s.turnOver).length }
  }
  const order: number[] = []
  let mask = full
  let k = bestLast
  while (k >= 0) {
    order.unshift(k)
    const p = prev[mask][k]
    mask &= ~(1 << k)
    k = p
  }
  return { order, feasible: true, turnOvers: cost[full][bestLast] }
}

function popcount(m: number): number {
  let c = 0
  while (m) {
    m &= m - 1
    c++
  }
  return c
}
