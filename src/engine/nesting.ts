/**
 * Rectangular cut-list optimizer: places flat blanks on stock sheets.
 * - "laser": MaxRects (best short-side fit), any layout
 * - "shear": guillotine splits only, so every cut runs edge to edge
 */
export interface NestItem {
  id: string
  label: string
  /** Blank width (flat length), mm */
  w: number
  /** Blank height (bend length), mm */
  h: number
  qty: number
}

export interface NestOptions {
  sheetW: number
  sheetH: number
  kerf: number
  margin: number
  allowRotate: boolean
  mode: 'laser' | 'shear'
}

export interface Placement {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
  rotated: boolean
}

export interface SheetLayout {
  placements: Placement[]
  utilization: number
}

export interface NestResult {
  sheets: SheetLayout[]
  unplaced: { id: string; label: string; count: number }[]
  placedCount: number
  utilization: number
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Fit {
  rect: Rect
  rotated: boolean
  score1: number
  score2: number
  freeIndex: number
}

type Score = 'bssf' | 'baf' | 'blsf' | 'bl'
type Split = 'slas' | 'llas' | 'h' | 'v'

interface Heuristic {
  score: Score
  split: Split
  /** first: first sheet with room; best: sheet with the tightest fit */
  pick: 'first' | 'best'
  sort: (a: NestItem, b: NestItem) => number
}

class Bin {
  free: Rect[]
  used: Placement[] = []
  mode: 'laser' | 'shear'
  h: Heuristic
  constructor(w: number, h: number, mode: 'laser' | 'shear', heuristic: Heuristic) {
    this.mode = mode
    this.h = heuristic
    this.free = [{ x: 0, y: 0, w, h }]
  }

  find(w: number, h: number, allowRotate: boolean): Fit | null {
    let best: Fit | null = null
    const tries: [number, number, boolean][] = [[w, h, false]]
    if (allowRotate && w !== h) tries.push([h, w, true])
    this.free.forEach((f, freeIndex) => {
      for (const [tw, th, rotated] of tries) {
        if (tw > f.w + 1e-6 || th > f.h + 1e-6) continue
        const dw = f.w - tw
        const dh = f.h - th
        let s1: number
        let s2: number
        switch (this.h.score) {
          case 'bssf':
            s1 = Math.min(dw, dh)
            s2 = Math.max(dw, dh)
            break
          case 'blsf':
            s1 = Math.max(dw, dh)
            s2 = Math.min(dw, dh)
            break
          case 'baf':
            s1 = f.w * f.h - tw * th
            s2 = Math.min(dw, dh)
            break
          default:
            s1 = f.y + th
            s2 = f.x
        }
        if (!best || s1 < best.score1 || (s1 === best.score1 && s2 < best.score2)) {
          best = { rect: { x: f.x, y: f.y, w: tw, h: th }, rotated, score1: s1, score2: s2, freeIndex }
        }
      }
    })
    return best
  }

  place(fit: Fit) {
    const r = fit.rect
    if (this.mode === 'shear') {
      const f = this.free[fit.freeIndex]
      this.free.splice(fit.freeIndex, 1)
      const rightW = f.w - r.w
      const topH = f.h - r.h
      let horizontal: boolean
      switch (this.h.split) {
        case 'slas':
          horizontal = rightW < topH
          break
        case 'llas':
          horizontal = rightW >= topH
          break
        case 'h':
          horizontal = true
          break
        default:
          horizontal = false
      }
      if (horizontal) {
        // full-width cut above the piece
        this.push({ x: f.x + r.w, y: f.y, w: rightW, h: r.h })
        this.push({ x: f.x, y: f.y + r.h, w: f.w, h: topH })
      } else {
        // full-height cut beside the piece
        this.push({ x: f.x + r.w, y: f.y, w: rightW, h: f.h })
        this.push({ x: f.x, y: f.y + r.h, w: r.w, h: topH })
      }
      this.mergeFree()
      return
    }
    const next: Rect[] = []
    for (const f of this.free) {
      if (r.x >= f.x + f.w || r.x + r.w <= f.x || r.y >= f.y + f.h || r.y + r.h <= f.y) {
        next.push(f)
        continue
      }
      if (r.x > f.x) next.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h })
      if (r.x + r.w < f.x + f.w) next.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - r.x - r.w, h: f.h })
      if (r.y > f.y) next.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y })
      if (r.y + r.h < f.y + f.h) next.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - r.y - r.h })
    }
    const contains = (b: Rect, a: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h
    // drop rects contained in another one (keep the first of identical duplicates)
    this.free = next.filter((a, i) => a.w > 0.5 && a.h > 0.5 && !next.some((b, j) => j !== i && contains(b, a) && (j < i || !contains(a, b))))
  }

  /** Join leftover rectangles that share a full edge (still cuttable edge to edge). */
  private mergeFree() {
    const eq = (a: number, b: number) => Math.abs(a - b) < 1e-6
    let merged = true
    while (merged) {
      merged = false
      outer: for (let i = 0; i < this.free.length; i++) {
        for (let j = i + 1; j < this.free.length; j++) {
          const a = this.free[i]
          const b = this.free[j]
          let m: Rect | null = null
          if (eq(a.x, b.x) && eq(a.w, b.w) && (eq(a.y + a.h, b.y) || eq(b.y + b.h, a.y))) m = { x: a.x, y: Math.min(a.y, b.y), w: a.w, h: a.h + b.h }
          else if (eq(a.y, b.y) && eq(a.h, b.h) && (eq(a.x + a.w, b.x) || eq(b.x + b.w, a.x))) m = { x: Math.min(a.x, b.x), y: a.y, w: a.w + b.w, h: a.h }
          if (m) {
            this.free.splice(j, 1)
            this.free[i] = m
            merged = true
            break outer
          }
        }
      }
    }
  }

  private push(r: Rect) {
    if (r.w > 0.5 && r.h > 0.5) this.free.push(r)
  }
}

