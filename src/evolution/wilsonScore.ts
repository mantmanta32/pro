/**
 * Wilson Score alt sınırı (lower bound).
 * Küçük örneklemlerde yapay yüksek güveni engeller.
 *
 * Wilson alt sınır = (p + z²/2n - z*√(p(1-p)/n + z²/4n²)) / (1 + z²/n)
 *
 * Burada:
 * - p = başarı sayısı / toplam (success rate)
 * - n = toplam örneklem
 * - z = güven aralığı z-skoru (1.96 = %95 güven)
 */

const DEFAULT_Z = 1.96

/**
 * Wilson score alt sınırı hesaplar.
 * @param successes - başarılı gözlem sayısı
 * @param total - toplam gözlem sayısı
 * @param z - z-skoru (varsayılan 1.96 = %95 güven)
 * @returns 0..1 arası düzeltilmiş başarı oranı
 */
export function wilsonLowerBound(
  successes: number,
  total: number,
  z: number = DEFAULT_Z,
): number {
  if (total === 0) return 0

  const p = successes / total
  const z2 = z * z
  const n = total

  // Wilson score lower bound formülü
  const numerator = p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)
  const denominator = 1 + z2 / n

  return Math.max(0, Math.min(1, numerator / denominator))
}

/**
 * Wilson score üst sınırı.
 */
export function wilsonUpperBound(
  successes: number,
  total: number,
  z: number = DEFAULT_Z,
): number {
  if (total === 0) return 1

  const p = successes / total
  const z2 = z * z
  const n = total

  const numerator = p + z2 / (2 * n) + z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)
  const denominator = 1 + z2 / n

  return Math.max(0, Math.min(1, numerator / denominator))
}

/**
 * Wilson score merkez tahmini.
 */
export function wilsonCenter(
  successes: number,
  total: number,
  z: number = DEFAULT_Z,
): number {
  if (total === 0) return 0.5
  const p = successes / total
  const z2 = z * z
  const n = total
  return (p + z2 / (2 * n)) / (1 + z2 / n)
}
