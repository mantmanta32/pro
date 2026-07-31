import { describe, it, expect } from 'vitest'
import { computeFitness, computeRMultiple } from '../../src/evolution/fitness'
import type { ClosedSignal } from '../../src/evolution/fitness'

function makeSignal(result: number, rMultiple: number): ClosedSignal {
  return {
    symbol: 'BTCUSDT',
    direction: 1,
    entryPrice: 50000,
    exitPrice: 50000 * (1 + result / 100),
    result,
    rMultiple,
    timestamp: Date.now(),
  }
}

describe('computeFitness', () => {
  it('returns 0 fitness for empty signals', () => {
    const result = computeFitness([])
    expect(result.fitness).toBe(0)
    expect(result.hasMinSamples).toBe(false)
  })

  it('higher success rate gives higher fitness', () => {
    const good = Array.from({ length: 30 }, (_, i) =>
      makeSignal(i < 24 ? 2 : -1, i < 24 ? 1 : -0.5)
    )
    const bad = Array.from({ length: 30 }, (_, i) =>
      makeSignal(i < 15 ? 2 : -1, i < 15 ? 1 : -0.5)
    )

    const goodFit = computeFitness(good)
    const badFit = computeFitness(bad)
    expect(goodFit.fitness).toBeGreaterThan(badFit.fitness)
  })

  it('detects insufficient sample size', () => {
    const small = [makeSignal(1, 0.5), makeSignal(2, 2)]
    const result = computeFitness(small)
    expect(result.hasMinSamples).toBe(false)
  })

  it('sufficient samples are detected', () => {
    const big = Array.from({ length: 30 }, () => makeSignal(1, 0.5))
    const result = computeFitness(big)
    expect(result.hasMinSamples).toBe(true)
  })

  it('computes max drawdown correctly', () => {
    const signals = [
      makeSignal(5, 2),
      makeSignal(-10, -4),
      makeSignal(3, 1),
      makeSignal(2, 0.5),
    ]
    const result = computeFitness(signals)
    // Peak: 5, trough: -5 → drawdown: 10
    expect(result.maxDrawdown).toBeCloseTo(10, 1)
  })
})

describe('computeRMultiple', () => {
  it('positive for winning long', () => {
    const r = computeRMultiple(1, 50000, 51000)
    expect(r).toBeGreaterThan(0)
  })

  it('negative for losing long', () => {
    const r = computeRMultiple(1, 50000, 49500)
    expect(r).toBeLessThan(0)
  })

  it('positive for winning short', () => {
    const r = computeRMultiple(-1, 50000, 49000)
    expect(r).toBeGreaterThan(0)
  })
})
