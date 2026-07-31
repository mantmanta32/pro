/**
 * Likidasyon baskısı hesaplama.
 * forceOrder akışından son X dakikadaki long/short likidasyon hacmi.
 */

import { RingBuffer } from './ringBuffer'
import { RING_BUFFER_CAPACITY } from '../config/symbols'
import type { ForceOrderData } from '../data/ws/useMarketSocket'

export interface LiquidationPressureState {
  /** Son penceredeki long likidasyon hacmi (USDT) */
  longVolume: number
  /** Son penceredeki short likidasyon hacmi (USDT) */
  shortVolume: number
  /** Toplam likidasyon sayısı */
  totalCount: number
  /** Baskı yönü: pozitif = short'lar likide oluyor (alış baskısı), negatif = long'lar (satış baskısı) */
  pressure: number
  /** Likidasyon baskı skoru (-100..+100 normalize) */
  pressureScore: number
}

interface LiquidationTick {
  time: number
  side: 'BUY' | 'SELL'
  volume: number
}

const WINDOW_MS = 5 * 60 * 1000 // 5 dakika pencere

const liquidationBuffers = new Map<string, RingBuffer<LiquidationTick>>()

function ensureBuffer(symbol: string): RingBuffer<LiquidationTick> {
  if (!liquidationBuffers.has(symbol)) {
    liquidationBuffers.set(symbol, new RingBuffer(RING_BUFFER_CAPACITY))
  }
  return liquidationBuffers.get(symbol)!
}

export function processForceOrder(order: ForceOrderData): LiquidationPressureState {
  const buffer = ensureBuffer(order.o.s)
  const price = parseFloat(order.o.p)
  const qty = parseFloat(order.o.v)
  const volume = price * qty

  buffer.push({
    time: order.o.T,
    side: order.o.S,
    volume,
  })

  return computePressure(order.o.s, buffer)
}

function computePressure(_symbol: string, buffer: RingBuffer<LiquidationTick>): LiquidationPressureState {
  const now = Date.now()
  const cutoff = now - WINDOW_MS

  let longVolume = 0
  let shortVolume = 0
  let totalCount = 0

  for (const tick of buffer.toArray()) {
    if (tick.time < cutoff) continue
    totalCount++
    if (tick.side === 'BUY') longVolume += tick.volume
    else shortVolume += tick.volume
  }

  // Baskı: short'ların likide olması = alış baskısı (pozitif)
  // Long'ların likide olması = satış baskısı (negatif)
  const total = longVolume + shortVolume
  const pressure = total > 0 ? (shortVolume - longVolume) / total : 0

  // -100..+100 normalize
  const pressureScore = Math.max(-100, Math.min(100, pressure * 100))

  return {
    longVolume,
    shortVolume,
    totalCount,
    pressure,
    pressureScore,
  }
}

export function getLiquidationPressure(symbol: string): LiquidationPressureState | undefined {
  const buffer = liquidationBuffers.get(symbol)
  if (!buffer) return undefined
  return computePressure(symbol, buffer)
}

export function clearLiquidationPressure(symbol: string): void {
  liquidationBuffers.delete(symbol)
}
