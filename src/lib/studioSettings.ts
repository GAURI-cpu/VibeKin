import type { AssetMeta, ExtraValue, Palette, StudioSettings } from './registry'

/** What the visitor writes on top of the background. */
export type TextTone = 'auto' | 'light' | 'dark'

export type StudioText = {
  headline: string
  subtitle: string
  button: string
  show: boolean
  tone: TextTone
}

export const TEXT_LIMITS = { headline: 60, subtitle: 120, button: 24 } as const

export const DEFAULT_TEXT: Omit<StudioText, 'show'> = {
  headline: 'Every frontend deserves a vibe.',
  subtitle: 'Made with Vibekin',
  button: 'Get started',
  tone: 'auto',
}

export const PHOTO_PALETTE_ID = 'photo'
export const PHOTO_PALETTE_LABEL = 'From your photo'

/** The palette settings point at: the photo palette when chosen, else a preset, else the first preset. */
export function resolvePalette(palettes: Palette[], s: StudioSettings): Palette {
  if (s.paletteId === PHOTO_PALETTE_ID && s.customPalette) {
    return { id: PHOTO_PALETTE_ID, label: PHOTO_PALETTE_LABEL, bg: s.customPalette.bg, colors: s.customPalette.colors }
  }
  return palettes.find((p) => p.id === s.paletteId) ?? palettes[0]
}

/** Exactly count colours, repeating from the start if there are too few. */
export const fitColors = (colors: string[], count: number) =>
  Array.from({ length: count }, (_, i) => colors[i % colors.length])

const HEX = /^[0-9a-f]{6}$/i

/** pal=photo&pbg=0d0f1a&pc=ff8a5b,ffd6a5 → the photo palette, or null if anything is off. */
function readPhotoPalette(query: URLSearchParams, count: number): { bg: string; colors: string[] } | null {
  const bg = query.get('pbg') ?? ''
  const colors = (query.get('pc') ?? '').split(',')
  if (!HEX.test(bg) || !colors.length || colors.length > 8 || !colors.every((c) => HEX.test(c))) return null
  return { bg: `#${bg.toLowerCase()}`, colors: fitColors(colors.map((c) => `#${c.toLowerCase()}`), count) }
}

export const round2 = (n: number) => Math.round(n * 100) / 100

export function defaultSettings(asset: AssetMeta): StudioSettings {
  const extras: Record<string, ExtraValue> = {}
  for (const control of asset.extraControls ?? []) extras[control.key] = control.default
  return {
    paletteId: asset.palettes[0].id,
    intensity: asset.defaults.intensity,
    detail: asset.defaults.detail,
    extras,
  }
}

export const defaultText = (asset: AssetMeta): StudioText => ({ ...DEFAULT_TEXT, show: asset.defaults.showText })

/** A number from the URL, or the fallback when it's missing, not a number, or out of range. */
function readNumber(raw: string | null, min: number, max: number, fallback: number) {
  if (raw === null || raw.trim() === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback
}

function readBool(raw: string | null, fallback: boolean) {
  return raw === '1' ? true : raw === '0' ? false : fallback
}

const readString = (raw: string | null, max: number, fallback: string) => (raw === null ? fallback : raw.slice(0, max))

/** Restores settings from a share link. Anything invalid falls back to the asset's defaults. */
export function readFromQuery(asset: AssetMeta, query: URLSearchParams): { settings: StudioSettings; text: StudioText } {
  const base = defaultSettings(asset)
  const pal = query.get('pal')
  const extras = { ...base.extras }
  for (const control of asset.extraControls ?? []) {
    const raw = query.get(`x_${control.key}`)
    if (control.kind === 'range') extras[control.key] = readNumber(raw, control.min, control.max, control.default)
    else if (control.kind === 'toggle') extras[control.key] = readBool(raw, control.default)
    else extras[control.key] = readString(raw, control.maxLength, control.default)
  }
  const photo = pal === PHOTO_PALETTE_ID ? readPhotoPalette(query, asset.palettes[0].colors.length) : null
  const tc = query.get('tc')
  const textBase = defaultText(asset)
  return {
    settings: {
      paletteId: photo ? PHOTO_PALETTE_ID : pal && asset.palettes.some((p) => p.id === pal) ? pal : base.paletteId,
      ...(photo ? { customPalette: photo } : {}),
      intensity: round2(readNumber(query.get('speed'), 0, 1, base.intensity)),
      detail: round2(readNumber(query.get('detail'), 0, 1, base.detail)),
      extras,
    },
    text: {
      headline: readString(query.get('h'), TEXT_LIMITS.headline, textBase.headline),
      subtitle: readString(query.get('s'), TEXT_LIMITS.subtitle, textBase.subtitle),
      button: readString(query.get('b'), TEXT_LIMITS.button, textBase.button),
      show: readBool(query.get('text'), textBase.show),
      tone: tc === 'light' || tc === 'dark' || tc === 'auto' ? tc : textBase.tone,
    },
  }
}

export function toQuery(asset: AssetMeta, settings: StudioSettings, text: StudioText): URLSearchParams {
  const query = new URLSearchParams()
  query.set('pal', settings.paletteId)
  if (settings.paletteId === PHOTO_PALETTE_ID && settings.customPalette) {
    query.set('pbg', settings.customPalette.bg.replace('#', ''))
    query.set('pc', settings.customPalette.colors.map((c) => c.replace('#', '')).join(','))
  }
  query.set('speed', String(settings.intensity))
  query.set('detail', String(settings.detail))
  query.set('h', text.headline)
  query.set('s', text.subtitle)
  query.set('b', text.button)
  query.set('text', text.show ? '1' : '0')
  query.set('tc', text.tone)
  for (const control of asset.extraControls ?? []) {
    const value = settings.extras[control.key]
    if (value === undefined) continue
    query.set(`x_${control.key}`, typeof value === 'boolean' ? (value ? '1' : '0') : String(value))
  }
  return query
}

/** The query as text. Commas stay readable, so a photo palette reads pc=ff8a5b,ffd6a5,9fd3db. */
export const queryString = (asset: AssetMeta, settings: StudioSettings, text: StudioText) =>
  toQuery(asset, settings, text).toString().replace(/%2C/gi, ',')

/** Light or dark is decided by luminance, never by a palette's name. */
export function isDark(hex: string) {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.replace(/./g, (c) => c + c)
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return true
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5
}

export const TEXT_COLORS = { light: '#fbf7f0', dark: '#2b2320' } as const

/** The colour the overlay text actually uses for a background. */
export function resolveTone(tone: TextTone, bg: string): 'light' | 'dark' {
  if (tone !== 'auto') return tone
  return isDark(bg) ? 'light' : 'dark'
}
