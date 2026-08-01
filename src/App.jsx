import { useMemo } from 'react';
import { useCryptoChart } from './hooks/useCryptoChart';
import { useLiquidation } from './hooks/useLiquidation';
import { useWhaleTrades } from './hooks/useWhaleTrades';
import { generateLiquidationMarkers, generateWhaleMarkers, formatLiqSize } from './utils/indicators';
import Chart from './components/Chart';
import SymbolInput from './components/SymbolInput';
import TimeframeSelector from './components/TimeframeSelector';
import PriceStats from './components/PriceStats';
import StatusBar from './components/StatusBar';

import './App.css';

function App() {
  const {
    symbol, timeframe, candles, ticker,
    isConnected, statusText, error, signals,
    changeSymbol, changeTimeframe,
  } = useCryptoChart();

  const { liquidations, liqConnected, allLiqStats } = useLiquidation(symbol);
  const { whaleTrades, whaleStats, whaleConnected } = useWhaleTrades(symbol);

  // Merge all chart markers (signals + liquidations + whales)
  const mergedSignals = useMemo(() => {
    if (!signals) return null;
    const liqMarkers = generateLiquidationMarkers(liquidations, candles);
    const whaleMarkers = generateWhaleMarkers(whaleTrades, candles);
    return {
      ...signals,
      markers: [...signals.markers, ...liqMarkers, ...whaleMarkers],
    };
  }, [signals, liquidations, whaleTrades, candles]);

  return (
    <div className="crypto-app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">📈</span>
            <span className="logo-text">CryptoLive</span>
          </div>
          <div className="header-subtitle">Binance Gerçek Zamanlı Grafik</div>
        </div>
        <StatusBar isConnected={isConnected} statusText={statusText}
          liqConnected={liqConnected} whaleConnected={whaleConnected} />
      </header>

      {/* Controls */}
      <div className="controls">
        <div className="controls-left">
          <SymbolInput currentSymbol={symbol} onUpdate={changeSymbol} />
        </div>
        <div className="controls-right">
          <TimeframeSelector current={timeframe} onChange={changeTimeframe} />
        </div>
      </div>

      {/* Liquidation + Whale Stats Bar */}
      <div className="liq-stats-bar">
        <div className="stats-section">
          <span className="stats-section-label">Liq</span>
          <div className="liq-stat">
            <span className="liq-stat-dot liq-dot-red"></span>
            <span className="liq-stat-val">{allLiqStats.totalLongs}</span>
          </div>
          <div className="liq-stat">
            <span className="liq-stat-dot liq-dot-green"></span>
            <span className="liq-stat-val">{allLiqStats.totalShorts}</span>
          </div>
          <div className="liq-stat">
            <span className="liq-stat-label">Vol</span>
            <span className="liq-stat-val">{formatLiqSize(allLiqStats.totalVol)}</span>
          </div>
        </div>

        <div className="stats-section">
          <span className="stats-section-label">🐋 Whale</span>
          <div className="liq-stat">
            <span className="liq-stat-dot liq-dot-blue"></span>
            <span className="liq-stat-val">{whaleStats.totalWhales}</span>
          </div>
          <div className="liq-stat">
            <span className="liq-stat-dot liq-dot-purple"></span>
            <span className="liq-stat-val">{whaleStats.totalMega}</span>
          </div>
          <div className="liq-stat">
            <span className="liq-stat-label">Vol</span>
            <span className="liq-stat-val">{formatLiqSize(whaleStats.totalVol)}</span>
          </div>
        </div>

        <div className="stats-section stats-feeds">
          <span className={`liq-conn-dot ${liqConnected ? 'online' : ''}`}></span>
          <span className="liq-stat-label">Liq</span>
          <span className={`liq-conn-dot ${whaleConnected ? 'online' : ''}`}></span>
          <span className="liq-stat-label">Whale</span>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="chart-section">
        <div className="chart-header">
          <div className="chart-title">
            <span className="pair">{symbol}</span>
            <span className="exchange">/ USDT</span>
          </div>
          <PriceStats ticker={ticker} symbol={symbol} />
        </div>

        {/* Legend */}
        <div className="indicator-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#f59e0b' }}></span><span>CVD</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#a78bfa' }}></span><span>EMA 9</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ background: '#60a5fa' }}></span><span>EMA 21</span>
          </div>
          <div className="legend-item signal-legend">
            <span className="legend-icon">▲</span><span>AL / 💪 AL</span>
          </div>
          <div className="legend-item signal-legend">
            <span className="legend-icon" style={{ color: '#ef4444' }}>▼</span><span>SAT / 💪 SAT</span>
          </div>
          <div className="legend-item liq-legend"><span>💀</span><span>Long Liq</span></div>
          <div className="legend-item liq-legend"><span>💰</span><span>Short Liq</span></div>
          <div className="legend-item whale-legend"><span>🐋</span><span>Whale</span></div>
          <div className="legend-item whale-legend"><span>🦈</span><span>Mega</span></div>
          <div className="legend-item whale-legend"><span>⚡</span><span>Absorb</span></div>
        </div>

        <div className="chart-wrapper">
          <Chart candles={candles} signals={mergedSignals} onChartReady={() => {}} />
          {error && (
            <div className="chart-error">
              <p>⚠️ {error}</p>
              <button onClick={() => window.location.reload()}>Yeniden Dene</button>
            </div>
          )}
          {!candles.length && !error && (
            <div className="chart-loading">
              <div className="loader"></div>
              <p>Veriler yükleniyor...</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="app-footer">
        <div className="footer-info">
          <span>Veri Kaynağı: Binance Spot + Futures</span>
          <span>•</span>
          <span>WebSocket /market + /public (2026 API)</span>
        </div>
        <div className="footer-note">Bu uygulama sadece eğitim amaçlıdır.</div>
      </div>
    </div>
  );
}

export default App;
