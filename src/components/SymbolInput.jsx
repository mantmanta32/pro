import { useState } from 'react';

export default function SymbolInput({ currentSymbol, onUpdate }) {
  const [inputValue, setInputValue] = useState(currentSymbol.replace('USDT', ''));

  const handleSubmit = (e) => {
    e.preventDefault();
    const newSymbol = inputValue.trim();
    if (newSymbol) {
      onUpdate(newSymbol);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="symbol-form">
      <div className="symbol-input-group">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder="BTC"
          className="symbol-input"
          maxLength={10}
        />
        <span className="symbol-suffix">USDT</span>
      </div>
      <button type="submit" className="update-btn">
        GÜNCELLE
      </button>
    </form>
  );
}
