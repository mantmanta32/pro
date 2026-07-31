/**
 * Pattern Pool repository'si.
 */

import { getDb } from '../db'
import type { PatternPoolRecord } from '../db'

function makeId(record: PatternPoolRecord): string {
  return `${record.direction}|${record.dominantTrigger}|${record.confidenceBand}|${record.coin}`
}

export async function savePattern(record: PatternPoolRecord): Promise<void> {
  const db = await getDb()
  record.id = makeId(record)
  await db.put('patternPool', record)
}

export async function getAllPatterns(): Promise<PatternPoolRecord[]> {
  const db = await getDb()
  return db.getAll('patternPool')
}

export async function getPatternsByCoin(coin: string): Promise<PatternPoolRecord[]> {
  const db = await getDb()
  return db.getAllFromIndex('patternPool', 'coin', coin)
}

export async function getTopPatterns(limit = 20): Promise<PatternPoolRecord[]> {
  const db = await getDb()
  const all = await db.getAll('patternPool')
  return all.sort((a, b) => b.wilsonLower - a.wilsonLower).slice(0, limit)
}

export async function clearPatternPool(): Promise<void> {
  const db = await getDb()
  await db.clear('patternPool')
}
