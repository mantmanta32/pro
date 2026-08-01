#!/usr/bin/env node
// live_probe.mjs — Headless flow signal probe
// Run: node scripts/live_probe.mjs [--symbol BTCUSDT] [--duration 600]
// Connects 3 streams (aggTrade, depth, bookTicker) via 2026 URLs.
// Produces: reports/probe_<timestamp>.json

import WebSocket from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAggTrade, parseDepthUpdate, parseBookTicker, formatSymbol } from '../src/services/binance.js';
import { TickCVD } from '../src/signals/cvd.js';
import { OBIEngine } from '../src/signals/obi.js';
import { SignalTracker } from '../src/signals/tracker.js';
import { SignalEngine } from '../src/signals/engine.js';
import { LatencyMetrics } from '../src/signals/metrics.js';
import { ROUND_TRIP_BPS } from '../src/config/fees.js';

// ── CLI args ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const SYMBOL = formatSymbol(args[args.indexOf('--symbol') + 1] || 'BTCUSDT');
const DURATION_SEC = parseInt(args[args.indexOf('--duration') + 1] || '600', 10);
const REPORT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'reports');

// ── URLs (2026 structure) ────────────────────────────────────
const WS_BASE = 'wss://fstream.binance.com';
const MARKET_URL = `${WS_BASE}/market/stream?streams=${SYMBOL.toLowerCase()}@aggTrade`;
const PUBLIC_URL = `${WS_BASE}/public/stream?streams=${SYMBOL.toLowerCase()}@depth@100ms/${SYMBOL.toLowerCase()}@bookTicker`;

// ── Engine setup ──────────────────────────────────────────────
const obi = new OBIEngine({ levels: 20 });
const cvd = new TickCVD({ windowMs: 60000 });
const tracker = new SignalTracker({ tpPct: 4, slPct: 2, timeoutMs: 300000 });
const engine = new SignalEngine({ obi, cvd, tracker, thresholds: { obiLong: 0.6, obiShort: 0.6, obiExit: 0.2 } });
const latency = new LatencyMetrics({ windowMs: 300000 });

// ── Counters ─────────────────────────────────────────────────
const counters = { aggTrade: 0, depthUpdate: 0, bookTicker: 0 };
const signals = [];
const crossCheck = { total: 0, correct: 0 };
let lastBook = null;
let startTime = Date.now();

// ── Helpers ──────────────────────────────────────────────────
function log(...args) { console.log(`[${new Date().toISOString()}]`, ...args); }

