export default function StatusBar({ isConnected, statusText, liqConnected }) {
  return (
    <div className="status-bar">
      <div className="status-indicator">
        <div className={`status-dot ${isConnected ? 'online' : ''}`} />
        <span className="status-text">{statusText}</span>
      </div>
      {liqConnected !== undefined && (
        <div className="status-indicator liq-status">
          <div className={`status-mini-dot ${liqConnected ? 'online' : ''}`} />
          <span className="status-text">Liq</span>
        </div>
      )}
      <div className="status-info">
        Binance • Gerçek Zamanlı
      </div>
    </div>
  );
}