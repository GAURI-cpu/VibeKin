import { GALAXY_COUNT } from '../lib/galaxy'
import type { PosterKey } from '../lib/posters'

export type BackgroundTemplate = {
  label: string
  /** Where the template opens, for example '/library/coder/matrix-rain'. */
  href: string
}

/** A type that opens its own page instead of expanding in the drawer. */
export type ThemeCard = {
  href: string
  subtitle: string
  /** Which background paints the still thumbnail. */
  poster: PosterKey
}

export type ThemeGroup = {
  label: string
  templates: BackgroundTemplate[]
  card?: ThemeCard
}

/**
 * The left-hand Themes drawer is built from this list.
 * Add a background to a type's templates and it appears under that type:
 *   templates: [{ label: 'Matrix rain', href: '/library/coder/matrix-rain' }],
 */
const AESTHETIC: BackgroundTemplate[] = [
  { label: 'Ink Bloom', href: '/studio/ink-bloom' },
  { label: 'Silk Flow', href: '/studio/silk-flow' },
  { label: 'Gradient Orbs', href: '/studio/gradient-orbs' },
]

export const THEME_GROUPS: ThemeGroup[] = [
  {
    label: 'Aesthetic & Simple',
    templates: AESTHETIC,
    card: { href: '/studio?vibe=Aesthetic', subtitle: `${AESTHETIC.length} backgrounds`, poster: 'SilkFlow' },
  },
  { label: 'Coder', templates: [] },
  { label: 'Glitter', templates: [] },
  { label: 'Galaxy', templates: [], card: { href: '/galaxy', subtitle: `${GALAXY_COUNT} backgrounds`, poster: 'Aurora' } },
  { label: '3D', templates: [] },
  { label: 'Luxury', templates: [] },
  { label: 'Playful', templates: [] },
  { label: 'Business', templates: [] },
]
