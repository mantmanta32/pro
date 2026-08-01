// CVD test — validates delta sign correctness
// Fixture: /home/user/cvd_fixture.jsonl
// Fields: p (price), m (buyerIsMaker), q (qty), V (valueUSD),
//          at_bid (trade at bid), at_ask (trade at ask), bid, ask
// Expected: m=true (buyer is maker) → aggressive seller → delta −
//           m=false (buyer is taker) → aggressive buyer → delta +

import { describe, it, expect } from 'vitest';
import { deltaSign, TickCVD } from '../cvd.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = '/home/user/cvd_fixture.jsonl';

describe('TickCVD — delta sign', () => {
  it('isTakerBuy=true → +1', () => { expect(deltaSign({ isTakerBuy: true })).toBe(1); });
  it('isTakerBuy=false → −1', () => { expect(deltaSign({ isTakerBuy: false })).toBe(-1); });
  it('m=true → buyer maker → seller taker → −1', () => {
    expect(deltaSign({ isBuyerMaker: true, isTakerBuy: false })).toBe(-1);
  });
  it('m=false → buyer taker → +1', () => {
    expect(deltaSign({ isBuyerMaker: false, isTakerBuy: true })).toBe(1);
  });
});

describe('TickCVD — rolling window', () => {
  it('accumulates delta in 1-min window', () => {
    const c = new TickCVD({ windowMs: 60000 });
    const t0 = 1700000000000;
    for (let i = 0; i < 5; i++) c.ingest({ isTakerBuy: true, valueUSD: 100, time: t0 + i * 1000 });
    for (let i = 0; i < 3; i++) c.ingest({ isTakerBuy: false, valueUSD: 200, time: t0 + 5000 + i * 1000 });
    expect(c.value()).toBe(-100);
    expect(c.direction()).toBe(-1);
    expect(c.count()).toBe(8);
  });
  it('prunes beyond window', () => {
    const c = new TickCVD({ windowMs: 10000 });
    const t0 = 1700000000000;
    c.ingest({ isTakerBuy: true, valueUSD: 100, time: t0 });
    c.ingest({ isTakerBuy: false, valueUSD: 50, time: t0 + 2000 });
    c.ingest({ isTakerBuy: true, valueUSD: 30, time: t0 + 20000 });
    expect(c.value()).toBe(30);
    expect(c.count()).toBe(1);
  });
  it('resets', () => {
    const c = new TickCVD({ windowMs: 60000 });
    c.ingest({ isTakerBuy: true, valueUSD: 100, time: Date.now() });
    c.reset();
    expect(c.value()).toBe(0);
  });
});

describe('TickCVD — fixture cross-check', () => {
  it('fixture ≥95% sign agreement using at_bid/at_ask', () => {
    if (!fs.existsSync(FIXTURE_PATH)) {
      console.warn(`[cvd.test] Fixture not found — skipping cross-check`);
      expect(true).toBe(true);
      return;
    }

    const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    if (lines.length === 0) { expect(true).toBe(true); return; }

    let correct = 0, total = 0;

    for (const line of lines) {
      const t = JSON.parse(line);

      // Use pre-computed at_bid / at_ask from fixture
      const hasBid = t.at_bid === true;
      const hasAsk = t.at_ask === true;

      // Skip ambiguous cases (at both or neither)
      if (hasBid === hasAsk) continue;

      total++;
      const expectedSign = hasBid ? -1 : 1;
      const sign = deltaSign({ isTakerBuy: t.m !== true, isBuyerMaker: t.m === true });

      if (sign === expectedSign) correct++;
    }

    const pct = ((correct / total) * 100).toFixed(1);
    console.log(`[cvd.test] Fixture: ${correct}/${total} correct (${pct}%)`);

    expect(total).toBeGreaterThan(0);
    expect(correct / total).toBeGreaterThanOrEqual(0.95);
  });
});
