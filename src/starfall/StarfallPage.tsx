import { useEffect, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { StarfallBackground } from '../backgrounds/StarfallBackground'
import { studioHref } from '../lib/registry'
import {
  DEFAULT_STARFALL_PALETTE,
  STARFALL_PALETTES,
  STARFALL_PALETTE_IDS,
  STARFALL_STORAGE_KEY,
  isStarfallPaletteId,
  type StarfallPaletteId,
} from '../lib/starfallPalettes'
import { followLink } from '../router'
import '../galaxy/galaxy.css'
import './starfall.css'

type CopyState = 'idle' | 'copied' | 'blocked'

function readSaved(): StarfallPaletteId {
  // A shared ?pal= link wins over the saved choice.
  const linked = new URLSearchParams(window.location.search).get('pal')
  if (isStarfallPaletteId(linked)) return linked
  try {
    const saved = localStorage.getItem(STARFALL_STORAGE_KEY)
    if (isStarfallPaletteId(saved)) return saved
  } catch {
    // Storage can be blocked; the default still works.
  }
  return DEFAULT_STARFALL_PALETTE
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** The left glow, body and right glow as three dots on the palette's night sky. */
function swatchStyle(id: StarfallPaletteId): CSSProperties {
  const { bg, colors } = STARFALL_PALETTES[id]
  const [left, body, right] = colors
  return {
    background: [
      `radial-gradient(circle at 30% 36%, ${left} 0 22%, transparent 23%)`,
      `radial-gradient(circle at 70% 36%, ${right} 0 22%, transparent 23%)`,
      `radial-gradient(circle at 50% 70%, ${body} 0 22%, transparent 23%)`,
      bg,
    ].join(', '),
  }
}

/** /starfall: Starfall in a medium box in the middle, colour rail beside it, sliders and buttons below. */
export function StarfallPage() {
  const [paletteId, setPaletteId] = useState<StarfallPaletteId>(readSaved)
  const [intensity, setIntensity] = useState(0.45)
  const [detail, setDetail] = useState(0.55)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const palette = STARFALL_PALETTES[paletteId]

  useEffect(() => {
    if (copyState === 'idle') return
    const reset = window.setTimeout(() => setCopyState('idle'), 2000)
    return () => window.clearTimeout(reset)
  }, [copyState])

  const choose = (id: StarfallPaletteId) => {
    setPaletteId(id)
    try {
      localStorage.setItem(STARFALL_STORAGE_KEY, id)
    } catch {
      // Storage can be blocked; the choice still holds for this visit.
    }
  }

  // Arrow keys move through the swatches like any radio group.
  const onRailKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const next = STARFALL_PALETTE_IDS[(index + step + STARFALL_PALETTE_IDS.length) % STARFALL_PALETTE_IDS.length]
    choose(next)
    document.getElementById(`starfall-swatch-${next}`)?.focus()
  }

  const copy = async () => {
    const colors = palette.colors.map((c) => `"${c}"`).join(', ')
    const snippet = `<StarfallBackground background="${palette.bg}" colors={[${colors}]} rainColor="${palette.rain}" intensity={${round2(intensity)}} detail={${round2(detail)}} />`
    try {
      await navigator.clipboard.writeText(snippet)
      setCopyState('copied')
    } catch {
      setCopyState('blocked')
    }
  }

  const studioQuery = `?pal=${paletteId}&speed=${round2(intensity)}&detail=${round2(detail)}`

  return (
    <main className="galaxy-detail">
      <a className="galaxy-back-link galaxy-detail-back" href="/galaxy" onClick={followLink}>
        ← Back to Galaxy
      </a>

      {/* A medium box in the middle of the page, like the other backgrounds, with the colour rail beside it. */}
      <div className="galaxy-detail-body">
        <div className="galaxy-detail-stage starfall-stage" style={{ background: palette.bg }}>
          <StarfallBackground
            background={palette.bg}
            colors={[...palette.colors]}
            rainColor={palette.rain}
            intensity={intensity}
            detail={detail}
          />
          <div className="galaxy-detail-copy starfall-copy">
            <h1>Every frontend deserves a vibe.</h1>
            <p>A deep blue galaxy with glowing stardust raining down toward you.</p>
          </div>
        </div>

        <div className="color-rail" role="radiogroup" aria-label="Colour">
          {STARFALL_PALETTE_IDS.map((id, i) => (
            <button
              key={id}
              id={`starfall-swatch-${id}`}
              type="button"
              role="radio"
              aria-checked={id === paletteId}
              aria-label={STARFALL_PALETTES[id].label}
              title={STARFALL_PALETTES[id].label}
              tabIndex={id === paletteId ? 0 : -1}
              className="color-rail-swatch"
              style={swatchStyle(id)}
              onClick={() => choose(id)}
              onKeyDown={(event) => onRailKey(event, i)}
            />
          ))}
        </div>
      </div>

      <div className="starfall-sliders">
        <label className="starfall-slider">
          <span>Light rain</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={detail}
            aria-label="Rain, from light to heavy"
            onChange={(event) => setDetail(Number(event.target.value))}
          />
          <span>Heavy</span>
        </label>
        <label className="starfall-slider">
          <span>Slow</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={intensity}
            aria-label="Speed, from slow to fast"
            onChange={(event) => setIntensity(Number(event.target.value))}
          />
          <span>Fast</span>
        </label>
      </div>

      <div className="galaxy-detail-actions starfall-actions">
        <button type="button" className="press press-ink" onClick={copy}>
          {copyState === 'copied' ? 'Copied!' : copyState === 'blocked' ? 'Copy blocked' : 'Copy code'}
        </button>
        <a className="press press-paper galaxy-press-link" href={studioHref('starfall') + studioQuery} onClick={followLink}>
          Open in Studio
        </a>
      </div>

      <p className="galaxy-sr-only" aria-live="polite">
        {copyState === 'copied' ? 'Code copied' : copyState === 'blocked' ? 'Your browser blocked copying.' : ''}
      </p>
    </main>
  )
}
