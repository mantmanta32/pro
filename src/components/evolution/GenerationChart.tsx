import React from 'react'
import { useEvolutionStore } from '../../store/useEvolutionStore'

export const GenerationChart: React.FC = () => {
  const fitnessHistory = useEvolutionStore((s) => s.fitnessHistory)
  const selectedCoin = useEvolutionStore((s) => s.selectedCoin)

  const coinHistory = fitnessHistory
    .filter((e) => e.coin === selectedCoin)
    .slice(0, 50)
    .reverse()

  if (coinHistory.length < 2) {
    return null
  }

  const maxFit = Math.max(...coinHistory.map((e) => e.fitness), 0.3)
  const minFit = Math.min(...coinHistory.map((e) => e.fitness), 0)

  return (
    <div className="card p-3">
      <h3 className="text-sm font-bold mb-2 text-[var(--color-accent-primary)]">
        Fitness Trendi
      </h3>
      <div className="relative h-16">
        <svg
          viewBox={`0 0 ${coinHistory.length} 100`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          <polyline
            points={coinHistory
              .map((e, i) => {
                const x = i
                const y = 100 - ((e.fitness - minFit) / (maxFit - minFit || 0.01)) * 90 - 5
                return `${x},${y}`
              })
              .join(' ')}
            fill="none"
            stroke="var(--color-accent-primary)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1">
        <span>Nesil #{coinHistory[0]?.generation || 0}</span>
        <span>Nesil #{coinHistory[coinHistory.length - 1]?.generation || 0}</span>
      </div>
    </div>
  )
}
