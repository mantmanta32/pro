const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
  { label: '1w', value: '1w' },
];

export default function TimeframeSelector({ current, onChange }) {
  return (
    <div className="timeframe-selector">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf.value}
          onClick={() => onChange(tf.value)}
          className={`timeframe-btn ${current === tf.value ? 'active' : ''}`}
        >
          {tf.label}
        </button>
      ))}
    </div>
  );
}
