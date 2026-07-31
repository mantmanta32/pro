/**
 * CVD (Cumulative Volume Delta) hesaplama.
 * aggTrade `m` (maker/taker) alanından gerçek zamanlı delta.
 * Ring buffer tabanlı, sembol başına.
 */

import { RingBuffer } from './ringBuffer'
import { RING_BUFFER_CAPACITY } from '../config/symbols'
import type { AggTradeData } from '../data/ws/useMarketSocket'

export interface CvdState {
  /** Son N tick'in kümülatif hacim deltası */
  delta: number
  /** Ham CVD değeri (tüm zaman) */
  cumulative: number
  /** Son tick sayısı */
  tickCount: number
  /** Alış hacmi (son N tick) */
  buyVolume: number
  /** Satış hacmi (son N tick) */
  sellVolume: number
  /** CVD yönü: 1 = alış baskısı, -1 = satış baskısı, 0 = nötr */
  direction: number
}

const cvdStates = new Map<string, {
  cumulative: number
  tickCount: number
  buffer: RingBuffer<{ delta: number; buyVol: number; sellVol: number }>
}>()

function ensureSymbol(symbol: string) {
  if (!cvdStates.has(symbol)) {
    cvdStates.set(symbol, {
      cumulative: 0,
      tickCount: 0,
      buffer: new RingBuffer(RING_BUFFER_CAPACITY),
    })
  }
  return cvdStates.get(symbol)!
}

export function processAggTrade(trade: AggTradeData): CvdState {
  const state = ensureSymbol(trade.s)
  const price = parseFloat(trade.p)
  const qty = parseFloat(trade.q)
  const volume = price * qty

  // m = true → market buy (taker buying = alış)
  // m = false → market sell (taker selling = satış)
  const tickDelta = trade.m ? volume : -volume
  const buyVol = trade.m ? volume : 0
  const sellVol = trade.m ? 0 : volume

  state.cumulative += tickDelta
  state.tickCount++
  state.buffer.push({ delta: tickDelta, buyVol, sellVol })

  // Son N tick üzerinden delta hesapla
  const recent = state.buffer.toArray()
  const recentDelta = recent.reduce((sum, t) => sum + t.delta, 0)
  const recentBuyVol = recent.reduce((sum, t) => sum + t.buyVol, 0)
  const recentSellVol = recent.reduce((sum, t) => sum + t.sellVol, 0)

  let direction = 0
  if (recentDelta > 0) direction = 1
  else if (recentDelta < 0) direction = -1

  return {
    delta: recentDelta,
    cumulative: state.cumulative,
    tickCount: state.tickCount,
    buyVolume: recentBuyVol,
    sellVolume: recentSellVol,
    direction,
  }
}

export function getCvdState(symbol: string): CvdState | undefined {
  const state = cvdStates.get(symbol)
  if (!state) return undefined

  const recent = state.buffer.toArray()
  const recentDelta = recent.reduce((sum, t) => sum + t.delta, 0)
  const recentBuyVol = recent.reduce((sum, t) => sum + t.buyVol, 0)
  const recentSellVol = recent.reduce((sum, t) => sum + t.sellVol, 0)

  let direction = 0
  if (recentDelta > 0) direction = 1
  else if (recentDelta < 0) direction = -1

  return {
    delta: recentDelta,
    cumulative: state.cumulative,
    tickCount: state.tickCount,
    buyVolume: recentBuyVol,
    sellVolume: recentSellVol,
    direction,
  }
}

export function clearCvdState(symbol: string): void {
  cvdStates.delete(symbol)
}
