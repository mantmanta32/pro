/**
 * Sinyal kayıtları repository'si.
 */

import { getDb } from '../db'
import type { SignalRecord } from '../db'

export async function saveSignal(record: SignalRecord): Promise<number> {
  const db = await getDb()
  return db.add('signals', record) as Promise<number>
}

export async function getSignalsBySymbol(symbol: string, limit = 100): Promise<SignalRecord[]> {
  const db = await getDb()
  const index = db.transaction('signals').store.index('symbol')
  const results: SignalRecord[] = []
  let cursor = await index.openCursor(IDBKeyRange.only(symbol), 'prev')

  while (cursor && results.length < limit) {
    results.push(cursor.value)
    cursor = await cursor.continue()
  }

  return results
}

export async function getSignalsByIndividual(individualId: string): Promise<SignalRecord[]> {
  const db = await getDb()
  return db.getAllFromIndex('signals', 'individualId', individualId)
}

export async function getRecentSignals(limit = 50): Promise<SignalRecord[]> {
  const db = await getDb()
  return db.getAllFromIndex('signals', 'timestamp', undefined, limit)
}

export async function getSignalCount(): Promise<number> {
  const db = await getDb()
  return db.count('signals')
}