function writeReport() {
  const durationMs = Date.now() - startTime;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(REPORT_DIR, `probe_${SYMBOL}_${ts}.json`);

  const report = {
    probe: {
      symbol: SYMBOL,
      durationSec: Math.round(durationMs / 1000),
      startedAt: new Date(startTime).toISOString(),
      feeModel: { roundTripBps: ROUND_TRIP_BPS, takerBps: 4, makerBps: 2 },
    },
    counters,
    engine: engine.snapshot(),
    latency: latency.snapshot(),
    cvdCrossCheck: {
      total: crossCheck.total,
      correct: crossCheck.correct,
      pct: crossCheck.total > 0 ? ((crossCheck.correct / crossCheck.total) * 100).toFixed(1) + '%' : 'N/A',
    },
    signals,
    lastObi: obi.compute(),
    lastCvd: cvd.value(),
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  log(`✅ Report written: ${file}`);
  return report;
}

// ── Stream handlers ──────────────────────────────────────────
function handleMessage(data) {
  const obj = JSON.parse(data.toString());
  if (!obj || !obj.stream) return;

  // ── aggTrade ───────────────────────────────────────────────
  if (obj.stream.endsWith('@aggTrade')) {
    const trade = parseAggTrade({ ...obj.data, e: 'aggTrade' });
    if (!trade) return;
    counters.aggTrade++;

    // Latency
    if (obj.data.E) latency.record(obj.data.E);

    // CVD
    cvd.ingest(trade);

    // CVD cross-check: trade price vs best bid/ask
    if (lastBook) {
      crossCheck.total++;
      const atBid = Math.abs(trade.price - lastBook.bestBid) <= Math.abs(trade.price - lastBook.bestAsk);
      const expectedSign = atBid ? -1 : 1;
      const sign = trade.isTakerBuy ? 1 : -1;
      if (sign === expectedSign) crossCheck.correct++;
    }

    // Evaluate engine with current price
    const currentPrice = trade.price;
    const currentTime = obj.data.E || Date.now();
    const result = engine.evaluate(currentPrice, currentTime);
    if (result.signal !== 'NONE') {
      signals.push({ time: new Date().toISOString(), signal: result.signal, reason: result.reason, price: currentPrice });
    }
    return;
  }

  // ── depthUpdate ────────────────────────────────────────────
  if (obj.stream.endsWith('@depth@100ms')) {
    const depth = parseDepthUpdate({ ...obj.data, e: 'depthUpdate' });
    if (!depth) return;
    counters.depthUpdate++;

    if (obj.data.E) latency.record(obj.data.E);

    const applied = obi.apply(depth);
    if (applied.gap) {
      log('⚠️ Depth gap detected — resubscribing...');
      obi.reset();
      // Flag for resubscribe (probe can't restart streams, but engine flags it)
      obi.resubscribeCount++;
    }
    return;
  }

  // ── bookTicker ─────────────────────────────────────────────
  if (obj.stream.endsWith('@bookTicker')) {
    const bt = parseBookTicker({ ...obj.data, e: 'bookTicker' });
    if (!bt) return;
    counters.bookTicker++;
    lastBook = bt;
    return;
  }
}

// ── Connection with exponential backoff + watchdog ───────────
function connect(url, label) {
  const ws = new WebSocket(url);
  let silentTries = 0;
  let lastMsg = Date.now();

  ws.on('open', () => {
    log(`✅ Connected: ${label}`);
    silentTries = 0;
    lastMsg = Date.now();
  });

  ws.on('message', (data) => {
    lastMsg = Date.now();
    if (typeof data === 'string') {
      handleMessage(data);
    }
  });

  ws.on('error', (err) => {
    log(`❌ ${label} error:`, err.message);
  });

  ws.on('close', () => {
    log(`🔌 ${label} closed`);
    const delay = Math.min(30000, 1000 * Math.pow(2, silentTries) + Math.random() * 1000);
    silentTries++;
    setTimeout(() => connect(url, label), delay);
  });

  // Watchdog: reconnect if no messages for 30s
  const watchdog = setInterval(() => {
    if (Date.now() - lastMsg > 30000) {
      log(`🐕 ${label} watchdog: 30s silence → reconnect`);
      ws.close();
      clearInterval(watchdog);
    }
  }, 15000);

  return ws;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  log(`🚀 Starting probe for ${SYMBOL}, ${DURATION_SEC}s`);
  log(`   Market: ${MARKET_URL}`);
  log(`   Public: ${PUBLIC_URL}`);

  // Initialize OBI from snapshot
  try {
    await obi.init(SYMBOL);
    log(`📊 OBI initialized: ${obi.bids.size} bids, ${obi.asks.size} asks`);
  } catch (err) {
    log(`⚠️ OBI snapshot failed (will init from stream): ${err.message}`);
    obi.ready = false;
  }

  // Connect streams
  const ws1 = connect(MARKET_URL, 'market (aggTrade)');
  const ws2 = connect(PUBLIC_URL, 'public (depth+bookTicker)');

  // Progress log
  const progressInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const obiVal = obi.ready ? obi.compute().toFixed(4) : 'init...';
    log(`⏱ ${elapsed}s | agg:${counters.aggTrade} depth:${counters.depthUpdate} bt:${counters.bookTicker} | OBI:${obiVal} CVD:${cvd.value().toFixed(0)} | signals:${signals.length}`);
  }, 30000);

  // Stop after duration
  setTimeout(() => {
    clearInterval(progressInterval);
    log('⏰ Duration reached — shutting down...');
    ws1.close();
    ws2.close();

    const report = writeReport();
    log('📋 Summary:');
    log(`   aggTrades: ${counters.aggTrade}`);
    log(`   depthUpdates: ${counters.depthUpdate}`);
    log(`   bookTickers: ${counters.bookTicker}`);
    log(`   signals: ${signals.length}`);
    log(`   CVD cross-check: ${crossCheck.correct}/${crossCheck.total} (${report.cvdCrossCheck.pct})`);
    log(`   latency p50: ${report.latency.p50}ms p99: ${report.latency.p99}ms`);
    log(`   trades: ${report.engine.tracker?.closedCount || 0} closed, net PnL: $${(report.engine.tracker?.totalNetPnl || 0).toFixed(4)}`);

    process.exit(0);
  }, DURATION_SEC * 1000);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
