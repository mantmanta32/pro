/**
 * Sinyal Motoru Yöneticisi — Katman 1 + Katman 2.
 * Tüm WS verilerini alır, sinyalleri hesaplar, evrimi tetikler.
 * React'ten tamamen bağımsız saf TS modülü.
 */

import type { TickerData, AggTradeData, ForceOrderData, MarketSocketCallbacks } from '../data/ws/useMarketSocket'
import type { DepthData } from '../data/ws/usePublicSocket'
import type { FundingData } from '../data/fundingPoll'
import { processAggTrade, getCvdState } from './cvd'
import { processDepthUpdate, getObiState } from './obi'
import { processForceOrder, getLiquidationPressure } from './liquidationPressure'
import { computeCompositeScore, type SignalComponentScores } from './compositeScore'
import { applyVpinGate } from './vpinGate'
import { addToPool, getDominantTrigger, getConfidenceBand } from '../patternPool/poolStore'
import { computeRMultiple } from '../evolution/fitness'
import type { ActiveSignal } from '../store/useBotStore'

export interface SignalEngineConfig {
  onSignal: (signal: ActiveSignal) => void
  onStatusChange: MarketSocketCallbacks['onStatusChange']
  onError: MarketSocketCallbacks['onError']
}

// Sembol başına fiyat takibi
const prices = new Map<string, number>()
// Sembol başına dakika açılış fiyatı
const minuteOpens = new Map<string, number>()
// Sembol başına hacim verisi
const volumes = new Map<string, number>()
// Funding rate verisi
const fundingRates = new Map<string, FundingData>()
// Sinyal throttle: aynı coine X saniyede bir sinyal
const lastSignalTime = new Map<string, number>()
const SIGNAL_THROTTLE_MS = 5000

