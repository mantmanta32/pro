import React from 'react'

interface StatusBadgeProps {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'idle' | 'running' | 'paused'
}

const statusConfig: Record<string, { label: string; bg: string; dot: string }> = {
  connected: { label: 'Bağlı', bg: '#1a3a1a', dot: '#7ee0a0' },
  disconnected: { label: 'Bağlı Değil', bg: '#3a1a1a', dot: '#f08080' },
  connecting: { label: 'Bağlanıyor', bg: '#3a3a1a', dot: '#e0c070' },
  reconnecting: { label: 'Yeniden Bağlanıyor', bg: '#3a2a1a', dot: '#e0c070' },
  running: { label: 'Çalışıyor', bg: '#1a3a1a', dot: '#7ee0a0' },
  paused: { label: 'Duraklatıldı', bg: '#3a3a1a', dot: '#e0c070' },
  idle: { label: 'Bekliyor', bg: '#2a2a2a', dot: '#888' },
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status] || statusConfig.idle
  return (
    <span
      className="badge inline-flex items-center gap-1.5"
      style={{ background: config.bg }}
    >
      <span
        className="w-2 h-2 rounded-full inline-block"
        style={{ background: config.dot }}
      />
      {config.label}
    </span>
  )
}
