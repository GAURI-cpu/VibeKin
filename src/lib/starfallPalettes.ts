/** Starfall's colour options. colors = [left glow, main body, right glow, accent]; rain tints the falling streaks. */
export const STARFALL_PALETTES = {
  'blue-galaxy': { label: 'Blue Galaxy', bg: '#02030c', colors: ['#8b3dff', '#2b44ff', '#19c9f0', '#3ddfa8'], rain: '#bfe6ff' },
  'pink-nebula': { label: 'Pink Nebula', bg: '#07020a', colors: ['#ff3d9a', '#8a2bd9', '#ff8a5b', '#ffd36b'], rain: '#ffd1ea' },
  'teal-deep': { label: 'Teal Deep', bg: '#010808', colors: ['#2b7bff', '#0fa3a3', '#3df2c7', '#b4ff6b'], rain: '#c9fff2' },
  'violet-dream': { label: 'Violet Dream', bg: '#05030c', colors: ['#d36bff', '#5b3dff', '#ff7ad9', '#7ab8ff'], rain: '#e8dcff' },
} as const

export type StarfallPaletteId = keyof typeof STARFALL_PALETTES

export const STARFALL_PALETTE_IDS = Object.keys(STARFALL_PALETTES) as StarfallPaletteId[]

export const DEFAULT_STARFALL_PALETTE: StarfallPaletteId = 'blue-galaxy'

export const STARFALL_STORAGE_KEY = 'vibekin-starfall-palette'

export const isStarfallPaletteId = (id: string | null): id is StarfallPaletteId =>
  id !== null && Object.prototype.hasOwnProperty.call(STARFALL_PALETTES, id)
