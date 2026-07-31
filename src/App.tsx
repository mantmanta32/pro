import { useState, useEffect, useRef, useCallback } from 'react'
import { Header } from './components/layout/Header'
import { BottomTabNav, type Tab } from './components/layout/BottomTabNav'
import { SignalTable } from './components/signals/SignalTable'
import { EvolutionPanel } from './components/evolution/EvolutionPanel'
import { GenerationChart } from './components/evolution/GenerationChart'
import { PatternPoolTable } from './components/patternPool/PatternPoolTable'
import { SettingsPanel } from './components/settings/SettingsPanel'
import { useBotStore } from './store/useBotStore'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('signals')
  const botStatus = useBotStore((s) => s.botStatus)
  const setBotStatus = useBotStore((s) => s.setBotStatus)
  const addSignal = useBotStore((s) => s.addSignal)
  const setMarketWsStatus = useBotStore((s) => s.setMarketWsStatus)
  const setLastError = useBotStore((s) => s.setLastError)

  const engineRef = useRef<any>(null)
  const marketSocketRef = useRef<any>(null)
  const publicSocketRef = useRef<any>(null)

  // Bot başlat/durdur
  const toggleBot = useCallback(() => {
    if (botStatus === 'running') {
      // Durdur
      setBotStatus('idle')
      marketSocketRef.current?.disconnect?.()
      publicSocketRef.current?.disconnect?.()
      engineRef.current?.reset?.()
    } else {
      // Başlat
      setBotStatus('running')

      // Dinamik import ile engine ve socket'leri yükle
      import('./signals/signalEngine').then(({ createSignalEngine }) => {
        const engine = createSignalEngine({
          onSignal: (signal) => addSignal(signal),
          onStatusChange: (status: string) => setMarketWsStatus(status as 'connecting' | 'connected' | 'disconnected' | 'reconnecting'),
          onError: (err: string) => setLastError(err),
        })
        engineRef.current = engine

        return import('./data/ws/useMarketSocket')
      }).then(({ createMarketSocket }) => {
        const marketSocket = createMarketSocket({
          onTicker: (data) => engineRef.current?.handleTicker(data),
          onAggTrade: (data) => engineRef.current?.handleAggTrade(data),
          onKline: () => {},
          onForceOrder: (data) => engineRef.current?.handleForceOrder(data),
          onStatusChange: (status) => setMarketWsStatus(status),
          onError: (err) => setLastError(err),
        })
        marketSocketRef.current = marketSocket
        marketSocket.connect()
      }).catch((err: unknown) => {
        console.error('Bot başlatılamadı:', err)
        setLastError('Bot başlatılamadı: ' + (err as Error).message)
        setBotStatus('idle')
      })
    }
  }, [botStatus, setBotStatus, addSignal, setMarketWsStatus, setLastError])

  // Cleanup
  useEffect(() => {
    return () => {
      marketSocketRef.current?.disconnect?.()
      publicSocketRef.current?.disconnect?.()
    }
  }, [])

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <Header onToggleBot={toggleBot} />

      <main className="flex-1 px-3 py-3 pb-20 overflow-y-auto">
        {activeTab === 'signals' && <SignalTable />}
        {activeTab === 'evolution' && (
          <div className="flex flex-col gap-3">
            <EvolutionPanel />
            <GenerationChart />
          </div>
        )}
        {activeTab === 'patterns' && <PatternPoolTable />}
        {activeTab === 'settings' && <SettingsPanel />}
      </main>

      <BottomTabNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
