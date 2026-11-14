import type { Machine, Material, Part } from './types'

/** Data taken from the machine nameplate: Ermaksan Speed-Bend Pro 4270×260 (2023). Tooling values are typical defaults — edit them to match your shop. */
export const DEFAULT_MACHINE: Machine = {
  name: 'Ermaksan Speed-Bend Pro 4270×260',
  serial: '00031861-ERH',
  maxLength: 4270,
  capacityTon: 260,
  approachSpeed: 140,
  vOpenings: [6, 8, 10, 12, 16, 20, 24, 30, 35, 40, 50, 60, 80, 100, 120, 160],
  punchType: 'straight',
  punchAngle: 88,
  punchRadius: 1,
  punchHeight: 120,
  dieHeight: 100,
  toolLoadLimit: 100,
}

export const DEFAULT_MATERIALS: Material[] = [
  { id: 's235', name: 'Mild steel S235', tensile: 430, radiusFactor: 0.16, density: 7.85 },
  { id: 's355', name: 'Structural steel S355', tensile: 530, radiusFactor: 0.17, density: 7.85 },
  { id: 'dx51', name: 'Galvanized DX51D', tensile: 380, radiusFactor: 0.16, density: 7.85 },
  { id: 'ss304', name: 'Stainless 304', tensile: 620, radiusFactor: 0.21, density: 7.93 },
  { id: 'al5754', name: 'Aluminium 5754-H22', tensile: 230, radiusFactor: 0.14, density: 2.67 },
]

let counter = 0
export function newId(): string {
  counter += 1
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function newPart(name = 'New part'): Part {
  return {
    id: newId(),
    name,
    materialId: 's235',
    thickness: 3,
    length: 1000,
    qty: 1,
    flanges: [50, 100, 50],
    bends: [
      { angle: 90, dir: 'up' },
      { angle: 90, dir: 'up' },
    ],
    vOverride: null,
    sequence: null,
  }
}

export interface Template {
  name: string
  flanges: number[]
  bends: { angle: number; dir: 'up' | 'down' }[]
}

export const TEMPLATES: Template[] = [
  { name: 'L angle', flanges: [50, 50], bends: [{ angle: 90, dir: 'up' }] },
  {
    name: 'U channel',
    flanges: [50, 100, 50],
    bends: [
      { angle: 90, dir: 'up' },
      { angle: 90, dir: 'up' },
    ],
  },
  {
    name: 'Z profile',
    flanges: [40, 80, 40],
    bends: [
      { angle: 90, dir: 'up' },
      { angle: 90, dir: 'down' },
    ],
  },
  {
    name: 'Hat',
    flanges: [25, 40, 60, 40, 25],
    bends: [
      { angle: 90, dir: 'down' },
      { angle: 90, dir: 'up' },
      { angle: 90, dir: 'up' },
      { angle: 90, dir: 'down' },
    ],
  },
  {
    name: 'C with lips',
    flanges: [15, 50, 100, 50, 15],
    bends: [
      { angle: 90, dir: 'up' },
      { angle: 90, dir: 'up' },
      { angle: 90, dir: 'up' },
      { angle: 90, dir: 'up' },
    ],
  },
]
