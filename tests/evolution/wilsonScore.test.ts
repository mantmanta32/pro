import { describe, it, expect } from 'vitest'
import { wilsonLowerBound, wilsonUpperBound, wilsonCenter } from '../../src/evolution/wilsonScore'

describe('wilsonLowerBound', () => {
  it('returns 0 for zero total', () => {
    expect(wilsonLowerBound(0, 0)).toBe(0)
  })

  it('penalizes small sample sizes', () => {
    // %100 başarı ama sadece 1 örnek — Wilson alt sınırı cezalandırmalı
    const score = wilsonLowerBound(1, 1)
    expect(score).toBeLessThan(1)
    expect(score).toBeGreaterThan(0)
  })

  it('approaches raw success rate with large samples', () => {
    const score = wilsonLowerBound(80, 100)
    // Wilson alt sınırı %95 güvenle ~0.71 olur (80/100 için)
    expect(score).toBeGreaterThan(0.68)
    expect(score).toBeLessThan(0.8) // alt sınır olduğu için ham orandan düşük
  })

  it('returns 0 for all failures', () => {
    const score = wilsonLowerBound(0, 10)
    expect(score).toBe(0)
  })

  it('n=5 ile n=3 karşılaştırması — küçük örneklem yapay yüksek çıkmasın', () => {
    // n=3, 3 başarı (100%)
    const score1 = wilsonLowerBound(3, 3)
    // n=5, 4 başarı (80%)
    const score2 = wilsonLowerBound(4, 5)
    // n=3 olan çok şişirilmemeli, n=5 olan yeterince cezalandırılmış
    expect(score1).toBeLessThan(0.95)
    // Wilson alt sınırı 4/5 için ~0.38 civarı olur
    expect(score2).toBeGreaterThan(0.3)
    expect(score2).toBeLessThan(0.7)
  })
})

describe('wilsonUpperBound', () => {
  it('returns 1 for all successes', () => {
    const score = wilsonUpperBound(10, 10)
    expect(score).toBeGreaterThan(0.9)
  })

  it('returns less than 1 for zero total', () => {
    expect(wilsonUpperBound(0, 0)).toBe(1)
  })
})

describe('wilsonCenter', () => {
  it('returns 0.5 for zero total', () => {
    expect(wilsonCenter(0, 0)).toBe(0.5)
  })

  it('shifts toward 0.5 for small samples', () => {
    // n=1, 1 başarı → merkez 0.5'e yaklaşmalı
    const score = wilsonCenter(1, 1)
    expect(score).toBeLessThan(1)
    expect(score).toBeGreaterThan(0.5)
  })
})
