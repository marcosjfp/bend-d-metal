import { describe, expect, it } from 'vitest'
import { nest, type NestOptions, type Placement } from './nesting'

const base: NestOptions = { sheetW: 3000, sheetH: 1500, kerf: 0, margin: 0, allowRotate: true, mode: 'laser' }

function overlaps(a: Placement, b: Placement) {
  return a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6
}

function assertValid(sheets: { placements: Placement[] }[], o: NestOptions) {
  for (const s of sheets) {
    for (const p of s.placements) {
      expect(p.x).toBeGreaterThanOrEqual(o.margin - 1e-6)
      expect(p.y).toBeGreaterThanOrEqual(o.margin - 1e-6)
      expect(p.x + p.w).toBeLessThanOrEqual(o.sheetW - o.margin + 1e-6)
      expect(p.y + p.h).toBeLessThanOrEqual(o.sheetH - o.margin + 1e-6)
    }
    for (let i = 0; i < s.placements.length; i++)
      for (let j = i + 1; j < s.placements.length; j++) expect(overlaps(s.placements[i], s.placements[j])).toBe(false)
  }
}

describe('nest', () => {
  for (const mode of ['laser', 'shear'] as const) {
    it(`packs exactly 4 quarter sheets on one sheet (${mode})`, () => {
      const r = nest([{ id: 'a', label: 'A', w: 1500, h: 750, qty: 4 }], { ...base, mode })
      expect(r.sheets).toHaveLength(1)
      expect(r.utilization).toBeCloseTo(1)
    })

    it(`never overlaps or leaves the sheet, with kerf and margin (${mode})`, () => {
      const o = { ...base, mode, kerf: 3, margin: 10 }
      const r = nest(
        [
          { id: 'a', label: 'A', w: 194, h: 1000, qty: 9 },
          { id: 'b', label: 'B', w: 420, h: 600, qty: 7 },
          { id: 'c', label: 'C', w: 90, h: 2500, qty: 5 },
        ],
        o,
      )
      expect(r.placedCount).toBe(21)
      assertValid(r.sheets, o)
      for (const s of r.sheets)
        for (let i = 0; i < s.placements.length; i++)
          for (let j = i + 1; j < s.placements.length; j++) {
            const a = s.placements[i]
            const b = s.placements[j]
            const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w))
            const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h))
            expect(Math.max(gapX, gapY)).toBeGreaterThanOrEqual(3 - 1e-6)
          }
    })
  }

  it('reports blanks that are larger than the sheet', () => {
    const r = nest([{ id: 'big', label: 'Big', w: 3200, h: 1600, qty: 2 }], base)
    expect(r.placedCount).toBe(0)
    expect(r.unplaced[0].count).toBe(2)
  })

  it('uses rotation when allowed', () => {
    const r = nest([{ id: 'r', label: 'R', w: 1400, h: 2900, qty: 1 }], base)
    expect(r.placedCount).toBe(1)
    expect(r.sheets[0].placements[0].rotated).toBe(true)
    const r2 = nest([{ id: 'r', label: 'R', w: 1400, h: 2900, qty: 1 }], { ...base, allowRotate: false })
    expect(r2.placedCount).toBe(0)
  })
})

describe('nest quality', () => {
  it('fits 40 × 188×1000 blanks on two 3000×1500 sheets when shearing', () => {
    // 15 upright + 6 crosswise = 21 per sheet without edge trim
    const r = nest([{ id: 'u', label: 'U', w: 188, h: 1000, qty: 40 }], { ...base, margin: 0, mode: 'shear' })
    expect(r.placedCount).toBe(40)
    expect(r.sheets).toHaveLength(2)
  })

  it('puts at least 19 per sheet with a 5 mm edge trim', () => {
    const r = nest([{ id: 'u', label: 'U', w: 188, h: 1000, qty: 40 }], { ...base, margin: 5, mode: 'shear' })
    expect(r.sheets[0].placements.length).toBeGreaterThanOrEqual(19)
  })
})
