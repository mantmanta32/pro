export default function StatusBar({ isConnected, statusText, liqConnected, whaleConnected }) {
  return (
    <div className="status-bar">
      <div className="status-indicator">
        <div className={`status-dot ${isConnected ? 'online' : ''}`} />
        <span className="status-text">{statusText}</span>
      </div>
      {liqConnected !== undefined && (
        <div className="status-indicator feed-status">
          <div className={`status-mini-dot ${liqConnected ? 'online' : ''}`} />
          <span className="status-text">Liq</span>
        </div>
      )}
      {whaleConnected !== undefined && (
        <div className="status-indicator feed-status">
          <div className={`status-mini-dot ${whaleConnected ? 'online' : ''}`} />
          <span className="status-text">Whale</span>
        </div>
      )}
      <div className="status-info">
        Binance • Gerçek Zamanlı
      </div>
    </div>
  );
}