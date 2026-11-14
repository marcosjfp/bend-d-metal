import { useDeferredValue, useMemo } from 'react'
import type { Analysis } from '../engine/bend'
import { nest, type SheetLayout } from '../engine/nesting'
import type { Part } from '../engine/types'
import type { AppState, Stock } from '../store'
import { NumberField, Segmented, fmt } from './fields'

interface Props {
  state: AppState
  analyses: Map<string, Analysis>
  setStock: (patch: Partial<Stock>) => void
  updatePartById: (id: string, patch: Partial<Part>) => void
}

const SHEETS: [number, number][] = [
  [2000, 1000],
  [2500, 1250],
  [3000, 1500],
  [4000, 2000],
]

const COLORS = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#ef4444', '#eab308', '#06b6d4', '#ec4899']

export function CutTab({ state, analyses, setStock, updatePartById }: Props) {
  const stock = state.stock
  const items = useMemo(
    () =>
      state.parts.map((p) => ({
        id: p.id,
        label: p.name || 'Untitled',
        w: Math.round((analyses.get(p.id)?.flatLength ?? 0) * 10) / 10,
        h: p.length,
        qty: p.qty,
      })),
    [state.parts, analyses],
  )
  const deferredItems = useDeferredValue(items)
  const deferredStock = useDeferredValue(stock)
  const result = useMemo(
    () =>
      nest(deferredItems, {
        sheetW: deferredStock.w,
        sheetH: deferredStock.h,
        kerf: deferredStock.kerf,
        margin: deferredStock.margin,
        allowRotate: deferredStock.allowRotate,
        mode: deferredStock.mode,
      }),
    [deferredItems, deferredStock],
  )
  const colorOf = (id: string) => COLORS[state.parts.findIndex((p) => p.id === id) % COLORS.length]
  const totalPcs = items.reduce((s, i) => s + i.qty, 0)

  return (
    <>
      <section className="card">
        <h2>Stock sheet</h2>
        <div className="chips">
          {SHEETS.map(([w, h]) => (
            <button
              key={`${w}x${h}`}
              type="button"
              className={`chip ${stock.w === w && stock.h === h ? 'on' : ''}`}
              onClick={() => setStock({ w, h })}
            >
              {w}×{h}
            </button>
          ))}
        </div>
        <div className="row2">
          <NumberField label="Sheet length" unit="mm" min={1} value={stock.w} onChange={(w) => setStock({ w })} />
          <NumberField label="Sheet width" unit="mm" min={1} value={stock.h} onChange={(h) => setStock({ h })} />
        </div>
        <div className="row2">
          <NumberField label="Kerf / gap" unit="mm" min={0} value={stock.kerf} onChange={(kerf) => setStock({ kerf })} />
          <NumberField label="Edge trim" unit="mm" min={0} value={stock.margin} onChange={(margin) => setStock({ margin })} />
        </div>
        <span className="field-label">Cutting with</span>
        <Segmented
          label="Cutting method"
          value={stock.mode}
          onChange={(mode) => setStock({ mode })}
          options={[
            { value: 'shear', label: 'Shear (straight cuts)' },
            { value: 'laser', label: 'Laser / plasma' },
          ]}
        />
        <label className="toggle">
          <input type="checkbox" checked={stock.allowRotate} onChange={(e) => setStock({ allowRotate: e.target.checked })} />
          <span>Allow rotating blanks (ignore grain direction)</span>
        </label>
      </section>

      <section className="card">
        <h2>Cut list</h2>
        <table className="cut-table">
          <thead>
            <tr>
              <th />
              <th>Part</th>
              <th>Blank (mm)</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            {state.parts.map((p) => {
              const it = items.find((i) => i.id === p.id)!
              return (
                <tr key={p.id}>
                  <td>
                    <span className="swatch" style={{ background: colorOf(p.id) }} />
                  </td>
                  <td>{it.label}</td>
                  <td>
                    {fmt(it.w)} × {fmt(it.h, 0)}
                  </td>
                  <td className="qty-cell">
                    <NumberField compact label="" min={0} value={p.qty} onChange={(qty) => updatePartById(p.id, { qty: Math.round(qty) })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Layout</h2>
          <span className="muted small">
            {result.placedCount}/{totalPcs} pcs
          </span>
        </div>
        <div className="summary">
          <div>
            <strong>{result.sheets.length}</strong>
            <span>sheet{result.sheets.length === 1 ? '' : 's'}</span>
          </div>
          <div>
            <strong>{fmt(result.utilization * 100, 0)}%</strong>
            <span>material used</span>
          </div>
          <div>
            <strong>{fmt((1 - result.utilization) * 100, 0)}%</strong>
            <span>offcut</span>
          </div>
        </div>
        {result.unplaced.map((u) => (
          <p key={u.id} className="issue error">
            ⛔ {u.count} × {u.label} do not fit on a {stock.w}×{stock.h} sheet.
          </p>
        ))}
        {result.sheets.map((s, i) => (
          <SheetView key={i} sheet={s} index={i} stock={stock} colorOf={colorOf} />
        ))}
      </section>
    </>
  )
}

function SheetView({ sheet, index, stock, colorOf }: { sheet: SheetLayout; index: number; stock: Stock; colorOf: (id: string) => string }) {
  const font = Math.min(stock.w, stock.h) / 16
  return (
    <figure className="sheet">
      <figcaption>
        Sheet {index + 1} · {sheet.placements.length} pcs · {fmt(sheet.utilization * 100, 0)}% used
      </figcaption>
      <svg viewBox={`0 0 ${stock.w} ${stock.h}`} role="img" aria-label={`Sheet ${index + 1} layout`}>
        <rect x={0} y={0} width={stock.w} height={stock.h} className="sheet-bg" />
        {sheet.placements.map((p, j) => {
          const tall = p.h > p.w * 1.5
          const along = tall ? p.h : p.w
          const across = tall ? p.w : p.h
          const fs = Math.min(font, along / 5, across / 2.2)
          const cx = p.x + p.w / 2
          const cy = p.y + p.h / 2
          return (
            <g key={j}>
              <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={colorOf(p.id)} className="piece" />
              {fs > font / 4 && (
                <text
                  x={cx}
                  y={cy}
                  fontSize={fs}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="piece-label"
                  transform={tall ? `rotate(-90 ${cx} ${cy})` : undefined}
                >
                  {fmt(p.rotated ? p.h : p.w, 0)}×{fmt(p.rotated ? p.w : p.h, 0)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
