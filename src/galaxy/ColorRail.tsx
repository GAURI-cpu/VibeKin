import { useCallback, useSyncExternalStore } from 'react'
import { GALAXY_PALETTES, PALETTE_STORAGE_KEY, type GalaxyPalette } from '../lib/galaxy'

type Choices = Record<string, string>

const listeners = new Set<() => void>()
let memoryChoices: Choices = {}

/** Falls back to this visit's choices when storage is blocked, so the page still updates. */
function readRaw() {
  try {
    return localStorage.getItem(PALETTE_STORAGE_KEY) ?? JSON.stringify(memoryChoices)
  } catch {
    return JSON.stringify(memoryChoices)
  }
}

/** Saved as {"aurora": "pink", ...}. Anything else (like an older single value) is ignored. */
function parse(raw: string): Choices {
  try {
    const value: unknown = JSON.parse(raw)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const choices: Choices = {}
      for (const [key, id] of Object.entries(value)) if (typeof id === 'string') choices[key] = id
      return choices
    }
  } catch {
    // Not JSON: fall through.
  }
  return memoryChoices
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Keeps other open tabs in step too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === PALETTE_STORAGE_KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** The palette picked for one background, or null for its own colours. */
export function useGalaxyPalette(backgroundId: string): [GalaxyPalette | null, (id: string | null) => void] {
  // The raw string is the snapshot, so it stays stable between renders.
  const raw = useSyncExternalStore(subscribe, readRaw)
  const id = parse(raw)[backgroundId] ?? null

  const choose = useCallback(
    (next: string | null) => {
      const choices = { ...parse(readRaw()) }
      if (next) choices[backgroundId] = next
      else delete choices[backgroundId]
      memoryChoices = choices
      try {
        localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(choices))
      } catch {
        // Storage can be blocked; the choice still holds for this visit.
      }
      listeners.forEach((listener) => listener())
    },
    [backgroundId],
  )

  return [GALAXY_PALETTES.find((palette) => palette.id === id) ?? null, choose]
}

type Swatch = { background: string; colors: string[] }

const swatchStyle = ({ background, colors }: Swatch) => ({
  background: `conic-gradient(from 200deg, ${colors[0]} 0 33%, ${colors[1] ?? colors[0]} 0 66%, ${colors[2] ?? colors[0]} 0)`,
  boxShadow: `inset 0 0 0 4px ${background}`,
})

type ColorRailProps = {
  value: string | null
  /** The background's own colours, shown as the first swatch. */
  original: Swatch
  onChange: (id: string | null) => void
}

/** Vertical beside the box on desktop, a row above it on phones. */
export function ColorRail({ value, original, onChange }: ColorRailProps) {
  return (
    <div className="color-rail" role="radiogroup" aria-label="Colours">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label="Original colours"
        title="Original"
        className="color-rail-swatch"
        style={swatchStyle(original)}
        onClick={() => onChange(null)}
      />
      <span className="color-rail-divider" aria-hidden="true" />
      {GALAXY_PALETTES.map((palette) => (
        <button
          key={palette.id}
          type="button"
          role="radio"
          aria-checked={palette.id === value}
          aria-label={palette.label}
          title={palette.label}
          className="color-rail-swatch"
          style={swatchStyle(palette)}
          onClick={() => onChange(palette.id)}
        />
      ))}
    </div>
  )
}
