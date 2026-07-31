import React from 'react'
import { useBotStore } from '../../store/useBotStore'
import { useEvolutionStore } from '../../store/useEvolutionStore'
import { StatusBadge } from '../common/StatusBadge'
import { evolutionConfig } from '../../config/evolutionConfig'

export const SettingsPanel: React.FC = () => {
  const botStatus = useBotStore((s) => s.botStatus)
  const marketWsStatus = useBotStore((s) => s.marketWsStatus)
  const publicWsStatus = useBotStore((s) => s.publicWsStatus)
  const signalCount = useBotStore((s) => s.signalCount)
  const trackedCoins = useBotStore((s) => s.trackedCoins)
  const totalCycles = useEvolutionStore((s) => s.totalCycles)
  const rollbackCount = useEvolutionStore((s) => s.rollbackCount)
  const lastError = useBotStore((s) => s.lastError)

  return (
    <div className="flex flex-col gap-3">
      {/* Durum */}
      <div className="card p-3">
        <h3 className="text-sm font-bold mb-2 text-[var(--color-accent-primary)]">
          📡 Bağlantı Durumu
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">Bot:</span>
            <StatusBadge status={botStatus === 'running' ? 'running' : 'idle'} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">Market WS:</span>
            <StatusBadge status={marketWsStatus} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">Public WS:</span>
            <StatusBadge status={publicWsStatus} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">Sinyaller:</span>
            <span className="font-mono">{signalCount}</span>
          </div>
        </div>
      </div>

      {/* Evrim */}
      <div className="card p-3">
        <h3 className="text-sm font-bold mb-2 text-[var(--color-accent-primary)]">
          🧬 Evrim Konfigürasyonu
        </h3>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <ConfigRow label="Popülasyon" value={evolutionConfig.populationSize} />
          <ConfigRow label="Elitizm" value={evolutionConfig.elitismCount} />
          <ConfigRow label="Mutasyon Oranı" value={`${(evolutionConfig.mutationRate * 100).toFixed(0)}%`} />
          <ConfigRow label="Min Sinyal" value={evolutionConfig.minClosedSignals} />
          <ConfigRow label="Rollback Eşiği" value={`${(evolutionConfig.rollbackThreshold * 100).toFixed(0)}%`} />
          <ConfigRow label="Döngü" value={totalCycles} />
          <ConfigRow label="Rollback" value={rollbackCount} />
          <ConfigRow label="Takip Edilen" value={trackedCoins.length > 0 ? `${trackedCoins.length} coin` : '-'} />
        </div>
      </div>

      {/* Veri Kaynakları */}
      <div className="card p-3">
        <h3 className="text-sm font-bold mb-2 text-[var(--color-accent-primary)]">
          🔗 Veri Kaynakları
        </h3>
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-muted)]">Market Stream:</span>
            <span className="font-mono text-[var(--color-text-secondary)]">!ticker@arr, !forceOrder@arr</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-muted)]">Public Stream:</span>
            <span className="font-mono text-[var(--color-text-secondary)]">depth@100ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-muted)]">Borsa:</span>
            <span className="text-[var(--color-success)]">Binance Futures</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-muted)]">Çoklu Borsa:</span>
            <span className="text-[var(--color-text-muted)]">v2'de gelecek</span>
          </div>
        </div>
      </div>

      {/* Hata */}
      {lastError && (
        <div
          className="card p-3"
          style={{ borderColor: 'var(--color-danger)' }}
        >
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-danger)' }}>
            ⚠️ Hata
          </h3>
          <p className="text-xs text-[var(--color-danger)]">{lastError}</p>
        </div>
      )}

      {/* Versiyon */}
      <div className="text-center text-[10px] text-[var(--color-text-muted)] py-4">
        Evrimsel Sinyal Botu v2.0 · Binance Futures · Pastel Pembe-Mor Tema · {new Date().getFullYear()}
      </div>
    </div>
  )
}

const ConfigRow: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex justify-between">
    <span className="text-[var(--color-text-muted)]">{label}</span>
    <span className="font-mono text-[var(--color-text-secondary)]">{value}</span>
  </div>
)
