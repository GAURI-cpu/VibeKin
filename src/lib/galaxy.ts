export type GalaxyItem = {
  id: string
  name: string
  tag: string
  description: string
  /** The export name in src/galaxy/backgrounds.tsx. */
  component: string
}

/** The one list the drawer card, the /galaxy grid and the detail pages all read. */
export const GALAXY_ITEMS: GalaxyItem[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    tag: 'Aesthetic',
    description: 'Curtains of light that ripple and shimmer across a night sky.',
    component: 'Aurora',
  },
  {
    id: 'milky-way',
    name: 'Milky Way',
    tag: 'Dreamy',
    description: 'A band of thousands of tiny stars, turning slowly across the sky.',
    component: 'MilkyWay',
  },
  {
    id: 'stardust',
    name: 'Stardust',
    tag: 'Cute',
    description: 'Soft pastel specks that float upward and twinkle as they go.',
    component: 'Stardust',
  },
  {
    id: 'black-hole',
    name: 'Black hole',
    tag: 'Luxury',
    description: 'A glowing disk of matter circling a perfectly dark centre.',
    component: 'BlackHole',
  },
  {
    id: 'comet-trail',
    name: 'Comet trail',
    tag: 'Playful',
    description: 'Comets streak across a quiet starry sky, trailing light behind them.',
    component: 'CometTrail',
  },
]

export type GalaxyPalette = {
  id: string
  label: string
  background: string
  colors: string[]
}

/**
 * The colour rail on the detail pages. Each background opens in its own colours;
 * a pick applies to that background only and is saved per id under PALETTE_STORAGE_KEY.
 */
export const GALAXY_PALETTES: GalaxyPalette[] = [
  { id: 'blue', label: 'Blue', background: '#070d24', colors: ['#5fa8ff', '#7ae0ff', '#c8d4ff'] },
  { id: 'pink', label: 'Pink', background: '#1f0a1c', colors: ['#ff7ac8', '#ffb3d9', '#ff8fa3'] },
  { id: 'cream', label: 'Cream', background: '#f6efe2', colors: ['#d9895b', '#c76b7e', '#7d8fc4'] },
  { id: 'green', label: 'Green', background: '#04140f', colors: ['#4fe3b0', '#9cf2c6', '#3fb8d0'] },
  { id: 'purple', label: 'Purple', background: '#120a2a', colors: ['#a98bff', '#d0b3ff', '#ff8fd0'] },
  { id: 'sunset', label: 'Sunset', background: '#1c0b14', colors: ['#ffb36b', '#ff7a6b', '#ffd27a'] },
]

export const PALETTE_STORAGE_KEY = 'vibekin-galaxy-palette'

/** Galaxy backgrounds that have their own interactive page, shown in the /galaxy grid after GALAXY_ITEMS. */
export type GalaxyLink = { id: string; name: string; tag: string; href: string }

export const GALAXY_LINKS: GalaxyLink[] = [
  { id: 'name-constellation', name: 'Name Constellation', tag: 'Interactive', href: '/constellation' },
  { id: 'wave-ribbons', name: 'Wave Ribbons', tag: 'Aesthetic', href: '/studio/wave-ribbons' },
  { id: 'starfall', name: 'Starfall', tag: 'Dreamy', href: '/starfall' },
]

export const GALAXY_COUNT = GALAXY_ITEMS.length + GALAXY_LINKS.length
