import { useEffect, useImperativeHandle, useRef, type CSSProperties, type Ref } from 'react'

/**
 * Name Constellation: a realistic night sky where the stars fly in and write a name.
 * Self-contained: Canvas 2D only, no imports from the rest of the codebase.
 */

export type NameConstellationHandle = {
  /** The live canvas, for anything else you want to do with the picture. */
  readonly canvas: HTMLCanvasElement | null
  /** The current frame as a PNG. */
  toBlob: () => Promise<Blob | null>
}

export type NameConstellationProps = {
  /** The text to write. An empty string scatters the stars. */
  name?: string
  background?: string
  /** Optional tint for the constellation lines. Star colours stay realistic. */
  colors?: string[]
  /** 0 to 1: twinkle speed and glow strength. */
  intensity?: number
  /** 0 to 1: how many stars and how much dust. */
  detail?: number
  fontFamily?: string
  className?: string
  style?: CSSProperties
  ref?: Ref<NameConstellationHandle>
}

export const DEFAULT_CONSTELLATION_FONT = 'Fredoka Variable, Fredoka, ui-rounded, system-ui, sans-serif'

type Look = {
  background: string
  colors?: string[]
  intensity: number
  detail: number
  fontFamily: string
}

type WriteMode = 'animate' | 'fade' | 'instant'

/* ---------- small helpers ---------- */

type RGB = [number, number, number]

function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.replace(/./g, (c) => c + c)
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [5, 8, 22]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const mix = (a: RGB, b: RGB, t: number): string =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

/** Realistic star colours and how often each appears. Index 2 is the clean white used for the name. */
const STAR_RGB: RGB[] = [
  [255, 196, 150],
  [255, 228, 200],
  [255, 248, 240],
  [228, 236, 255],
  [200, 214, 255],
]
const STAR_WEIGHTS = [0.04, 0.08, 0.62, 0.22, 0.04]
const WHITE = 2

function pickStarColor() {
  let roll = Math.random()
  for (let i = 0; i < STAR_WEIGHTS.length; i++) {
    roll -= STAR_WEIGHTS[i]
    if (roll <= 0) return i
  }
  return WHITE
}

/** A sharp point with a soft photographic falloff. Never a cartoon sparkle. */
function makeStarSprite([r, g, b]: RGB) {
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = 64
  const sctx = sprite.getContext('2d')!
  const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.08, `rgba(${r},${g},${b},0.95)`)
  grad.addColorStop(0.22, `rgba(${r},${g},${b},0.35)`)
  grad.addColorStop(0.5, `rgba(${r},${g},${b},0.06)`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  sctx.fillStyle = grad
  sctx.fillRect(0, 0, 64, 64)
  return sprite
}

