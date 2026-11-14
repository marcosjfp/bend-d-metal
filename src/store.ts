import { useEffect, useState } from 'react'
import { DEFAULT_MACHINE, DEFAULT_MATERIALS, newPart } from './engine/defaults'
import type { Machine, Material, Part } from './engine/types'

export interface Stock {
  w: number
  h: number
  kerf: number
  margin: number
  allowRotate: boolean
  mode: 'laser' | 'shear'
}

export interface AppState {
  version: 1
  machine: Machine
  materials: Material[]
  parts: Part[]
  activeId: string
  stock: Stock
}

const KEY = 'bend-d-metal:v1'

export const DEFAULT_STOCK: Stock = { w: 3000, h: 1500, kerf: 0, margin: 5, allowRotate: true, mode: 'shear' }

export function initialState(): AppState {
  const p = newPart('U channel')
  return {
    version: 1,
    machine: { ...DEFAULT_MACHINE },
    materials: DEFAULT_MATERIALS.map((m) => ({ ...m })),
    parts: [p],
    activeId: p.id,
    stock: { ...DEFAULT_STOCK },
  }
}

/** Sample job shown on first launch so new users see every feature with real data. */
export function exampleState(): AppState {
  const c = {
    ...newPart('C channel'),
    thickness: 2,
    length: 2000,
    qty: 24,
    flanges: [15, 50, 100, 50, 15],
    bends: [
      { angle: 90, dir: 'up' as const },
      { angle: 90, dir: 'up' as const },
      { angle: 90, dir: 'up' as const },
      { angle: 90, dir: 'up' as const },
    ],
  }
  const angle = { ...newPart('Angle bracket'), thickness: 3, length: 1000, qty: 40, flanges: [50, 50], bends: [{ angle: 90, dir: 'up' as const }] }
  const hat = {
    ...newPart('Hat profile'),
    thickness: 1.5,
    length: 2500,
    qty: 12,
    flanges: [25, 40, 60, 40, 25],
    bends: [
      { angle: 90, dir: 'down' as const },
      { angle: 90, dir: 'up' as const },
      { angle: 90, dir: 'up' as const },
      { angle: 90, dir: 'down' as const },
    ],
  }
  return { ...initialState(), parts: [c, angle, hat], activeId: c.id }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as Partial<AppState>
      if (s.version === 1 && Array.isArray(s.parts) && s.parts.length) {
        const base = initialState()
        return {
          ...base,
          ...s,
          machine: { ...base.machine, ...s.machine },
          stock: { ...base.stock, ...s.stock },
          materials: s.materials?.length ? s.materials : base.materials,
        } as AppState
      }
    }
  } catch {
    /* corrupted storage: start fresh */
  }
  return exampleState()
}

export function useAppState() {
  const [state, setState] = useState<AppState>(load)
  useEffect(() => {
    const id = setTimeout(() => localStorage.setItem(KEY, JSON.stringify(state)), 250)
    return () => clearTimeout(id)
  }, [state])
  return [state, setState] as const
}
