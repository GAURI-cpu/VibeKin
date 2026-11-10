import { ORBS_PALETTES, type OrbsPaletteKey } from '../backgrounds/GradientOrbsBackground'

/** A still Gradient Orbs frame for cards: the diagonal gradient with its spheres and shine. */
export function renderGradientOrbsPoster(width: number, height: number, key: OrbsPaletteKey = 'twilight'): string {
  const { a, b } = ORBS_PALETTES[key]
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const x = c.getContext('2d')
  if (!x) return ''
  const g = x.createLinearGradient(0, height, width, 0)
  g.addColorStop(0, a)
  g.addColorStop(1, b)
  x.fillStyle = g
  x.fillRect(0, 0, width, height)
  const m = Math.min(width, height)
  const orbs = [[0.66, 0.3, 0.12], [0.86, 0.35, 0.056], [0.73, 0.66, 0.19], [0.47, 0.75, 0.048], [0.9, 0.82, 0.088], [0.58, 0.12, 0.032]]
  for (const [ox, oy, or] of orbs) {
    const cx = width * ox
    const cy = height * oy
    const r = m * or
    x.fillStyle = 'rgba(20,10,60,.22)'
    x.beginPath()
    x.arc(cx + r * 0.25, cy + r * 0.35, r * 0.95, 0, 7)
    x.fill()
    const s = x.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
    s.addColorStop(0, b)
    s.addColorStop(1, a)
    x.fillStyle = s
    x.beginPath()
    x.arc(cx, cy, r, 0, 7)
    x.fill()
    const h = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r * 1.1)
    h.addColorStop(0, 'rgba(255,255,255,.22)')
    h.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = h
    x.fill()
  }
  return c.toDataURL('image/jpeg', 0.85)
}