/** A thin straight glint that fades at both ends, like a diffraction spike. */
function makeGlintSprite(vertical: boolean) {
  const sprite = document.createElement('canvas')
  sprite.width = vertical ? 2 : 128
  sprite.height = vertical ? 128 : 2
  const sctx = sprite.getContext('2d')!
  const grad = vertical ? sctx.createLinearGradient(0, 0, 0, 128) : sctx.createLinearGradient(0, 0, 128, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.5, 'rgba(255,255,255,1)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  sctx.fillStyle = grad
  sctx.fillRect(0, 0, sprite.width, sprite.height)
  return sprite
}

/** Resolves when the font is ready, but never waits longer than 1.5s. */
function waitForFont(fontFamily: string) {
  const load: Promise<unknown> =
    typeof document !== 'undefined' && document.fonts
      ? document.fonts.load(`400 64px ${fontFamily}`).catch(() => undefined)
      : Promise.resolve()
  return {
    soon: Promise.race([load, new Promise((resolve) => window.setTimeout(resolve, 1500))]),
    loaded: load,
  }
}

/* ---------- the engine ---------- */

type Star = {
  x: number
  y: number
  /** Resting position: the letter point for name stars, a drifting spot for the rest. */
  bx: number
  by: number
  vx: number
  vy: number
  r: number
  tw: number
  ph: number
  color: number
  /** Index into the current points, or -1 when wandering. */
  point: number
  flying: boolean
  fx: number
  fy: number
  cx: number
  cy: number
  start: number
  dur: number
  alpha: number
  target: number
  flash: number
  glow: number
}

type Edge = { a: number; b: number; start: number }

type Engine = {
  resize: (width: number, height: number, ratio: number) => void
  setLook: (look: Pick<Look, 'colors' | 'intensity'>) => void
  setPointer: (x: number | null, y?: number) => void
  requestWrite: (name: string) => void
  /** Writes at once in the given mode, skipping the font wait (for stills). */
  writeNow: (name: string, mode: WriteMode) => void
  frame: (now: number) => void
  dispose: () => void
}

function createEngine(canvas: HTMLCanvasElement, initial: Look, reducedMotion: boolean): Engine {
  const ctx = canvas.getContext('2d')!
  const bg = document.createElement('canvas')
  const text = document.createElement('canvas')
  const tctx = text.getContext('2d', { willReadFrequently: true })!
  const sprites = STAR_RGB.map(makeStarSprite)
  const glintH = makeGlintSprite(false)
  const glintV = makeGlintSprite(true)

  let look = initial
  let lineRgb: RGB = look.colors?.[0] ? hexToRgb(look.colors[0]) : [225, 232, 255]
  let W = 0
  let H = 0
  let ratio = 1
  let last = performance.now()
  let pointer: { x: number; y: number } | null = null

  const poolSize = Math.round(140 + clamp01(look.detail) * 270)
  const stars: Star[] = []
  let edges: Edge[] = []
  let glowStart = Infinity
  /** Smaller text gets smaller stars and glints, so small names on phones stay readable. */
  let starScale = 1
  let currentName = ''
  let fontReady = false
  let pending: string | null = null
  let disposed = false

  const randomSpot = () => ({ x: Math.random() * W, y: Math.random() * H })

  function makeStars() {
    for (let i = 0; i < poolSize; i++) {
      const spot = randomSpot()
      const angle = Math.random() * Math.PI * 2
      const speed = 0.004 + Math.random() * 0.01
      stars.push({
        x: spot.x,
        y: spot.y,
        bx: spot.x,
        by: spot.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 0.75 + Math.pow(Math.random(), 2.2) * 1.15,
        tw: 2 + Math.random() * 5,
        ph: Math.random() * Math.PI * 2,
        color: pickStarColor(),
        point: -1,
        flying: false,
        fx: 0,
        fy: 0,
        cx: 0,
        cy: 0,
        start: 0,
        dur: 1,
        alpha: reducedMotion ? 0.4 : 0,
        target: 0.4,
        flash: 0,
        glow: 0,
      })
    }
  }

  function paintBackground() {
    bg.width = Math.max(1, Math.round(W * ratio))
    bg.height = Math.max(1, Math.round(H * ratio))
    const b = bg.getContext('2d')!
    b.setTransform(ratio, 0, 0, ratio, 0, 0)
    const base = hexToRgb(look.background)
    const sky = b.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, mix(base, [27, 42, 92], 0.5))
    sky.addColorStop(0.55, mix(base, [15, 24, 56], 0.35))
    sky.addColorStop(1, look.background)
    b.fillStyle = sky
    b.fillRect(0, 0, W, H)

    // Nebula tints, barely there.
    b.globalCompositeOperation = 'lighter'
    const size = Math.max(W, H)
    const tint = (x: number, y: number, r: number, color: string) => {
      const g = b.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, color)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      b.fillStyle = g
      b.fillRect(0, 0, W, H)
    }
    tint(W * 0.28, H * 0.3, size * 0.6, 'rgba(120,90,200,0.10)')
    tint(W * 0.76, H * 0.62, size * 0.55, 'rgba(60,140,210,0.08)')
    tint(W * 0.55, H * 0.12, size * 0.4, 'rgba(210,110,170,0.035)')

    // Thousands of faint field stars, denser along a diagonal band.
    const count = Math.round(((W * H) / 380) * (0.5 + clamp01(look.detail) * 0.85))
    for (let i = 0; i < count; i++) {
      const x = Math.random() * W
      const y = Math.random() * H
      const band = Math.abs(x / W - y / H * 0.85 - 0.08)
      if (band > 0.17 && Math.random() < 0.45) continue
      const m = Math.pow(Math.random(), 4)
      const color = pickStarColor()
      if (m < 0.15) {
        const [r, g, bl] = STAR_RGB[color]
        b.globalAlpha = 1
        b.fillStyle = `rgba(${r},${g},${bl},${clamp01(0.12 + m * 2.2)})`
        b.fillRect(x, y, 0.7, 0.7)
      } else {
        const core = 0.45 + m * 0.8
        const s = core * 12
        b.globalAlpha = clamp01(0.2 + m * 0.45)
        b.drawImage(sprites[color], x - s / 2, y - s / 2, s, s)
      }
    }
    b.globalAlpha = 1
    b.globalCompositeOperation = 'source-over'
  }

  /** Draws the name invisibly and returns points along each stroke's centre line. */
  function sample(name: string) {
    text.width = Math.max(1, Math.round(W))
    text.height = Math.max(1, Math.round(H))
    let size = Math.min(H * 0.34, 300)
    tctx.font = `400 ${size}px ${look.fontFamily}`
    const measured = tctx.measureText(name).width
    if (measured > W * 0.8) size *= (W * 0.8) / measured
    tctx.font = `400 ${size}px ${look.fontFamily}`
    tctx.textAlign = 'center'
    tctx.textBaseline = 'middle'
    tctx.fillStyle = '#ffffff'
    tctx.clearRect(0, 0, text.width, text.height)
    const cx = W / 2
    const cy = H * 0.42
    tctx.fillText(name, cx, cy)

    const metrics = tctx.measureText(name)
    const x0 = Math.max(0, Math.floor(cx - metrics.actualBoundingBoxLeft - 4))
    const x1 = Math.min(text.width - 1, Math.ceil(cx + metrics.actualBoundingBoxRight + 4))
    const y0 = Math.max(0, Math.floor(cy - metrics.actualBoundingBoxAscent - 4))
    const y1 = Math.min(text.height - 1, Math.ceil(cy + metrics.actualBoundingBoxDescent + 4))
    const data = tctx.getImageData(0, 0, text.width, text.height).data
    const tw = text.width
    const th = text.height
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < tw && y < th && data[(y * tw + x) * 4 + 3] > 128

    const scan = (minD: number, e: number) => {
      // A fine scan packs points closer to minD apart, so strokes have no gaps.
      const step = Math.max(2, minD * 0.3)
      const cell = minD
      const grid = new Map<number, [number, number][]>()
      const key = (gx: number, gy: number) => gx * 100003 + gy
      const points: [number, number][] = []
      for (let y = y0; y <= y1; y += step) {
        for (let x = x0; x <= x1; x += step) {
          const px = Math.round(x + (Math.random() - 0.5) * step * 0.8)
          const py = Math.round(y + (Math.random() - 0.5) * step * 0.8)
          if (!(inside(px, py) && inside(px - e, py) && inside(px + e, py) && inside(px, py - e) && inside(px, py + e))) continue
          const gx = Math.floor(px / cell)
          const gy = Math.floor(py / cell)
          let near = false
          for (let ox = -1; ox <= 1 && !near; ox++) {
            for (let oy = -1; oy <= 1 && !near; oy++) {
              for (const [qx, qy] of grid.get(key(gx + ox, gy + oy)) ?? []) {
                if ((qx - px) ** 2 + (qy - py) ** 2 < minD * minD) {
                  near = true
                  break
                }
              }
            }
          }
          if (near) continue
          points.push([px, py])
          const bucket = grid.get(key(gx, gy))
          if (bucket) bucket.push([px, py])
          else grid.set(key(gx, gy), [[px, py]])
        }
      }
      return points
    }

    let erode = Math.max(2, Math.round(size * 0.035))
    // Small text (phones, long names) packs points tighter so every letter stays readable.
    let minD = Math.max(size < 120 ? 6 : 9, size * 0.068)
    let points = scan(minD, erode)
    if (points.length === 0) {
      erode = 1
      points = scan(minD, erode)
    }
    // A long name needs more points than there are stars: spread them out instead of leaving gaps.
    for (let tries = 0; points.length > stars.length && tries < 10; tries++) {
      minD *= 1.12
      points = scan(minD, erode)
    }
    if (points.length > stars.length) points = points.slice(0, stars.length)
    starScale = Math.max(0.5, Math.min(1, size / 170))
    return { points, minD }
  }

  function fly(star: Star, tx: number, ty: number, delay: number, mode: WriteMode, now: number) {
    if (mode !== 'animate' || reducedMotion) {
      star.x = star.bx = tx
      star.y = star.by = ty
      star.flying = false
      if (mode === 'fade') star.alpha = 0
      if (mode === 'instant') star.alpha = star.target
      return
    }
    const dx = tx - star.x
    const dy = ty - star.y
    const bow = (Math.random() - 0.5) * 0.6
    star.fx = star.x
    star.fy = star.y
    star.cx = (star.x + tx) / 2 - dy * bow
    star.cy = (star.y + ty) / 2 + dx * bow
    star.bx = tx
    star.by = ty
    star.start = now + delay
    star.dur = 1200 + Math.random() * 500
    star.flying = true
  }

  function scatter(mode: WriteMode, now: number) {
    edges = []
    glowStart = Infinity
    for (const star of stars) {
      star.point = -1
      star.target = 0.4
      const spot = randomSpot()
      fly(star, spot.x, spot.y, Math.random() * 400, mode, now)
    }
  }

  function write(name: string, mode: WriteMode) {
    const now = performance.now()
    currentName = name.trim()
    if (!currentName || W < 2 || H < 2) {
      scatter(mode, now)
      return
    }
    const { points, minD } = sample(currentName)
    if (points.length === 0) {
      scatter(mode, now)
      return
    }
    points.sort((a, b) => a[0] - b[0])
    const minX = points[0][0]
    const span = points[points.length - 1][0] - minX || 1
    const xFrac = (x: number) => (x - minX) / span

    // Stars and points both left to right, so the flights don't cross over each other.
    const order = stars.map((_, i) => i).sort((a, b) => stars[a].x - stars[b].x)
    const chosen = points.map((_, k) => order[Math.floor(((k + 0.5) * stars.length) / points.length)])
    const used = new Set(chosen)
    chosen.forEach((index, k) => {
      const star = stars[index]
      star.point = k
      star.target = 1
      fly(star, points[k][0], points[k][1], xFrac(points[k][0]) * 700, mode, now)
    })
    stars.forEach((star, index) => {
      if (used.has(index)) return
      star.point = -1
      star.target = 0.35
      const spot = randomSpot()
      fly(star, spot.x, spot.y, Math.random() * 500, mode, now)
    })

    // Each point joins its two nearest neighbours, so lines trace strokes and never jump letters.
    const linesStart = mode === 'animate' && !reducedMotion ? now + 1500 : now - 100000
    const limit = (minD * 1.65) ** 2
    const seen = new Set<number>()
    edges = []
    points.forEach(([px, py], i) => {
      const near: [number, number][] = []
      points.forEach(([qx, qy], j) => {
        if (i === j) return
        const d = (qx - px) ** 2 + (qy - py) ** 2
        if (d <= limit) near.push([d, j])
      })
      near.sort((a, b) => a[0] - b[0])
      for (const [, j] of near.slice(0, 2)) {
        const lo = Math.min(i, j)
        const hi = Math.max(i, j)
        const key = lo * 4096 + hi
        if (seen.has(key)) continue
        seen.add(key)
        // lo is the left-hand point, since points are sorted by x: lines grow left to right.
        edges.push({ a: chosen[lo], b: chosen[hi], start: linesStart + xFrac((points[lo][0] + points[hi][0]) / 2) * 700 })
      }
    })
    glowStart = linesStart + 600
  }

  const font = waitForFont(look.fontFamily)
  const firstMode: WriteMode = reducedMotion ? 'fade' : 'animate'
  void font.soon.then(() => {
    if (disposed) return
    fontReady = true
    write(pending ?? currentName, firstMode)
    pending = null
  })
  // If the font arrives after the 1.5s cut-off, redraw the name in it.
  void font.loaded.then(() => {
    if (disposed || !fontReady || !currentName) return
    write(currentName, firstMode)
  })

  return {
    resize(width, height, nextRatio) {
      const first = W === 0
      const sx = first ? 1 : width / W
      const sy = first ? 1 : height / H
      W = width
      H = height
      ratio = nextRatio
      canvas.width = Math.max(1, Math.round(W * ratio))
      canvas.height = Math.max(1, Math.round(H * ratio))
      if (first) makeStars()
      else
        for (const star of stars) {
          star.x *= sx
          star.y *= sy
          star.bx *= sx
          star.by *= sy
          star.flying = false
        }
      paintBackground()
      if (fontReady && currentName) write(currentName, 'instant')
    },
    setLook(next) {
      look = { ...look, ...next }
      lineRgb = look.colors?.[0] ? hexToRgb(look.colors[0]) : [225, 232, 255]
    },
    setPointer(x, y) {
      pointer = x === null || y === undefined ? null : { x, y }
    },
    requestWrite(name) {
      if (!fontReady) {
        pending = name
        return
      }
      write(name, reducedMotion ? 'fade' : 'animate')
    },
    writeNow(name, mode) {
      fontReady = true
      pending = null
      write(name, mode)
    },
    frame(now) {
      if (W < 2 || H < 2) return
      const dt = Math.min(50, Math.max(0, now - last))
      last = now
      const speed = 0.6 + clamp01(look.intensity) * 0.8
      const strength = 0.6 + clamp01(look.intensity) * 0.8

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.drawImage(bg, 0, 0, W, H)

      // Move every star and work out how close the cursor is.
      for (const star of stars) {
        if (star.flying) {
          const p = (now - star.start) / star.dur
          if (p >= 1) {
            star.flying = false
            star.x = star.bx
            star.y = star.by
          } else if (p > 0) {
            const e = easeInOutCubic(p)
            const u = 1 - e
            star.x = u * u * star.fx + 2 * u * e * star.cx + e * e * star.bx
            star.y = u * u * star.fy + 2 * u * e * star.cy + e * e * star.by
          }
        } else if (star.point >= 0) {
          // Settled stars breathe a little.
          const wobble = reducedMotion ? 0 : 1.2
          star.x = star.bx + Math.sin(now * 0.0007 * star.tw + star.ph) * wobble
          star.y = star.by + Math.cos(now * 0.0006 * star.tw + star.ph * 1.7) * wobble
        } else if (!reducedMotion) {
          star.bx += star.vx * dt
          star.by += star.vy * dt
          if (star.bx < -10) star.bx = W + 10
          if (star.bx > W + 10) star.bx = -10
          if (star.by < -10) star.by = H + 10
          if (star.by > H + 10) star.by = -10
          star.x = star.bx
          star.y = star.by
        }
        star.alpha += (star.target - star.alpha) * Math.min(1, dt / 400)
        star.glow = pointer ? Math.max(0, 1 - Math.hypot(star.x - pointer.x, star.y - pointer.y) / 90) : 0
      }

      // A very faint glow of the real word, so the name reads at once.
      if (now > glowStart) {
        const g = clamp01((now - glowStart) / 1200) * strength
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.filter = 'blur(6px)'
        ctx.globalAlpha = 0.055 * g
        ctx.drawImage(text, 0, 0, W, H)
        ctx.filter = 'none'
        ctx.globalAlpha = 0.033 * g
        ctx.drawImage(text, 0, 0, W, H)
        ctx.restore()
      }

      // Lines grow from one star to the next.
      ctx.lineCap = 'round'
      for (const edge of edges) {
        const p = reducedMotion ? 1 : clamp01((now - edge.start) / 650)
        if (p <= 0) continue
        const a = stars[edge.a]
        const b = stars[edge.b]
        const glow = Math.max(a.glow, b.glow)
        ctx.globalAlpha = Math.min(a.alpha, b.alpha)
        ctx.strokeStyle = `rgba(${lineRgb[0]},${lineRgb[1]},${lineRgb[2]},${0.32 + glow * 0.35})`
        ctx.lineWidth = 0.9 + glow * 0.4
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p)
        ctx.stroke()
      }

      // The stars: clean points with a soft falloff, and thin glints on the name stars.
      ctx.globalCompositeOperation = 'lighter'
      for (const star of stars) {
        const shimmer = reducedMotion
          ? 1
          : 1 +
            0.07 * Math.sin(now * 0.001 * star.tw * speed + star.ph) +
            0.04 * Math.sin(now * 0.0023 * star.tw * speed + star.ph * 2.3)
        const shimmerN = clamp01((shimmer - 0.89) / 0.22)
        if (star.point >= 0) {
          if (!reducedMotion && Math.random() < 0.0009) star.flash = 1
          star.flash *= Math.exp(-dt / 350)
          const core = (1.0 + star.r * 0.75) * (0.55 + 0.45 * starScale) * (1 + star.glow * 0.5) * (1 + 0.6 * star.flash)
          const alpha = clamp01(star.alpha * shimmer * (1 + star.glow * 0.4))
          const s = core * 12
          ctx.globalAlpha = alpha
          ctx.drawImage(sprites[WHITE], star.x - s / 2, star.y - s / 2, s, s)
          const length =
            core * (7 + 5 * shimmerN) * starScale * (star.r > 1.2 ? 1 : 0.55) * (1 + 1.5 * star.flash) * (1 + star.glow * 0.8)
          ctx.globalAlpha = clamp01((0.22 + 0.28 * shimmerN) * alpha * strength + star.glow * 0.2)
          ctx.drawImage(glintH, star.x - length, star.y - 0.45, length * 2, 0.9)
          ctx.drawImage(glintV, star.x - 0.45, star.y - length, 0.9, length * 2)
        } else {
          const core = star.r * 0.6 * (1 + star.glow * 0.5)
          const s = core * 12
          ctx.globalAlpha = clamp01(star.alpha * shimmer * (1 + star.glow * 0.6))
          ctx.drawImage(sprites[star.color], star.x - s / 2, star.y - s / 2, s, s)
        }
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    },
    dispose() {
      disposed = true
    },
  }
}

