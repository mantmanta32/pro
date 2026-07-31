import { formatPrice, formatChange, formatVolume } from '../utils/formatters';

export default function PriceStats({ ticker, symbol }) {
  const { price, change, high, low, volume } = ticker;

  const changeClass = change >= 0 ? 'positive' : 'negative';

  return (
    <div className="price-stats">
      <div className="stat price-stat">
        <div className="stat-label">FİYAT</div>
        <div className="stat-value current-price" id="current-price">
          {formatPrice(price)}
        </div>
        <div className={`stat-change ${changeClass}`} id="price-change">
          {formatChange(change)}
        </div>
      </div>

      <div className="stat">
        <div className="stat-label">24S YÜKSEK</div>
        <div className="stat-value">{formatPrice(high)}</div>
      </div>

      <div className="stat">
        <div className="stat-label">24S DÜŞÜK</div>
        <div className="stat-value">{formatPrice(low)}</div>
      </div>

      <div className="stat">
        <div className="stat-label">24S HACİM</div>
        <div className="stat-value">{formatVolume(volume)}</div>
      </div>

      <div className="stat symbol-stat">
        <div className="stat-label">ÇİFT</div>
        <div className="stat-value symbol">{symbol}</div>
      </div>
    </div>
  );
}