const SORTS: ((a: NestItem, b: NestItem) => number)[] = [
  (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h,
  (a, b) => b.w * b.h - a.w * a.h,
  (a, b) => b.w - a.w || b.h - a.h,
  (a, b) => b.h - a.h || b.w - a.w,
]

function heuristics(mode: 'laser' | 'shear', pieceCount: number): Heuristic[] {
  const scores: Score[] = mode === 'laser' ? ['bssf', 'baf', 'blsf', 'bl'] : ['baf', 'bssf', 'blsf']
  const splits: Split[] = mode === 'laser' ? ['slas'] : ['slas', 'llas', 'h', 'v']
  const sorts = pieceCount > 400 ? SORTS.slice(0, 2) : SORTS
  const out: Heuristic[] = []
  for (const pick of ['first', 'best'] as const)
    for (const score of scores) for (const split of splits) for (const sort of sorts) out.push({ score, split, sort, pick })
  return out
}

function packOnce(pieces: NestItem[], binW: number, binH: number, k: number, margin: number, o: NestOptions, h: Heuristic): Bin[] {
  const sorted = [...pieces].sort(h.sort)
  const bins: Bin[] = []
  for (const p of sorted) {
    let chosen: { bin: Bin; fit: Fit } | null = null
    for (const bin of bins) {
      const fit = bin.find(p.w + k, p.h + k, o.allowRotate)
      if (!fit) continue
      if (!chosen || fit.score1 < chosen.fit.score1 || (fit.score1 === chosen.fit.score1 && fit.score2 < chosen.fit.score2)) chosen = { bin, fit }
      if (h.pick === 'first') break
    }
    if (!chosen) {
      const bin = new Bin(binW, binH, o.mode, h)
      bins.push(bin)
      const fit = bin.find(p.w + k, p.h + k, o.allowRotate)
      if (!fit) continue
      chosen = { bin, fit }
    }
    chosen.bin.place(chosen.fit)
    const r = chosen.fit.rect
    chosen.bin.used.push({ id: p.id, label: p.label, x: r.x + margin, y: r.y + margin, w: r.w - k, h: r.h - k, rotated: chosen.fit.rotated })
  }
  return bins
}

const areaOf = (b: Bin) => b.used.reduce((s, p) => s + p.w * p.h, 0)

export function nest(items: NestItem[], o: NestOptions): NestResult {
  const k = Math.max(0, o.kerf)
  const binW = o.sheetW - 2 * o.margin + k
  const binH = o.sheetH - 2 * o.margin + k
  const pieces: NestItem[] = []
  const unplaced = new Map<string, { id: string; label: string; count: number }>()

  for (const it of items) {
    if (!(it.w > 0 && it.h > 0)) continue
    const fits = (it.w + k <= binW && it.h + k <= binH) || (o.allowRotate && it.h + k <= binW && it.w + k <= binH)
    for (let q = 0; q < it.qty; q++) {
      if (fits) pieces.push(it)
      else {
        const u = unplaced.get(it.id) ?? { id: it.id, label: it.label, count: 0 }
        u.count++
        unplaced.set(it.id, u)
      }
    }
  }

  // Try several packing strategies; keep the one with the fewest sheets, then the emptiest last sheet.
  let bins: Bin[] = []
  for (const h of heuristics(o.mode, pieces.length)) {
    const candidate = packOnce(pieces, binW, binH, k, o.margin, o, h)
    if (
      !bins.length ||
      candidate.length < bins.length ||
      (candidate.length === bins.length && areaOf(candidate[candidate.length - 1]) < areaOf(bins[bins.length - 1]))
    ) {
      bins = candidate
    }
    if (!pieces.length) break
  }

  const sheetArea = o.sheetW * o.sheetH
  const sheets = bins.map((b) => ({ placements: b.used, utilization: areaOf(b) / sheetArea }))
  const usedArea = sheets.reduce((s, sh) => s + sh.utilization * sheetArea, 0)
  return {
    sheets,
    unplaced: [...unplaced.values()],
    placedCount: sheets.reduce((s, sh) => s + sh.placements.length, 0),
    utilization: sheets.length ? usedArea / (sheets.length * sheetArea) : 0,
  }
}
