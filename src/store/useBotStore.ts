/**
 * Ana bot state'i: bağlantı durumu, çalışıyor/durdu, aktif sinyaller.
 */

import { create } from 'zustand'

export interface ActiveSignal {
  symbol: string
  direction: number          // 1=LONG, -1=SHORT
  score: number              // kompozit skor (-100..+100)
  confidence: number         // 0..1
  price: number
  timestamp: number
  components: {
    cvdScore: number
    obiScore: number
    liquidationScore: number
    fundingScore: number
    momentumScore: number
    volumeScore: number
  }
}

export type BotStatus = 'idle' | 'running' | 'paused'
export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

interface BotState {
  // Bot durumu
  botStatus: BotStatus
  setBotStatus: (status: BotStatus) => void

  // WS bağlantı durumları
  marketWsStatus: WsStatus
  publicWsStatus: WsStatus
  setMarketWsStatus: (status: WsStatus) => void
  setPublicWsStatus: (status: WsStatus) => void

  // Aktif sinyaller (son 50)
  activeSignals: ActiveSignal[]
  addSignal: (signal: ActiveSignal) => void
  clearSignals: () => void

  // Takip edilen coinler
  trackedCoins: string[]
  setTrackedCoins: (coins: string[]) => void

  // Sinyal sayacı
  signalCount: number
  incrementSignalCount: () => void
  resetSignalCount: () => void

  // Son hata
  lastError: string | null
  setLastError: (error: string | null) => void
}

export const useBotStore = create<BotState>((set) => ({
  botStatus: 'idle',
  setBotStatus: (botStatus) => set({ botStatus }),

  marketWsStatus: 'disconnected',
  publicWsStatus: 'disconnected',
  setMarketWsStatus: (marketWsStatus) => set({ marketWsStatus }),
  setPublicWsStatus: (publicWsStatus) => set({ publicWsStatus }),

  activeSignals: [],
  addSignal: (signal) => set((state) => {
    const signals = [signal, ...state.activeSignals].slice(0, 50)
    return { activeSignals: signals, signalCount: state.signalCount + 1 }
  }),
  clearSignals: () => set({ activeSignals: [] }),

  trackedCoins: [],
  setTrackedCoins: (trackedCoins) => set({ trackedCoins }),

  signalCount: 0,
  incrementSignalCount: () => set((s) => ({ signalCount: s.signalCount + 1 })),
  resetSignalCount: () => set({ signalCount: 0 }),

  lastError: null,
  setLastError: (lastError) => set({ lastError }),
}))
