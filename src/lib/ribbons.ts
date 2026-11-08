export const RIBBON_PALETTES = {
  'teal-magenta': { label: 'Teal & Magenta', bg: '#03050a', a: '#1de9c3', b: '#e535c9' },
  'blue-pink': { label: 'Blue & Pink', bg: '#04050f', a: '#3b82f6', b: '#f472b6' },
  'gold-rose': { label: 'Gold & Rose', bg: '#0a0605', a: '#f5c26b', b: '#fb7185' },
  'green-cyan': { label: 'Green & Cyan', bg: '#020a07', a: '#34d399', b: '#22d3ee' },
  'violet-orange': { label: 'Violet & Orange', bg: '#07040d', a: '#a78bfa', b: '#fb923c' },
  cream: { label: 'Cream', bg: '#f6efe4', a: '#c98a5a', b: '#b06a8c' },
} as const

export type RibbonPaletteId = keyof typeof RIBBON_PALETTES

export const RIBBON_PALETTE_IDS = Object.keys(RIBBON_PALETTES) as RibbonPaletteId[]

export const DEFAULT_RIBBON_PALETTE: RibbonPaletteId = 'teal-magenta'

export const RIBBON_STORAGE_KEY = 'vibekin-ribbons-palette'

export const isRibbonPaletteId = (id: string | null): id is RibbonPaletteId => !!id && id in RIBBON_PALETTES
