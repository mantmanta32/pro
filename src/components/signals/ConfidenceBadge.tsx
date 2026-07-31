import React from 'react'

interface ConfidenceBadgeProps {
  confidence: number  // 0..1
  wilsonAdjusted?: number
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ confidence, wilsonAdjusted }) => {
  const displayConf = wilsonAdjusted ?? confidence
  const pct = (displayConf * 100).toFixed(0)

  let color: string
  let label: string

  if (displayConf >= 0.7) {
    color = 'var(--color-confidence-high)'
    label = 'Yüksek'
  } else if (displayConf >= 0.4) {
    color = 'var(--color-confidence-mid)'
    label = 'Orta'
  } else {
    color = 'var(--color-confidence-low)'
    label = 'Düşük'
  }

  return (
    <span
      className="badge font-mono"
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {label} · %{pct}
    </span>
  )
}
