export type BendDir = 'up' | 'down'

/** A bend between two flanges. `angle` is the finished included angle in degrees (90 = right angle). */
export interface Bend {
  angle: number
  dir: BendDir
}

export interface Part {
  id: string
  name: string
  materialId: string
  /** Sheet thickness, mm */
  thickness: number
  /** Bend length (along the bend line), mm */
  length: number
  qty: number
  /** Outside dimensions of each flange, mm. flanges.length === bends.length + 1 */
  flanges: number[]
  bends: Bend[]
  /** Force a specific V-die opening (mm). null = choose automatically. */
  vOverride: number | null
  /** Bend order chosen by the user (indices into `bends`). null = use suggested order. */
  sequence: number[] | null
}

export interface Material {
  id: string
  name: string
  /** Tensile strength Rm, MPa (N/mm²) */
  tensile: number
  /** Air-bending inner radius as a fraction of the V opening (ri ≈ factor × V) */
  radiusFactor: number
  /** Density, g/cm³ (used for blank weight) */
  density?: number
}

export type PunchType = 'straight' | 'gooseneck'

export interface Machine {
  name: string
  serial: string
  /** Max bending length, mm */
  maxLength: number
  /** Press force, metric tons */
  capacityTon: number
  /** Approach speed, mm/s */
  approachSpeed: number
  /** V-die openings available in the shop, mm */
  vOpenings: number[]
  punchType: PunchType
  /** Punch tip angle, degrees */
  punchAngle: number
  /** Punch tip radius, mm */
  punchRadius: number
  /** Punch height below the clamp, mm */
  punchHeight: number
  /** Die block height, mm */
  dieHeight: number
  /** Rated load of the tooling, t/m */
  toolLoadLimit: number
}

export type Level = 'error' | 'warn' | 'info'

export interface Issue {
  level: Level
  text: string
}

export interface Pt {
  x: number
  y: number
}
