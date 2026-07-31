/**
 * Fitness fonksiyonu: başarı oranı + R-multiple + drawdown + Wilson alt sınır.
 * Gerçek istatistiksel anlamlılık için minimum 30 kapanmış sinyal şartı.
 */

import { evolutionConfig } from '../config/evolutionConfig'
import { wilsonLowerBound } from './wilsonScore'

export interface ClosedSignal {
  symbol: string
  direction: number        // 1=LONG, -1=SHORT
  entryPrice: number
  exitPrice: number
  result: number           // % kar/zarar
  rMultiple: number        // R-multiple (kar / risk)
  timestamp: number
}

export interface FitnessResult {
  /** Toplam fitness skoru (0..1) */
  fitness: number
  /** Başarı oranı (ham) */
  successRate: number
  /** Wilson alt sınırı ile düzeltilmiş başarı oranı */
  wilsonAdjustedRate: number
  /** Ortalama R-multiple */
  avgRMultiple: number
  /** Maksimum drawdown (%) */
  maxDrawdown: number
  /** Toplam sinyal sayısı */
  totalSignals: number
  /** Başarılı sinyal sayısı */
  successfulSignals: number
  /** Minimum örneklem karşılandı mı? */
  hasMinSamples: boolean
  /** Toplam kâr (%) */
  totalReturn: number
}

/**
 * Bir parametre setinin fitness değerini hesaplar.
 * @param signals - kapanmış sinyaller listesi
 * @returns FitnessResult
 */
export function computeFitness(signals: ClosedSignal[]): FitnessResult {
  const totalSignals = signals.length
  const hasMinSamples = totalSignals >= evolutionConfig.minClosedSignals

  if (totalSignals === 0) {
    return {
      fitness: 0,
      successRate: 0,
      wilsonAdjustedRate: 0,
      avgRMultiple: 0,
      maxDrawdown: 0,
      totalSignals: 0,
      successfulSignals: 0,
      hasMinSamples: false,
      totalReturn: 0,
    }
  }

  // Başarı oranı
  const successfulSignals = signals.filter(s => s.result > 0).length
  const successRate = successfulSignals / totalSignals

  // Wilson düzeltmesi
  const wilsonAdjustedRate = wilsonLowerBound(successfulSignals, totalSignals, evolutionConfig.wilsonZ)

  // Ortalama R-multiple
  const avgRMultiple = signals.reduce((sum, s) => sum + s.rMultiple, 0) / totalSignals

  // Maksimum drawdown
  let peak = 0
  let cumulative = 0
  let maxDrawdown = 0
  for (const s of signals) {
    cumulative += s.result
    peak = Math.max(peak, cumulative)
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative)
  }

  // Toplam return
  const totalReturn = signals.reduce((sum, s) => sum + s.result, 0)

  // Fitness hesapla
  const { fitnessWeights } = evolutionConfig

  // Drawdown ters ağırlıklı: düşük drawdown → yüksek skor
  const drawdownScore = maxDrawdown > 0
    ? Math.max(0, 1 - maxDrawdown / 100)
    : 1

  // Örneklem bonusu: minSamples'tan sonra logaritmik büyür
  const sampleBonus = Math.min(1, Math.log2(totalSignals + 1) / Math.log2(evolutionConfig.minClosedSignals * 2 + 1))

  // R-multiple normalize (beklenen aralık -3..+3)
  const rNorm = Math.max(0, Math.min(1, (avgRMultiple + 3) / 6))

  const fitness =
    successRate * fitnessWeights.successRate +
    rNorm * fitnessWeights.avgRMultiple +
    wilsonAdjustedRate * fitnessWeights.wilsonLowerBound +
    drawdownScore * fitnessWeights.maxDrawdown +
    sampleBonus * fitnessWeights.sampleCount

  return {
    fitness: Math.max(0, Math.min(1, fitness)),
    successRate,
    wilsonAdjustedRate,
    avgRMultiple,
    maxDrawdown,
    totalSignals,
    successfulSignals,
    hasMinSamples,
    totalReturn,
  }
}

/**
 * R-multiple hesapla: entry/exit fiyat ve yöne göre
 */
export function computeRMultiple(
  direction: number,
  entryPrice: number,
  exitPrice: number,
  stopLossPct: number = evolutionConfig.defaultStopLossPct,
): number {
  const risk = entryPrice * (stopLossPct / 100)
  const reward = (exitPrice - entryPrice) * direction
  return risk > 0 ? reward / risk : 0
}
