/**
 * Soket sessizlik takibi (watchdog).
 * N saniye boyunca hiç mesaj gelmezse otomatik reconnect callback'ini çağırır.
 */

export interface WatchdogConfig {
  /** Sessizlik eşiği (ms) — bu sürede mesaj gelmezse tetiklenir */
  silenceThresholdMs: number
  /** Tetiklendiğinde çağrılacak reconnect fonksiyonu */
  onTimeout: () => void
}

export function createWatchdog(config: WatchdogConfig) {
  let timer: ReturnType<typeof setTimeout> | null = null

  function feed(): void {
    clear()
    timer = setTimeout(() => {
      console.warn('[Watchdog] Sessizlik eşiği aşıldı, reconnect tetikleniyor...')
      config.onTimeout()
    }, config.silenceThresholdMs)
  }

  function clear(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function destroy(): void {
    clear()
  }

  return { feed, clear, destroy }
}

export type Watchdog = ReturnType<typeof createWatchdog>
