// Utility formatters

export const formatPrice = (price) => {
  if (!price || isNaN(price)) return '—';
  if (price > 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (price > 1) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  if (price > 0.01) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }
  return price.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
};

export const formatVolume = (volume) => {
  if (!volume || isNaN(volume)) return '—';
  if (volume >= 1e9) return (volume / 1e9).toFixed(2) + 'B';
  if (volume >= 1e6) return (volume / 1e6).toFixed(2) + 'M';
  if (volume >= 1e3) return (volume / 1e3).toFixed(2) + 'K';
  return volume.toFixed(2);
};

export const formatChange = (change) => {
  if (!change || isNaN(change)) return '0.00%';
  const prefix = change >= 0 ? '+' : '';
  return `${prefix}${change.toFixed(2)}%`;
};
