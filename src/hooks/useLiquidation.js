import { useState, useEffect, useRef, useCallback } from 'react';
import { getLiquidationWsUrl, parseLiquidationEvent } from '../services/binance';

/**
 * Hook for Binance Futures liquidation WebSocket feed (2026 /market structure).
 *
 * Tracks all liquidations across all symbols, filters for the active chart symbol,
 * and accumulates liquidation stats.
 */
export function useLiquidation(activeSymbol) {
  const [liquidations, setLiquidations] = useState([]);     // filtered for active symbol
  const [allLiqStats, setAllLiqStats] = useState({           // global stats
    totalLongs: 0,
    totalShorts: 0,
    totalVol: 0,
    lastEvent: null,
  });
  const [liqConnected, setLiqConnected] = useState(false);

  const wsRef = useRef(null);
  const bufferRef = useRef([]);
  const isMountedRef = useRef(true);
  const activeSymbolRef = useRef(activeSymbol);
  activeSymbolRef.current = activeSymbol;

  // Flush buffer at intervals (batch DOM updates)
  const flushBuffer = useCallback(() => {
    const symbol = activeSymbolRef.current;
    const items = bufferRef.current;
    if (items.length === 0) return;

    // Take a snapshot
    const batch = items.splice(0);

    setLiquidations((prev) => {
      const updated = [...batch, ...prev];
      return updated.slice(0, 200); // keep last 200
    });

    // Stats update for matching symbol
    setAllLiqStats((prev) => {
      const longs = batch.filter((l) => l.side === 'SELL').length;
      const shorts = batch.filter((l) => l.side === 'BUY').length;
      const vol = batch.reduce((s, l) => s + l.valueUSD, 0);
      return {
        totalLongs: prev.totalLongs + longs,
        totalShorts: prev.totalShorts + shorts,
        totalVol: prev.totalVol + vol,
        lastEvent: batch[0] || prev.lastEvent,
      };
    });
  }, []);

  // Connect WebSocket
  useEffect(() => {
    isMountedRef.current = true;
    let intervalId = null;

    const connect = () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const url = getLiquidationWsUrl();
      // 2026 new structure: wss://fstream.binance.com/market/ws/!forceOrder@arr
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMountedRef.current) setLiqConnected(true);
      };

      ws.onmessage = (event) => {
        const liq = parseLiquidationEvent(event.data);
        if (!liq) return;

        // Only buffer if it matches active symbol (USDS-M only, st=1 or undefined)
        if (liq.symbolType !== undefined && liq.symbolType !== 1) return;

        const sym = activeSymbolRef.current;
        if (liq.symbol === sym) {
          bufferRef.current.push(liq);
        }
      };

      ws.onerror = () => {
        if (isMountedRef.current) setLiqConnected(false);
      };

      ws.onclose = () => {
        if (isMountedRef.current) {
          setLiqConnected(false);
          setTimeout(connect, 5000); // reconnect
        }
      };
    };

    connect();
    intervalId = setInterval(flushBuffer, 1000);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []); // connect once

  // When symbol changes, clear filtered liquidations
  useEffect(() => {
    setLiquidations([]);
    setAllLiqStats({ totalLongs: 0, totalShorts: 0, totalVol: 0, lastEvent: null });
    bufferRef.current = [];
  }, [activeSymbol]);

  return {
    liquidations,       // array of liquidation events for active symbol
    liqConnected,       // WebSocket connection status
    allLiqStats,        // { totalLongs, totalShorts, totalVol, lastEvent }
  };
}
