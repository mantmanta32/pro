/**
 * Dinamik sembol evreni: en yüksek hacimli USDT-M futures sembollerini
 * `/fapi/v1/ticker/24hr` REST endpoint'inden çeker.
 * Hardcoded liste YOK.
 */

import { TICKER_24HR_URL, MIN_DAILY_VOLUME_USDT, SYMBOL_POLL_INTERVAL_MS } from '../config/symbols'

export interface SymbolInfo {
  symbol: string
  price: number
  priceChangePercent: number
  volumeUsdt: number
  high: number
  low: number
}

let symbolCache: SymbolInfo[] = []
let lastFetch = 0

export async function fetchTopSymbols(limit = 60): Promise<SymbolInfo[]> {
  const now = Date.now()
  if (now - lastFetch < SYMBOL_POLL_INTERVAL_MS && symbolCache.length > 0) {
    return symbolCache.slice(0, limit)
  }

  try {
    const res = await fetch(TICKER_24HR_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: any[] = await res.json()

    const symbols: SymbolInfo[] = data
      .filter((t: any) =>
        t.symbol.endsWith('USDT') &&
        parseFloat(t.quoteVolume) >= MIN_DAILY_VOLUME_USDT
      )
      .map((t: any): SymbolInfo => ({
        symbol: t.symbol,
        price: parseFloat(t.lastPrice),
        priceChangePercent: parseFloat(t.priceChangePercent),
        volumeUsdt: parseFloat(t.quoteVolume),
        high: parseFloat(t.highPrice),
        low: parseFloat(t.lowPrice),
      }))
      .sort((a, b) => b.volumeUsdt - a.volumeUsdt)

    symbolCache = symbols
    lastFetch = now
    console.log(`[SymbolUniverse] ${symbols.length} sembol yüklendi (toplam)`)
    return symbols.slice(0, limit)
  } catch (err) {
    console.warn('[SymbolUniverse] Sembol listesi çekilemedi:', err)
    return symbolCache.slice(0, limit) // fallback: önbellekteki
  }
}

/** Tüm sembolleri al (önbellekten) */
export function getCachedSymbols(): SymbolInfo[] {
  return symbolCache
}

/** Sembol adına göre bilgi */
export function getSymbolInfo(symbol: string): SymbolInfo | undefined {
  return symbolCache.find(s => s.symbol === symbol)
}
