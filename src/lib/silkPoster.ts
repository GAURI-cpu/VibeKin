import { SILK_PALETTES, type SilkPaletteKey } from '../backgrounds/SilkFlowBackground'

/** A still Silk Flow frame for cards: blurred glows plus the silk lines. */
export function renderSilkFlowPoster(width: number, height: number, key: SilkPaletteKey = 'midnight'): string {
  const pal = SILK_PALETTES[key]
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const x = c.getContext('2d')
  if (!x) return ''
  const rgb = (h: string, a = 1) => `rgba(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',')},${a})`
  x.fillStyle = pal.base
  x.fillRect(0, 0, width, height)
  x.filter = `blur(${Math.round(Math.min(width, height) * 0.09)}px)`
  const spots = [[0.22, 0.18, 0.55], [0.75, 0.32, 0.55], [0.55, 0.85, 0.6], [0.95, 0.85, 0.45], [0.05, 0.85, 0.45], [0.5, 0.45, 0.4]]
  spots.forEach(([bx, by, br], i) => {
    const r = Math.max(width, height) * br * 0.55
    const g = x.createRadialGradient(width * bx, height * by, 0, width * bx, height * by, r)
    g.addColorStop(0, rgb(pal.blobs[i]))
    g.addColorStop(1, rgb(pal.blobs[i], 0))
    x.fillStyle = g
    x.fillRect(0, 0, width, height)
  })
  x.filter = 'none'
  x.lineWidth = 0.8
  for (let i = 0; i < 46; i++) {
    x.strokeStyle = `rgba(${pal.line.join(',')},${pal.la * (0.18 + 0.32 * Math.sin((i / 46) * Math.PI))})`
    x.beginPath()
    for (let j = 0; j <= 100; j++) {
      const s = j / 100
      const py = height * (0.08 + i * 0.019) + Math.sin(s * 5 + i * 0.12) * height * 0.05 + Math.sin(s * 11) * height * 0.012
      if (j) x.lineTo(s * width, py)
      else x.moveTo(s * width, py)
    }
    x.stroke()
  }
  return c.toDataURL('image/jpeg', 0.85)
}
