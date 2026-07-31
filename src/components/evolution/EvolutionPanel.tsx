import React from 'react'
import { useEvolutionStore } from '../../store/useEvolutionStore'
import { StatCard } from '../common/StatCard'

export const EvolutionPanel: React.FC = () => {
  const selectedCoin = useEvolutionStore((s) => s.selectedCoin)
  const populations = useEvolutionStore((s) => s.populations)
  const totalCycles = useEvolutionStore((s) => s.totalCycles)
  const rollbackCount = useEvolutionStore((s) => s.rollbackCount)
  const fitnessHistory = useEvolutionStore((s) => s.fitnessHistory)

  const gen = selectedCoin ? populations.get(selectedCoin) : undefined

  if (!selectedCoin || !gen) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-3">🧬</div>
        <p className="text-[var(--color-text-secondary)]">Evrim henüz başlamadı</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Sinyal üretildikçe popülasyon optimize edilecek
        </p>
      </div>
    )
  }

  const best = gen.best
  const fitness = best.fitness

  return (
    <div className="flex flex-col gap-3">
      {/* Özet kartları */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="🧬 Nesil"
          value={`#${gen.number}`}
          subValue={`${gen.individuals.length} birey`}
        />
        <StatCard
          label="📊 Fitness"
          value={fitness ? `${(fitness.fitness * 100).toFixed(1)}%` : '-'}
          subValue={fitness ? `WL: ${(fitness.wilsonAdjustedRate * 100).toFixed(1)}%` : '-'}
          color="var(--color-accent-primary)"
        />
        <StatCard
          label="🔄 Döngü"
          value={totalCycles}
          subValue={`${rollbackCount} rollback`}
        />
        <StatCard
          label="✅ Başarı"
          value={fitness ? `${fitness.successfulSignals}/${fitness.totalSignals}` : '0/0'}
          subValue={fitness ? `%${(fitness.successRate * 100).toFixed(0)}` : '-'}
          color="var(--color-success)"
        />
      </div>

      {/* En iyi birey parametreleri */}
      <div className="card p-3">
        <h3 className="text-sm font-bold mb-2 text-[var(--color-accent-primary)]">
          🏆 En İyi Birey Parametreleri
        </h3>
        <div className="grid grid-cols-2 gap-1 text-xs font-mono">
          <ParamRow label="CVD Ağırlık" value={best.weightCvd} />
          <ParamRow label="OBI Ağırlık" value={best.weightObi} />
          <ParamRow label="Likidasyon" value={best.weightLiquidation} />
          <ParamRow label="Funding" value={best.weightFunding} />
          <ParamRow label="Momentum" value={best.weightMomentum} />
          <ParamRow label="Hacim" value={best.weightVolume} />
          <ParamRow label="Eşik" value={best.signalThreshold} isInt />
          <ParamRow label="Histerezis" value={best.hysteresisConfirmations} isInt />
        </div>
      </div>

      {/* Fitness geçmişi */}
      {fitnessHistory.length > 0 && (
        <div className="card p-3">
          <h3 className="text-sm font-bold mb-2 text-[var(--color-accent-primary)]">
            📈 Fitness Geçmişi
          </h3>
          <div className="flex items-end gap-1 h-20">
            {fitnessHistory.slice(0, 30).reverse().map((entry, i) => (
              <div
                key={i}
                className="flex-1 rounded-t"
                style={{
                  height: `${Math.max(4, entry.fitness * 100)}%`,
                  background: 'var(--color-accent-primary)',
                  opacity: 0.6 + entry.fitness * 0.4,
                }}
                title={`Nesil #${entry.generation}: ${(entry.fitness * 100).toFixed(1)}%`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const ParamRow: React.FC<{ label: string; value: number; isInt?: boolean }> = ({
  label,
  value,
  isInt,
}) => (
  <div className="flex justify-between">
    <span className="text-[var(--color-text-muted)]">{label}</span>
    <span className="text-[var(--color-text-primary)]">
      {isInt ? value.toFixed(0) : value.toFixed(3)}
    </span>
  </div>
)
