/**
 * IndexedDB açma + şema tanımı (idb wrapper).
 *
 * Object Store'lar:
 * - signals: kapanmış sinyaller
 * - patternPool: pattern havuzu girdileri
 * - paramGenerations: evrim nesilleri (her coin için)
 * - coinPerformance: coin bazlı performans
 */

import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'evrimsel-sinyal-botu'
const DB_VERSION = 1

export interface SignalRecord {
  id?: number
  symbol: string
  direction: number
  entryPrice: number
  exitPrice: number
  result: number
  rMultiple: number
  confidence: number
  dominantTrigger: string
  confidenceBand: string
  timestamp: number
  individualId: string
}

export interface PatternPoolRecord {
  id?: string
  direction: number
  dominantTrigger: string
  confidenceBand: string
  coin: string
  total: number
  successes: number
  successRate: number
  wilsonLower: number
  avgRMultiple: number
  avgResult: number
  updatedAt: number
}

export interface GenerationRecord {
  id?: string
  coin: string
  generation: number
  individuals: any // serialized Individual[]
  best: any
  avgFitness: number
  timestamp: number
}

export interface CoinPerformanceRecord {
  id?: string
  symbol: string
  totalSignals: number
  successfulSignals: number
  totalReturn: number
  avgRMultiple: number
  lastSignalTime: number
  updatedAt: number
}

let dbInstance: IDBPDatabase | null = null

export async function getDb(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Sinyaller
      if (!db.objectStoreNames.contains('signals')) {
        const signalsStore = db.createObjectStore('signals', {
          keyPath: 'id',
          autoIncrement: true,
        })
        signalsStore.createIndex('symbol', 'symbol')
        signalsStore.createIndex('timestamp', 'timestamp')
        signalsStore.createIndex('individualId', 'individualId')
      }

      // Pattern Pool
      if (!db.objectStoreNames.contains('patternPool')) {
        const poolStore = db.createObjectStore('patternPool', { keyPath: 'id' })
        poolStore.createIndex('coin', 'coin')
        poolStore.createIndex('wilsonLower', 'wilsonLower')
      }

      // Nesiller
      if (!db.objectStoreNames.contains('paramGenerations')) {
        const genStore = db.createObjectStore('paramGenerations', {
          keyPath: 'id',
        })
        genStore.createIndex('coin', 'coin')
        genStore.createIndex('generation', 'generation')
      }

      // Coin performans
      if (!db.objectStoreNames.contains('coinPerformance')) {
        db.createObjectStore('coinPerformance', { keyPath: 'symbol' })
      }
    },
  })

  return dbInstance
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
