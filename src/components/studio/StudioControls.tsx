import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { AssetMeta, ExtraControl, ExtraValue, Palette, StudioSettings } from '../../lib/registry'
import {
  PHOTO_PALETTE_ID,
  PHOTO_PALETTE_LABEL,
  TEXT_LIMITS,
  round2,
  type StudioText,
  type TextTone,
} from '../../lib/studioSettings'
import { PhotoVibe, type PhotoVibeProps } from './PhotoVibe'

type Props = {
  asset: AssetMeta
  settings: StudioSettings
  text: StudioText
  onSettingsChange: (next: StudioSettings) => void
  onTextChange: (next: StudioText) => void
  onReset: () => void
  shareUrl: () => string
  photo: PhotoVibeProps
}

const TONES: { id: TextTone; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

/** A circle in the palette's background with its first colours split across the middle. */
function swatchStyle(p: Palette) {
  const colors = p.colors.slice(0, 3)
  const slice = 100 / colors.length
  const stops = colors.map((c, i) => `${c} ${i * slice}% ${(i + 1) * slice}%`).join(', ')
  return { background: p.bg, '--split': `conic-gradient(from 210deg, ${stops})` } as CSSProperties
}

function useFlash() {
  const [flash, setFlash] = useState<string | null>(null)
  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 2000)
    return () => window.clearTimeout(timer)
  }, [flash])
  return [flash, setFlash] as const
}

function Slider(props: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  minLabel: string
  maxLabel: string
  onChange: (value: number) => void
}) {
  const { id, label, value, min, max, step, minLabel, maxLabel, onChange } = props
  return (
    <div className="studio-field">
      <label className="studio-label" htmlFor={id}>
        {label}
      </label>
      <div className="studio-range">
        <span aria-hidden="true">{minLabel}</span>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={`${label} ${Math.round(((value - min) / (max - min || 1)) * 100)}%, ${minLabel} to ${maxLabel}`}
          onChange={(event) => onChange(round2(Number(event.target.value)))}
        />
        <span aria-hidden="true">{maxLabel}</span>
      </div>
    </div>
  )
}

