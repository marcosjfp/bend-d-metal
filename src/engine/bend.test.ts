import { describe, expect, it } from 'vitest'
import { analyzePart, bendDeduction, chooseV, kFactor, tonPerMeter } from './bend'
import { DEFAULT_MACHINE, newPart } from './defaults'
import type { Material } from './types'

const steel: Material = { id: 'x', name: 'Steel', tensile: 450, radiusFactor: 0.16 }

describe('force', () => {
  it('matches the 1.42·Rm·t²/V rule', () => {
    // 6 mm, V48, 450 MPa → 479 kN/m ≈ 48.9 t/m
    expect(tonPerMeter(450, 6, 48)).toBeCloseTo(48.87, 1)
    // 10 mm, V80 → ≈ 81.5 t/m → only ~3.19 m at 260 t
    expect(260 / tonPerMeter(450, 10, 80)).toBeCloseTo(3.19, 1)
  })
})

describe('k-factor', () => {
  it('is clamped and grows with r/t', () => {
    expect(kFactor(0.1, 3)).toBe(0.25)
    expect(kFactor(30, 3)).toBe(0.5)
    expect(kFactor(3, 3)).toBeCloseTo(0.325)
  })
})

describe('bend deduction', () => {
  it('is zero-ish for a flat "bend" and ~2t for a 90° bend', () => {
    expect(bendDeduction(180, 3, 3, 0.33)).toBeCloseTo(0)
    const bd = bendDeduction(90, 3.84, 3, kFactor(3.84, 3))
    expect(bd).toBeGreaterThan(5.5)
    expect(bd).toBeLessThan(6.5)
  })
})

describe('analyzePart', () => {
  it('computes a 3 mm 50/50 L-angle blank around 94 mm on V24', () => {
    const p = { ...newPart(), thickness: 3, flanges: [50, 50], bends: [{ angle: 90, dir: 'up' as const }] }
    const a = analyzePart(p, steel, DEFAULT_MACHINE)
    expect(a.v).toBe(24)
    expect(a.flatLength).toBeGreaterThan(93)
    expect(a.flatLength).toBeLessThan(95)
    expect(a.issues.filter((i) => i.level === 'error')).toHaveLength(0)
  })

  it('flags parts longer than the machine', () => {
    const p = { ...newPart(), length: 5000 }
    const a = analyzePart(p, steel, DEFAULT_MACHINE)
    expect(a.issues.some((i) => i.level === 'error' && i.text.includes('4270'))).toBe(true)
  })

  it('flags over-capacity bends (10 mm × 4 m on V80)', () => {
    const p = { ...newPart(), thickness: 10, length: 4000, flanges: [100, 100], bends: [{ angle: 90, dir: 'up' as const }], vOverride: 80 }
    const a = analyzePart(p, steel, DEFAULT_MACHINE)
    expect(a.totalTon).toBeGreaterThan(260)
    expect(a.issues.some((i) => i.level === 'error' && i.text.includes('260 t'))).toBe(true)
  })

  it('flags a flange that is too short for the die', () => {
    const p = { ...newPart(), thickness: 6, flanges: [20, 100], bends: [{ angle: 90, dir: 'up' as const }], vOverride: 50 }
    const a = analyzePart(p, steel, DEFAULT_MACHINE)
    expect(a.issues.some((i) => i.level === 'error' && i.text.startsWith('Flange 1'))).toBe(true)
  })
})

describe('chooseV', () => {
  it('picks a smaller die when a flange is short', () => {
    const p = { ...newPart(), thickness: 3, flanges: [12, 100], bends: [{ angle: 90, dir: 'up' as const }] }
    const { v } = chooseV(p, steel, DEFAULT_MACHINE)
    expect(v * 0.7).toBeLessThanOrEqual(12)
  })
  it('prefers a wider die when the force would exceed capacity', () => {
    const p = { ...newPart(), thickness: 10, length: 4000, flanges: [150, 150], bends: [{ angle: 90, dir: 'up' as const }] }
    const { v } = chooseV(p, steel, DEFAULT_MACHINE)
    expect(tonPerMeter(450, 10, v) * 4).toBeLessThanOrEqual(260)
  })
})
