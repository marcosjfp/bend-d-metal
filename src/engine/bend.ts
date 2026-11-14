import type { Issue, Machine, Material, Part } from './types'

export const DEG = Math.PI / 180
export const KN_PER_TON = 9.80665

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Recommended V-opening / thickness ratio for air bending. */
export function targetRatio(t: number): number {
  if (t < 3) return 6
  if (t <= 10) return 8
  if (t <= 20) return 10
  return 12
}

/** Shortest flange (outside dimension) that still rests safely on a die of opening V. */
export function minFlangeFor(v: number): number {
  return 0.7 * v
}

/** K-factor from the r/t ratio (DIN 6935 correction, expressed as K = k/2). */
export function kFactor(r: number, t: number): number {
  return clamp(0.325 + 0.25 * Math.log10(r / t), 0.25, 0.5)
}

/** Air-bending force for a 90° bend, kN per metre of bend length. */
export function forcePerMeterKN(tensile: number, t: number, v: number): number {
  return (1.42 * tensile * t * t) / v
}

export function tonPerMeter(tensile: number, t: number, v: number): number {
  return forcePerMeterKN(tensile, t, v) / KN_PER_TON
}

export function innerRadius(v: number, mat: Material, punchRadius: number): number {
  return Math.max(mat.radiusFactor * v, punchRadius)
}

/**
 * Bend deduction for outside (mold-line) dimensions.
 * flat = sum(outside flange dims) − sum(bend deductions)
 */
export function bendDeduction(includedAngle: number, r: number, t: number, k: number): number {
  const beta = (180 - includedAngle) * DEG
  const ossb = Math.tan(beta / 2) * (r + t)
  const ba = beta * (r + k * t)
  return 2 * ossb - ba
}

export interface VChoice {
  v: number
  auto: boolean
}

export function chooseV(part: Part, mat: Material, machine: Machine): VChoice {
  if (part.vOverride && part.vOverride > 0) return { v: part.vOverride, auto: false }
  const t = part.thickness
  const target = targetRatio(t) * t
  const opts = [...machine.vOpenings].filter((v) => v > 0).sort((a, b) => a - b)
  if (opts.length === 0) return { v: Math.round(target), auto: true }
  const shortest = Math.min(part.flanges[0] ?? Infinity, part.flanges[part.flanges.length - 1] ?? Infinity)
  const lengthM = part.length / 1000
  const dist = (v: number) => Math.abs(Math.log(v / target))
  const byTarget = (a: number, b: number) => dist(a) - dist(b)

  const flangeOk = (v: number) => part.bends.length === 0 || minFlangeFor(v) <= shortest
  const ratioOk = (v: number) => v / t >= 5 && v / t <= 14
  const forceOk = (v: number) => {
    const tpm = tonPerMeter(mat.tensile, t, v)
    return tpm <= machine.toolLoadLimit && tpm * lengthM <= machine.capacityTon
  }

  const tiers = [
    opts.filter((v) => flangeOk(v) && ratioOk(v) && forceOk(v)),
    opts.filter((v) => flangeOk(v) && forceOk(v)),
    opts.filter((v) => flangeOk(v)),
    opts,
  ]
  for (const tier of tiers) {
    if (tier.length) return { v: [...tier].sort(byTarget)[0], auto: true }
  }
  return { v: opts[0], auto: true }
}

export interface Analysis {
  v: number
  vAuto: boolean
  ratio: number
  radius: number
  k: number
  deductions: number[]
  flatLength: number
  tonPerMeter: number
  totalTon: number
  loadPct: number
  /** Longest bend this setup can do at full machine capacity, mm */
  maxLengthAtCapacity: number
  minFlange: number
  issues: Issue[]
}