/* ---------- the component ---------- */

export function NameConstellationBackground({
  name = '',
  background = '#050816',
  colors,
  intensity = 0.5,
  detail = 0.6,
  fontFamily = DEFAULT_CONSTELLATION_FONT,
  className,
  style,
  ref,
}: NameConstellationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const nameRef = useRef(name)
  const lookRef = useRef({ colors, intensity })
  const colorKey = colors?.join(',') ?? ''

  useImperativeHandle(
    ref,
    () => ({
      get canvas() {
        return canvasRef.current
      },
      toBlob: () =>
        new Promise<Blob | null>((resolve) => {
          const canvas = canvasRef.current
          if (!canvas) resolve(null)
          else canvas.toBlob(resolve, 'image/png')
        }),
    }),
    [],
  )

  useEffect(() => {
    const canvas = canvasRef.current!
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const engine = createEngine(
      canvas,
      { background, detail, fontFamily, colors: lookRef.current.colors, intensity: lookRef.current.intensity },
      reducedMotion,
    )
    engineRef.current = engine

    const resize = () => {
      const box = canvas.getBoundingClientRect()
      engine.resize(Math.max(1, box.width), Math.max(1, box.height), Math.min(window.devicePixelRatio || 1, 2))
    }
    resize()
    engine.requestWrite(nameRef.current)
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

    // One clock: performance.now() everywhere, never the rAF timestamp.
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
      engine.dispose()
      engineRef.current = null
    }
  }, [background, detail, fontFamily])

  useEffect(() => {
    lookRef.current = { colors: colorKey ? colorKey.split(',') : undefined, intensity }
    engineRef.current?.setLook(lookRef.current)
  }, [colorKey, intensity])

  useEffect(() => {
    if (nameRef.current === name) return
    nameRef.current = name
    engineRef.current?.requestWrite(name)
  }, [name])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', background, ...style }}
    />
  )
}

/** A finished still of a name, for posters and thumbnails. */
export async function renderNameConstellationPoster(
  name: string,
  width: number,
  height: number,
  look: Partial<Look> = {},
): Promise<string> {
  const fontFamily = look.fontFamily ?? DEFAULT_CONSTELLATION_FONT
  await waitForFont(fontFamily).soon
  const canvas = document.createElement('canvas')
  const engine = createEngine(
    canvas,
    { background: '#050816', intensity: 0.5, detail: 0.6, ...look, fontFamily },
    true,
  )
  engine.resize(width, height, 1)
  // Let the engine's own font wait settle first, so it can't redraw over this write.
  await new Promise((resolve) => window.setTimeout(resolve, 0))
  engine.writeNow(name, 'instant')
  engine.frame(performance.now())
  engine.dispose()
  return canvas.toDataURL('image/jpeg', 0.88)
}
