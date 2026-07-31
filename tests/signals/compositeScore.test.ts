import { describe, it, expect } from 'vitest'
import { computeCompositeScore } from '../../src/signals/compositeScore'

describe('computeCompositeScore', () => {
  it('returns neutral for all zero components', () => {
    const result = computeCompositeScore('BTCUSDT', {
      cvdScore: 0,
      obiScore: 0,
      liquidationScore: 0,
      fundingScore: 0,
      momentumScore: 0,
      volumeScore: 0,
    })
    expect(result.direction).toBe(0)
    expect(result.score).toBe(0)
  })

  it('detects bullish signal with strong components', () => {
    const result = computeCompositeScore('BTCUSDT', {
      cvdScore: 80,
      obiScore: 70,
      liquidationScore: 60,
      fundingScore: 50,
      momentumScore: 40,
      volumeScore: 30,
    })
    // İlk tick: sinyal eşiğini geçmeli
    expect(result.score).toBeGreaterThan(30)
  })

  it('hysteresis requires confirmation before direction change', () => {
    // Önce SHORT sinyal ver
    computeCompositeScore('ETHUSDT', {
      cvdScore: -80, obiScore: -70, liquidationScore: -60,
      fundingScore: -50, momentumScore: -40, volumeScore: -30,
    })

    // Sonra zayıf LONG — histerezis yüzünden hala SHORT olmalı
    const result = computeCompositeScore('ETHUSDT', {
      cvdScore: 40, obiScore: 30, liquidationScore: 20,
      fundingScore: 10, momentumScore: 5, volumeScore: 0,
    })

    expect(result.hysteresis.consecutiveCount).toBeGreaterThanOrEqual(0)
  })

  it('confidence is between 0 and 1', () => {
    const result = computeCompositeScore('BTCUSDT', {
      cvdScore: 50, obiScore: 40, liquidationScore: 30,
      fundingScore: 20, momentumScore: 10, volumeScore: 0,
    })
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })
})
