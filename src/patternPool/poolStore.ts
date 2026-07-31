/**
 * Pattern Pool: kombinasyon → sonuç eşleşmesi.
 * Kapanan her sinyal (yön, tetikleyici tipi, confidence bandı, coin)
 * kombinasyonuyla havuza yazılır. Wilson score ile sıralanır.
 */

import { wilsonLowerBound } from '../evolution/wilsonScore'

export interface PatternKey {
  /** Sinyal yönü: 1=LONG, -1=SHORT */
  direction: number
  /** En güçlü tetikleyici bileşen tipi */
  dominantTrigger: string
  /** Confidence bandı: 'high' | 'mid' | 'low' */
  confidenceBand: string
  /** Coin sembolü (opsiyonel, coin-spesifik pattern için) */
  coin: string
}

export interface PatternEntry {
  /** Pattern anahtarı */
  key: PatternKey
  /** Toplam sinyal sayısı */
  total: number
  /** Başarılı sinyal sayısı */
  successes: number
  /** Ham başarı oranı */
  successRate: number
  /** Wilson alt sınırı */
  wilsonLower: number
  /** Ortalama R-multiple */
  avgRMultiple: number
  /** Son güncelleme zamanı */
  updatedAt: number
  /** Ortalama sonuç (%) */
  avgResult: number
}

const pool = new Map<string, PatternEntry>()

function keyToString(key: PatternKey): string {
  return `${key.direction}|${key.dominantTrigger}|${key.confidenceBand}|${key.coin}`
}

/** Hangi bileşenin dominant olduğunu belirle */
export function getDominantTrigger(scores: Record<string, number>): string {
  let maxAbs = 0
  let dominant = 'neutral'

  for (const [key, value] of Object.entries(scores)) {
    if (Math.abs(value) > maxAbs) {
      maxAbs = Math.abs(value)
      dominant = key
    }
  }

  return dominant
}

/** Confidence bandını belirle */
export function getConfidenceBand(confidence: number): 'high' | 'mid' | 'low' {
  if (confidence >= 0.7) return 'high'
  if (confidence >= 0.4) return 'mid'
  return 'low'
}

/**
 * Havuza yeni bir kapanmış sinyal ekle.
 */
export function addToPool(key: PatternKey, result: number, rMultiple: number): PatternEntry {
  const k = keyToString(key)
  const existing = pool.get(k)

  if (existing) {
    const total = existing.total + 1
    const successes = existing.successes + (result > 0 ? 1 : 0)
    const successRate = successes / total
    const wilsonLower = wilsonLowerBound(successes, total)
    const avgRMultiple = (existing.avgRMultiple * existing.total + rMultiple) / total
    const avgResult = (existing.avgResult * existing.total + result) / total

    const entry: PatternEntry = {
      key,
      total,
      successes,
      successRate,
      wilsonLower,
      avgRMultiple,
      updatedAt: Date.now(),
      avgResult,
    }
    pool.set(k, entry)
    return entry
  }

  const entry: PatternEntry = {
    key,
    total: 1,
    successes: result > 0 ? 1 : 0,
    successRate: result > 0 ? 1 : 0,
    wilsonLower: wilsonLowerBound(result > 0 ? 1 : 0, 1),
    avgRMultiple: rMultiple,
    updatedAt: Date.now(),
    avgResult: result,
  }
  pool.set(k, entry)
  return entry
}

/** Tüm havuzu al */
export function getPool(): PatternEntry[] {
  return [...pool.values()]
}

/** Wilson score'a göre sıralanmış havuz */
export function getRankedPool(minSamples = 3): PatternEntry[] {
  return [...pool.values()]
    .filter(e => e.total >= minSamples)
    .sort((a, b) => b.wilsonLower - a.wilsonLower)
}

/** Havuzu temizle */
export function clearPool(): void {
  pool.clear()
}

/** Havuzu dış veriyle yükle (DB'den geri yükleme için) */
export function loadPool(entries: PatternEntry[]): void {
  pool.clear()
  for (const e of entries) {
    pool.set(keyToString(e.key), e)
  }
}
