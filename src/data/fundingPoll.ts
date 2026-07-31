/**
 * Periyodik funding rate REST poll.
 * Her sembol için funding rate ve mark price bilgisini toplar.
 */

import { FUNDING_RATE_URL, FUNDING_POLL_INTERVAL_MS } from '../config/symbols'

export interface FundingData {
  symbol: string
  markPrice: number
  fundingRate: number      // güncel funding rate
  fundingRatePercent: number
  nextFundingTime: number  // ms timestamp
  indexPrice: number
}

export type FundingUpdateHandler = (data: FundingData[]) => void

let pollTimer: ReturnType<typeof setInterval> | null = null
let activeSymbols: string[] = []

export function startFundingPoll(
  symbols: string[],
  onUpdate: FundingUpdateHandler
): void {
  activeSymbols = symbols
  stopFundingPoll()

  const poll = async () => {
    if (activeSymbols.length === 0) return
    try {
      const results = await Promise.allSettled(
        activeSymbols.map(async (symbol) => {
          const res = await fetch(`${FUNDING_RATE_URL}?symbol=${symbol}`)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          return {
            symbol: data.symbol,
            markPrice: parseFloat(data.markPrice),
            fundingRate: parseFloat(data.lastFundingRate),
            fundingRatePercent: parseFloat(data.lastFundingRate) * 100,
            nextFundingTime: data.nextFundingTime,
            indexPrice: parseFloat(data.indexPrice),
          } as FundingData
        })
      )

      const fundingData: FundingData[] = []
      for (const r of results) {
        if (r.status === 'fulfilled') fundingData.push(r.value)
      }

      if (fundingData.length > 0) onUpdate(fundingData)
    } catch (err) {
      console.warn('[FundingPoll] Hata:', err)
    }
  }

  // İlk poll hemen, sonra periyodik
  poll()
  pollTimer = setInterval(poll, FUNDING_POLL_INTERVAL_MS)
}

export function updateFundingSymbols(symbols: string[]): void {
  activeSymbols = symbols
}

export function stopFundingPoll(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
