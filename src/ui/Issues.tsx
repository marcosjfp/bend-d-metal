import type { Issue } from '../engine/types'

const ICON = { error: '⛔', warn: '⚠️', info: 'ℹ️' } as const

export function Issues({ issues }: { issues: Issue[] }) {
  if (!issues.length) return <p className="issue ok">✅ Fits the machine and tooling.</p>
  const sorted = [...issues].sort((a, b) => rank(a.level) - rank(b.level))
  return (
    <ul className="issues">
      {sorted.map((i, k) => (
        <li key={k} className={`issue ${i.level}`}>
          <span aria-hidden>{ICON[i.level]}</span> {i.text}
        </li>
      ))}
    </ul>
  )
}

const rank = (l: Issue['level']) => (l === 'error' ? 0 : l === 'warn' ? 1 : 2)
