import { useEffect, useState, type ReactNode } from 'react'

export const fmt = (n: number, d = 1) => (Number.isFinite(n) ? (Math.round(n * 10 ** d) / 10 ** d).toString() : '–')

export function parseNum(s: string): number {
  return parseFloat(s.replace(',', '.'))
}

interface NumberFieldProps {
  label: ReactNode
  value: number
  onChange: (n: number) => void
  unit?: string
  min?: number
  max?: number
  className?: string
  compact?: boolean
}

/** Numeric input tuned for phones: decimal keypad, accepts comma decimals, 16px font (no iOS zoom). */
export function NumberField({ label, value, onChange, unit, min, max, className, compact }: NumberFieldProps) {
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)
  const [bad, setBad] = useState(false)

  useEffect(() => {
    if (!focused) {
      setText(String(value))
      setBad(false)
    }
  }, [value, focused])

  return (
    <label className={`field ${compact ? 'field-compact' : ''} ${className ?? ''}`}>
      <span className="field-label">{label}</span>
      <span className={`field-input ${bad ? 'bad' : ''}`}>
        <input
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={text}
          onFocus={(e) => {
            setFocused(true)
            e.target.select()
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          onChange={(e) => {
            setText(e.target.value)
            const n = parseNum(e.target.value)
            const ok = Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)
            setBad(!ok)
            if (ok) onChange(n)
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </span>
    </label>
  )
}

interface SegmentedProps<T extends string> {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label?: string
}

export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chips({ values, onPick, current, suffix = '' }: { values: number[]; onPick: (v: number) => void; current?: number; suffix?: string }) {
  return (
    <div className="chips">
      {values.map((v) => (
        <button key={v} type="button" className={`chip ${v === current ? 'on' : ''}`} onClick={() => onPick(v)}>
          {v}
          {suffix}
        </button>
      ))}
    </div>
  )
}
