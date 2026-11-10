import { useEffect, useRef, type CSSProperties } from 'react'

/**
 * Ink Bloom: a drop of ink slowly blooming through milky water (WebGL).
 * The cursor pushes the ink like a finger in water; clicking drops a fresh bloom.
 * Self-contained: no imports from the rest of the codebase.
 */

export type InkBloomProps = {
  background?: string
  /** [mid ink, deep ink] */
  colors?: string[]
  /** 0 to 1: how fast the ink moves. */
  intensity?: number
  /** 0 to 1: how many fine filaments. */
  detail?: number
  className?: string
  style?: CSSProperties
}

type V3 = [number, number, number]

const hex = (h: string | undefined, fb: V3): V3 => {
  let c = (h ?? '').trim().replace('#', '')
  if (c.length === 3) c = c.replace(/./g, (x) => x + x)
  const n = parseInt(c.slice(0, 6), 16)
  if (c.length < 6 || Number.isNaN(n)) return fb
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
const isDark = ([r, g, b]: V3) => r * 0.299 + g * 0.587 + b * 0.114 < 0.5

const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uMouseOn;
uniform vec3 uBg; uniform vec3 uMid; uniform vec3 uDeep;
uniform float uIntensity; uniform float uDetail; uniform float uDark;
uniform vec3 uDrop;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6,1.2,-1.2,1.6);
  for (int i = 0; i < 6; i++){ v += a * noise(p); p = m * p; a *= 0.5; } return v; }
float ridged(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6,1.2,-1.2,1.6);
  for (int i = 0; i < 5; i++){ float n = 1.0 - abs(noise(p)*2.0-1.0); v += a*n*n; p = m*p; a *= 0.5; } return v; }
