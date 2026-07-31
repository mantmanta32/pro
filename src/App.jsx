import { useCryptoChart } from './hooks/useCryptoChart';
import Chart from './components/Chart';
import SymbolInput from './components/SymbolInput';
import TimeframeSelector from './components/TimeframeSelector';
import PriceStats from './components/PriceStats';
import StatusBar from './components/StatusBar';

import './App.css';

function App() {
  const {
    symbol,
    timeframe,
    candles,
    ticker,
    isConnected,
    statusText,
    error,
    changeSymbol,
    changeTimeframe,
  } = useCryptoChart();

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

        <StatusBar isConnected={isConnected} statusText={statusText} />
      </header>

      {/* Controls */}
      <div className="controls">
        <div className="controls-left">
          <SymbolInput 
            currentSymbol={symbol} 
            onUpdate={changeSymbol} 
          />
        </div>

        <div className="controls-right">
          <TimeframeSelector 
            current={timeframe} 
            onChange={changeTimeframe} 
          />
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

        <div className="chart-wrapper">
          <Chart 
            candles={candles} 
            onChartReady={() => {}} 
          />
          
          {error && (
            <div className="chart-error">
              <p>⚠️ {error}</p>
              <button onClick={() => window.location.reload()}>
                Yeniden Dene
              </button>
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

      {/* Footer Info */}
      <div className="app-footer">
        <div className="footer-info">
          <span>Veri Kaynağı: Binance</span>
          <span>•</span>
          <span>Gerçek zamanlı WebSocket + REST</span>
        </div>
        <div className="footer-note">
          Bu uygulama sadece eğitim amaçlıdır.
        </div>
      </div>
    </div>
  );
}

export default App;
