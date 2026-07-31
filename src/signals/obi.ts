/**
 * OBI (Order Book Imbalance) hesaplama.
 * Depth verisinden top-N seviye bid/ask hacim oranı.
 *
 * OBI = (BidVol - AskVol) / (BidVol + AskVol)
 * Aralık: -1 (tamamen ask) ile +1 (tamamen bid) arası.
 */

import type { DepthData } from '../data/ws/usePublicSocket'

export interface ObiState {
  /** OBI değeri (-1 ile +1 arası) */
  obi: number
  /** Toplam bid hacmi (top N seviye) */
  bidVolume: number
  /** Toplam ask hacmi (top N seviye) */
  askVolume: number
  /** Bid/Ask oranı */
  ratio: number
  /** Son güncelleme zamanı */
  updatedAt: number
}

interface DepthBook {
  bids: Map<number, number>  // price → qty
  asks: Map<number, number>
  lastUpdateId: number
}

const DEPTH_LEVELS = 20 // top 20 seviye
const depthBooks = new Map<string, DepthBook>()

function ensureBook(symbol: string): DepthBook {
  if (!depthBooks.has(symbol)) {
    depthBooks.set(symbol, { bids: new Map(), asks: new Map(), lastUpdateId: 0 })
  }
  return depthBooks.get(symbol)!
}

export function processDepthUpdate(data: DepthData): ObiState {
  const book = ensureBook(data.s)

  // Update ID kontrolü — sırasız güncellemeyi atla
  if (data.u <= book.lastUpdateId) {
    return computeObi(data.s, book)
  }
  book.lastUpdateId = data.u

  // Bid'leri güncelle
  for (const [priceStr, qtyStr] of data.b) {
    const price = parseFloat(priceStr)
    const qty = parseFloat(qtyStr)
    if (qty === 0) book.bids.delete(price)
    else book.bids.set(price, qty)
  }

  // Ask'leri güncelle
  for (const [priceStr, qtyStr] of data.a) {
    const price = parseFloat(priceStr)
    const qty = parseFloat(qtyStr)
    if (qty === 0) book.asks.delete(price)
    else book.asks.set(price, qty)
  }

  // Sıralı tut (bids: azalan, asks: artan)
  trimBook(book)

  return computeObi(data.s, book)
}

function trimBook(book: DepthBook) {
  // Bid'leri en yüksek fiyattan başlayarak DEPTH_LEVELS kadar tut
  const sortedBids = [...book.bids.entries()].sort((a, b) => b[0] - a[0])
  book.bids = new Map(sortedBids.slice(0, DEPTH_LEVELS))

  // Ask'leri en düşük fiyattan başlayarak DEPTH_LEVELS kadar tut
  const sortedAsks = [...book.asks.entries()].sort((a, b) => a[0] - b[0])
  book.asks = new Map(sortedAsks.slice(0, DEPTH_LEVELS))
}

function computeObi(_symbol: string, book: DepthBook): ObiState {
  let bidVolume = 0
  for (const [, qty] of book.bids) bidVolume += qty

  let askVolume = 0
  for (const [, qty] of book.asks) askVolume += qty

  const total = bidVolume + askVolume
  const obi = total > 0 ? (bidVolume - askVolume) / total : 0
  const ratio = askVolume > 0 ? bidVolume / askVolume : bidVolume > 0 ? Infinity : 1

  return { obi, bidVolume, askVolume, ratio, updatedAt: Date.now() }
}

export function getObiState(symbol: string): ObiState | undefined {
  const book = depthBooks.get(symbol)
  if (!book) return undefined
  return computeObi(symbol, book)
}

export function clearObiState(symbol: string): void {
  depthBooks.delete(symbol)
}
