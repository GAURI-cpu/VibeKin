/**
 * The nine galaxy backgrounds, drawn with Canvas 2D (no WebGL, so any number can exist at once).
 * A scene is set up for a size and options, then returns a draw function called with time in seconds.
 */

export type GalaxyOptions = {
  /** Sky colour behind everything. Light skies switch to normal blending so colours don't wash out. */
  background: string
  /** Three accent colours; scenes cycle through them. */
  colors: string[]
  /** 0 to 1: brightness and glow strength. */
  intensity: number
  /** 0 to 1: how many stars and particles are drawn. */
  detail: number
}

export type Draw = (ctx: CanvasRenderingContext2D, t: number) => void
export type Scene = (width: number, height: number, options: GalaxyOptions) => Draw

/* ---------- helpers ---------- */

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function rgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.replace(/./g, (c) => c + c)
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [255, 255, 255]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgba(hex: string, alpha: number) {
  const [r, g, b] = rgb(hex)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`
}

export function isLightColor(hex: string) {
  const [r, g, b] = rgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

type Look = {
  light: boolean
  /** Additive glow on dark skies, plain paint on light ones. */
  blend: GlobalCompositeOperation
  star: string
  glow: number
  color: (i: number) => string
  count: (perMegapixel: number, width: number, height: number) => number
}

function look(o: GalaxyOptions): Look {
  const light = isLightColor(o.background)
  const colors = o.colors.length ? o.colors : ['#ffffff']
  const detail = clamp01(o.detail)
  return {
    light,
    blend: light ? 'source-over' : 'lighter',
    star: light ? '#5e514a' : '#ffffff',
    glow: (0.35 + clamp01(o.intensity) * 0.9) * (light ? 0.75 : 1),
    color: (i) => colors[((i % colors.length) + colors.length) % colors.length],
    count: (perMegapixel, w, h) => Math.round(((w * h) / 1e6) * perMegapixel * (0.3 + detail * 1.1)),
  }
}

type Star = { x: number; y: number; r: number; phase: number; speed: number }

function makeStars(w: number, h: number, count: number, random: () => number): Star[] {
  return Array.from({ length: count }, () => ({
    x: random() * w,
    y: random() * h,
    r: random() < 0.08 ? 1.2 + random() * 1.1 : 0.5 + random() * 0.8,
    phase: random() * Math.PI * 2,
    speed: 0.6 + random() * 2.2,
  }))
}

function drawStars(ctx: CanvasRenderingContext2D, stars: Star[], t: number, color: string, alpha: number) {
  ctx.fillStyle = color
  for (const s of stars) {
    ctx.globalAlpha = alpha * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase)))
    if (s.r < 1) {
      ctx.fillRect(s.x, s.y, s.r * 2, s.r * 2)
    } else {
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, rgba(color, alpha))
  g.addColorStop(1, rgba(color, 0))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

function paintSky(ctx: CanvasRenderingContext2D, w: number, h: number, o: GalaxyOptions) {
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.fillStyle = o.background
  ctx.fillRect(0, 0, w, h)
}

/* ---------- scenes ---------- */

const aurora: Scene = (w, h, o) => {
  const L = look(o)
  const random = seeded(37)
  const stars = makeStars(w, h * 0.7, L.count(220, w, h), random)
  // One soft vertical gradient per colour, stretched into each curtain strip.
  const sprites = [0, 1, 2].map((i) => {
    const sprite = document.createElement('canvas')
    sprite.width = 1
    sprite.height = 128
    const sctx = sprite.getContext('2d')!
    const g = sctx.createLinearGradient(0, 0, 0, 128)
    g.addColorStop(0, rgba(L.color(i), 0))
    g.addColorStop(0.75, rgba(L.color(i), 0.55))
    g.addColorStop(0.92, rgba(L.color(i), 0.9))
    g.addColorStop(1, rgba(L.color(i), 0))
    sctx.fillStyle = g
    sctx.fillRect(0, 0, 1, 128)
    return sprite
  })
  const step = Math.max(3, Math.round(w / 360))
  return (ctx, t) => {
    paintSky(ctx, w, h, o)
    drawStars(ctx, stars, t, L.star, 0.8)
    glowDot(ctx, w / 2, h * 1.05, Math.max(w, h) * 0.7, L.color(0), 0.16 * L.glow)
    ctx.globalCompositeOperation = L.blend
    for (let band = 0; band < 3; band++) {
      const base = h * (0.42 + band * 0.09)
      for (let x = 0; x < w; x += step) {
        const wave = Math.sin(x * 0.0035 + t * 0.35 + band * 1.7) * h * 0.09 + Math.sin(x * 0.011 - t * 0.6 + band) * h * 0.025
        const length = h * (0.22 + 0.12 * Math.sin(x * 0.005 + t * 0.45 + band * 2.1))
        const shimmer = 0.45 + 0.55 * Math.sin(x * 0.018 + t * 1.6 + band * 3)
        ctx.globalAlpha = clamp01(shimmer * 0.55 * L.glow)
        ctx.drawImage(sprites[band], x, base + wave - length, step + 1, length)
      }
    }
    ctx.globalAlpha = 1
  }
}

const milkyWay: Scene = (w, h, o) => {
  const L = look(o)
  const random = seeded(41)
  const stars = makeStars(w, h, L.count(200, w, h), random)
  const reach = Math.hypot(w, h) * 0.6
  const gauss = () => (random() + random() + random() - 1.5) / 1.5
  const dust = Array.from({ length: L.count(2600, w, h) }, (_, i) => ({
    u: random() * 2 - 1,
    v: gauss() * 0.16 * (1 - Math.abs(gauss()) * 0.4),
    r: random() < 0.05 ? 1.4 : 0.7,
    phase: random() * Math.PI * 2,
    color: i % 3 === 0 ? L.color(i) : L.star,
  }))
  return (ctx, t) => {
    paintSky(ctx, w, h, o)
    drawStars(ctx, stars, t, L.star, 0.7)
    const angle = -0.6 + t * 0.015
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    ctx.globalCompositeOperation = L.blend
    // The soft glow of the band itself.
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(angle)
    ctx.scale(1, 0.22)
    glowDot(ctx, 0, 0, reach, L.color(0), 0.3 * L.glow)
    glowDot(ctx, reach * 0.15, 0, reach * 0.5, L.color(1), 0.25 * L.glow)
    ctx.restore()
    for (const d of dust) {
      const x = w / 2 + (d.u * cos - d.v * sin) * reach
      const y = h / 2 + (d.u * sin + d.v * cos) * reach
      if (x < 0 || x > w || y < 0 || y > h) continue
      ctx.globalAlpha = clamp01((0.35 + 0.4 * Math.sin(t * 1.5 + d.phase)) * L.glow)
      ctx.fillStyle = d.color
      ctx.fillRect(x, y, d.r, d.r)
    }
    ctx.globalAlpha = 1
  }
}

const stardust: Scene = (w, h, o) => {
  const L = look(o)
  const random = seeded(67)
  const stars = makeStars(w, h, L.count(150, w, h), random)
  const specks = Array.from({ length: L.count(380, w, h) }, (_, i) => ({
    x: random() * w,
    y: random() * (h + 40),
    r: 1 + random() * 2.4,
    rise: 0.02 + random() * 0.05,
    sway: 0.4 + random() * 0.8,
    phase: random() * Math.PI * 2,
    color: L.color(i),
  }))
  return (ctx, t) => {
    paintSky(ctx, w, h, o)
    glowDot(ctx, w / 2, h * 1.1, Math.max(w, h) * 0.8, L.color(0), 0.22 * L.glow)
    drawStars(ctx, stars, t, L.star, 0.6)
    ctx.globalCompositeOperation = L.blend
    for (const s of specks) {
      const y = h + 20 - ((h + 40 - s.y + t * s.rise * h) % (h + 40))
      const x = s.x + Math.sin(t * s.sway + s.phase) * 18
      const twinkle = 0.5 + 0.5 * Math.sin(t * 2.2 + s.phase)
      ctx.globalAlpha = clamp01((0.35 + twinkle * 0.65) * L.glow)
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(x, y, s.r, 0, Math.PI * 2)
      ctx.fill()
      if (s.r > 2.6) glowDot(ctx, x, y, s.r * 5, s.color, 0.25 * twinkle * L.glow)
    }
    ctx.globalAlpha = 1
  }
}

const blackHole: Scene = (w, h, o) => {
  const L = look(o)
  const random = seeded(79)
  const stars = makeStars(w, h, L.count(260, w, h), random)
  const core = Math.min(w, h) * 0.12
  const tilt = 0.32
  const disk = Array.from({ length: L.count(3200, w, h) }, () => {
    const r = core * (1.25 + Math.pow(random(), 1.6) * 3.4)
    return {
      r,
      a: random() * Math.PI * 2,
      speed: 2.4 / Math.pow(r / core, 1.5),
      size: random() < 0.1 ? 1.8 : 1,
      band: r < core * 1.9 ? 0 : r < core * 3 ? 1 : 2,
    }
  })
  return (ctx, t) => {
    paintSky(ctx, w, h, o)
    drawStars(ctx, stars, t, L.star, 0.8)
    const cx = w / 2
    const cy = h / 2
    ctx.globalCompositeOperation = L.blend
    glowDot(ctx, cx, cy, core * 5, L.color(1), 0.22 * L.glow)
    const drawHalf = (back: boolean) => {
      for (const p of disk) {
        const a = p.a + t * p.speed * 0.25
        const s = Math.sin(a)
        if (back !== s < 0) continue
        ctx.globalAlpha = clamp01((0.45 + 0.4 * (1 - p.band / 2)) * L.glow)
        ctx.fillStyle = L.color(p.band)
        ctx.fillRect(cx + Math.cos(a) * p.r, cy + s * p.r * tilt, p.size, p.size)
      }
      ctx.globalAlpha = 1
    }
    drawHalf(true)
    // The dark centre and its thin bright edge.
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = L.light ? '#1d1613' : '#000000'
    ctx.beginPath()
    ctx.arc(cx, cy, core, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = L.blend
    ctx.strokeStyle = rgba(L.color(0), clamp01(0.9 * L.glow))
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, core * 1.04, 0, Math.PI * 2)
    ctx.stroke()
    drawHalf(false)
  }
}

const cometTrail: Scene = (w, h, o) => {
  const L = look(o)
  const random = seeded(97)
  const stars = makeStars(w, h, L.count(320, w, h), random)
  const travel = Math.hypot(w, h) * 1.3
  const dir = { x: -Math.cos(0.5), y: Math.sin(0.5) }
  const comets = Array.from({ length: 3 + Math.round(clamp01(o.detail) * 4) }, (_, i) => ({
    start: { x: w * (0.4 + random() * 0.9), y: -h * (0.1 + random() * 0.5) },
    period: 5 + random() * 5,
    offset: random() * 10,
    tail: Math.max(w, h) * (0.15 + random() * 0.15),
    color: L.color(i),
  }))
  return (ctx, t) => {
    paintSky(ctx, w, h, o)
    drawStars(ctx, stars, t, L.star, 0.9)
    ctx.globalCompositeOperation = L.blend
    ctx.lineCap = 'round'
    for (const c of comets) {
      const phase = ((t + c.offset) / c.period) % 1
      if (phase > 0.55) continue
      const p = phase / 0.55
      const x = c.start.x + dir.x * travel * p
      const y = c.start.y + dir.y * travel * p
      const tx = x - dir.x * c.tail
      const ty = y - dir.y * c.tail
      const fade = Math.sin(p * Math.PI)
      const g = ctx.createLinearGradient(tx, ty, x, y)
      g.addColorStop(0, rgba(c.color, 0))
      g.addColorStop(1, rgba(c.color, clamp01(0.9 * fade * L.glow)))
      ctx.strokeStyle = g
      ctx.lineWidth = 2.6
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(x, y)
      ctx.stroke()
      glowDot(ctx, x, y, 14, c.color, 0.7 * fade * L.glow)
      glowDot(ctx, x, y, 4, L.light ? c.color : '#ffffff', fade)
    }
  }
}

export const SCENES = {
  Aurora: aurora,
  MilkyWay: milkyWay,
  Stardust: stardust,
  BlackHole: blackHole,
  CometTrail: cometTrail,
} satisfies Record<string, Scene>

export type SceneName = keyof typeof SCENES

const base = { intensity: 0.8, detail: 0.7 }

/** Each background's own look when no colour from the rail has been picked. */
export const SCENE_DEFAULTS: Record<SceneName, GalaxyOptions> = {
  Aurora: { ...base, background: '#081428', colors: ['#4fe3b0', '#8a7bff', '#5fd0ff'] },
  MilkyWay: { ...base, background: '#0a0818', colors: ['#c9a8ff', '#c8d4ff', '#ffe9c7'] },
  Stardust: { ...base, background: '#1d1430', colors: ['#ffc6e0', '#c9b9ff', '#b2f0dd'] },
  BlackHole: { ...base, background: '#0b0812', colors: ['#ffd27a', '#d6b36a', '#b0626f'] },
  CometTrail: { ...base, background: '#0d0b26', colors: ['#7ae0ff', '#ff8fc7', '#ffe39a'] },
}

export const isSceneName = (name: string): name is SceneName => name in SCENES

/** Scenes start this many seconds in, so posters and live previews show the same moment. */
export const START_TIME = 20

const posterCache = new Map<string, string>()

/** One still frame as an image URL, for gallery posters and the drawer card. */
export function renderPoster(name: SceneName, options: GalaxyOptions, width = 640, height = 400) {
  const key = `${name}|${width}x${height}|${JSON.stringify(options)}`
  const cached = posterCache.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  SCENES[name](width, height, options)(ctx, START_TIME)
  const url = canvas.toDataURL('image/jpeg', 0.86)
  posterCache.set(key, url)
  return url
}
