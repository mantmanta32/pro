/**
 * Zaman formatlama yardımcıları.
 */

const LOCALE = 'tr-TR'

/** ISO timestamp'i okunabilir zamana çevir */
export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Zaman farkını "Xs önce" formatında göster */
export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5) return 'az önce'
  if (seconds < 60) return `${seconds}s önce`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}d önce`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}s önce`
  const days = Math.floor(hours / 24)
  return `${days}g önce`
}

/** Tarih formatla */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
