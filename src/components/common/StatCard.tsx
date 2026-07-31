import React from 'react'

interface StatCardProps {
  label: string
  value: string | number
  subValue?: string
  color?: string
  icon?: string
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, subValue, color, icon }) => (
  <div className="card p-3 flex flex-col gap-1 min-w-[100px]">
    <span className="text-xs text-[var(--color-text-muted)]">
      {icon && <span className="mr-1">{icon}</span>}
      {label}
    </span>
    <span
      className="text-lg font-bold font-mono"
      style={{ color: color || 'var(--color-text-primary)' }}
    >
      {value}
    </span>
    {subValue && (
      <span className="text-xs text-[var(--color-text-secondary)]">{subValue}</span>
    )}
  </div>
)