export function createSignalEngine(config: SignalEngineConfig) {
  // ── Ticker Handler ──
  function handleTicker(data: TickerData) {
    const price = parseFloat(data.c)
    prices.set(data.s, price)
    volumes.set(data.s, parseFloat(data.q))

    // Dakika açılışı takibi (kaba: ilk tick veya 60sn'de bir)
    const now = Date.now()
    const lastOpen = minuteOpens.get(data.s)
    if (!lastOpen || now - lastOpen > 60_000) {
      minuteOpens.set(data.s, price)
    }
  }

  // ── AggTrade Handler ──
  function handleAggTrade(data: AggTradeData) {
    processAggTrade(data)
    evaluateSymbol(data.s)
  }

  // ── ForceOrder Handler ──
  function handleForceOrder(data: ForceOrderData) {
    processForceOrder(data)
    evaluateSymbol(data.o.s)
  }

  // ── Depth Handler ──
  function handleDepth(data: DepthData) {
    processDepthUpdate(data)
    evaluateSymbol(data.s)
  }

  // ── Funding Handler ──
  function handleFunding(data: FundingData[]) {
    for (const d of data) {
      fundingRates.set(d.symbol, d)
    }
  }

  // ── Değerlendirme ──
  function evaluateSymbol(symbol: string) {
    // Throttle kontrolü
    const now = Date.now()
    const lastSignal = lastSignalTime.get(symbol) || 0
    if (now - lastSignal < SIGNAL_THROTTLE_MS) return

    const price = prices.get(symbol)
    if (!price || price <= 0) return

    const minuteOpen = minuteOpens.get(symbol) || price

    // Katman 1 bileşenleri
    const cvd = getCvdState(symbol)
    const obi = getObiState(symbol)
    const liq = getLiquidationPressure(symbol)
    const funding = fundingRates.get(symbol)

    // CVD skoru (-100..+100)
    let cvdScore = 0
    if (cvd && cvd.tickCount > 5) {
      const totalVol = cvd.buyVolume + cvd.sellVolume
      cvdScore = totalVol > 0 ? (cvd.delta / totalVol) * 100 : 0
      cvdScore = Math.max(-100, Math.min(100, cvdScore))
    }

    // OBI skoru
    let obiScore = 0
    if (obi) {
      obiScore = obi.obi * 100
    }

    // Likidasyon skoru
    let liquidationScore = 0
    if (liq && liq.totalCount > 0) {
      liquidationScore = liq.pressureScore
    }

    // Funding skoru (-100..+100)
    // Aşırı pozitif funding → short fırsatı (negatif skor)
    // Aşırı negatif funding → long fırsatı (pozitif skor)
    let fundingScore = 0
    if (funding) {
      const rate = funding.fundingRatePercent
      if (rate > 0.1) fundingScore = -Math.min(100, rate * 200)
      else if (rate < -0.1) fundingScore = Math.min(100, Math.abs(rate) * 200)
      else fundingScore = -rate * 100 // normalize
    }

    // Momentum skoru (yardımcı filtre)
    let momentumScore = 0
    if (minuteOpen > 0) {
      const change = ((price - minuteOpen) / minuteOpen) * 100
      momentumScore = Math.max(-100, Math.min(100, change * 20))
    }

    // Hacim skoru
    let volumeScore = 0
    const vol = volumes.get(symbol) || 0
    if (vol > 1_000_000) volumeScore = Math.min(100, (vol / 10_000_000) * 50)

    const components: SignalComponentScores = {
      cvdScore,
      obiScore,
      liquidationScore,
      fundingScore,
      momentumScore,
      volumeScore,
    }

    // Katman 2: Kompozit skor
    const composite = computeCompositeScore(symbol, components)

    // VPIN gate
    const sampleCount = cvd?.tickCount ?? 0
    const totalVolume = (cvd?.buyVolume ?? 0) + (cvd?.sellVolume ?? 0)
    const vpinResult = applyVpinGate({ sampleCount, totalVolume }, composite.confidence)

    // Sinyal var mı?
    if (composite.direction !== 0 && vpinResult.adjustedConfidence > 0.3) {
      lastSignalTime.set(symbol, now)

      const signal: ActiveSignal = {
        symbol,
        direction: composite.direction,
        score: composite.score,
        confidence: vpinResult.adjustedConfidence,
        price,
        timestamp: now,
        components,
      }

      config.onSignal(signal)
    }
  }

  // ── Sinyal kapanışı (simülasyon) ──
  function closeSignal(symbol: string, direction: number, entryPrice: number): void {
    const price = prices.get(symbol)
    if (!price) return

    const exitPrice = price
    const result = ((exitPrice - entryPrice) / entryPrice) * 100 * direction
    const rMultiple = computeRMultiple(direction, entryPrice, exitPrice)

    // Pattern pool'a ekle
    const components = getComponents(symbol)
    const dominant = getDominantTrigger(components)
    const confidence = 0.5 // placeholder
    const band = getConfidenceBand(confidence)

    addToPool(
      {
        direction,
        dominantTrigger: dominant,
        confidenceBand: band,
        coin: symbol,
      },
      result,
      rMultiple,
    )
  }

  function getComponents(symbol: string): Record<string, number> {
    const cvd = getCvdState(symbol)
    const obi = getObiState(symbol)
    const liq = getLiquidationPressure(symbol)
    const funding = fundingRates.get(symbol)
    const price = prices.get(symbol) || 0
    const minuteOpen = minuteOpens.get(symbol) || price

    let cvdScore = 0, obiScore = 0, liqScore = 0, fundingScore = 0, momentumScore = 0, volScore = 0

    if (cvd && cvd.tickCount > 5) {
      const t = cvd.buyVolume + cvd.sellVolume
      cvdScore = t > 0 ? (cvd.delta / t) * 100 : 0
    }
    if (obi) obiScore = obi.obi * 100
    if (liq && liq.totalCount > 0) liqScore = liq.pressureScore
    if (funding) {
      const r = funding.fundingRatePercent
      fundingScore = r > 0.1 ? -Math.min(100, r * 200) : r < -0.1 ? Math.min(100, Math.abs(r) * 200) : -r * 100
    }
    if (minuteOpen > 0) momentumScore = ((price - minuteOpen) / minuteOpen) * 2000
    const vol = volumes.get(symbol) || 0
    if (vol > 1_000_000) volScore = Math.min(100, (vol / 10_000_000) * 50)

    return {
      cvdScore: Math.max(-100, Math.min(100, cvdScore)),
      obiScore: Math.max(-100, Math.min(100, obiScore)),
      liquidationScore: Math.max(-100, Math.min(100, liqScore)),
      fundingScore: Math.max(-100, Math.min(100, fundingScore)),
      momentumScore: Math.max(-100, Math.min(100, momentumScore)),
      volumeScore: Math.max(-100, Math.min(100, volScore)),
    }
  }

  function reset() {
    prices.clear()
    minuteOpens.clear()
    volumes.clear()
    fundingRates.clear()
    lastSignalTime.clear()
  }

  return {
    handleTicker,
    handleAggTrade,
    handleForceOrder,
    handleDepth,
    handleFunding,
    closeSignal,
    reset,
  }
}