const fmt = (n: number, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toString()

export function analyzePart(part: Part, mat: Material, machine: Machine): Analysis {
  const issues: Issue[] = []
  const t = part.thickness
  const { v, auto } = chooseV(part, mat, machine)
  const radius = innerRadius(v, mat, machine.punchRadius)
  const k = kFactor(radius, Math.max(t, 0.01))
  const deductions = part.bends.map((b) => bendDeduction(b.angle, radius, t, k))
  const flatLength = part.flanges.reduce((s, f) => s + f, 0) - deductions.reduce((s, d) => s + d, 0)
  const tpm = tonPerMeter(mat.tensile, t, v)
  const totalTon = part.bends.length ? tpm * (part.length / 1000) : 0
  const loadPct = (totalTon / machine.capacityTon) * 100
  const minFlange = minFlangeFor(v)
  const maxLengthAtCapacity = (machine.capacityTon / tpm) * 1000

  if (!(t > 0)) issues.push({ level: 'error', text: 'Thickness must be greater than 0.' })
  if (!(part.length > 0)) issues.push({ level: 'error', text: 'Bend length must be greater than 0.' })
  if (part.flanges.some((f) => !(f > 0))) issues.push({ level: 'error', text: 'Every flange needs a length greater than 0.' })

  if (part.length > machine.maxLength) {
    issues.push({
      level: 'error',
      text: `Part is ${fmt(part.length, 0)} mm long — the machine bends at most ${machine.maxLength} mm.`,
    })
  }

  if (part.bends.length) {
    if (totalTon > machine.capacityTon) {
      issues.push({
        level: 'error',
        text: `Needs ${fmt(totalTon)} t but the machine has ${machine.capacityTon} t. Max length with this setup: ${fmt(maxLengthAtCapacity, 0)} mm, or use a wider V.`,
      })
    } else if (loadPct > 85) {
      issues.push({ level: 'warn', text: `Uses ${fmt(loadPct, 0)}% of machine capacity — little margin for harder material.` })
    }

    if (tpm > machine.toolLoadLimit) {
      issues.push({
        level: 'error',
        text: `${fmt(tpm)} t/m exceeds the tooling rating (${machine.toolLoadLimit} t/m).`,
      })
    }
    const evenLoad = machine.capacityTon / (machine.maxLength / 1000)
    if (tpm > evenLoad && totalTon <= machine.capacityTon) {
      issues.push({
        level: 'warn',
        text: `Concentrated load ${fmt(tpm)} t/m is above the evenly spread rating (${fmt(evenLoad)} t/m). Bend in the centre of the machine.`,
      })
    }

    const ratio = v / t
    if (ratio < 5) issues.push({ level: 'warn', text: `V is only ${fmt(ratio)}× the thickness — very high force and risk of cracking.` })
    if (ratio > 14) issues.push({ level: 'warn', text: `V is ${fmt(ratio)}× the thickness — large radius and less accurate angles.` })

    const last = part.flanges.length - 1
    part.flanges.forEach((f, i) => {
      if (!(f > 0)) return
      const outer = i === 0 || i === last
      if (f < minFlange) {
        issues.push({
          level: outer ? 'error' : 'warn',
          text: outer
            ? `Flange ${i + 1} (${fmt(f)} mm) is shorter than the minimum ${fmt(minFlange)} mm for V${v}. It will fall into the die.`
            : `Flange ${i + 1} (${fmt(f)} mm) is shorter than ${fmt(minFlange)} mm — it may not rest on the die shoulders for the next bend.`,
        })
      }
    })

    part.bends.forEach((b, i) => {
      if (!(b.angle > 0 && b.angle < 180)) {
        issues.push({ level: 'error', text: `Bend ${i + 1}: angle must be between 1° and 179°.` })
      } else if (b.angle < machine.punchAngle) {
        issues.push({
          level: 'warn',
          text: `Bend ${i + 1} (${b.angle}°) is sharper than the ${machine.punchAngle}° punch — you need an acute punch and die.`,
        })
      }
    })
  }

  return {
    v,
    vAuto: auto,
    ratio: v / t,
    radius,
    k,
    deductions,
    flatLength,
    tonPerMeter: tpm,
    totalTon,
    loadPct,
    maxLengthAtCapacity,
    minFlange,
    issues,
  }
}
