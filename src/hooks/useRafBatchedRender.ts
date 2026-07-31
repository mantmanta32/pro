/**
 * Dirty-flag + requestAnimationFrame render batching.
 * Yüksek frekanslı WS mesajlarında DOM her tick'te değil,
 * RAF ile batch halinde güncellenir.
 */

import { useEffect, useRef, useCallback } from 'react'

/**
 * RAF-batched callback: verilen callback'i sadece
 * bir sonraki animation frame'de çağırır.
 * Aynı frame içinde tekrarlanan çağrılar sadece sonuncuyu tetikler.
 */
export function useRafBatchedCallback<T extends (...args: any[]) => void>(
  callback: T,
): T {
  const rafRef = useRef<number | null>(null)
  const callbackRef = useRef(callback)
  const pendingRef = useRef(false)

  callbackRef.current = callback

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return useCallback((...args: any[]) => {
    if (!pendingRef.current) {
      pendingRef.current = true
      rafRef.current = requestAnimationFrame(() => {
        pendingRef.current = false
        rafRef.current = null
        callbackRef.current(...args)
      })
    }
  }, []) as T
}

/**
 * RAF-batched state setter.
 * Zustand store'u yüksek frekansta güncellemek için kullanılır.
 */
export function useRafBatchedState<T>(
  setter: (value: T) => void,
  value: T,
): void {
  const batched = useRafBatchedCallback(() => setter(value))

  useEffect(() => {
    batched()
  }, [value, batched])
}
