export default function StatusBar({ isConnected, statusText }) {
  return (
    <div className="status-bar">
      <div className="status-indicator">
        <div className={`status-dot ${isConnected ? 'online' : ''}`} />
        <span className="status-text">{statusText}</span>
      </div>
      <div className="status-info">
        Binance • Gerçek Zamanlı
      </div>
    </div>
  );
}
