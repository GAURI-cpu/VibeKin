import * as THREE from 'three'
import type { BackdropId } from './vibes'

type Rect = { left: number; top: number; right: number; bottom: number }

export type BackdropLayer = {
  setKind(kind: BackdropId): void
  setColors(colors: string[]): void
  setDim(dim: boolean): void
  /** `keepClear` is the copy block, where marks fade so the text stays readable. */
  resize(width: number, height: number, keepClear: Rect): void
  frame(time: number): void
}

/** Pastels vanish on cream, so marks use a deeper tint there and a lighter one on dim paper. */
function markColor(hex: string, dim: boolean) {
  const hsl = { h: 0, s: 0, l: 0 }
  const color = new THREE.Color(hex)
  color.getHSL(hsl, THREE.SRGBColorSpace)
  const lightness = dim ? Math.max(hsl.l, 0.72) : Math.min(hsl.l, 0.56) - 0.04
  color.setHSL(hsl.h, Math.min(1, hsl.s * 0.85 + 0.12), lightness, THREE.SRGBColorSpace)
  return `#${color.getHexString(THREE.SRGBColorSpace)}`
}

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

const CODE = `const kin=blobs.map(b=>b.look(cursor));blink();squish(){y*=.8;x*=1.1}vibe.shuffle();<Hero mood="cute"/>sparkle(t)=>sin(t)**6;paper:#fbf7f0;`

type Point = [number, number]

const spin = (count: number, fn: (a: number) => Point): Point[] =>
  Array.from({ length: count + 1 }, (_, i) => fn((i / count) * Math.PI * 2))

const DOODLES: Point[][] = [
  // Heart
  spin(26, (a) => [
    (16 * Math.sin(a) ** 3) / 17,
    -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17,
  ]),
  // Star
  Array.from({ length: 11 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 ? 0.42 : 1
    return [Math.cos(a) * r, Math.sin(a) * r] as Point
  }),
  // Spiral
  Array.from({ length: 40 }, (_, i) => {
    const a = (i / 39) * Math.PI * 5
    const r = (i / 39) * 0.95
    return [Math.cos(a) * r, Math.sin(a) * r] as Point
  }),
  // Squiggle
  Array.from({ length: 28 }, (_, i) => [(i / 27) * 2.2 - 1.1, Math.sin((i / 27) * Math.PI * 5) * 0.32] as Point),
  // Flower
  spin(50, (a) => {
    const r = 0.62 + 0.34 * Math.cos(5 * a)
    return [Math.cos(a) * r, Math.sin(a) * r]
  }),
  // Smile
  spin(24, (a) => [Math.cos(a) * 0.9, Math.sin(a) * 0.9]),
]

