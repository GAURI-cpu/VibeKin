import { useEffect, useRef, type CSSProperties } from 'react'

/**
 * Wave Ribbons: two flowing ribbons of fine light lines, with glowing particles riding along them.
 * Self-contained: Canvas 2D only, no imports from the rest of the codebase.
 */

export type WaveRibbonsProps = {
  background?: string
  colorA?: string
  colorB?: string
  /** 0 to 1: how fast everything flows. */
  intensity?: number
  /** 0 to 1: how many lines and particles. */
  detail?: number
  className?: string
  style?: CSSProperties
}

type RGB = [number, number, number]

function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.replace(/./g, (c) => c + c)
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [3, 5, 10]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Light or dark is decided by luminance, never by a palette's name. */
export function isDark(hex: string) {
  const [r, g, b] = hexToRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5
}

const rgba = (c: RGB, a: number) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.max(0, Math.min(1, a))})`

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

const SAMPLES = 110

type Look = { background: string; colorA: string; colorB: string; intensity: number; detail: number }

type Ribbon = {
  /** Centre path at s (0..1) and time t, in pixels. */
  path: (s: number, t: number, w: number, h: number) => [number, number]
  /** Half-width of the ribbon at s. */
  width: (s: number, w: number, h: number) => number
  twist: number
  color: 'a' | 'b'
}

/** A sweeps in from the bottom-left and rises in a wave toward the middle. */
const RIBBON_A: Ribbon = {
  path: (s, t, w, h) => [
    w * (-0.08 + 0.74 * s),
    h * (1.04 - 0.6 * s + 0.11 * Math.sin(s * Math.PI * 2.1 + t * 0.35) - 0.05 * Math.sin(s * Math.PI * 4.3 - t * 0.22)),
  ],
  width: (s, w, h) => Math.min(w, h) * (0.025 + 0.12 * Math.sin(Math.PI * Math.min(1, s * 1.1))),
  twist: 9,
  color: 'a',
}

/** B flows down the right side in an S-curve. */
const RIBBON_B: Ribbon = {
  path: (s, t, w, h) => [
    w * (0.82 + 0.075 * Math.sin(s * Math.PI * 2 + t * 0.3) + 0.02 * Math.sin(s * Math.PI * 5 - t * 0.25)),
    h * (-0.06 + 1.12 * s),
  ],
  width: (s, w, h) => Math.min(w, h) * (0.04 + 0.08 * Math.sin(Math.PI * s)),
  twist: 7,
  color: 'b',
}

const RIBBONS = [RIBBON_A, RIBBON_B]

type Particle = {
  ribbon: number
  s: number
  k: number
  speed: number
  x: number
  y: number
  vx: number
  vy: number
  size: number
  phase: number
  free: boolean
}

type Engine = {
  resize: (width: number, height: number, ratio: number) => void
  setLook: (look: Look, instant?: boolean) => void
  setPointer: (x: number | null, y?: number) => void
  frame: (now: number) => void
  /** Moves time straight to a moment, for still frames. */
  seek: (seconds: number) => void
}

function createEngine(canvas: HTMLCanvasElement, initial: Look, reducedMotion: boolean): Engine {
  const ctx = canvas.getContext('2d')!
  let look = initial
  let W = 1
  let H = 1
  let ratio = 1
  let time = 7
  let last = performance.now()

  // Current colours ease toward these targets, so a new palette melts in.
  const target = { bg: hexToRgb(look.background), a: hexToRgb(look.colorA), b: hexToRgb(look.colorB) }
  const current = { bg: [...target.bg] as RGB, a: [...target.a] as RGB, b: [...target.b] as RGB }

  let pointer: { x: number; y: number } | null = null
  const smooth = { x: 0, y: 0, strength: 0 }

  let lines = 0
  let particles: Particle[] = []

  // Reused buffers: centre, normal and width per sample, per ribbon.
  const centre = RIBBONS.map(() => new Float32Array(SAMPLES * 2))
  const normal = RIBBONS.map(() => new Float32Array(SAMPLES * 2))
  const widths = RIBBONS.map(() => new Float32Array(SAMPLES))

  function build() {
    lines = Math.round(36 + clamp01(look.detail) * 44)
    const count = Math.round(90 + clamp01(look.detail) * 160)
    particles = Array.from({ length: count }, () => ({
      ribbon: Math.random() < 0.55 ? 0 : 1,
      s: Math.random(),
      k: Math.random(),
      speed: (0.006 + Math.random() * 0.018) * (Math.random() < 0.5 ? 1 : -0.6),
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8 - 3,
      size: 0.8 + Math.pow(Math.random(), 2) * 2.4,
      phase: Math.random() * Math.PI * 2,
      free: Math.random() < 0.18,
    }))
  }
  build()

  function sampleRibbons() {
    RIBBONS.forEach((ribbon, r) => {
      const c = centre[r]
      const n = normal[r]
      const wd = widths[r]
      for (let i = 0; i < SAMPLES; i++) {
        const s = i / (SAMPLES - 1)
        const [x, y] = ribbon.path(s, time, W, H)
        c[i * 2] = x
        c[i * 2 + 1] = y
        wd[i] = ribbon.width(s, W, H)
      }
      for (let i = 0; i < SAMPLES; i++) {
        const a = Math.max(0, i - 1)
        const b = Math.min(SAMPLES - 1, i + 1)
        const dx = c[b * 2] - c[a * 2]
        const dy = c[b * 2 + 1] - c[a * 2 + 1]
        const len = Math.hypot(dx, dy) || 1
        n[i * 2] = -dy / len
        n[i * 2 + 1] = dx / len
      }
    })
  }

  /** The line offset that makes the lines fan out, cross and twist like a mesh. */
  const offset = (ribbon: Ribbon, s: number, k: number, w: number) =>
    w *
    Math.sin(s * ribbon.twist + time * 0.9 + k * 3.4) *
    (0.75 + 0.25 * Math.cos(s * ribbon.twist * 0.5 + k * 6 - time * 0.6))

  /** Lines and particles near the pointer bulge gently away from it. */
  function bulge(x: number, y: number): [number, number] {
    if (smooth.strength < 0.01) return [x, y]
    const dx = x - smooth.x
    const dy = y - smooth.y
    const d = Math.hypot(dx, dy)
    if (d >= 220 || d < 0.001) return [x, y]
    const push = (1 - d / 220) ** 2 * 34 * smooth.strength
    return [x + (dx / d) * push, y + (dy / d) * push]
  }

  function pointOn(r: number, s: number, k: number): [number, number] {
    const f = clamp01(s) * (SAMPLES - 1)
    const i = Math.min(SAMPLES - 2, Math.floor(f))
    const u = f - i
    const c = centre[r]
    const n = normal[r]
    const x = c[i * 2] + (c[i * 2 + 2] - c[i * 2]) * u
    const y = c[i * 2 + 1] + (c[i * 2 + 3] - c[i * 2 + 1]) * u
    const o = offset(RIBBONS[r], s, k, widths[r][i])
    return bulge(x + n[i * 2] * o, y + n[i * 2 + 1] * o)
  }

  function draw(dt: number) {
    const dark = isDark(rgbToHex(current.bg))
    const blend: GlobalCompositeOperation = dark ? 'lighter' : 'source-over'

    // Background: the palette bg with soft light from the bottom corners and a glow at the top.
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = rgba(current.bg, 1)
    ctx.fillRect(0, 0, W, H)
    const size = Math.max(W, H)
    const corner = (x: number, y: number, r: number, color: string) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, color)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    }
    corner(0, H, size * 0.75, rgba(current.a, dark ? 0.2 : 0.16))
    corner(W, H, size * 0.7, rgba(current.b, dark ? 0.17 : 0.13))
    corner(W / 2, 0, size * 0.55, dark ? 'rgba(255,255,255,0.045)' : 'rgba(60,30,40,0.05)')

    sampleRibbons()

    // Ribbons: each line is one path, stroked with a gradient that fades out at the end.
    ctx.globalCompositeOperation = blend
    ctx.lineWidth = 0.75
    ctx.lineJoin = 'round'
    RIBBONS.forEach((ribbon, r) => {
      const color = ribbon.color === 'a' ? current.a : current.b
      const c = centre[r]
      for (let l = 0; l < lines; l++) {
        const k = lines > 1 ? l / (lines - 1) : 0.5
        const alpha = (dark ? 0.2 : 0.3) + 0.22 * (1 - Math.abs(k - 0.5) * 2)
        const grad = ctx.createLinearGradient(c[0], c[1], c[(SAMPLES - 1) * 2], c[(SAMPLES - 1) * 2 + 1])
        grad.addColorStop(0, rgba(color, alpha))
        grad.addColorStop(0.82, rgba(color, alpha))
        grad.addColorStop(1, rgba(color, 0))
        ctx.strokeStyle = grad
        ctx.beginPath()
        for (let i = 0; i < SAMPLES; i++) {
          const s = i / (SAMPLES - 1)
          const o = offset(ribbon, s, k, widths[r][i])
          const [x, y] = bulge(c[i * 2] + normal[r][i * 2] * o, c[i * 2 + 1] + normal[r][i * 2 + 1] * o)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    })

    // Particles: most ride the ribbons, some float freely. Each twinkles.
    const seconds = dt / 1000
    for (const p of particles) {
      let x: number
      let y: number
      if (p.free) {
        p.x += p.vx * seconds
        p.y += p.vy * seconds
        if (p.x < -10) p.x = W + 10
        if (p.x > W + 10) p.x = -10
        if (p.y < -10) p.y = H + 10
        if (p.y > H + 10) p.y = -10
        ;[x, y] = bulge(p.x, p.y)
      } else {
        p.s += p.speed * seconds * (0.25 + clamp01(look.intensity) * 0.9) * (reducedMotion ? 0.25 : 1)
        if (p.s > 1) p.s -= 1
        if (p.s < 0) p.s += 1
        ;[x, y] = pointOn(p.ribbon, p.s, p.k)
      }
      // Fade riders near the soft end of their ribbon.
      const endFade = p.free ? 1 : clamp01((1 - p.s) / 0.15)
      const twinkle = 0.35 + 0.65 * Math.sin(time * 2.2 + p.phase) ** 2
      const tint = p.free ? (p.phase > Math.PI ? current.a : current.b) : p.ribbon === 0 ? current.a : current.b
      const r = p.size * 4
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, dark ? 'rgba(255,255,255,0.95)' : rgba(tint, 0.9))
      g.addColorStop(0.25, rgba(tint, 0.55))
      g.addColorStop(1, rgba(tint, 0))
      ctx.globalAlpha = twinkle * endFade
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  function rgbToHex(c: RGB) {
    return `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
  }

  return {
    resize(width, height, nextRatio) {
      const sx = width / W
      const sy = height / H
      W = width
      H = height
      ratio = nextRatio
      canvas.width = Math.max(1, Math.round(W * ratio))
      canvas.height = Math.max(1, Math.round(H * ratio))
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      for (const p of particles) {
        p.x *= sx
        p.y *= sy
      }
    },
    setLook(next, instant = false) {
      const rebuild = next.detail !== look.detail
      look = next
      target.bg = hexToRgb(next.background)
      target.a = hexToRgb(next.colorA)
      target.b = hexToRgb(next.colorB)
      if (instant) {
        current.bg = [...target.bg]
        current.a = [...target.a]
        current.b = [...target.b]
      }
      if (rebuild) build()
    },
    setPointer(x, y) {
      pointer = x === null || y === undefined ? null : { x, y }
    },
    seek(seconds) {
      time = seconds
    },
    frame(now) {
      const dt = Math.min(50, Math.max(0, now - last))
      last = now
      time += (dt / 1000) * (0.25 + clamp01(look.intensity) * 0.9) * (reducedMotion ? 0.25 : 1)

      // Melt colours toward the new palette.
      const k = 1 - Math.pow(0.002, dt / 1000)
      for (const key of ['bg', 'a', 'b'] as const) {
        for (let i = 0; i < 3; i++) current[key][i] += (target[key][i] - current[key][i]) * k
      }

      // Smooth the pointer so the bulge glides instead of jumping.
      const follow = 1 - Math.pow(0.0005, dt / 1000)
      if (pointer) {
        if (smooth.strength < 0.01) {
          smooth.x = pointer.x
          smooth.y = pointer.y
        }
        smooth.x += (pointer.x - smooth.x) * follow
        smooth.y += (pointer.y - smooth.y) * follow
        smooth.strength += (1 - smooth.strength) * follow
      } else {
        smooth.strength += (0 - smooth.strength) * follow
      }

      draw(dt)
    },
  }
}

