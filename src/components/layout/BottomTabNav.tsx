import React from 'react'

export type Tab = 'signals' | 'evolution' | 'patterns' | 'settings'

interface BottomTabNavProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'signals', label: 'Sinyaller', icon: '📡' },
  { id: 'evolution', label: 'Evrim', icon: '🧬' },
  { id: 'patterns', label: 'Pattern', icon: '🏊' },
  { id: 'settings', label: 'Ayarlar', icon: '⚙️' },
]

export const BottomTabNav: React.FC<BottomTabNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t"
      style={{
        background: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex-1 flex flex-col items-center justify-center py-2 px-1 transition-colors"
            style={{
              color: isActive
                ? 'var(--color-accent-primary)'
                : 'var(--color-text-muted)',
              borderTop: isActive
                ? '2px solid var(--color-accent-primary)'
                : '2px solid transparent',
            }}
          >
            <span className="text-lg">{tab.icon}</span>
            <span className="text-[10px] font-medium mt-0.5">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