export function createBackdropLayer(canvas: HTMLCanvasElement, reducedMotion: boolean): BackdropLayer {
  const ctx = canvas.getContext('2d')!
  let kind: BackdropId = 'clay'
  let moodColors = ['#2b2320']
  let dim = false
  let colors = moodColors
  let width = 1
  let height = 1
  let clear: Rect = { left: 0, top: 0, right: 0, bottom: 0 }
  let lastDraw = -Infinity
  let drawnOnce = false

  type Speck = { x: number; y: number; size: number; phase: number; speed: number; color: number }
  let specks: Speck[] = []

  type Column = { x: number; head: number; rate: number; length: number; offset: number; color: number }
  let columns: Column[] = []
  const rowHeight = 19

  type Doodle = { shape: number; x: number; y: number; size: number; rotation: number; color: number; seed: number }
  let doodles: Doodle[] = []

  /** 1 away from the copy, falling to `floor` right behind it. */
  function clearance(x: number, y: number, floor: number) {
    const cx = (clear.left + clear.right) / 2
    const cy = (clear.top + clear.bottom) / 2
    const nx = (x - cx) / ((clear.right - clear.left) / 2 || 1)
    const ny = (y - cy) / ((clear.bottom - clear.top) / 2 || 1)
    const distance = Math.max(Math.abs(nx), Math.abs(ny))
    const t = Math.min(1, Math.max(0, (distance - 0.8) / 0.4))
    return floor + (1 - floor) * t * t * (3 - 2 * t)
  }

  function layout() {
    const random = seeded(19)

    specks = Array.from({ length: Math.round((width * height) / 5200) }, () => ({
      x: random() * width,
      y: random() * height,
      size: random() < 0.14 ? 6 + random() * 9 : 1 + random() * 1.6,
      phase: random() * Math.PI * 2,
      speed: 0.7 + random() * 1.9,
      color: Math.floor(random() * 6),
    }))

    const columnWidth = 22
    columns = Array.from({ length: Math.ceil(width / columnWidth) }, (_, i) => ({
      x: i * columnWidth + 4,
      head: random() * 60,
      rate: 0.5 + random() * 0.9,
      length: 7 + Math.floor(random() * 15),
      offset: Math.floor(random() * CODE.length),
      color: Math.floor(random() * 6),
    }))

    const cell = Math.max(130, Math.min(190, width / 8))
    doodles = []
    for (let y = cell / 2; y < height; y += cell) {
      for (let x = cell / 2; x < width; x += cell) {
        const px = x + (random() - 0.5) * cell * 0.5
        const py = y + (random() - 0.5) * cell * 0.5
        const shape = Math.floor(random() * DOODLES.length)
        const roll = random()
        const size = 18 + random() * 20
        const rotation = (random() - 0.5) * 0.9
        const color = Math.floor(random() * 6)
        const seed = Math.floor(random() * 1e6)
        const inCopy = px > clear.left - 20 && px < clear.right + 20 && py > clear.top - 20 && py < clear.bottom + 20
        if (!inCopy && roll > 0.16) doodles.push({ shape, x: px, y: py, size, rotation, color, seed })
      }
    }
  }

  function tint(index: number) {
    return colors[index % colors.length]
  }

  function drawGlitter(t: number) {
    for (const speck of specks) {
      const twinkle = Math.pow(Math.max(0, Math.sin(t * speck.speed + speck.phase)), 6)
      const alpha = (reducedMotion ? 0.7 : twinkle) * clearance(speck.x, speck.y, 0.1)
      if (alpha < 0.02) continue
      ctx.globalAlpha = alpha
      ctx.fillStyle = tint(speck.color)
      if (speck.size < 3) {
        ctx.fillRect(speck.x, speck.y, speck.size, speck.size)
        continue
      }
      const r = speck.size * (reducedMotion ? 1 : 0.65 + twinkle * 0.35)
      const pinch = r * 0.12
      ctx.beginPath()
      ctx.moveTo(speck.x, speck.y - r)
      ctx.quadraticCurveTo(speck.x + pinch, speck.y - pinch, speck.x + r, speck.y)
      ctx.quadraticCurveTo(speck.x + pinch, speck.y + pinch, speck.x, speck.y + r)
      ctx.quadraticCurveTo(speck.x - pinch, speck.y + pinch, speck.x - r, speck.y)
      ctx.quadraticCurveTo(speck.x - pinch, speck.y - pinch, speck.x, speck.y - r)
      ctx.fill()
    }
  }

  function drawRain(t: number) {
    ctx.font = '500 13px "DM Mono", monospace'
    ctx.textBaseline = 'top'
    const rows = Math.ceil(height / rowHeight) + 24
    for (const column of columns) {
      const head = reducedMotion ? column.head : Math.floor((t * 12 * column.rate + column.head) % rows)
      for (let i = 0; i < column.length; i++) {
        const row = head - i
        if (row < 0) continue
        const y = row * rowHeight
        if (y > height) continue
        const glyph = CODE[(column.offset + row * 3) % CODE.length]
        const fade = i === 0 ? 1 : 0.62 * (1 - i / column.length)
        ctx.globalAlpha = fade * clearance(column.x, y, 0.05)
        ctx.fillStyle = i === 0 ? (dim ? '#f8efe3' : '#2b2320') : tint(column.color)
        ctx.fillText(glyph, column.x, y)
      }
    }
  }

  function drawDoodles(t: number) {
    const boil = reducedMotion ? 0 : Math.floor(t * 6) % 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 3.2
    ctx.globalAlpha = 0.9
    for (const doodle of doodles) {
      const random = seeded(doodle.seed + boil * 977)
      const cos = Math.cos(doodle.rotation)
      const sin = Math.sin(doodle.rotation)
      const points = DOODLES[doodle.shape].map(([px, py]): Point => {
        const jx = px * doodle.size + (random() - 0.5) * 2.6
        const jy = py * doodle.size + (random() - 0.5) * 2.6
        return [doodle.x + jx * cos - jy * sin, doodle.y + jx * sin + jy * cos]
      })
      ctx.strokeStyle = tint(doodle.color)
      ctx.beginPath()
      ctx.moveTo(points[0][0], points[0][1])
      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i][0] + points[i + 1][0]) / 2
        const midY = (points[i][1] + points[i + 1][1]) / 2
        ctx.quadraticCurveTo(points[i][0], points[i][1], midX, midY)
      }
      const last = points[points.length - 1]
      ctx.lineTo(last[0], last[1])
      ctx.stroke()
      if (doodle.shape === 5) {
        // Two eyes and a smile inside the circle.
        ctx.fillStyle = tint(doodle.color)
        for (const side of [-1, 1]) {
          ctx.beginPath()
          ctx.arc(doodle.x + side * doodle.size * 0.32, doodle.y - doodle.size * 0.2, 2.6, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.beginPath()
        ctx.arc(doodle.x, doodle.y + doodle.size * 0.05, doodle.size * 0.38, 0.25, Math.PI - 0.25)
        ctx.stroke()
      }
    }
  }

  const FRAME_GAP: Record<BackdropId, number> = { clay: Infinity, glitter: 1 / 30, rain: 1 / 12, doodles: 1 / 6 }

  function draw(t: number) {
    ctx.clearRect(0, 0, width, height)
    ctx.globalAlpha = 1
    if (kind === 'glitter') drawGlitter(t)
    if (kind === 'rain') drawRain(t)
    if (kind === 'doodles') drawDoodles(t)
    lastDraw = t
    drawnOnce = true
  }

  return {
    setKind(next) {
      kind = next
      drawnOnce = false
    },
    setColors(next) {
      moodColors = next
      colors = moodColors.map((hex) => markColor(hex, dim))
      drawnOnce = false
    },
    setDim(next) {
      dim = next
      colors = moodColors.map((hex) => markColor(hex, dim))
      drawnOnce = false
    },
    resize(w, h, keepClear) {
      width = w
      height = h
      clear = keepClear
      const ratio = Math.min(window.devicePixelRatio, 2)
      canvas.width = Math.round(w * ratio)
      canvas.height = Math.round(h * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      layout()
      drawnOnce = false
    },
    frame(t) {
      if (!drawnOnce) return draw(t)
      if (reducedMotion) return
      if (t - lastDraw >= FRAME_GAP[kind]) draw(t)
    },
  }
}
