import { useState, useEffect, useRef, useCallback } from 'react';
import { getAggTradeWsUrl, parseAggTrade } from '../services/binance';
import { formatLiqSize } from '../utils/indicators';

/**
 * Hook: Whale trade & absorption detection via Binance aggTrade stream.
 *
 * Detection levels:
 *   🐋 WHALE  → valueUSD above `whaleThreshold` (default $100K)
 *   🦈 MEGA   → valueUSD above `megaThreshold` (default $500K)
 *   ⚡ ABSORB → large volume but price barely moves (absorption)
 *
 * Returns:
 *   whaleTrades[]  — last N whale events for this symbol
 *   whaleStats     — running counts & totals
 *   whaleConnected — WebSocket status
 */

const WHALE_THRESHOLD  = 100000;   // $100K+
const MEGA_THRESHOLD   = 500000;   // $500K+
const MAX_WHALES       = 200;
const ABSORB_WINDOW    = 3000;     // 3s window for absorption check
const ABSORB_MIN_VOL   = 50000;    // min volume to consider absorption
const ABSORB_PRICE_PCT = 0.05;     // max 0.05% price move = absorption

export function useWhaleTrades(activeSymbol) {
  const [whaleTrades, setWhaleTrades] = useState([]);
  const [whaleStats, setWhaleStats] = useState({
    totalWhales: 0,
    totalMega: 0,
    buyVol: 0,
    sellVol: 0,
    totalVol: 0,
    lastWhale: null,
  });
  const [whaleConnected, setWhaleConnected] = useState(false);

  const wsRef = useRef(null);
  const bufferRef = useRef([]);
  const priceWindowRef = useRef([]);  // recent trades for absorption
  const isMountedRef = useRef(true);
  const activeSymbolRef = useRef(activeSymbol);
  activeSymbolRef.current = activeSymbol;

  const flushBuffer = useCallback(() => {
    const batch = bufferRef.current;
    if (batch.length === 0) return;
    const items = batch.splice(0);

    setWhaleTrades((prev) => {
      const updated = [...items, ...prev];
      return updated.slice(0, MAX_WHALES);
    });

    setWhaleStats((prev) => {
      const mega = items.filter((t) => t.level === 'mega').length;
      const whales = items.filter((t) => t.level === 'whale').length + mega;
      const bVol = items.filter((t) => t.isTakerBuy).reduce((s, t) => s + t.valueUSD, 0);
      const sVol = items.filter((t) => !t.isTakerBuy).reduce((s, t) => s + t.valueUSD, 0);
      return {
        totalWhales: prev.totalWhales + whales,
        totalMega: prev.totalMega + mega,
        buyVol: prev.buyVol + bVol,
        sellVol: prev.sellVol + sVol,
        totalVol: prev.totalVol + bVol + sVol,
        lastWhale: items[0] || prev.lastWhale,
      };
    });
  }, []);

  // Detect absorption: large volume with minimal price movement
  const checkAbsorption = useCallback((trade, recentTrades) => {
    if (recentTrades.length < 5) return false;
    if (trade.valueUSD < ABSORB_MIN_VOL) return false;

    const prices = recentTrades.map((t) => t.price);
    const avgPrice = prices.reduce((s, p) => s + p, 0) / prices.length;
    const pctChange = Math.abs((trade.price - avgPrice) / avgPrice) * 100;
    const totalVol = recentTrades.reduce((s, t) => s + t.valueUSD, 0);

    // Absorption: large cumulative volume but price barely moved
    return pctChange < ABSORB_PRICE_PCT && totalVol > ABSORB_MIN_VOL * 2;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    let intervalId = null;

    const connect = () => {
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }

      const sym = activeSymbolRef.current;
      const url = getAggTradeWsUrl(sym);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMountedRef.current) setWhaleConnected(true);
      };

      ws.onmessage = (event) => {
        const trade = parseAggTrade(event.data);
        if (!trade) return;

        // Track recent trades for absorption detection
        priceWindowRef.current.push(trade);
        if (priceWindowRef.current.length > 50) priceWindowRef.current.shift();
        const recent = priceWindowRef.current.filter(
          (t) => trade.time - t.time < ABSORB_WINDOW
        );

        const val = trade.valueUSD;
        let level = null;

        if (val >= MEGA_THRESHOLD) {
          level = 'mega';
        } else if (val >= WHALE_THRESHOLD) {
          level = 'whale';
        }

        // Also flag absorption (large quiet volume)
        const isAbsorb = level === null && checkAbsorption(trade, recent);

        if (level || isAbsorb) {
          bufferRef.current.push({
            ...trade,
            level: level || 'absorb',
            isAbsorption: isAbsorb,
          });
        }
      };

      ws.onerror = () => { if (isMountedRef.current) setWhaleConnected(false); };
      ws.onclose = () => {
        if (isMountedRef.current) {
          setWhaleConnected(false);
          setTimeout(connect, 5000);
        }
      };
    };

    connect();
    intervalId = setInterval(flushBuffer, 1000);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, []);

  // Reset on symbol change
  useEffect(() => {
    setWhaleTrades([]);
    setWhaleStats({ totalWhales: 0, totalMega: 0, buyVol: 0, sellVol: 0, totalVol: 0, lastWhale: null });
    bufferRef.current = [];
    priceWindowRef.current = [];
  }, [activeSymbol]);

  return { whaleTrades, whaleStats, whaleConnected };
}
