import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { AssetMeta, Palette, StudioSettings } from '../../lib/registry'
import { resolveTone, type StudioText } from '../../lib/studioSettings'

type Device = 'desktop' | 'tablet' | 'phone'

const DEVICES: { id: Device; label: string }[] = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'phone', label: 'Phone' },
]

type Props = {
  asset: AssetMeta
  settings: StudioSettings
  text: StudioText
  palette: Palette
}

/** The one live background on the page, in a device frame, with the visitor's hero text on top. */
export function StudioPreview({ asset, settings, text, palette }: Props) {
  const [device, setDevice] = useState<Device>('desktop')
  // 'native' uses the Fullscreen API; 'overlay' is the fixed full-window fallback.
  const [fullscreen, setFullscreen] = useState<'off' | 'native' | 'overlay'>('off')
  const stageRef = useRef<HTMLDivElement>(null)
  const tone = resolveTone(text.tone, palette.bg)
  const { Preview } = asset

  useEffect(() => {
    const sync = () => {
      if (!document.fullscreenElement) setFullscreen((current) => (current === 'native' ? 'off' : current))
    }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  // Esc closes the fallback overlay (the browser handles Esc for real fullscreen).
  useEffect(() => {
    if (fullscreen !== 'overlay') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen('off')
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [fullscreen])

  const toggleFullscreen = useCallback(async () => {
    if (fullscreen === 'native') {
      try {
        await document.exitFullscreen()
      } catch {
        // Already out of fullscreen.
      }
      setFullscreen('off')
      return
    }
    if (fullscreen === 'overlay') return setFullscreen('off')
    const stage = stageRef.current
    try {
      if (!stage?.requestFullscreen || !document.fullscreenEnabled) throw new Error('unsupported')
      await stage.requestFullscreen()
      setFullscreen('native')
    } catch {
      setFullscreen('overlay')
    }
  }, [fullscreen])

  const isFull = fullscreen !== 'off'
  const hasText = text.show && Boolean(text.headline.trim() || text.subtitle.trim() || text.button.trim())

  return (
    <section className="studio-preview" aria-label="Live preview">
      <div className="studio-frame" data-device={device}>
        <div
          ref={stageRef}
          className="studio-stage"
          data-full={isFull ? fullscreen : undefined}
          data-tone={tone}
          style={{ background: palette.bg }}
        >
          <div className="studio-stage-bg">
            <Suspense fallback={null}>
              <Preview settings={settings} />
            </Suspense>
          </div>

          {hasText && (
            <div className="studio-hero">
              {text.headline.trim() && <h2 className="studio-hero-headline">{text.headline}</h2>}
              {text.subtitle.trim() && <p className="studio-hero-subtitle">{text.subtitle}</p>}
              {text.button.trim() && (
                <span className="studio-hero-button">
                  {text.button}
                </span>
              )}
            </div>
          )}

          {isFull && (
            <button type="button" className="studio-exit" onClick={toggleFullscreen}>
              Exit fullscreen
            </button>
          )}
        </div>
      </div>

      <div className="studio-preview-bar">
        <div className="studio-segment" role="group" aria-label="Preview size">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              type="button"
              className="studio-segment-button"
              aria-pressed={device === d.id}
              onClick={() => setDevice(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <button type="button" className="studio-button" onClick={toggleFullscreen}>
          {isFull ? 'Exit fullscreen' : 'Fullscreen'}
        </button>
        {/* TODO(pro): image / video export buttons go here. */}
      </div>
    </section>
  )
}
