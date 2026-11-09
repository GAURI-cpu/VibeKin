/**
 * "Vibe from a photo": pulls a palette out of a photo, entirely in the browser.
 * Pure TypeScript. The only DOM it touches is the canvas used to read pixels.
 *
 * Pipeline: read (downscale to 120px) → k-means in OKLab (k = 8, seeded k-means++, 12 rounds)
 * → background from the darkest/lightest big cluster → accents by weight and colourfulness,
 * tuned to glow on the background with at least 3:1 contrast.
 */

export type PhotoPalette = {
  bg: string
  accents: string[]
  mode: 'dark' | 'light'
  /** Raw cluster colours, heaviest first. */
  source: string[]
}

/** One k-means cluster in OKLab, with its share of the photo's pixels. */
export type Cluster = { L: number; a: number; b: number; weight: number }

type Lab = { L: number; a: number; b: number }
type Rgb = [number, number, number]

export type ExtractOptions = { count: number; mode?: 'dark' | 'light'; rotate?: number }

const MAX_SIDE = 120
const K = 8
const ITERATIONS = 12
const MIN_WEIGHT = 0.03
const SAME_COLOUR = 0.08
/** Below this OKLCH chroma a cluster counts as grey. */
const COLOURFUL = 0.035

/* ---------- colour maths: sRGB ↔ linear ↔ OKLab ---------- */

const SRGB_TO_LINEAR = Array.from({ length: 256 }, (_, i) => {
  const c = i / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
})

const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)

function linearToOklab(r: number, g: number, b: number): Lab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

function oklabToLinear({ L, a, b }: Lab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const chroma = (c: Lab) => Math.hypot(c.a, c.b)
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const distance = (p: Lab, q: Lab) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b)

function withChroma(c: Lab, next: number): Lab {
  const current = chroma(c)
  if (current < 1e-9) return { L: c.L, a: 0, b: 0 }
  const f = next / current
  return { L: c.L, a: c.a * f, b: c.b * f }
}

function rotateHue(c: Lab, degrees: number): Lab {
  const C = chroma(c)
  const h = Math.atan2(c.b, c.a) + (degrees * Math.PI) / 180
  return { L: c.L, a: C * Math.cos(h), b: C * Math.sin(h) }
}

const EPS = 1e-4
const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -EPS && v <= 1 + EPS)

/** Into the sRGB gamut by lowering chroma (keeps lightness and hue), then a final clip. Linear RGB out. */
function toGamut(c: Lab): Rgb {
  let rgb = oklabToLinear(c)
  if (!inGamut(rgb)) {
    let lo = 0
    let hi = 1
    const C = chroma(c)
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(oklabToLinear(withChroma(c, C * mid)))) lo = mid
      else hi = mid
    }
    rgb = oklabToLinear(withChroma(c, C * lo))
  }
  return [clamp(rgb[0], 0, 1), clamp(rgb[1], 0, 1), clamp(rgb[2], 0, 1)]
}

function linearToHex(rgb: Rgb) {
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round(clamp(linearToSrgb(v), 0, 1) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}

const toHex = (c: Lab) => linearToHex(toGamut(c))

/** WCAG relative luminance of a linear RGB colour. */
const luminance = (rgb: Rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]

const contrast = (y1: number, y2: number) => (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05)

function hexToLab(hex: string): Lab {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16) || 0
  return linearToOklab(SRGB_TO_LINEAR[(n >> 16) & 255], SRGB_TO_LINEAR[(n >> 8) & 255], SRGB_TO_LINEAR[n & 255])
}

/* ---------- 1. read ---------- */

/** Decodes an image and returns RGBA pixels, downscaled so the longest side is at most 120px. */
export async function readPixels(file: File | Blob): Promise<Uint8ClampedArray> {
  let source: ImageBitmap | HTMLImageElement
  let width: number
  let height: number
  let bitmap: ImageBitmap | null = null
  let url: string | null = null
  try {
    try {
      bitmap = await createImageBitmap(file)
      source = bitmap
      width = bitmap.width
      height = bitmap.height
    } catch {
      // Older browsers: decode through an <img> instead.
      url = URL.createObjectURL(file)
      const img = new Image()
      img.decoding = 'async'
      img.src = url
      await img.decode()
      source = img
      width = img.naturalWidth
      height = img.naturalHeight
    }
    if (!width || !height) throw new Error('Empty image')
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('No canvas')
    ctx.drawImage(source, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h).data
  } finally {
    bitmap?.close()
    if (url) URL.revokeObjectURL(url)
  }
}

