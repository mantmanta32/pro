/**
 * VPIN-benzeri gate: düşük likidite / düşük örneklem durumunda
 * güven skorunu otomatik bastırır.
 *
 * Wilson score alt sınırı kullanarak düşük örneklemli
 * durumlarda yapay yüksek güveni engeller.
 */

import { wilsonLowerBound } from '../evolution/wilsonScore'

export interface VpinGateInput {
  /** Toplam tick/olay sayısı */
  sampleCount: number
  /** Toplam hacim (USDT) */
  totalVolume: number
  /** Başarılı sinyal sayısı (varsa) */
  successCount?: number
  /** Minimum gerekli örneklem */
  minSamples?: number
  /** Minimum gerekli hacim */
  minVolume?: number
}

export interface VpinGateResult {
  /** Geçti mi? */
  passed: boolean
  /** Bastırma faktörü (0..1), 1 = bastırma yok */
  suppressionFactor: number
  /** Wilson-tabanlı düzeltilmiş güven */
  adjustedConfidence: number
  /** Reddetme sebebi (boş = geçti) */
  reason: string
}

const DEFAULT_MIN_SAMPLES = 5
const DEFAULT_MIN_VOLUME = 10000 // 10K USDT

/**
 * VPIN gate: düşük örneklem/hacim durumunda güveni bastır.
 */
export function applyVpinGate(
  input: VpinGateInput,
  rawConfidence: number,
): VpinGateResult {
  const minSamples = input.minSamples ?? DEFAULT_MIN_SAMPLES
  const minVolume = input.minVolume ?? DEFAULT_MIN_VOLUME

  // Hacim kontrolü
  if (input.totalVolume < minVolume) {
    const factor = Math.sqrt(input.totalVolume / minVolume)
    return {
      passed: false,
      suppressionFactor: factor,
      adjustedConfidence: rawConfidence * factor,
      reason: `Düşük hacim (${input.totalVolume.toFixed(0)} < ${minVolume})`,
    }
  }

  // Örneklem kontrolü
  if (input.sampleCount < minSamples) {
    const factor = Math.sqrt(input.sampleCount / minSamples)
    return {
      passed: false,
      suppressionFactor: factor,
      adjustedConfidence: rawConfidence * factor,
      reason: `Düşük örneklem (${input.sampleCount} < ${minSamples})`,
    }
  }

  // Wilson score düzeltmesi (başarı verisi varsa)
  if (input.successCount !== undefined && input.sampleCount > 0) {
    const successRate = input.successCount / input.sampleCount
    const wilsonLower = wilsonLowerBound(input.successCount, input.sampleCount)
    const adjustment = wilsonLower / Math.max(successRate, 0.01)

    return {
      passed: true,
      suppressionFactor: Math.min(1, adjustment),
      adjustedConfidence: rawConfidence * Math.min(1, adjustment),
      reason: '',
    }
  }

  return {
    passed: true,
    suppressionFactor: 1,
    adjustedConfidence: rawConfidence,
    reason: '',
  }
}
