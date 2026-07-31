/**
 * Pattern Pool sıralama — Wilson score alt sınırına göre.
 * Düşük örneklemli kombinasyonların üste çıkmasını engeller.
 */

import type { PatternEntry } from './poolStore'

export interface RankingResult {
  entry: PatternEntry
  rank: number
  percentile: number
}

/**
 * Havuzu sırala ve sıralama metriklerini ekle.
 */
export function rankPool(entries: PatternEntry[], minSamples = 3): RankingResult[] {
  const filtered = entries.filter(e => e.total >= minSamples)
  const sorted = [...filtered].sort((a, b) => b.wilsonLower - a.wilsonLower)

  return sorted.map((entry, idx) => ({
    entry,
    rank: idx + 1,
    percentile: sorted.length > 0 ? (idx / sorted.length) * 100 : 100,
  }))
}

/**
 * En iyi N pattern'i al.
 */
export function getTopPatterns(entries: PatternEntry[], n = 10, minSamples = 3): PatternEntry[] {
  return entries
    .filter(e => e.total >= minSamples)
    .sort((a, b) => b.wilsonLower - a.wilsonLower)
    .slice(0, n)
}

/**
 * Belirli bir yön için en iyi pattern'leri al.
 */
export function getTopPatternsByDirection(
  entries: PatternEntry[],
  direction: number,
  n = 5,
  minSamples = 3,
): PatternEntry[] {
  return entries
    .filter(e => e.key.direction === direction && e.total >= minSamples)
    .sort((a, b) => b.wilsonLower - a.wilsonLower)
    .slice(0, n)
}