function Extra({
  control,
  value,
  onChange,
}: {
  control: ExtraControl
  value: ExtraValue | undefined
  onChange: (value: ExtraValue) => void
}) {
  const id = `studio-extra-${control.key}`
  if (control.kind === 'range') {
    return (
      <Slider
        id={id}
        label={control.label}
        value={typeof value === 'number' ? value : control.default}
        min={control.min}
        max={control.max}
        step={control.step}
        minLabel={control.minLabel ?? String(control.min)}
        maxLabel={control.maxLabel ?? String(control.max)}
        onChange={onChange}
      />
    )
  }
  if (control.kind === 'toggle') {
    return (
      <label className="studio-check">
        <input
          type="checkbox"
          checked={typeof value === 'boolean' ? value : control.default}
          onChange={(event) => onChange(event.target.checked)}
        />
        {control.label}
      </label>
    )
  }
  return (
    <div className="studio-field">
      <label className="studio-label" htmlFor={id}>
        {control.label}
      </label>
      <input
        id={id}
        className="studio-input"
        type="text"
        maxLength={control.maxLength}
        value={typeof value === 'string' ? value : control.default}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function StudioControls({ asset, settings, text, onSettingsChange, onTextChange, onReset, shareUrl, photo }: Props) {
  const [flash, setFlash] = useFlash()
  const swatchRefs = useRef<(HTMLButtonElement | null)[]>([])
  // The photo palette, once there is one, is the first swatch.
  const custom = photo.palette
  const palettes: Palette[] = custom
    ? [{ id: PHOTO_PALETTE_ID, label: PHOTO_PALETTE_LABEL, bg: custom.bg, colors: custom.colors }, ...asset.palettes]
    : asset.palettes
  const activeIndex = Math.max(
    0,
    palettes.findIndex((p) => p.id === settings.paletteId),
  )

  const set = (patch: Partial<StudioSettings>) => onSettingsChange({ ...settings, ...patch })
  const setExtra = (key: string, value: ExtraValue) => set({ extras: { ...settings.extras, [key]: value } })
  const setText = (patch: Partial<StudioText>) => onTextChange({ ...text, ...patch })

  // Arrow keys move along the swatches and pick as they go; Home and End jump to the ends.
  const onSwatchKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = palettes.length
    let next = -1
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % count
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + count) % count
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = count - 1
    if (next < 0) return
    event.preventDefault()
    set({ paletteId: palettes[next].id })
    swatchRefs.current[next]?.focus()
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl())
      setFlash('Link copied!')
    } catch {
      setFlash('Copy blocked')
    }
  }

  return (
    <aside className="studio-controls" aria-label="Customise">
      <h2 className="studio-controls-title">Controls</h2>

      <fieldset className="studio-group">
        <legend className="studio-label">Colour</legend>
        <div className="studio-swatches">
          {palettes.map((p, i) => (
            <button
              key={p.id}
              ref={(el) => {
                swatchRefs.current[i] = el
              }}
              type="button"
              className="studio-swatch"
              aria-pressed={i === activeIndex}
              tabIndex={i === activeIndex ? 0 : -1}
              onClick={() => set({ paletteId: p.id })}
              onKeyDown={(event) => onSwatchKey(event, i)}
            >
              <span className="studio-swatch-dot" style={swatchStyle(p)} aria-hidden="true" />
              <span className="studio-swatch-label">{p.label}</span>
            </button>
          ))}
        </div>
        {/* TODO(pro): custom colour picker goes after the swatches. */}
      </fieldset>

      <PhotoVibe {...photo} />

      <Slider
        id="studio-speed"
        label="Speed"
        value={settings.intensity}
        min={0}
        max={1}
        step={0.01}
        minLabel={asset.sliderLabels?.intensity?.min ?? 'Calm'}
        maxLabel={asset.sliderLabels?.intensity?.max ?? 'Lively'}
        onChange={(intensity) => set({ intensity })}
      />
      <Slider
        id="studio-detail"
        label="Detail"
        value={settings.detail}
        min={0}
        max={1}
        step={0.01}
        minLabel={asset.sliderLabels?.detail?.min ?? 'Simple'}
        maxLabel={asset.sliderLabels?.detail?.max ?? 'Rich'}
        onChange={(detail) => set({ detail })}
      />

      {asset.extraControls?.map((control) => (
        <Extra
          key={control.key}
          control={control}
          value={settings.extras[control.key]}
          onChange={(value) => setExtra(control.key, value)}
        />
      ))}

      {/* TODO(pro): "Customise with AI" prompt box goes here. */}

      <fieldset className="studio-group">
        <legend className="studio-label">Your text</legend>
        <label className="studio-check">
          <input type="checkbox" checked={text.show} onChange={(event) => setText({ show: event.target.checked })} />
          Show text
        </label>
        <div className="studio-field">
          <label className="studio-sublabel" htmlFor="studio-headline">
            Headline
          </label>
          <input
            id="studio-headline"
            className="studio-input"
            type="text"
            maxLength={TEXT_LIMITS.headline}
            value={text.headline}
            onChange={(event) => setText({ headline: event.target.value })}
          />
        </div>
        <div className="studio-field">
          <label className="studio-sublabel" htmlFor="studio-subtitle">
            Subtitle
          </label>
          <input
            id="studio-subtitle"
            className="studio-input"
            type="text"
            maxLength={TEXT_LIMITS.subtitle}
            value={text.subtitle}
            onChange={(event) => setText({ subtitle: event.target.value })}
          />
        </div>
        <div className="studio-field">
          <label className="studio-sublabel" htmlFor="studio-button">
            Button text
          </label>
          <input
            id="studio-button"
            className="studio-input"
            type="text"
            maxLength={TEXT_LIMITS.button}
            value={text.button}
            onChange={(event) => setText({ button: event.target.value })}
          />
        </div>
      </fieldset>

      <fieldset className="studio-group">
        <legend className="studio-label">Text colour</legend>
        <div className="studio-segment">
          {TONES.map((t) => (
            <label key={t.id} className="studio-segment-button studio-radio">
              <input
                type="radio"
                name="studio-tone"
                value={t.id}
                checked={text.tone === t.id}
                onChange={() => setText({ tone: t.id })}
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="studio-controls-actions">
        <button type="button" className="studio-button" onClick={onReset}>
          Reset
        </button>
        <button type="button" className="studio-button studio-button-ink" onClick={share}>
          {flash ?? 'Share link'}
        </button>
      </div>
      <p className="galaxy-sr-only" aria-live="polite">
        {flash ?? ''}
      </p>
    </aside>
  )
}
