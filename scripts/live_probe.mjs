#!/usr/bin/env node
// live_probe.mjs — Headless flow signal probe (fixed: Buffer-safe, gap-recover, watchdog)
// Run: node scripts/live_probe.mjs [--symbol BTCUSDT] [--duration 600]

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
const getArg = (flag, def) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : def; };
const SYMBOL = formatSymbol(getArg('--symbol', 'BTCUSDT'));
const DURATION_SEC = parseInt(getArg('--duration', '600'), 10);
const REPORT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'reports');

// ── URLs (2026 structure) ────────────────────────────────────
const WS_BASE = 'wss://fstream.binance.com';
const S = SYMBOL.toLowerCase();
const MARKET_URL = `${WS_BASE}/market/stream?streams=${S}@aggTrade`;
const PUBLIC_URL = `${WS_BASE}/public/stream?streams=${S}@depth@100ms/${S}@bookTicker`;

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
let obiInitError = null;

// ── Helpers ──────────────────────────────────────────────────
function log(...a) { console.log(`[${new Date().toISOString()}]`, ...a); }

function writeReport() {
  const dur = Math.round((Date.now() - startTime) / 1000);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(REPORT_DIR, `probe_${SYMBOL}_${ts}.json`);
  const report = {
    probe: { symbol: SYMBOL, durationSec: dur, startedAt: new Date(startTime).toISOString(),
      feeModel: { roundTripBps: ROUND_TRIP_BPS, takerBps: 4, makerBps: 2 } },
    counters,
    obiReady: obi.ready,
    obiInitError: obiInitError || null,
    engine: engine.snapshot(),
    latency: latency.snapshot(),
    cvdCrossCheck: { ...crossCheck,
      pct: crossCheck.total > 0 ? ((crossCheck.correct / crossCheck.total) * 100).toFixed(1) + '%' : 'N/A' },
    signals,
    lastObi: obi.compute(),
    lastCvd: cvd.value(),
  };
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  log(`✅ Report: ${file}`);
  return report;
}

// ── Stream handler (Buffer-safe: always .toString()) ─────────
function handleMessage(raw) {
  const data = raw.toString();
  let obj;
  try { obj = JSON.parse(data); } catch { return; }
  if (!obj || !obj.stream) return;

  // ── aggTrade ───────────────────────────────────────────────
  if (obj.stream.endsWith('@aggTrade')) {
    const trade = parseAggTrade({ ...obj.data, e: 'aggTrade' });
    if (!trade) return;
    counters.aggTrade++;

    if (obj.data.E) latency.record(obj.data.E);

    // CVD
    cvd.ingest(trade);

    // CVD cross-check: trade price vs best bid/ask
    if (lastBook) {
      crossCheck.total++;
      const atBid = Math.abs(trade.price - lastBook.bestBid) <= Math.abs(trade.price - lastBook.bestAsk);
      if ((atBid && !trade.isTakerBuy) || (!atBid && trade.isTakerBuy)) crossCheck.correct++;
    }

    const result = engine.evaluate(trade.price, obj.data.E || Date.now());
    if (result.signal !== 'NONE') {
      signals.push({ time: new Date().toISOString(), signal: result.signal, reason: result.reason, price: trade.price });
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
      log('⚠️ Depth gap — re-initializing OBI...');
      obi.reset();
      obi.resubscribeCount++;
      // Re-init asynchronously
      obi.init(SYMBOL).then(() => {
        log('📊 OBI re-initialized after gap');
      }).catch((e) => {
        log('⚠️ OBI re-init failed:', e.message);
        obiInitError = e.message;
      });
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

// ── Connection (fixed: Buffer-safe + watchdog only on real silence) ─
function connect(url, label) {
  const ws = new WebSocket(url);
  let silentTries = 0;
  let lastMsg = Date.now();
  let connected = false;

  ws.on('open', () => {
    connected = true;
    log(`✅ Connected: ${label}`);
    silentTries = 0;
    lastMsg = Date.now();
  });

  ws.on('message', (data) => {
    // ws sends Buffer — convert and process
    handleMessage(data);
    lastMsg = Date.now(); // only update on successful processing
  });

  ws.on('error', (err) => { log(`❌ ${label} error:`, err.message); });

  ws.on('close', () => {
    connected = false;
    log(`🔌 ${label} closed`);
    const delay = Math.min(30000, 1000 * Math.pow(2, silentTries) + Math.random() * 1000);
    silentTries++;
    setTimeout(() => connect(url, label), delay);
  });

  // Watchdog
  const watchdog = setInterval(() => {
    if (connected && Date.now() - lastMsg > 45000) {
      log(`🐕 ${label} watchdog: 45s silence → reconnect`);
      ws.close();
      clearInterval(watchdog);
    }
  }, 15000);

  return ws;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  log(`🚀 Probe: ${SYMBOL}, ${DURATION_SEC}s`);
  log(`   Market: ${MARKET_URL}`);
  log(`   Public: ${PUBLIC_URL}`);

  try {
    await obi.init(SYMBOL);
    log(`📊 OBI: ${obi.bids.size} bids, ${obi.asks.size} asks`);
  } catch (err) {
    log(`⚠️ OBI snapshot failed: ${err.message}`);
    obiInitError = err.message;
    obi.ready = false;
  }

  const ws1 = connect(MARKET_URL, 'market');
  const ws2 = connect(PUBLIC_URL, 'public');

  const progress = setInterval(() => {
    const el = Math.round((Date.now() - startTime) / 1000);
    const o = obi.ready ? obi.compute().toFixed(4) : 'init...';
    log(`⏱ ${el}s | agg:${counters.aggTrade} depth:${counters.depthUpdate} bt:${counters.bookTicker} | OBI:${o} CVD:${cvd.value().toFixed(0)} | signals:${signals.length}`);
  }, 30000);

  setTimeout(() => {
    clearInterval(progress);
    log('⏰ Done — shutting down');
    ws1.close();
    ws2.close();
    const r = writeReport();
    log(`📋 agg:${counters.aggTrade} depth:${counters.depthUpdate} bt:${counters.bookTicker}`);
    log(`   cross-check: ${crossCheck.correct}/${crossCheck.total} (${r.cvdCrossCheck.pct})`);
    log(`   latency p50:${r.latency.p50}ms p99:${r.latency.p99}ms`);
    log(`   trades: ${r.engine.tracker?.closedCount || 0}, netPnL: $${(r.engine.tracker?.totalNetPnl || 0).toFixed(4)}`);
    process.exit(0);
  }, DURATION_SEC * 1000);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
