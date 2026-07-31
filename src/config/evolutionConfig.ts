/**
 * Evrimsel optimizasyon konfigürasyonu.
 * Anlık evrim modeli: her sinyal kapandığında tetiklenir, zamanlayıcı yok.
 * DB'de her coin için ayrı parametre popülasyonu tutulur.
 */
export const evolutionConfig = {
  /** Popülasyondaki birey (parametre seti) sayısı */
  populationSize: 8,

  /** Elitizm: her nesilde doğrudan aktarılan en iyi birey sayısı */
  elitismCount: 3,

  /** Mutasyon oranı (0-1): bir parametrenin mutasyona uğrama olasılığı */
  mutationRate: 0.15,

  /** Mutasyon büyüklüğü (parametre aralığının yüzdesi olarak) */
  mutationScale: 0.1,

  /** Evrim tetiklenmeden önce toplanması gereken minimum kapanmış sinyal sayısı */
  minClosedSignals: 30,

  /** Fitness bileşenlerinin ağırlıkları (toplam 1.0 olmalı) */
  fitnessWeights: {
    successRate: 0.30,    // başarı oranı
    avgRMultiple: 0.25,   // ortalama R-multiple
    wilsonLowerBound: 0.25, // Wilson alt sınır (küçük örneklem cezası)
    maxDrawdown: 0.10,    // maksimum drawdown (ters ağırlıklı)
    sampleCount: 0.10,    // örneklem büyüklüğü bonusu
  },

  /** Wilson score z-değeri (%95 güven → 1.96) */
  wilsonZ: 1.96,

  /** Rollback eşiği: yeni nesil fitness'ı öncekinden bu kadar düşükse geri al */
  rollbackThreshold: 0.05,

  /** R-multiple hesaplamada kullanılacak stop-loss oranı (%) */
  defaultStopLossPct: 2.0,

  /** Sinyal yönüne göre kullanılacak take-profit oranı (%) */
  defaultTakeProfitPct: 4.0,
} as const

export type EvolutionConfig = typeof evolutionConfig
