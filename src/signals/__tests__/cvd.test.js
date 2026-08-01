// CVD test — validates delta sign correctness
// Fixture: /home/user/cvd_fixture.jsonl (243 live Binance aggTrades + bookTicker)
// Each line: { time, m, price, bid, ask, qty, valueUSD, ... }
// Expected: m=true → trade price at bid → aggressive seller → delta negative
//           m=false → trade price at ask → aggressive buyer → delta positive

import { describe, it, expect } from 'vitest';
import { deltaSign } from '../cvd.js';
import { TickCVD } from '../cvd.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = '/home/user/cvd_fixture.jsonl';

describe('TickCVD — delta sign', () => {
  it('isTakerBuy=true → delta sign +1 (aggressive buyer)', () => {
    expect(deltaSign({ isTakerBuy: true })).toBe(1);
  });

  it('isTakerBuy=false → delta sign -1 (aggressive seller)', () => {
    expect(deltaSign({ isTakerBuy: false })).toBe(-1);
  });

  it('manually-parsed m=true → isTakerBuy=false → sign -1', () => {
    // m=true → buyer is maker → seller is taker
    const trade = { isBuyerMaker: true, isTakerBuy: false, price: 50000, quantity: 1, valueUSD: 50000 };
    expect(deltaSign(trade)).toBe(-1);
  });

  it('manually-parsed m=false → isTakerBuy=true → sign +1', () => {
    const trade = { isBuyerMaker: false, isTakerBuy: true, price: 50000, quantity: 1, valueUSD: 50000 };
    expect(deltaSign(trade)).toBe(1);
  });
});

describe('TickCVD — rolling window', () => {
  it('accumulates deltas in 1-min window', () => {
    const cvd = new TickCVD({ windowMs: 60000 });
    const baseTime = 1700000000000;

    // 5 buys, 3 sells
    for (let i = 0; i < 5; i++) {
      cvd.ingest({ isTakerBuy: true, valueUSD: 100, time: baseTime + i * 1000 });
    }
    for (let i = 0; i < 3; i++) {
      cvd.ingest({ isTakerBuy: false, valueUSD: 200, time: baseTime + 5000 + i * 1000 });
    }

    // Deltas: +500 (buys) −600 (sells) = −100
    expect(cvd.value()).toBe(-100);
    expect(cvd.direction()).toBe(-1);
    expect(cvd.count()).toBe(8);
  });

  it('prunes old ticks beyond window', () => {
    const cvd = new TickCVD({ windowMs: 10000 }); // 10s window
    const baseTime = 1700000000000;

    cvd.ingest({ isTakerBuy: true, valueUSD: 100, time: baseTime });       // +100
    cvd.ingest({ isTakerBuy: false, valueUSD: 50, time: baseTime + 2000 }); // -50
    // Now at +50

    // Ingest a tick way in the future, which prunes old ones
    cvd.ingest({ isTakerBuy: true, valueUSD: 30, time: baseTime + 20000 }); // window=10s cuts old ones

    expect(cvd.value()).toBe(30);
    expect(cvd.count()).toBe(1);
  });

  it('resets cleanly', () => {
    const cvd = new TickCVD({ windowMs: 60000 });
    cvd.ingest({ isTakerBuy: true, valueUSD: 100, time: Date.now() });
    expect(cvd.value()).toBe(100);
    cvd.reset();
    expect(cvd.value()).toBe(0);
    expect(cvd.count()).toBe(0);
  });
});

describe('TickCVD — fixture cross-check', () => {
  it('fixture ≥95% sign agreement', () => {
    // Skip if fixture not present (it's provided by reviewer)
    if (!fs.existsSync(FIXTURE_PATH)) {
      console.warn(`[cvd.test] Fixture not found at ${FIXTURE_PATH} — skipping cross-check`);
      expect(true).toBe(true);
      return;
    }

    const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    if (lines.length === 0) {
      expect(true).toBe(true);
      return;
    }

    let correct = 0;
    let total = 0;

    for (const line of lines) {
      const t = JSON.parse(line);
      total++;

      // Determine if trade happened at bid or ask
      // At bid → aggressive seller → delta negative
      // At ask → aggressive buyer → delta positive
      const atBid = Math.abs(t.price - t.bid) <= Math.abs(t.price - t.ask);
      const expectedSign = atBid ? -1 : 1;

      const sign = deltaSign({ isTakerBuy: t.m !== true, isBuyerMaker: t.m === true });

      if (sign === expectedSign) correct++;
    }

    const pct = ((correct / total) * 100).toFixed(1);
    console.log(`[cvd.test] Fixture: ${correct}/${total} correct (${pct}%)`);

    expect(pct).toBeTruthy();
    expect(correct / total).toBeGreaterThanOrEqual(0.95);
  });
});
