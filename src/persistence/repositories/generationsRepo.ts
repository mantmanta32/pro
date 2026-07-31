/**
 * Evrim nesilleri repository'si.
 * Her coin için ayrı popülasyon saklanır.
 */

import { getDb } from '../db'
import type { GenerationRecord } from '../db'

export async function saveGeneration(record: GenerationRecord): Promise<void> {
  const db = await getDb()
  record.id = `${record.coin}-gen-${record.generation}`
  await db.put('paramGenerations', record)
}

export async function getLatestGeneration(coin: string): Promise<GenerationRecord | undefined> {
  const db = await getDb()
  const index = db.transaction('paramGenerations').store.index('coin')
  const cursor = await index.openCursor(IDBKeyRange.only(coin), 'prev')
  return cursor?.value
}

export async function getGenerationsByCoin(coin: string, limit = 20): Promise<GenerationRecord[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('paramGenerations', 'coin', coin)
  return all
    .sort((a, b) => b.generation - a.generation)
    .slice(0, limit)
}

export async function getAllGenerations(): Promise<GenerationRecord[]> {
  const db = await getDb()
  return db.getAll('paramGenerations')
}

export async function clearGenerations(coin?: string): Promise<void> {
  const db = await getDb()
  if (coin) {
    const all = await db.getAllFromIndex('paramGenerations', 'coin', coin)
    for (const r of all) {
      if (r.id) await db.delete('paramGenerations', r.id)
    }
  } else {
    await db.clear('paramGenerations')
  }
}

// Coin Performance
export async function saveCoinPerformance(record: {
  symbol: string
  totalSignals: number
  successfulSignals: number
  totalReturn: number
  avgRMultiple: number
  lastSignalTime: number
  updatedAt: number
}): Promise<void> {
  const db = await getDb()
  await db.put('coinPerformance', record)
}

export async function getCoinPerformance(symbol: string): Promise<any | undefined> {
  const db = await getDb()
  return db.get('coinPerformance', symbol)
}

export async function getAllCoinPerformance(): Promise<any[]> {
  const db = await getDb()
  return db.getAll('coinPerformance')
}
