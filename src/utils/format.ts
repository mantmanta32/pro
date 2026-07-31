/**
 * Fiyat/yüzde formatlama (tr-TR locale).
 */

const LOCALE = 'tr-TR'

/** Fiyat formatla: 12.345,67 */
export function formatPrice(value: number, decimals = 2): string {
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Yüzde formatla: %12,34 */
export function formatPercent(value: number, decimals = 2): string {
  return `%${value.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: 'exceptZero',
  })}`
}

/** Yüzde değişim (renkli, işaretli) */
export function formatChange(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`
}

/** Hacim formatla (K, M, B) */
export function formatVolume(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

/** USDT formatla */
export function formatUsdt(value: number): string {
  if (value >= 1_000_000) return `$${formatVolume(value)}`
  return `$${value.toLocaleString(LOCALE, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

/** Skor formatla (renkli) */
export function formatScore(value: number): string {
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  })
}

/** Confidence formatla */
export function formatConfidence(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

/** Sinyal yönü emoji + metin */
export function formatDirection(direction: number): string {
  if (direction > 0) return '🟢 LONG'
  if (direction < 0) return '🔴 SHORT'
  return '⚪ NÖTR'
}
