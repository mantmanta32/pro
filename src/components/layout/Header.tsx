import React from 'react'
import { StatusBadge } from '../common/StatusBadge'
import { useBotStore } from '../../store/useBotStore'

interface HeaderProps {
  onToggleBot: () => void
}

export const Header: React.FC<HeaderProps> = ({ onToggleBot }) => {
  const botStatus = useBotStore((s) => s.botStatus)
  const marketWsStatus = useBotStore((s) => s.marketWsStatus)
  const signalCount = useBotStore((s) => s.signalCount)

  const isRunning = botStatus === 'running'

  return (
    <header
      className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
      style={{
        background: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold" style={{ color: 'var(--color-accent-primary)' }}>
          Evrimsel Sinyal Botu
        </h1>
        <span className="text-xs text-[var(--color-text-muted)] hidden sm:inline">
          v2.0
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          <StatusBadge status={marketWsStatus} />
          {signalCount > 0 && (
            <span className="text-xs text-[var(--color-text-muted)] font-mono">
              {signalCount} sinyal
            </span>
          )}
        </div>

        <button
          onClick={onToggleBot}
          className="btn-primary text-sm"
          style={{
            background: isRunning
              ? 'var(--color-danger)'
              : 'var(--color-accent-primary)',
          }}
        >
          {isRunning ? '⏹ Durdur' : '▶ Başlat'}
        </button>
      </div>
    </header>
  )
}
