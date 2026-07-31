import React, { useEffect, useState } from 'react'
import { getPool, type PatternEntry } from '../../patternPool/poolStore'
import { rankPool } from '../../patternPool/ranking'
import { formatDirection, formatPercent } from '../../utils/format'

export const PatternPoolTable: React.FC = () => {
  const [patterns, setPatterns] = useState<PatternEntry[]>([])
  const [minSamples, setMinSamples] = useState(3)

  useEffect(() => {
    const interval = setInterval(() => {
      setPatterns(getPool())
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const ranked = rankPool(patterns, minSamples)

  if (ranked.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-3">🏊</div>
        <p className="text-[var(--color-text-secondary)]">Pattern havuzu boş</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Sinyaller kapandıkça başarılı pattern'ler burada sıralanacak
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center px-1">
        <span className="text-xs text-[var(--color-text-muted)]">
          {ranked.length} pattern (Wilson sıralı)
        </span>
        <select
          value={minSamples}
          onChange={(e) => setMinSamples(Number(e.target.value))}
          className="text-xs bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text-secondary)]"
        >
          <option value={1}>Min 1</option>
          <option value={3}>Min 3</option>
          <option value={5}>Min 5</option>
          <option value={10}>Min 10</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
              <th className="p-2 text-left">#</th>
              <th className="p-2 text-left">Yön</th>
              <th className="p-2 text-left">Tetikleyici</th>
              <th className="p-2 text-left">Güven</th>
              <th className="p-2 text-right">n</th>
              <th className="p-2 text-right">Başarı</th>
              <th className="p-2 text-right">Wilson ↓</th>
              <th className="p-2 text-right">R̄</th>
            </tr>
          </thead>
          <tbody>
            {ranked.slice(0, 30).map(({ entry, rank }) => (
              <tr
                key={`${entry.key.direction}-${entry.key.dominantTrigger}-${entry.key.confidenceBand}`}
                className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]"
              >
                <td className="p-2 text-[var(--color-text-muted)]">{rank}</td>
                <td className="p-2 font-bold">
                  <span
                    style={{
                      color:
                        entry.key.direction > 0
                          ? 'var(--color-signal-bullish)'
                          : 'var(--color-signal-bearish)',
                    }}
                  >
                    {formatDirection(entry.key.direction)}
                  </span>
                </td>
                <td className="p-2 text-[var(--color-text-secondary)]">
                  {entry.key.dominantTrigger}
                </td>
                <td className="p-2">{entry.key.confidenceBand}</td>
                <td className="p-2 text-right font-mono">{entry.total}</td>
                <td className="p-2 text-right font-mono">
                  {formatPercent(entry.successRate * 100, 0)}
                </td>
                <td
                  className="p-2 text-right font-mono font-bold"
                  style={{ color: 'var(--color-accent-primary)' }}
                >
                  {(entry.wilsonLower * 100).toFixed(1)}%
                </td>
                <td className="p-2 text-right font-mono">
                  {entry.avgRMultiple.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
