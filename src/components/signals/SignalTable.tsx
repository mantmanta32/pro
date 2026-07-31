import React from 'react'
import { SignalRow } from './SignalRow'
import { useBotStore } from '../../store/useBotStore'

export const SignalTable: React.FC = () => {
  const signals = useBotStore((s) => s.activeSignals)
  const signalCount = useBotStore((s) => s.signalCount)

  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-3">📡</div>
        <p className="text-[var(--color-text-secondary)]">Henüz sinyal yok</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Bot çalışmaya başladığında sinyaller burada görünecek
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center px-1 mb-1">
        <span className="text-xs text-[var(--color-text-muted)]">
          Toplam {signalCount} sinyal
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          Son {signals.length} gösteriliyor
        </span>
      </div>
      {signals.map((signal) => (
        <SignalRow key={`${signal.symbol}-${signal.timestamp}`} signal={signal} />
      ))}
    </div>
  )
}
