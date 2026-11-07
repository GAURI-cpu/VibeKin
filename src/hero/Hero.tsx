import { useEffect, useRef, useState } from 'react'
import { createBackdropLayer, type BackdropLayer } from './backdrops'
import { createBlobScene, type BlobScene } from './blobScene'
import { BACKDROPS, MOODS, buildPrompt, type BackdropId } from './vibes'

const pickOther = <T,>(items: T[], current: T) => {
  const others = items.filter((item) => item !== current)
  return others[Math.floor(Math.random() * others.length)]
}

type CopyState = 'idle' | 'copied' | 'blocked'

type HeroProps = {
  moodId: string
  onMoodChange: (id: string) => void
  dim: boolean
}

export function Hero({ moodId, onMoodChange, dim }: HeroProps) {
  const heroRef = useRef<HTMLElement>(null)
  const sceneHostRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLCanvasElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<BlobScene | null>(null)
  const layerRef = useRef<BackdropLayer | null>(null)

  const [backdropId, setBackdropId] = useState<BackdropId>('clay')
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [sceneFailed, setSceneFailed] = useState(false)

  const mood = MOODS.find((item) => item.id === moodId)!
  const backdrop = BACKDROPS.find((item) => item.id === backdropId)!

  useEffect(() => {
    const hero = heroRef.current!
    const host = sceneHostRef.current!
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const layer = createBackdropLayer(backdropRef.current!, reducedMotion)
    layerRef.current = layer

    let scene: BlobScene | null = null
    try {
      scene = createBlobScene(host, hero, reducedMotion)
      sceneRef.current = scene
    } catch {
      // No WebGL: the headline and controls still work, on plain paper.
      setSceneFailed(true)
    }

    const resize = () => {
      const heroBox = hero.getBoundingClientRect()
      const copyBox = copyRef.current!.getBoundingClientRect()
      scene?.resize()
      layer.resize(heroBox.width, heroBox.height, {
        left: copyBox.left - heroBox.left,
        top: copyBox.top - heroBox.top,
        right: copyBox.right - heroBox.left,
        bottom: copyBox.bottom - heroBox.top,
      })
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(hero)

    // Only spend frames while the hero is on screen.
    let onScreen = true
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
    })
    intersection.observe(hero)

    let raf = 0
    let last = performance.now()
    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick)
      // The first rAF timestamp can predate performance.now(), so floor at zero.
      const dt = Math.max(0, Math.min((ms - last) / 1000, 0.05))
      last = ms
      if (!onScreen || document.hidden) return
      const t = ms / 1000
      layer.frame(t)
      scene?.frame(t, dt)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      intersection.disconnect()
      scene?.dispose()
      sceneRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.setPalette(mood.colors, mood.cheek)
    layerRef.current?.setColors(mood.colors)
  }, [mood])

  useEffect(() => {
    sceneRef.current?.setLight(dim)
    layerRef.current?.setDim(dim)
  }, [dim])

  useEffect(() => {
    sceneRef.current?.setGlitter(backdropId === 'glitter')
    const canvas = backdropRef.current!
    canvas.style.opacity = '0'
    const swap = window.setTimeout(() => {
      layerRef.current?.setKind(backdropId)
      canvas.style.opacity = '1'
    }, 200)
    return () => window.clearTimeout(swap)
  }, [backdropId])

  useEffect(() => {
    if (copyState === 'idle') return
    const reset = window.setTimeout(() => setCopyState('idle'), 2200)
    return () => window.clearTimeout(reset)
  }, [copyState])

  // Changing the vibe changes what the button copies, so clear any old result.
  useEffect(() => setCopyState('idle'), [moodId, backdropId, dim])

  // The blobs bounce on any vibe change, including one picked from the navbar.
  const vibeKey = `${moodId}/${backdropId}`
  const previousVibeKey = useRef(vibeKey)
  useEffect(() => {
    if (previousVibeKey.current === vibeKey) return
    previousVibeKey.current = vibeKey
    sceneRef.current?.bounce()
  }, [vibeKey])

  const shuffle = () => {
    setBackdropId(pickOther(BACKDROPS, backdrop).id)
    onMoodChange(pickOther(MOODS, mood).id)
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildPrompt(mood, backdrop, dim))
      setCopyState('copied')
    } catch {
      setCopyState('blocked')
    }
  }

  return (
    <main>
      <section ref={heroRef} className="hero" data-scene-failed={sceneFailed || undefined}>
        <canvas ref={backdropRef} className="hero-backdrop" aria-hidden="true" />
        <div ref={sceneHostRef} className="hero-scene" aria-hidden="true" />

        <div ref={copyRef} className="hero-copy">
          <h1>
            Pick a vibe.
            <br />
            Copy the prompt.
          </h1>
          <p className="hero-lede">
            Animated backgrounds and templates you can copy as a prompt or as code, then change to suit your mood.
          </p>

          {/* Two identical rows make the loop seamless. The copy is hidden from screen readers and Tab. */}
          <div className="moods" role="group" aria-label="Mood">
            {[false, true].map((isCopy) => (
              <div key={String(isCopy)} className="moods-row" aria-hidden={isCopy || undefined}>
                {MOODS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="chip"
                    tabIndex={isCopy ? -1 : undefined}
                    aria-pressed={item.id === moodId}
                    onClick={() => onMoodChange(item.id)}
                  >
                    <span className="chip-swatches" aria-hidden="true">
                      {item.colors.slice(0, 3).map((color) => (
                        <i key={color} style={{ background: color }} />
                      ))}
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div className="actions">
            <button type="button" className="press press-ink" onClick={copyPrompt}>
              {copyState === 'copied' ? 'Prompt copied' : 'Copy prompt'}
            </button>
            <button type="button" className="press press-paper" onClick={shuffle}>
              Shuffle vibe
            </button>
          </div>

          <p className="status" aria-live="polite">
            {copyState === 'blocked'
              ? 'Your browser blocked copying. Allow clipboard access and try again.'
              : `${backdrop.label} / ${mood.label}`}
          </p>
        </div>
      </section>
    </main>
  )
}
