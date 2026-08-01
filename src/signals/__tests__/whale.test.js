// Whale detector tests — thresholds, absorption, edge cases

import { describe, it, expect, beforeEach } from 'vitest';
import { WhaleDetector } from '../whale.js';

function makeTrade(overrides = {}) {
  return {
    price: 50000, quantity: 5, valueUSD: 250000,
    isTakerBuy: true, time: 1700000000000,
    ...overrides,
  };
}

describe('WhaleDetector', () => {
  let wd;
  beforeEach(() => { wd = new WhaleDetector(); });

  it('detects WHALE ($100K+)', () => {
    const r = wd.ingest(makeTrade({ valueUSD: 100000 }));
    expect(r).toBeTruthy();
    expect(r.level).toBe('whale');
    expect(wd.counts.whale).toBe(1);
  });

  it('detects MEGA ($500K+)', () => {
    const r = wd.ingest(makeTrade({ valueUSD: 500000 }));
    expect(r).toBeTruthy();
    expect(r.level).toBe('mega');
    expect(wd.counts.mega).toBe(1);
  });

  it('mega beats whale when both thresholds met', () => {
    const r = wd.ingest(makeTrade({ valueUSD: 600000 }));
    expect(r.level).toBe('mega');
    expect(wd.counts.mega).toBe(1);
    expect(wd.counts.whale).toBe(0);
  });

  it('$99,999 is NOT a whale', () => {
    const r = wd.ingest(makeTrade({ valueUSD: 99999 }));
    expect(r).toBeNull();
  });

  it('exactly $100K IS a whale', () => {
    const r = wd.ingest(makeTrade({ valueUSD: 100000 }));
    expect(r.level).toBe('whale');
  });

  it('exactly $500K IS mega', () => {
    const r = wd.ingest(makeTrade({ valueUSD: 500000 }));
    expect(r.level).toBe('mega');
  });

  it('$499,999.99 is WHALE not MEGA', () => {
    const r = wd.ingest(makeTrade({ valueUSD: 499999.99 }));
    expect(r.level).toBe('whale');
  });

  it('detects ABSORB: large vol, price static', () => {
    const t0 = 1700000000000;
    // Feed 5 trades at same price in 2s → absorption
    for (let i = 0; i < 5; i++) {
      wd.ingest(makeTrade({ time: t0 + i * 400, price: 50000, valueUSD: 15000 }));
    }
    // Now a $60K trade at same price → should trigger absorption
    const r = wd.ingest(makeTrade({ time: t0 + 2000, price: 50000, valueUSD: 60000 }));
    expect(r).toBeTruthy();
    expect(r.level).toBe('absorb');
  });

  it('no ABSORB when price moves significantly', () => {
    const t0 = 1700000000000;
    for (let i = 0; i < 5; i++) {
      wd.ingest(makeTrade({ time: t0 + i * 400, price: 50000 + i * 10, valueUSD: 15000 }));
    }
    const r = wd.ingest(makeTrade({ time: t0 + 2000, price: 50100, valueUSD: 60000 }));
    // Price moved ~0.2% — not absorption
    expect(r).toBeNull();
  });

  it('no ABSORB below min volume', () => {
    const t0 = 1700000000000;
    for (let i = 0; i < 5; i++) {
      wd.ingest(makeTrade({ time: t0 + i * 400, price: 50000, valueUSD: 10000 }));
    }
    // Last trade only $40K — below $50K absorb min
    const r = wd.ingest(makeTrade({ time: t0 + 2000, price: 50000, valueUSD: 40000 }));
    expect(r).toBeNull();
  });

  it('absorption needs ≥3 trades in window', () => {
    const t0 = 1700000000000;
    wd.ingest(makeTrade({ time: t0 + 400, price: 50000, valueUSD: 20000 }));
    // Only 1 trade before this one (need ≥3 in window)
    const r = wd.ingest(makeTrade({ time: t0 + 1000, price: 50000, valueUSD: 60000 }));
    expect(r).toBeNull();
  });

  it('whale + absorption = whale (size wins)', () => {
    const t0 = 1700000000000;
    for (let i = 0; i < 5; i++) {
      wd.ingest(makeTrade({ time: t0 + i * 400, price: 50000, valueUSD: 15000 }));
    }
    // $120K = whale, even if price matches absorb criteria
    const r = wd.ingest(makeTrade({ time: t0 + 2000, price: 50000, valueUSD: 120000 }));
    expect(r.level).toBe('whale');
  });

  it('snapshot returns accurate counts', () => {
    wd.ingest(makeTrade({ valueUSD: 200000 }));  // whale
    wd.ingest(makeTrade({ valueUSD: 600000 }));  // mega
    const s = wd.snapshot();
    expect(s.counts.whale).toBe(1);
    expect(s.counts.mega).toBe(1);
    expect(s.totalVol).toBe(800000);
  });

  it('reset clears everything', () => {
    wd.ingest(makeTrade({ valueUSD: 200000 }));
    wd.reset();
    expect(wd.sightings.length).toBe(0);
    expect(wd.counts.whale).toBe(0);
    expect(wd.totalVol).toBe(0);
  });
});
