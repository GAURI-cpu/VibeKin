import { useEffect, useState } from 'react'
import { WaveRibbonsBackground, isDark } from '../backgrounds/WaveRibbonsBackground'
import { RibbonColorRail } from '../components/RibbonColorRail'
import {
  DEFAULT_RIBBON_PALETTE,
  RIBBON_PALETTES,
  RIBBON_STORAGE_KEY,
  isRibbonPaletteId,
  type RibbonPaletteId,
} from '../lib/ribbons'
import { followLink } from '../router'
import '../galaxy/galaxy.css'
import './ribbons.css'

type CopyState = 'idle' | 'copied' | 'blocked'

function readSaved(): RibbonPaletteId {
  // A shared ?palette= link wins over the saved choice.
  const linked = new URLSearchParams(window.location.search).get('palette')
  if (isRibbonPaletteId(linked)) return linked
  try {
    const saved = localStorage.getItem(RIBBON_STORAGE_KEY)
    if (isRibbonPaletteId(saved)) return saved
  } catch {
    // Storage can be blocked; the default still works.
  }
  return DEFAULT_RIBBON_PALETTE
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** /ribbons: Wave Ribbons in a medium box, with the colour rail beside it and two sliders below. */
export function RibbonsPage() {
  // Read before the first paint, so the text starts in the right colour.
  const [paletteId, setPaletteId] = useState<RibbonPaletteId>(readSaved)
  const [intensity, setIntensity] = useState(0.45)
  const [detail, setDetail] = useState(0.65)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  // The colour transition switches on only after the first two frames, so first load never flashes.
  const [animateText, setAnimateText] = useState(false)

  const palette = RIBBON_PALETTES[paletteId]
  const dark = isDark(palette.bg)

  useEffect(() => {
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setAnimateText(true))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [])

  useEffect(() => {
    if (copyState === 'idle') return
    const reset = window.setTimeout(() => setCopyState('idle'), 2000)
    return () => window.clearTimeout(reset)
  }, [copyState])

  const choose = (id: RibbonPaletteId) => {
    setPaletteId(id)
    try {
      localStorage.setItem(RIBBON_STORAGE_KEY, id)
    } catch {
      // Storage can be blocked; the choice still holds for this visit.
    }
  }

  const copy = async () => {
    const snippet = `<WaveRibbonsBackground background="${palette.bg}" colorA="${palette.a}" colorB="${palette.b}" intensity={${round2(intensity)}} detail={${round2(detail)}} />`
    try {
      await navigator.clipboard.writeText(snippet)
      setCopyState('copied')
    } catch {
      setCopyState('blocked')
    }
  }

  return (
    <main className="galaxy-detail">
      <a className="galaxy-back-link galaxy-detail-back" href="/galaxy" onClick={followLink}>
        ← Back to Galaxy
      </a>

      <div className="galaxy-detail-body">
        <div
          className="galaxy-detail-stage ribbons-stage"
          data-sky={dark ? 'dark' : 'light'}
          data-animate={animateText || undefined}
          style={{ background: palette.bg }}
        >
          <WaveRibbonsBackground
            background={palette.bg}
            colorA={palette.a}
            colorB={palette.b}
            intensity={intensity}
            detail={detail}
          />
          <div className="galaxy-detail-copy ribbons-copy">
            <h1>Every frontend deserves a vibe.</h1>
            <p>Flowing ribbons of fine light lines with glowing particles.</p>
          </div>
        </div>
        <RibbonColorRail value={paletteId} onChange={choose} />
      </div>

      <div className="ribbons-sliders">
        <label className="ribbons-slider">
          <span>Calm</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={intensity}
            aria-label="Speed, from calm to lively"
            onChange={(event) => setIntensity(Number(event.target.value))}
          />
          <span>Lively</span>
        </label>
        <label className="ribbons-slider">
          <span>Simple</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={detail}
            aria-label="Detail, from simple to rich"
            onChange={(event) => setDetail(Number(event.target.value))}
          />
          <span>Rich</span>
        </label>
      </div>

      <div className="galaxy-detail-actions">
        <button type="button" className="press press-ink" onClick={copy}>
          {copyState === 'copied' ? 'Copied!' : copyState === 'blocked' ? 'Copy blocked' : 'Copy code'}
        </button>
      </div>
      <p className="galaxy-sr-only" aria-live="polite">
        {copyState === 'copied' ? 'Code copied' : copyState === 'blocked' ? 'Your browser blocked copying.' : ''}
      </p>
    </main>
  )
}