float bloom(vec2 p, vec2 c, float size, float t, out float shade, out float fil){
  vec2 q = (p - c) * 1.6 / size;
  vec2 w = vec2(fbm(q + vec2(0.0, t)), fbm(q + vec2(5.2, 1.3) - t));
  float n = fbm(q + 2.4 * w + vec2(t * 0.5, 0.0));
  float r = length((p - c) * vec2(0.9, 1.15) / size + 0.25 * (w - 0.5));
  float spread = 0.55 + 0.08 * sin(t * 2.0);
  shade = n;
  fil = pow(ridged(q * (1.8 + uDetail * 1.2) + 3.0 * w), 3.0) * smoothstep(spread + 0.1, spread - 0.2, r);
  return smoothstep(spread, spread - 0.3, r) * smoothstep(0.28, 0.55, n);
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * (0.025 + uIntensity * 0.07);
  vec2 m = (uMouse - 0.5 * uRes) / uRes.y;
  vec2 d = p - m; float md = dot(d, d);
  p += d * 0.18 * exp(-md * 9.0) * uMouseOn;
  float shade1, fil1, shade2, fil2;
  float ink = bloom(p, vec2(0.0), 1.0, t, shade1, fil1);
  vec2 dc = (uDrop.xy - 0.5 * uRes) / uRes.y;
  float grow = 1.0 - exp(-uDrop.z * 0.9);
  float fade = exp(-uDrop.z * 0.08);
  float ink2 = bloom(p, dc, 0.08 + 0.42 * grow, t + 3.7, shade2, fil2) * fade;
  float total = clamp(ink * 1.3 + fil1 * (0.35 + 0.5 * uDetail) + ink2 * 1.2 + fil2 * 0.4 * fade, 0.0, 0.95);
  float sh = mix(shade1, shade2, clamp(ink2 / max(ink + ink2, 0.001), 0.0, 1.0));
  vec3 inkCol = mix(uMid, uDeep, smoothstep(0.35, 0.8, sh));
  vec3 col = mix(uBg, inkCol, total);
  col *= 1.0 - mix(0.05, 0.25, uDark) * smoothstep(0.4, 1.0, length(uv - 0.5) * 1.35);
  col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.02;
  gl_FragColor = vec4(col, 1.0);
}`

type Look = { bg: V3; mid: V3; deep: V3; dark: number; intensity: number; detail: number }
type Frame = { time: number; mouse: [number, number]; on: number; drop: V3 }

function toLook(p: InkBloomProps): Look {
  const bg = hex(p.background, [0.965, 0.957, 0.941])
  return {
    bg,
    mid: hex(p.colors?.[0], [0.294, 0.337, 0.69]),
    deep: hex(p.colors?.[1], [0.086, 0.106, 0.302]),
    dark: isDark(bg) ? 1 : 0,
    intensity: p.intensity ?? 0.4,
    detail: p.detail ?? 0.6,
  }
}

function createRenderer(canvas: HTMLCanvasElement, keep = false) {
  const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: keep })
  if (!gl) return null
  const prog = gl.createProgram()
  const add = (type: number, src: string) => {
    const s = gl.createShader(type)
    if (!s) return
    gl.shaderSource(s, src)
    gl.compileShader(s)
    gl.attachShader(prog, s)
  }
  add(gl.VERTEX_SHADER, 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }')
  add(gl.FRAGMENT_SHADER, FRAG)
  gl.linkProgram(prog)
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const al = gl.getAttribLocation(prog, 'a')
  gl.enableVertexAttribArray(al)
  gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0)
  const U = (n: string) => gl.getUniformLocation(prog, n)
  const u = {
    res: U('uRes'), time: U('uTime'), mouse: U('uMouse'), on: U('uMouseOn'), bg: U('uBg'), mid: U('uMid'),
    deep: U('uDeep'), inten: U('uIntensity'), detail: U('uDetail'), dark: U('uDark'), drop: U('uDrop'),
  }
  return {
    draw(l: Look, f: Frame) {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(u.res, canvas.width, canvas.height)
      gl.uniform1f(u.time, f.time)
      gl.uniform2f(u.mouse, f.mouse[0], f.mouse[1])
      gl.uniform1f(u.on, f.on)
      gl.uniform3fv(u.bg, l.bg)
      gl.uniform3fv(u.mid, l.mid)
      gl.uniform3fv(u.deep, l.deep)
      gl.uniform1f(u.inten, l.intensity)
      gl.uniform1f(u.detail, l.detail)
      gl.uniform1f(u.dark, l.dark)
      gl.uniform3fv(u.drop, f.drop)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    /** Frees the program but keeps the context alive, so a remount (React StrictMode) can reuse the canvas. */
    dispose(lose = false) {
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
      if (lose) gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

/** A still frame for cards and thumbnails. */
export function renderInkBloomPoster(width: number, height: number, props: InkBloomProps = {}): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const look = toLook(props)
  const r = createRenderer(canvas, true)
  if (r) {
    r.draw(look, { time: 40, mouse: [0, 0], on: 0, drop: [-9999, -9999, 999] })
    const url = canvas.toDataURL('image/jpeg', 0.85)
    r.dispose(true)
    return url
  }
  // No WebGL: a soft painted bloom so the card still has a picture.
  const c2 = document.createElement('canvas')
  c2.width = width
  c2.height = height
  const ctx = c2.getContext('2d')
  if (!ctx) return ''
  const rgb = (v: V3, a = 1) => `rgba(${v.map((x) => Math.round(x * 255)).join(',')},${a})`
  ctx.fillStyle = rgb(look.bg)
  ctx.fillRect(0, 0, width, height)
  const blob = (x: number, y: number, rad: number, col: V3, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
    g.addColorStop(0, rgb(col, a))
    g.addColorStop(1, rgb(col, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
  }
  const s = height
  blob(width * 0.5, height * 0.5, s * 0.5, look.mid, 0.8)
  blob(width * 0.42, height * 0.45, s * 0.28, look.deep, 0.8)
  blob(width * 0.6, height * 0.58, s * 0.24, look.deep, 0.6)
  blob(width * 0.55, height * 0.36, s * 0.2, look.mid, 0.6)
  return c2.toDataURL('image/jpeg', 0.85)
}

export function InkBloomBackground(props: InkBloomProps) {
  const { background = '#f6f4f0', className, style } = props
  const ref = useRef<HTMLCanvasElement>(null)
  const target = useRef<Look>(toLook(props))
  target.current = toLook(props)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const r = createRenderer(canvas)
    if (!r) return
    const t0 = target.current
    const cur: Look = { ...t0, bg: [...t0.bg], mid: [...t0.mid], deep: [...t0.deep] }
    const m = { x: 0, y: 0, sx: 0, sy: 0, on: 0, t: 0 }
    const drop: V3 = [-9999, -9999, 999]
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const toC = (x: number, y: number): [number, number] => {
      const b = canvas.getBoundingClientRect()
      return [((x - b.left) / b.width) * canvas.width, (1 - (y - b.top) / b.height) * canvas.height]
    }
    const inside = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect()
      return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom
    }
    const resize = () => {
      const d = Math.min(devicePixelRatio || 1, 2) * 0.6
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * d))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * d))
    }
    const onMove = (e: PointerEvent) => {
      if (!inside(e)) return void (m.t = 0)
      ;[m.x, m.y] = toC(e.clientX, e.clientY)
      if (m.on < 0.01) [m.sx, m.sy] = [m.x, m.y]
      m.t = 1
    }
    const onLeave = () => (m.t = 0)
    const onDown = (e: PointerEvent) => {
      if (!inside(e) || (e.target instanceof Element && e.target.closest('button,a,input,select,textarea,label'))) return
      ;[drop[0], drop[1]] = toC(e.clientX, e.clientY)
      drop[2] = 0
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    addEventListener('pointermove', onMove)
    addEventListener('pointerdown', onDown)
    document.addEventListener('pointerleave', onLeave)

    let raf = 0
    let last = performance.now()
    let time = 0
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const now = performance.now()
      if (document.hidden) return void (last = now)
      const dt = (Math.min(50, now - last) / 1000) * (reduce ? 0.25 : 1)
      last = now
      time += dt
      drop[2] += dt
      const k = 1 - Math.pow(0.002, dt)
      const T = target.current
      const ease = (a: V3, b: V3) => a.forEach((v, i) => (a[i] = v + (b[i] - v) * k))
      ease(cur.bg, T.bg)
      ease(cur.mid, T.mid)
      ease(cur.deep, T.deep)
      cur.dark += (T.dark - cur.dark) * k
      cur.intensity += (T.intensity - cur.intensity) * k
      cur.detail += (T.detail - cur.detail) * k
      m.sx += (m.x - m.sx) * Math.min(1, dt * 6)
      m.sy += (m.y - m.sy) * Math.min(1, dt * 6)
      m.on += (m.t - m.on) * Math.min(1, dt * 3)
      r.draw(cur, { time, mouse: [m.sx, m.sy], on: m.on, drop })
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerleave', onLeave)
      r.dispose()
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', background, ...style }}
    />
  )
}
