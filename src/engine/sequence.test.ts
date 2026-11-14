import { describe, expect, it } from 'vitest'
import { DEFAULT_MACHINE, newPart } from './defaults'
import { evaluateSequence, planSequence, pose, currentAngles } from './sequence'
import type { Part } from './types'

const up = { angle: 90, dir: 'up' as const }

describe('pose', () => {
  it('puts the bend at the origin with both arms rising after a 90° up bend', () => {
    const part: Part = { ...newPart(), flanges: [50, 50], bends: [up] }
    const pts = pose(part, currentAngles(part, new Set(), 0, 1), 0, false)
    expect(pts[1].x).toBeCloseTo(0)
    expect(pts[1].y).toBeCloseTo(0)
    expect(pts[0].y).toBeGreaterThan(30)
    expect(pts[2].y).toBeGreaterThan(30)
    expect(pts[0].x).toBeLessThan(0)
    expect(pts[2].x).toBeGreaterThan(0)
  })

  it('turns a down bend over so its inside still faces the punch', () => {
    const part: Part = { ...newPart(), flanges: [50, 50], bends: [{ angle: 90, dir: 'down' }] }
    const pts = pose(part, currentAngles(part, new Set(), 0, 1), 0, false)
    expect(pts[0].y).toBeGreaterThan(30)
    expect(pts[2].y).toBeGreaterThan(30)
  })
})

describe('sequence', () => {
  it('finds a collision-free order for a normal U channel', () => {
    const part: Part = { ...newPart(), thickness: 2, flanges: [40, 120, 40], bends: [up, up] }
    const plan = planSequence(part, DEFAULT_MACHINE, 16)
    expect(plan.feasible).toBe(true)
    expect(plan.order).toHaveLength(2)
  })

  it('detects the tools hitting a deep narrow U', () => {
    const part: Part = { ...newPart(), thickness: 2, flanges: [150, 30, 150], bends: [up, up] }
    const steps = evaluateSequence(part, DEFAULT_MACHINE, 16, [0, 1])
    expect(steps[0].hit).toBeNull()
    expect(['punch', 'upper beam']).toContain(steps[1].hit?.where)
    expect(planSequence(part, DEFAULT_MACHINE, 16).feasible).toBe(false)
  })

  it('counts turn-overs for a Z profile', () => {
    const part: Part = { ...newPart(), thickness: 2, flanges: [40, 80, 40], bends: [up, { angle: 90, dir: 'down' }] }
    const plan = planSequence(part, DEFAULT_MACHINE, 16)
    expect(plan.feasible).toBe(true)
    expect(plan.turnOvers).toBe(1)
  })
})
