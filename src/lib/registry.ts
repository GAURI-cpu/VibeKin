import { createElement, lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { SCENE_DEFAULTS, type SceneName } from '../galaxy/scenes'
import { MOODS } from '../hero/vibes'
import { GALAXY_ITEMS, GALAXY_PALETTES } from './galaxy'
import { resolvePalette } from './studioSettings'
import { STARFALL_PALETTES, STARFALL_PALETTE_IDS } from './starfallPalettes'
import { ORBS_PALETTES, type GradientOrbsProps, type OrbsPaletteKey } from '../backgrounds/GradientOrbsBackground'
import { SILK_PALETTES, type SilkFlowProps, type SilkPaletteKey } from '../backgrounds/SilkFlowBackground'
import { INK_PALETTES, INK_PALETTE_IDS } from './inkPalettes'
import { DEFAULT_RIBBON_PALETTE, RIBBON_PALETTES, RIBBON_PALETTE_IDS } from './ribbons'

/* ---------- Studio types ---------- */

/** colors are in the order the component expects. */
export type Palette = { id: string; label: string; bg: string; colors: string[]; rain?: string }

/** The words at each end of a slider. */
export type SliderLabels = { min: string; max: string }

export type ExtraControl =
  | {
      kind: 'range'
      key: string
      label: string
      min: number
      max: number
      step: number
      default: number
      minLabel?: string
      maxLabel?: string
    }
  | { kind: 'toggle'; key: string; label: string; default: boolean }
  /** Free text the component itself draws, like the name in Name Constellation. */
  | { kind: 'text'; key: string; label: string; default: string; maxLength: number }

export type ExtraValue = number | boolean | string

export type StudioSettings = {
  paletteId: string
  intensity: number
  detail: number
  extras: Record<string, ExtraValue>
  /** Colours pulled from the visitor's photo; used when paletteId is "photo". */
  customPalette?: { bg: string; colors: string[] }
}

export type PropValue = string | number | boolean | string[]

export type StudioProps = Record<string, PropValue>

export type AssetMeta = {
  id: string
  name: string
  vibe: string
  description: string
  /** Source files shown in the Component tab, relative to src/. The first one holds the component. */
  files: string[]
  /** The exported component name used in the React snippet. */
  componentName: string
  /** The import path used in the React snippet. */
  importPath: string
  /** npm packages it needs beyond React. */
  dependencies: string[]
  pro: boolean
  /** First one is the default. */
  palettes: Palette[]
  defaults: { intensity: number; detail: number; showText: boolean }
  extraControls?: ExtraControl[]
  /** Words at the ends of the Speed and Detail sliders, when Calm/Lively and Simple/Rich don't fit. */
  sliderLabels?: { intensity?: SliderLabels; detail?: SliderLabels }
  /** Turns Studio settings into the component's own props. */
  toProps: (s: StudioSettings) => StudioProps
  /** The live component, loaded only when the Studio shows it. */
  Preview: LazyExoticComponent<ComponentType<{ settings: StudioSettings }>>
}

/** The palette a setting points at, or the asset's first one. */
export function paletteOf(asset: Pick<AssetMeta, 'palettes'>, s: StudioSettings): Palette {
  return resolvePalette(asset.palettes, s)
}

type AssetInput<P> = Omit<AssetMeta, 'toProps' | 'Preview'> & {
  load: () => Promise<ComponentType<P>>
  toProps: (s: StudioSettings, palette: Palette) => P & StudioProps
}

/** Ties each asset's toProps to its real component props, so the snippet and the preview can't drift apart. */
function defineAsset<P extends object>({ load, toProps, ...meta }: AssetInput<P>): AssetMeta {
  // The photo palette goes through toProps like any preset, so every background works unchanged.
  const props = (s: StudioSettings) => toProps(s, resolvePalette(meta.palettes, s))
  return {
    ...meta,
    toProps: props,
    Preview: lazy(async () => {
      const Component = await load()
      function StudioPreviewBackground({ settings }: { settings: StudioSettings }) {
        return createElement(Component, props(settings))
      }
      return { default: StudioPreviewBackground }
    }),
  }
}

/* ---------- palettes ---------- */

const ribbonPalettes: Palette[] = [
  DEFAULT_RIBBON_PALETTE,
  ...RIBBON_PALETTE_IDS.filter((id) => id !== DEFAULT_RIBBON_PALETTE),
].map((id) => {
  const p = RIBBON_PALETTES[id]
  return { id, label: p.label, bg: p.bg, colors: [p.a, p.b] }
})

const galaxyPalettes = (scene: SceneName): Palette[] => [
  { id: 'original', label: 'Original', bg: SCENE_DEFAULTS[scene].background, colors: SCENE_DEFAULTS[scene].colors },
  ...GALAXY_PALETTES.map((p) => ({ id: p.id, label: p.label, bg: p.background, colors: p.colors })),
]

const mood = (id: string) => MOODS.find((m) => m.id === id)?.colors.slice(0, 3) ?? ['#ffffff']

/** Star colours stay realistic; a mood only tints the lines. The sky stays dark so the stars read. */
const constellationPalettes: Palette[] = [
  { id: 'night', label: 'Night', bg: '#050816', colors: ['#ffffff', '#c8d4ff'] },
  { id: 'cute', label: 'Cute', bg: '#1d1430', colors: mood('cute') },
  { id: 'dreamy', label: 'Dreamy', bg: '#0f1030', colors: mood('dreamy') },
  { id: 'playful', label: 'Playful', bg: '#0d0b26', colors: mood('playful') },
  { id: 'aesthetic', label: 'Aesthetic', bg: '#14100f', colors: mood('aesthetic') },
  { id: 'luxury', label: 'Luxury', bg: '#0b0812', colors: mood('luxury') },
]

const starfallPalettes: Palette[] = STARFALL_PALETTE_IDS.map((id) => {
  const p = STARFALL_PALETTES[id]
  return { id, label: p.label, bg: p.bg, colors: [...p.colors], rain: p.rain }
})

const inkPalettes: Palette[] = INK_PALETTE_IDS.map((id) => {
  const p = INK_PALETTES[id]
  return { id, label: p.label, bg: p.bg, colors: [...p.colors] }
})

const silkPalettes: Palette[] = (Object.keys(SILK_PALETTES) as SilkPaletteKey[]).map((id) => {
  const p = SILK_PALETTES[id]
  return { id, label: p.name, bg: p.base, colors: [...p.blobs] }
})
const isSilkKey = (id: string): id is SilkPaletteKey => Object.prototype.hasOwnProperty.call(SILK_PALETTES, id)

const orbsPalettes: Palette[] = (Object.keys(ORBS_PALETTES) as OrbsPaletteKey[]).map((id) => {
  const p = ORBS_PALETTES[id]
  return { id, label: p.name, bg: p.a, colors: [p.a, p.b] }
})
const isOrbsKey = (id: string): id is OrbsPaletteKey => Object.prototype.hasOwnProperty.call(ORBS_PALETTES, id)

/** A palette without its own rain colour (a photo palette) rains a pale version of its right glow. */
function paleRain(hex: string | undefined) {
  const n = parseInt((hex ?? '#bfe6ff').replace('#', '').slice(0, 6), 16)
  if (Number.isNaN(n)) return '#bfe6ff'
  const mix = (c: number) => Math.round(c + (255 - c) * 0.7).toString(16).padStart(2, '0')
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`
}

/* ---------- the registry ---------- */

const galaxyAssets = GALAXY_ITEMS.map((item) => {
  const scene = item.component as SceneName
  return defineAsset({
    id: item.id,
    name: item.name,
    vibe: item.tag,
    description: item.description,
    files: ['galaxy/backgrounds.tsx', 'galaxy/GalaxyCanvas.tsx', 'galaxy/scenes.ts'],
    componentName: item.component,
    importPath: '@/components/galaxy/backgrounds',
    dependencies: [],
    pro: false,
    palettes: galaxyPalettes(scene),
    defaults: { intensity: SCENE_DEFAULTS[scene].intensity, detail: SCENE_DEFAULTS[scene].detail, showText: true },
    load: () => import('../galaxy/backgrounds').then((m) => m.GALAXY_COMPONENTS[scene]),
    toProps: (s, p) => ({ background: p.bg, colors: p.colors, intensity: s.intensity, detail: s.detail }),
  })
})

export const REGISTRY: AssetMeta[] = [
  defineAsset({
    id: 'wave-ribbons',
    name: 'Wave Ribbons',
    vibe: 'Galaxy',
    description: 'Flowing ribbons of fine light lines with glowing particles.',
    files: ['backgrounds/WaveRibbonsBackground.tsx'],
    componentName: 'WaveRibbonsBackground',
    importPath: '@/components/WaveRibbonsBackground',
    dependencies: [],
    pro: false,
    palettes: ribbonPalettes,
    defaults: { intensity: 0.45, detail: 0.65, showText: true },
    load: () => import('../backgrounds/WaveRibbonsBackground').then((m) => m.WaveRibbonsBackground),
    toProps: (s, p) => ({
      background: p.bg,
      colorA: p.colors[0],
      colorB: p.colors[1],
      intensity: s.intensity,
      detail: s.detail,
    }),
  }),
  defineAsset({
    id: 'name-constellation',
    name: 'Name Constellation',
    vibe: 'Galaxy',
    description: 'Type a name and the stars write it in the sky.',
    files: ['backgrounds/NameConstellationBackground.tsx'],
    componentName: 'NameConstellationBackground',
    importPath: '@/components/NameConstellationBackground',
    dependencies: [],
    pro: false,
    palettes: constellationPalettes,
    // The name in the stars is the headline here, so the text overlay starts hidden.
    defaults: { intensity: 0.5, detail: 0.6, showText: false },
    extraControls: [{ kind: 'text', key: 'name', label: 'Name in the stars', default: 'vibekin', maxLength: 14 }],
    load: () => import('../backgrounds/NameConstellationBackground').then((m) => m.NameConstellationBackground),
    toProps: (s, p) => {
      const name = typeof s.extras.name === 'string' ? s.extras.name : 'vibekin'
      const props = { name, background: p.bg, intensity: s.intensity, detail: s.detail }
      // Night is the component's own look, so it leaves the line tint out.
      return p.id === 'night' ? props : { ...props, colors: p.colors }
    },
  }),
  defineAsset({
    id: 'starfall',
    name: 'Starfall',
    vibe: 'Galaxy',
    description: 'A deep galaxy with glowing stardust raining down toward you.',
    files: ['backgrounds/StarfallBackground.tsx'],
    componentName: 'StarfallBackground',
    importPath: '@/components/StarfallBackground',
    dependencies: [],
    pro: false,
    palettes: starfallPalettes,
    defaults: { intensity: 0.45, detail: 0.55, showText: true },
    sliderLabels: { intensity: { min: 'Slow', max: 'Fast' }, detail: { min: 'Light rain', max: 'Heavy' } },
    load: () => import('../backgrounds/StarfallBackground').then((m) => m.StarfallBackground),
    toProps: (s, p) => ({
      background: p.bg,
      colors: p.colors,
      rainColor: p.rain ?? paleRain(p.colors[2]),
      intensity: s.intensity,
      detail: s.detail,
    }),
  }),
  defineAsset({
    id: 'ink-bloom',
    name: 'Ink Bloom',
    vibe: 'Aesthetic',
    description: 'A drop of ink slowly blooming through milky water.',
    files: ['backgrounds/InkBloomBackground.tsx'],
    componentName: 'InkBloomBackground',
    importPath: '@/components/InkBloomBackground',
    dependencies: [],
    pro: false,
    palettes: inkPalettes,
    defaults: { intensity: 0.4, detail: 0.6, showText: true },
    sliderLabels: { intensity: { min: 'Calm', max: 'Lively' }, detail: { min: 'Simple', max: 'Detailed' } },
    load: () => import('../backgrounds/InkBloomBackground').then((m) => m.InkBloomBackground),
    toProps: (s, p) => ({ background: p.bg, colors: [p.colors[0], p.colors[1]], intensity: s.intensity, detail: s.detail }),
  }),
  defineAsset({
    id: 'silk-flow',
    name: 'Silk Flow',
    vibe: 'Aesthetic',
    description: 'Soft blurred colour glows with fine flowing silk lines, very slow and calm.',
    files: ['backgrounds/SilkFlowBackground.tsx'],
    componentName: 'SilkFlowBackground',
    importPath: '@/components/SilkFlowBackground',
    dependencies: [],
    pro: false,
    palettes: silkPalettes,
    defaults: { intensity: 0.5, detail: 0.5, showText: true },
    extraControls: [{ kind: 'toggle', key: 'decorations', label: 'Decorations', default: true }],
    load: () => import('../backgrounds/SilkFlowBackground').then((m) => m.SilkFlowBackground),
    toProps: (s, p) => {
      // A preset is just its key; a photo palette passes its own colours on top of Midnight.
      const props: SilkFlowProps & StudioProps = { palette: isSilkKey(p.id) ? p.id : 'midnight' }
      if (!isSilkKey(p.id)) Object.assign(props, { colors: p.colors, background: p.bg })
      Object.assign(props, { intensity: s.intensity, detail: s.detail })
      if (s.extras.decorations === false) props.decorations = false
      return props
    },
  }),
  defineAsset({
    id: 'gradient-orbs',
    name: 'Gradient Orbs',
    vibe: 'Aesthetic',
    description: 'A diagonal gradient with soft 3D spheres, small rings and twinkling dots.',
    files: ['backgrounds/GradientOrbsBackground.tsx'],
    componentName: 'GradientOrbsBackground',
    importPath: '@/components/GradientOrbsBackground',
    dependencies: [],
    pro: false,
    palettes: orbsPalettes,
    defaults: { intensity: 0.5, detail: 0.5, showText: true },
    extraControls: [{ kind: 'toggle', key: 'parallax', label: 'Parallax', default: true }],
    load: () => import('../backgrounds/GradientOrbsBackground').then((m) => m.GradientOrbsBackground),
    toProps: (s, p) => {
      // A preset is just its key; custom (photo) colours go in as [from, to].
      const props: GradientOrbsProps & StudioProps = { palette: isOrbsKey(p.id) ? p.id : 'twilight' }
      if (!isOrbsKey(p.id)) props.colors = [p.colors[0], p.colors[1] ?? p.colors[0]]
      Object.assign(props, { intensity: s.intensity, detail: s.detail })
      if (s.extras.parallax === false) props.parallax = false
      return props
    },
  }),
  ...galaxyAssets,
]

export const findAsset = (id: string) => REGISTRY.find((asset) => asset.id === id)

export const studioHref = (id: string) => `/studio/${id}`
