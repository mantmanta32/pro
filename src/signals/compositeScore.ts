/**
 * Katman 2 — Kompozit skor hesaplama.
 * Tüm Katman 1 bileşenlerini birleştirip ağırlıklı -100..+100 skor üretir.
 * İki-tık histerezis: sinyal yön değiştirmeden önce iki ardışık teyit.
 */

export interface SignalComponentScores {
  /** CVD delta skoru (-100..+100) */
  cvdScore: number
  /** OBI skoru (-100..+100) */
  obiScore: number
  /** Likidasyon baskı skoru (-100..+100) */
  liquidationScore: number
  /** Funding rate skoru (-100..+100) — aşırı pozitif = short fırsatı, aşırı negatif = long fırsatı */
  fundingScore: number
  /** Fiyat momentum skoru (-100..+100) — yardımcı filtre */
  momentumScore: number
  /** Hacim anomali skoru (-100..+100) */
  volumeScore: number
}

export interface CompositeResult {
  /** Ağırlıklı kompozit skor (-100..+100) */
  score: number
  /** Sinyal yönü: 1 = LONG, -1 = SHORT, 0 = NÖTR */
  direction: number
  /** Ham güven değeri (0..1) */
  confidence: number
  /** Histerezis durumu */
  hysteresis: HysteresisState
  /** Bileşen skorları */
  components: SignalComponentScores
  /** Sinyalde kullanılan bileşen sayısı */
  activeComponents: number
  /** Zaman damgası */
  timestamp: number
}

export interface HysteresisState {
  /** Mevcut yön */
  currentDirection: number
  /** Önceki tick yönü */
  previousDirection: number
  /** Aynı yönde ardışık teyit sayısı */
  consecutiveCount: number
  /** Yön değişimi için gereken teyit sayısı */
  requiredConfirmations: number
}

interface CompositeConfig {
  weights: {
    cvd: number
    obi: number
    liquidation: number
    funding: number
    momentum: number
    volume: number
  }
  /** Histerezis için gerekli ardışık teyit sayısı */
  hysteresisRequired: number
  /** Sinyal tetikleme eşiği (abs(score) > threshold) */
  signalThreshold: number
}

const DEFAULT_CONFIG: CompositeConfig = {
  weights: { cvd: 0.25, obi: 0.20, liquidation: 0.20, funding: 0.15, momentum: 0.10, volume: 0.10 },
  hysteresisRequired: 2,
  signalThreshold: 30,
}

const hysteresisStates = new Map<string, HysteresisState>()

function ensureHysteresis(symbol: string): HysteresisState {
  if (!hysteresisStates.has(symbol)) {
    hysteresisStates.set(symbol, {
      currentDirection: 0,
      previousDirection: 0,
      consecutiveCount: 0,
      requiredConfirmations: 2,
    })
  }
  return hysteresisStates.get(symbol)!
}

/**
 * Ağırlıklı kompozit skor hesapla.
 * config parametresiyle evrim optimize edilebilir.
 */
export function computeCompositeScore(
  symbol: string,
  components: SignalComponentScores,
  config: Partial<CompositeConfig> = {},
): CompositeResult {
  const cfg = { ...DEFAULT_CONFIG, ...config, weights: { ...DEFAULT_CONFIG.weights, ...config.weights } }

  const activeComponents: number =
    (components.cvdScore !== 0 ? 1 : 0) +
    (components.obiScore !== 0 ? 1 : 0) +
    (components.liquidationScore !== 0 ? 1 : 0) +
    (components.fundingScore !== 0 ? 1 : 0) +
    (components.momentumScore !== 0 ? 1 : 0) +
    (components.volumeScore !== 0 ? 1 : 0)

  const score =
    components.cvdScore * cfg.weights.cvd +
    components.obiScore * cfg.weights.obi +
    components.liquidationScore * cfg.weights.liquidation +
    components.fundingScore * cfg.weights.funding +
    components.momentumScore * cfg.weights.momentum +
    components.volumeScore * cfg.weights.volume

  const clampedScore = Math.max(-100, Math.min(100, score))

  // Ham güven: bileşenlerin mutlak skorlarının ortalaması
  const absScores = [
    Math.abs(components.cvdScore),
    Math.abs(components.obiScore),
    Math.abs(components.liquidationScore),
    Math.abs(components.fundingScore),
    Math.abs(components.momentumScore),
    Math.abs(components.volumeScore),
  ]
  const confidence = absScores.reduce((a, b) => a + b, 0) / (6 * 100)

  // Histerezis
  const hyst = ensureHysteresis(symbol)
  const rawDirection = clampedScore > cfg.signalThreshold ? 1 : clampedScore < -cfg.signalThreshold ? -1 : 0

  if (rawDirection === hyst.currentDirection && rawDirection !== 0) {
    hyst.consecutiveCount++
  } else if (rawDirection !== 0) {
    hyst.previousDirection = hyst.currentDirection
    hyst.consecutiveCount = 1
  } else {
    hyst.consecutiveCount = Math.max(0, hyst.consecutiveCount - 1)
  }

  // Yön değişimi: iki ardışık teyit gerekli
  let direction = hyst.currentDirection
  if (rawDirection !== 0 && hyst.consecutiveCount >= cfg.hysteresisRequired) {
    direction = rawDirection
  } else if (rawDirection === 0 && hyst.consecutiveCount === 0) {
    direction = 0
  }

  hyst.currentDirection = direction

  return {
    score: clampedScore,
    direction,
    confidence,
    hysteresis: { ...hyst },
    components,
    activeComponents,
    timestamp: Date.now(),
  }
}

export function resetHysteresis(symbol: string): void {
  hysteresisStates.delete(symbol)
}

export function getDefaultConfig(): CompositeConfig {
  return { ...DEFAULT_CONFIG, weights: { ...DEFAULT_CONFIG.weights } }
}
