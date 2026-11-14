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
  return initialState()
}

export function useAppState() {
  const [state, setState] = useState<AppState>(load)
  useEffect(() => {
    const id = setTimeout(() => localStorage.setItem(KEY, JSON.stringify(state)), 250)
    return () => clearTimeout(id)
  }, [state])
  return [state, setState] as const
}
