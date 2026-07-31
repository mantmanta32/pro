import React from 'react'
import { ConfidenceBadge } from './ConfidenceBadge'
import { formatPrice, formatScore, formatDirection } from '../../utils/format'
import { timeAgo } from '../../utils/time'
import type { ActiveSignal } from '../../store/useBotStore'

interface SignalRowProps {
  signal: ActiveSignal
}

export const SignalRow: React.FC<SignalRowProps> = ({ signal }) => {
  const isBullish = signal.direction > 0
  const borderColor = isBullish
    ? 'var(--color-signal-bullish)'
    : 'var(--color-signal-bearish)'

  return (
    <div
      className="card p-3 flex items-center gap-3"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      {/* Yön */}
      <div className="flex-shrink-0 text-sm font-bold" style={{ color: borderColor }}>
        {formatDirection(signal.direction)}
      </div>

      {/* Sembol & Fiyat */}
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">{signal.symbol}</div>
        <div className="text-xs text-[var(--color-text-secondary)] font-mono">
          {formatPrice(signal.price)} · {timeAgo(signal.timestamp)}
        </div>
      </div>

      {/* Skor */}
      <div className="text-right flex-shrink-0">
        <div className="font-mono font-bold text-sm">{formatScore(signal.score)}</div>
        <div className="mt-0.5">
          <ConfidenceBadge confidence={signal.confidence} />
        </div>
      </div>
    </div>
  )
}
