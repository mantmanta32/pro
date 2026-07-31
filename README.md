# 📈 CryptoLive - React + Vite

Modern, modüler yapıya sahip gerçek zamanlı kripto para grafik uygulaması.

**Özellikler:**
- Binance WebSocket + REST API entegrasyonu
- Lightweight Charts ile profesyonel mum grafiği
- Gerçek zamanlı fiyat ve hacim güncellemeleri
- Farklı zaman dilimleri (1m, 5m, 15m, 1h, 4h, 1d, 1w)
- Herhangi bir USDT çifti (örn: BTC, ETH, SOL)
- Tamamen modüler React yapısı

## Kullanılan Teknolojiler
- React 19 + Vite
- Lightweight Charts
- Custom Hooks & Service Layer

## Proje Yapısı (Modüler)

```
src/
├── components/
│   ├── Chart.jsx              # LightweightCharts wrapper
│   ├── PriceStats.jsx         # Fiyat, değişim, 24h istatistikleri
│   ├── StatusBar.jsx          # Bağlantı durumu
│   ├── SymbolInput.jsx        # Sembol değiştirme
│   └── TimeframeSelector.jsx  # Zaman dilimi seçici
├── hooks/
│   └── useCryptoChart.js      # Tüm state & WebSocket mantığı
├── services/
│   └── binance.js             # API çağrıları
├── utils/
│   └── formatters.js          # Fiyat/hacim formatlayıcıları
├── App.jsx
└── App.css
```

## Başlatma

```bash
npm install
npm run dev
```

Uygulama: http://localhost:5173

## Nasıl Kullanılır?

1. Sol üstteki inputa coin adı yaz (örn: `ETH`, `SOL`)
2. **GÜNCELLE** butonuna bas
3. Zaman dilimlerini üstteki butonlarla değiştir
4. Gerçek zamanlı mumlar ve fiyatlar anında güncellenir

---

Orijinal vanilla JS versiyonundan tamamen React + Vite modüler yapıya dönüştürülmüştür.
