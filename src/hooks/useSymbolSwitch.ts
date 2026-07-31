/**
 * Race condition korumalı sembol değişimi.
 * Yeni sembol yüklenene kadar eski veriyi gösterir,
 * unmount olduysa state güncellemez.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export function useSymbolSwitch<T>(
  symbol: string,
  fetcher: (symbol: string, signal: AbortSignal) => Promise<T>,
): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const load = useCallback(async (sym: string) => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    try {
      const result = await fetcher(sym, controller.signal)
      if (mountedRef.current && !controller.signal.aborted) {
        setData(result)
      }
    } catch (err) {
      if (mountedRef.current && !controller.signal.aborted && err instanceof Error) {
        setError(err)
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }

    return () => controller.abort()
  }, [fetcher])

  useEffect(() => {
    const cleanup = load(symbol)
    return () => { cleanup }
  }, [symbol, load])

  return { data, loading, error }
}
