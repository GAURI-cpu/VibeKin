export type RegistryEntry = {
  id: string
  name: string
  vibe: string
  description: string
  /** The component file, under src/backgrounds. */
  file: string
  /** npm packages it needs beyond React. */
  dependencies: string[]
  /** The page where people try it. */
  href: string
}

export const REGISTRY: RegistryEntry[] = [
  {
    id: 'name-constellation',
    name: 'Name Constellation',
    vibe: 'Galaxy',
    description: 'Type a name and the stars write it in the sky.',
    file: 'NameConstellationBackground.tsx',
    dependencies: [],
    href: '/constellation',
  },
  {
    id: 'wave-ribbons',
    name: 'Wave Ribbons',
    vibe: 'Aesthetic',
    description: 'Flowing ribbons of fine light lines with glowing particles.',
    file: 'WaveRibbonsBackground.tsx',
    dependencies: [],
    href: '/ribbons',
  },
]
