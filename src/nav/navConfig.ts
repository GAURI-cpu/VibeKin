export type NavLink = {
  label: string
  href: string
  description?: string
}

export type NavMenu = {
  label: string
  /** Lists every mood from hero/vibes.ts, so new vibes appear here automatically. */
  showVibes?: boolean
  links: NavLink[]
}

export type NavItem = NavLink | NavMenu

export const isMenu = (item: NavItem): item is NavMenu => 'links' in item

/**
 * The whole navbar is built from this list. Add a page by adding a line.
 * The # links are placeholders: swap them for real paths as the pages get built.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Library',
    showVibes: true,
    links: [
      { label: 'Backgrounds', href: '#backgrounds', description: 'Animated scenes to put behind your page' },
      { label: 'Templates', href: '#templates', description: 'Full page layouts ready to restyle' },
    ],
  },
  { label: 'Studio', href: '#studio' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Contact', href: '#contact' },
]

export const NAV_CTA: NavLink = { label: 'Browse library', href: '#library' }
