/**
 * Evrim state'i: popülasyon, nesil sayacı, fitness geçmişi.
 * Her coin için ayrı popülasyon tutulur.
 */

import { create } from 'zustand'
import type { Generation } from '../evolution/population'

interface EvolutionState {
  /** Coin → Generation map */
  populations: Map<string, Generation>
  /** Aktif izlenen coin (UI'da gösterilen) */
  selectedCoin: string | null
  /** Toplam evrim döngü sayısı */
  totalCycles: number
  /** Rollback sayısı */
  rollbackCount: number
  /** Fitness geçmişi (son N değer) */
  fitnessHistory: { coin: string; generation: number; fitness: number; timestamp: number }[]

  setPopulation: (coin: string, generation: Generation) => void
  getPopulation: (coin: string) => Generation | undefined
  setSelectedCoin: (coin: string | null) => void
  incrementCycles: () => void
  incrementRollbacks: () => void
  addFitnessEntry: (entry: { coin: string; generation: number; fitness: number; timestamp: number }) => void
  clearAll: () => void
}

export const useEvolutionStore = create<EvolutionState>((set, get) => ({
  populations: new Map(),
  selectedCoin: null,
  totalCycles: 0,
  rollbackCount: 0,
  fitnessHistory: [],

  setPopulation: (coin, generation) => set((state) => {
    const newMap = new Map(state.populations)
    newMap.set(coin, generation)
    return { populations: newMap }
  }),

  getPopulation: (coin) => get().populations.get(coin),

  setSelectedCoin: (selectedCoin) => set({ selectedCoin }),

  incrementCycles: () => set((s) => ({ totalCycles: s.totalCycles + 1 })),

  incrementRollbacks: () => set((s) => ({ rollbackCount: s.rollbackCount + 1 })),

  addFitnessEntry: (entry) => set((s) => ({
    fitnessHistory: [entry, ...s.fitnessHistory].slice(0, 200),
  })),

  clearAll: () => set({
    populations: new Map(),
    selectedCoin: null,
    totalCycles: 0,
    rollbackCount: 0,
    fitnessHistory: [],
  }),
}))
