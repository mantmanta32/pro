/**
 * Tema renk token'ları — Tailwind v4 @theme bloğu ile index.css'te tanımlandı.
 * Bu dosya, JS/TS tarafında tema değerlerine erişim için export sağlar.
 * (Grafik kütüphaneleri, canvas işlemleri, dinamik stil için referans.)
 */
export const theme = {
  bg: {
    primary: '#1a0a1e',
    secondary: '#22102a',
    card: '#2d1540',
    cardHover: '#3a1d54',
    input: '#1e0d26',
  },
  text: {
    primary: '#f0e0f8',
    secondary: '#c0a0d8',
    muted: '#8868a4',
  },
  accent: {
    primary: '#d478d4',
    secondary: '#b06ab0',
    glow: '#e890e8',
  },
  status: {
    success: '#7ee0a0',
    danger: '#f08080',
    warning: '#e0c070',
    info: '#80b8e0',
  },
  signal: {
    bullish: '#5ee080',
    bearish: '#f06070',
    neutral: '#888',
  },
  confidence: {
    high: '#5ee080',
    mid: '#e0c070',
    low: '#f06070',
  },
  border: '#3a2050',
  borderGlow: '#6a4090',
} as const

export type Theme = typeof theme
