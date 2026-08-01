// Binance API Service - Updated for 2026 WebSocket URL migration
//
// After 2026-04-23 legacy URLs decommissioned:
//   Public (high-freq): wss://fstream.binance.com/public/ws/...
//   Market (regular):   wss://fstream.binance.com/market/ws/...
//   Private (user):     wss://fstream.binance.com/private/ws...
//
// Stream mapping:
//   Kline/Candlestick → Market
//   Liquidations      → Market
//   Aggregate Trades  → Market
//   Book Ticker       → Public
//   Depth             → Public

// ── REST endpoints ────────────────────────────────────────────
const SPOT_REST  = 'https://api.binance.com/api/v3';
const FUT_REST   = 'https://fapi.binance.com/fapi/v1';

// ── WebSocket endpoints (2026 new structure) ──────────────────
const WS_MARKET  = 'wss://fstream.binance.com/market';
const WS_PUBLIC  = 'wss://fstream.binance.com/public';

// ── Klines (spot REST, futures WS for real-time) ──────────────
export const fetchKlines = async (symbol, interval, limit = 200) => {
  const url = `${SPOT_REST}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kline API error: ${res.status}`);
  const data = await res.json();
  return data.map((d) => ({
    time: d[0] / 1000,
    open: parseFloat(d[1]),
    high: parseFloat(d[2]),
    low: parseFloat(d[3]),
    close: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  }));
};

// ── 24h Ticker (spot REST) ────────────────────────────────────
export const fetch24hTicker = async (symbol) => {
  const url = `${SPOT_REST}/ticker/24hr?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Ticker API error');
  const data = await res.json();
  return { price: parseFloat(data.lastPrice), change: parseFloat(data.priceChangePercent),
    high: parseFloat(data.highPrice), low: parseFloat(data.lowPrice), volume: parseFloat(data.volume) };
};

// ── Futures Open Interest ─────────────────────────────────────
export const fetchOpenInterest = async (symbol) => {
  const url = `${FUT_REST}/openInterest?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return { openInterest: parseFloat(data.openInterest), timestamp: data.time };
};

// ── WebSocket URL builders ───────────────────────────────────
export const getWebSocketUrl = (symbol, interval) =>
  `${WS_MARKET}/ws/${symbol.toLowerCase()}@kline_${interval}`;
export const getLiquidationWsUrl = () => `${WS_MARKET}/ws/!forceOrder@arr`;
export const getAggTradeWsUrl = (symbol) => `${WS_MARKET}/ws/${symbol.toLowerCase()}@aggTrade`;
export const getDepthWsUrl = (symbol, speed = 100) => `${WS_PUBLIC}/ws/${symbol.toLowerCase()}@depth@${speed}ms`;
export const getBookTickerWsUrl = (symbol) => `${WS_PUBLIC}/ws/${symbol.toLowerCase()}@bookTicker`;
export const getCombinedStreamUrl = (type, streams) => {
  const base = type === 'public' ? WS_PUBLIC : WS_MARKET;
  return `${base}/stream?streams=${streams.join('/')}`;
};

// ── Symbol formatter ──────────────────────────────────────────
export const formatSymbol = (input) => {
  let sym = input.trim().toUpperCase();
  if (!sym.endsWith('USDT')) sym += 'USDT';
  return sym;
};

// ── Parsers ───────────────────────────────────────────────────
export const parseLiquidationEvent = (data) => {
  try {
    const json = typeof data === 'string' ? JSON.parse(data) : data;
    if (json.e !== 'forceOrder') return null;
    const o = json.o;
    return { symbol: o.s, side: o.S, price: parseFloat(o.ap) || parseFloat(o.p),
      quantity: parseFloat(o.q), valueUSD: (parseFloat(o.ap) || parseFloat(o.p)) * parseFloat(o.q),
      time: json.E, orderType: o.o, timeInForce: o.f, status: o.X,
      symbolType: json.st || null, pairSymbol: json.ps || o.s };
  } catch (e) { return null; }
};

// Key: m=true → buyer is maker → seller is aggressive taker → bearish
//      m=false → buyer is taker → buyer is aggressive → bullish
export const parseAggTrade = (data) => {
  try {
    const json = typeof data === 'string' ? JSON.parse(data) : data;
    if (json.e !== 'aggTrade') return null;
    const price = parseFloat(json.p), qty = parseFloat(json.q);
    return { symbol: json.s, price, quantity: qty, valueUSD: price * qty,
      time: json.E || json.T, tradeTime: json.T,
      isBuyerMaker: json.m === true, isTakerBuy: json.m !== true,
      aggTradeId: json.a, symbolType: json.st || null };
  } catch (e) { return null; }
};

// { e: "bookTicker", s, b, B, a, A }
export const parseBookTicker = (data) => {
  try {
    const json = typeof data === 'string' ? JSON.parse(data) : data;
    if (json.e !== 'bookTicker') return null;
    return { symbol: json.s, bestBid: parseFloat(json.b), bestBidQty: parseFloat(json.B),
      bestAsk: parseFloat(json.a), bestAskQty: parseFloat(json.A) };
  } catch (e) { return null; }
};

// { e: "depthUpdate", E, s, U, u, b: [[p,q],...], a: [[p,q],...] }
export const parseDepthUpdate = (data) => {
  try {
    const json = typeof data === 'string' ? JSON.parse(data) : data;
    if (json.e !== 'depthUpdate') return null;
    return { symbol: json.s, eventTime: json.E, U: json.U, u: json.u,
      b: json.b, a: json.a };
  } catch (e) { return null; }
};

// Exported for probe harness
export { WS_MARKET, WS_PUBLIC, FUT_REST, SPOT_REST };