export function WaveRibbonsBackground({
  background = '#03050a',
  colorA = '#1de9c3',
  colorB = '#e535c9',
  intensity = 0.45,
  detail = 0.65,
  className,
  style,
}: WaveRibbonsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const lookRef = useRef<Look>({ background, colorA, colorB, intensity, detail })

  useEffect(() => {
    const canvas = canvasRef.current!
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const engine = createEngine(canvas, lookRef.current, reducedMotion)
    engineRef.current = engine

    const resize = () => {
      const box = canvas.getBoundingClientRect()
      engine.resize(Math.max(1, box.width), Math.max(1, box.height), Math.min(window.devicePixelRatio || 1, 1.75))
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    let visible = true
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    intersection.observe(canvas)

    const onPointer = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect()
      engine.setPointer(event.clientX - box.left, event.clientY - box.top)
    }
    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') engine.setPointer(null)
    }
    const onLeave = () => engine.setPointer(null)
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('pointerdown', onPointer, { passive: true })
    window.addEventListener('pointerup', onPointerEnd)
    window.addEventListener('pointercancel', onLeave)
    document.documentElement.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)

    // One clock: performance.now() inside the loop.
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!visible || document.hidden) return
      engine.frame(performance.now())
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      intersection.disconnect()
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('pointerup', onPointerEnd)
      window.removeEventListener('pointercancel', onLeave)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    lookRef.current = { background, colorA, colorB, intensity, detail }
    engineRef.current?.setLook(lookRef.current)
  }, [background, colorA, colorB, intensity, detail])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', background, ...style }}
    />
  )
}

/** One still frame as an image URL, for thumbnails. */
export function renderWaveRibbonsPoster(width: number, height: number, look: Partial<Look> = {}) {
  const canvas = document.createElement('canvas')
  const engine = createEngine(
    canvas,
    { background: '#03050a', colorA: '#1de9c3', colorB: '#e535c9', intensity: 0.45, detail: 0.65, ...look },
    true,
  )
  engine.resize(width, height, 1)
  engine.seek(7)
  engine.frame(performance.now())
  return canvas.toDataURL('image/jpeg', 0.88)
}