/* ---------- 2. cluster ---------- */

/** Small seeded random (mulberry32), so the same photo always gives the same palette. */
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

/** k-means in OKLab. Returns clusters heaviest first; empty for a fully transparent image. */
export function clusterPixels(pixels: Uint8ClampedArray, k = K, iterations = ITERATIONS): Cluster[] {
  const total = pixels.length / 4
  const points = new Float64Array(total * 3)
  let n = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue
    const lab = linearToOklab(SRGB_TO_LINEAR[pixels[i]], SRGB_TO_LINEAR[pixels[i + 1]], SRGB_TO_LINEAR[pixels[i + 2]])
    points[n * 3] = lab.L
    points[n * 3 + 1] = lab.a
    points[n * 3 + 2] = lab.b
    n++
  }
  if (n === 0) return []

  const random = seeded(0x5eed)
  const centres: number[] = []
  const nearest = new Float64Array(n).fill(Infinity)
  const d2 = (i: number, c: number) => {
    const dL = points[i * 3] - centres[c * 3]
    const da = points[i * 3 + 1] - centres[c * 3 + 1]
    const db = points[i * 3 + 2] - centres[c * 3 + 2]
    return dL * dL + da * da + db * db
  }

  // k-means++ seeding: each new centre is picked with probability ∝ squared distance to the nearest one.
  let pick = Math.floor(random() * n)
  for (let c = 0; c < k; c++) {
    if (c > 0) {
      let sum = 0
      for (let i = 0; i < n; i++) sum += nearest[i]
      if (sum <= 1e-12) break // every pixel already sits on a centre
      let r = random() * sum
      pick = n - 1
      for (let i = 0; i < n; i++) {
        r -= nearest[i]
        if (r <= 0) {
          pick = i
          break
        }
      }
    }
    centres.push(points[pick * 3], points[pick * 3 + 1], points[pick * 3 + 2])
    for (let i = 0; i < n; i++) nearest[i] = Math.min(nearest[i], d2(i, c))
  }

  const count = centres.length / 3
  const assignment = new Int32Array(n)
  const sizes = new Float64Array(count)
  const assign = () => {
    sizes.fill(0)
    for (let i = 0; i < n; i++) {
      let best = 0
      let bestD = Infinity
      for (let c = 0; c < count; c++) {
        const d = d2(i, c)
        if (d < bestD) {
          bestD = d
          best = c
        }
      }
      assignment[i] = best
      sizes[best]++
    }
  }

  for (let round = 0; round < iterations; round++) {
    assign()
    const sums = new Float64Array(count * 3)
    for (let i = 0; i < n; i++) {
      const c = assignment[i]
      sums[c * 3] += points[i * 3]
      sums[c * 3 + 1] += points[i * 3 + 1]
      sums[c * 3 + 2] += points[i * 3 + 2]
    }
    for (let c = 0; c < count; c++) {
      if (!sizes[c]) continue // an empty cluster keeps its centre
      centres[c * 3] = sums[c * 3] / sizes[c]
      centres[c * 3 + 1] = sums[c * 3 + 1] / sizes[c]
      centres[c * 3 + 2] = sums[c * 3 + 2] / sizes[c]
    }
  }
  assign()

  const clusters: Cluster[] = []
  for (let c = 0; c < count; c++) {
    if (sizes[c]) clusters.push({ L: centres[c * 3], a: centres[c * 3 + 1], b: centres[c * 3 + 2], weight: sizes[c] / n })
  }
  return clusters.sort((p, q) => q.weight - p.weight)
}

/* ---------- 3–8. palette ---------- */

/** Dark when the photo's weighted average lightness is below 0.6. */
export function autoMode(clusters: Cluster[]): 'dark' | 'light' {
  let L = 0
  let w = 0
  for (const c of clusters) {
    L += c.L * c.weight
    w += c.weight
  }
  return w && L / w >= 0.6 ? 'light' : 'dark'
}

