/**
 * Exponential backoff: 1s → 2s → 4s → 8s → max 30s.
 * Başarılı bağlantıda sıfırlanır.
 */

export interface BackoffState {
  readonly attempt: number
  readonly delayMs: number
}

const MIN_DELAY_MS = 1_000
const MAX_DELAY_MS = 30_000
const FACTOR = 2

export function createBackoff(minMs = MIN_DELAY_MS, maxMs = MAX_DELAY_MS, factor = FACTOR) {
  let attempt = 0

  function next(): BackoffState {
    attempt++
    const delayMs = Math.min(minMs * Math.pow(factor, attempt - 1), maxMs)
    return { attempt, delayMs }
  }

  function reset(): void {
    attempt = 0
  }

  function getAttempt(): number {
    return attempt
  }

  return { next, reset, getAttempt }
}

export type Backoff = ReturnType<typeof createBackoff>
