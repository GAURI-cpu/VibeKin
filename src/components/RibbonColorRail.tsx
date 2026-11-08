import { useRef, type KeyboardEvent } from 'react'
import { RIBBON_PALETTES, RIBBON_PALETTE_IDS, type RibbonPaletteId } from '../lib/ribbons'

type RibbonColorRailProps = {
  value: RibbonPaletteId
  onChange: (id: RibbonPaletteId) => void
}

/** The same colour rail as the Galaxy pages: beside the box on desktop, a row above it on phones. */
export function RibbonColorRail({ value, onChange }: RibbonColorRailProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  // Arrow keys move along the rail and pick as they go.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    const edge = event.key === 'Home' ? 0 : event.key === 'End' ? RIBBON_PALETTE_IDS.length - 1 : null
    if (step === undefined && edge === null) return
    event.preventDefault()
    const index = RIBBON_PALETTE_IDS.indexOf(value)
    const next =
      edge ?? (index + (step ?? 0) + RIBBON_PALETTE_IDS.length) % RIBBON_PALETTE_IDS.length
    onChange(RIBBON_PALETTE_IDS[next])
    buttons.current[next]?.focus()
  }

  return (
    <div className="color-rail color-rail--labelled" role="group" aria-label="Background colour" onKeyDown={onKeyDown}>
      {RIBBON_PALETTE_IDS.map((id, i) => {
        const palette = RIBBON_PALETTES[id]
        const active = id === value
        return (
          <button
            key={id}
            ref={(node) => {
              buttons.current[i] = node
            }}
            type="button"
            aria-pressed={active}
            aria-label={palette.label}
            title={palette.label}
            tabIndex={active ? 0 : -1}
            className="color-rail-swatch color-rail-swatch--split"
            style={{
              background: `linear-gradient(90deg, ${palette.a} 0 50%, ${palette.b} 50% 100%)`,
              boxShadow: `inset 0 0 0 5px ${palette.bg}`,
            }}
            onClick={() => onChange(id)}
          />
        )
      })}
    </div>
  )
}
