export type BackgroundTemplate = {
  label: string
  /** Where the template opens, for example '/library/coder/matrix-rain'. */
  href: string
}

export type ThemeGroup = {
  label: string
  templates: BackgroundTemplate[]
}

/**
 * The left-hand Themes drawer is built from this list.
 * Add a background to a type's templates and it appears under that type:
 *   templates: [{ label: 'Matrix rain', href: '/library/coder/matrix-rain' }],
 */
export const THEME_GROUPS: ThemeGroup[] = [
  { label: 'Aesthetic & Simple', templates: [] },
  { label: 'Coder', templates: [] },
  { label: 'Glitter', templates: [] },
  { label: 'Galaxy', templates: [] },
  { label: '3D', templates: [] },
  { label: 'Luxury', templates: [] },
  { label: 'Playful', templates: [] },
  { label: 'Business', templates: [] },
]
