/** Ink Bloom's colour options. colors = [mid ink, deep ink]; Night is the only dark one. */
export const INK_PALETTES = {
  indigo: { label: 'Indigo', bg: '#f6f4f0', colors: ['#4b56b0', '#161b4d'] },
  rose: { label: 'Rose', bg: '#faf3f1', colors: ['#d0708f', '#6b1f3a'] },
  emerald: { label: 'Emerald', bg: '#f2f5f1', colors: ['#3a9a7c', '#0f3b30'] },
  charcoal: { label: 'Charcoal', bg: '#f4f3f1', colors: ['#6a6a73', '#1b1b20'] },
  night: { label: 'Night', bg: '#0b0d18', colors: ['#5d6cff', '#c9d1ff'] },
} as const

export type InkPaletteId = keyof typeof INK_PALETTES

export const INK_PALETTE_IDS = Object.keys(INK_PALETTES) as InkPaletteId[]