/** Builds the palette from clusters. Cheap, so Dark/Light, Shuffle and asset switches never re-read the photo. */
export function paletteFromClusters(clusters: Cluster[], opts: ExtractOptions): PhotoPalette {
  const count = Math.max(1, Math.floor(opts.count))
  const list: Cluster[] = clusters.length ? clusters : [{ L: 0.5, a: 0, b: 0, weight: 1 }]
  const mode = opts.mode ?? autoMode(list)
  const dark = mode === 'dark'

  // Background: the darkest (or lightest) cluster with a real share of the photo, made deep (or soft).
  const big = list.filter((c) => c.weight >= MIN_WEIGHT)
  const pool = big.length ? big : list
  const base = pool.reduce((best, c) => (dark ? c.L < best.L : c.L > best.L) ? c : best)
  const bgLab = withChroma({ L: dark ? 0.13 : 0.95, a: base.a, b: base.b }, Math.min(chroma(base), dark ? 0.04 : 0.03))
  const bgRgb = toGamut(bgLab)
  const bgY = luminance(bgRgb)

  // Accents must read against the background: nudge lightness until contrast is at least 3:1.
  const finish = (c: Lab, tune: boolean) => {
    let lab = c
    if (tune) {
      lab = dark
        ? withChroma({ ...lab, L: clamp(lab.L, 0.62, 0.85) }, Math.min(chroma(lab) * 1.15, 0.25))
        : withChroma({ ...lab, L: clamp(lab.L, 0.45, 0.72) }, Math.min(chroma(lab) * 1.05, 0.25))
    }
    for (let i = 0; i < 50 && contrast(luminance(toGamut(lab)), bgY) < 3; i++) {
      lab = { ...lab, L: clamp(lab.L + (dark ? 0.02 : -0.02), 0, 1) }
    }
    return toHex(lab)
  }

  const score = (c: Cluster) => Math.sqrt(c.weight) * (0.35 + chroma(c) * 4)
  const colourful = list.filter((c) => chroma(c) >= COLOURFUL).sort((p, q) => score(q) - score(p))
  const picked: Lab[] = []
  for (const c of colourful) {
    if (picked.length >= count) break
    if (picked.every((p) => distance(p, c) >= SAME_COLOUR)) picked.push(c)
  }

  let accents: string[]
  if (picked.length) {
    // Too few colours (a mostly grey photo): walk the strongest accent's hue around the wheel.
    const offsets = [40, -40, 80, -80, 120, -120, 160, -160]
    for (let i = 0; picked.length < count; i++) picked.push(rotateHue(picked[0], offsets[i % offsets.length]))
    accents = picked.map((c) => finish(c, true))
  } else {
    // A fully grey photo: a quiet silver/pearl (or graphite) scale, faintly tinted like the background.
    const steps = dark ? [0.86, 0.72, 0.95, 0.64, 0.79] : [0.5, 0.62, 0.42, 0.68, 0.56]
    accents = Array.from({ length: count }, (_, i) =>
      finish(withChroma({ L: steps[i % steps.length], a: bgLab.a, b: bgLab.b }, Math.min(chroma(bgLab), 0.012)), false),
    )
  }

  const r = (((opts.rotate ?? 0) % count) + count) % count
  return {
    bg: linearToHex(bgRgb),
    accents: [...accents.slice(r), ...accents.slice(0, r)],
    mode,
    source: list.map((c) => toHex(c)),
  }
}

/** One step: cluster the pixels, then build the palette. */
export function extractPalette(pixels: Uint8ClampedArray, opts: ExtractOptions): PhotoPalette {
  return paletteFromClusters(clusterPixels(pixels), opts)
}

/* ---------- naming, for the screen-reader announcement ---------- */

const HUES: [number, string, string][] = [
  // [OKLCH hue upper bound in degrees, dark name, light name]
  [15, 'plum', 'blush'],
  [45, 'wine', 'blush'],
  [75, 'umber', 'peach'],
  [115, 'olive', 'cream'],
  [165, 'forest', 'mint'],
  [215, 'teal', 'mist'],
  [275, 'navy', 'sky'],
  [330, 'violet', 'lilac'],
  [360, 'plum', 'blush'],
]

/** A friendly name like "deep navy" or "soft cream". */
export function nameColour(hex: string): string {
  const lab = hexToLab(hex)
  const darkish = lab.L < 0.5
  if (chroma(lab) < 0.012) return darkish ? 'deep charcoal' : 'soft pearl'
  const hue = ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360
  const [, darkName, lightName] = HUES.find(([max]) => hue < max) ?? HUES[0]
  return darkish ? `deep ${darkName}` : `soft ${lightName}`
}
