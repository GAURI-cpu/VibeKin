import { useEffect, useRef, useState, type CSSProperties } from 'react'

/**
 * Starfall: a deep galaxy nebula (WebGL, behind) with glowing rain falling toward the viewer (Canvas 2D, in front).
 * Self-contained: no imports from the rest of the codebase.
 */

export type StarfallProps = {
  background?: string
  /** [left glow, main body, right glow, accent] */
  colors?: string[]
  rainColor?: string
  /** 0 to 1: how fast the rain falls. */
  intensity?: number
  /** 0 to 1: how many drops. */
  detail?: number
  className?: string
  style?: CSSProperties
}

type RGB = [number, number, number]

/** Colours as 0..255 channels. */
type Look = { bg: RGB; colors: [RGB, RGB, RGB, RGB]; rain: RGB }

const DEFAULT_BG = '#02030c'
const DEFAULT_COLORS = ['#8b3dff', '#2b44ff', '#19c9f0', '#3ddfa8']
const DEFAULT_RAIN = '#bfe6ff'

function hexToRgb(hex: string | undefined, fallback: RGB): RGB {
  if (!hex) return fallback
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.replace(/./g, (c) => c + c)
  const n = parseInt(h.slice(0, 6), 16)
  if (h.length < 6 || Number.isNaN(n)) return fallback
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toLook(background: string, colors: string[], rain: string): Look {
  const base = DEFAULT_COLORS.map((c) => hexToRgb(c, [255, 255, 255]))
  const pick = (i: number) => hexToRgb(colors[i] ?? colors[i % Math.max(1, colors.length)], base[i])
  return {
    bg: hexToRgb(background, [2, 3, 12]),
    colors: [pick(0), pick(1), pick(2), pick(3)],
    rain: hexToRgb(rain, [191, 230, 255]),
  }
}

const copyLook = (l: Look): Look => ({
  bg: [...l.bg],
  colors: [[...l.colors[0]], [...l.colors[1]], [...l.colors[2]], [...l.colors[3]]],
  rain: [...l.rain],
})

const rgba = (c: RGB, a: number) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.max(0, Math.min(1, a))})`

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

const dropCount = (detail: number) => Math.round(60 + clamp01(detail) * 520)
const fallSpeed = (intensity: number) => 0.35 + clamp01(intensity) * 1.6

/* ---------- the nebula: WebGL ---------- */

const VERTEX = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }'

/** Copied exactly from the starfall.html reference, constants and all. */
const FRAGMENT = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec3 uBg; uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 hash2(vec2 p){ float n = hash(p); return vec2(n, hash(p + n + 17.17)); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6,1.2,-1.2,1.6); for (int i = 0; i < 6; i++){ v += a * noise(p); p = m * p; a *= 0.5; } return v; }
float ridged(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6,1.2,-1.2,1.6); for (int i = 0; i < 5; i++){ float n = 1.0 - abs(noise(p)*2.0-1.0); v += a*n*n; p = m*p; a *= 0.5; } return v; }
vec3 stars(vec2 p){
  vec3 col = vec3(0.0);
  for (int l = 0; l < 4; l++){
    float fl = float(l); float sc = 30.0 + fl * 28.0;
    vec2 g = p * sc; vec2 id = floor(g); vec2 f = fract(g) - 0.5; vec2 o = hash2(id + fl * 31.7) - 0.5;
    float h = hash(id + fl * 7.1); float present = step(0.55 - fl * 0.08, h);
    float b = pow(hash(id + 3.3 + fl), 6.0) * (1.5 - fl * 0.25);
    float d = length(f - o * 0.8);
    float tw = 0.75 + 0.25 * sin(uTime * (1.5 + h * 4.0) + h * 50.0);
    col += mix(vec3(0.8, 0.88, 1.0), vec3(1.0), h) * (exp(-d*d*1100.0) + exp(-d*30.0) * 0.08) * b * present * tw * 2.4;
  }
  return col;
}
vec3 glowSpot(vec2 p, vec2 c, float r, vec3 col){ float d = length(p - c); return col * (exp(-d * d / (r * r)) * 0.9 + exp(-d * d / (r * r * 0.05)) * 1.2); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.012;
  vec2 q = p * 1.35 + vec2(t, -t * 0.4);
  vec2 w = vec2(fbm(q + vec2(0.0, 1.7)), fbm(q + vec2(5.2, 1.3)));
  vec2 w2 = vec2(fbm(q + 3.0 * w + vec2(1.7, 9.2) + t), fbm(q + 3.0 * w + vec2(8.3, 2.8) - t));
  float n = fbm(q + 2.6 * w2);
  float wisps = pow(ridged(q * 1.6 + 2.0 * w), 2.4);
  // colour by region: violet on the left, deep blue body, cyan on the right
  float side = smoothstep(-0.9, 0.9, p.x + (w.x - 0.5) * 0.6);
  vec3 body = mix(uC0, uC1, smoothstep(0.05, 0.38, side));
  body = mix(body, uC2, smoothstep(0.62, 1.0, side));
  float band = exp(-pow((p.y - 0.02 + 0.15 * sin(p.x * 1.3)) * 1.5, 2.0));            // the main cloud band
  float dens = smoothstep(0.28, 0.8, n) * (0.45 + 1.0 * band);
  vec3 col = uBg + body * dens * 1.55 + body * wisps * 0.7 * (0.4 + band);
  col += mix(body, vec3(1.0), 0.35) * pow(dens, 2.5) * 0.9;
  // dark dust lanes
  float dust = smoothstep(0.5, 0.75, fbm(q * 2.4 + 9.0 + w2));
  col *= 1.0 - dust * 0.45;
  // glowing hotspots like in the reference
  col += glowSpot(p, vec2(0.55, 0.28), 0.09, uC2) * 0.9;
  col += glowSpot(p, vec2(-0.72, 0.12), 0.12, uC0) * 0.55;
  col += glowSpot(p, vec2(0.02, -0.45), 0.07, uC3) * 0.7;
  col += glowSpot(p, vec2(-0.25, 0.05), 0.05, mix(uC1, vec3(1.0), 0.5)) * 0.35;
  col += stars(p + 2.0) * (1.0 - dust * 0.5);
  col *= 1.0 - 0.35 * smoothstep(0.45, 1.05, length(uv - 0.5) * 1.4);
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.02;
  col = col / (1.0 + col * 0.25);
  gl_FragColor = vec4(col, 1.0);
}`

type Nebula = {
  resize: (width: number, height: number) => void
  render: (time: number, look: Look) => void
  dispose: () => void
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const kind = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'
    console.error(`Starfall: ${kind} shader failed to compile:
${gl.getShaderInfoLog(shader) ?? '(no log)'}`)
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/**
 * 'unavailable' when the browser has no WebGL (the caller draws a CSS sky),
 * 'failed' when WebGL exists but the shader didn't build (the error is logged).
 */
function createNebula(canvas: HTMLCanvasElement, preserve = false): Nebula | 'unavailable' | 'failed' {
  let gl: WebGLRenderingContext | null = null
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: preserve })
  } catch {
    gl = null
  }
  if (!gl) return 'unavailable'
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  if (!vs || !fs || !program) return 'failed'
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(`Starfall: shader program failed to link:
${gl.getProgramInfoLog(program) ?? '(no log)'}`)
    gl.deleteProgram(program)
    return 'failed'
  }
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.useProgram(program)
  const aPos = gl.getAttribLocation(program, 'a')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const u = (name: string) => gl.getUniformLocation(program, name)
  const uRes = u('uRes')
  const uTime = u('uTime')
  const uBg = u('uBg')
  const uC = [u('uC0'), u('uC1'), u('uC2'), u('uC3')]
  const ctx = gl
  const set3 = (loc: WebGLUniformLocation | null, c: RGB) => ctx.uniform3f(loc, c[0] / 255, c[1] / 255, c[2] / 255)

  return {
    resize(width, height) {
      canvas.width = Math.max(1, Math.round(width))
      canvas.height = Math.max(1, Math.round(height))
      ctx.viewport(0, 0, canvas.width, canvas.height)
    },
    render(time, look) {
      if (ctx.isContextLost()) return
      ctx.useProgram(program)
      ctx.uniform2f(uRes, canvas.width, canvas.height)
      ctx.uniform1f(uTime, time)
      set3(uBg, look.bg)
      look.colors.forEach((c, i) => set3(uC[i], c))
      ctx.drawArrays(ctx.TRIANGLES, 0, 3)
    },
    dispose() {
      ctx.deleteBuffer(buffer)
      ctx.deleteProgram(program)
      // Frees the context now rather than at garbage collection; hover previews make many.
      // Safe because every mount draws on a brand-new canvas: a canvas whose context was lost
      // hands back that same dead context forever, which is what broke the nebula before.
      ctx.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

/* ---------- the rain: Canvas 2D, 3D perspective ---------- */

// The viewer stands below looking up: drops start far away near a point high in the sky,
// then grow and spread outward as they fall toward and past the viewer.

type Drop = { x: number; y: number; z: number; v: number; size: number; spark: boolean }

/** fresh: the first fill, spread along the whole fall. Otherwise a new drop starts far away. */
const spawn = (fresh: boolean): Drop => ({
  x: (Math.random() - 0.5) * 3.2,
  y: 0.25 + Math.random() * 2.4,
  z: fresh ? 0.2 + Math.random() * 3.8 : 4 + Math.random() * 0.5,
  v: 0.6 + Math.random() * 0.8,
  size: 0.6 + Math.random() * 1.0,
  spark: Math.random() < 0.12,
})

type Rain = {
  resize: (width: number, height: number, ratio: number) => void
  setCount: (count: number) => void
  /** Moves every drop on by dt seconds, then draws. dt 0 just redraws. */
  frame: (dt: number, speed: number, look: Look) => void
}

function createRain(canvas: HTMLCanvasElement, count: number): Rain {
  const ctx = canvas.getContext('2d')!
  let W = 1
  let H = 1
  let ratio = 1
  const drops: Drop[] = Array.from({ length: count }, () => spawn(true))

  return {
    resize(width, height, nextRatio) {
      W = Math.max(1, width)
      H = Math.max(1, height)
      ratio = nextRatio
      canvas.width = Math.round(W * ratio)
      canvas.height = Math.round(H * ratio)
    },
    setCount(next) {
      // Keeps the drops already falling; only adds or removes the difference.
      while (drops.length < next) drops.push(spawn(true))
      if (drops.length > next) drops.length = next
    },
    frame(dt, speed, look) {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'
      const f = Math.min(W, H) * 0.42
      // Where the rain comes from: a point high above the top of the screen.
      const vx = W * 0.5
      const vy = -H * 0.25
      const rain = look.rain
      const glow = look.colors[2]

      for (let i = 0; i < drops.length; i++) {
        const d = drops[i]
        d.z -= d.v * speed * dt
        if (d.z < 0.12) {
          drops[i] = spawn(false)
          continue
        }
        const x1 = vx + (d.x / d.z) * f
        const y1 = vy + (d.y / d.z) * f
        // The tail sits where the drop was a moment ago, by velocity, so streaks match at any frame rate.
        const tz = d.z + d.v * speed * 0.09
        const x0 = vx + (d.x / tz) * f
        const y0 = vy + (d.y / tz) * f
        if (x1 < -50 || x1 > W + 50 || y1 > H + 50) {
          drops[i] = spawn(false)
          continue
        }
        const near = Math.min(1, 0.6 / d.z) // 0 far .. 1 close
        const alpha = Math.min(1, (1 - d.z / 4.5) * 1.2) * (0.35 + 0.65 * near)
        const width = d.size * (0.35 + near * 1.6)

        const line = ctx.createLinearGradient(x0, y0, x1, y1)
        line.addColorStop(0, rgba(rain, 0))
        line.addColorStop(1, rgba(rain, alpha * 0.85))
        ctx.strokeStyle = line
        ctx.lineWidth = width
        ctx.beginPath()
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()

        // The glowing head: white core, then the right glow colour.
        const hr = width * (d.spark ? 4.5 : 2.4)
        const head = ctx.createRadialGradient(x1, y1, 0, x1, y1, hr)
        head.addColorStop(0, `rgba(255,255,255,${Math.max(0, alpha * (d.spark ? 0.95 : 0.7))})`)
        head.addColorStop(0.35, rgba(glow, alpha * 0.35))
        head.addColorStop(1, rgba(glow, 0))
        ctx.fillStyle = head
        ctx.beginPath()
        ctx.arc(x1, y1, hr, 0, 7)
        ctx.fill()
      }

      // A faint glow where the rain comes from.
      const source = ctx.createRadialGradient(vx, vy, 0, vx, vy, Math.min(W, H) * 0.35)
      source.addColorStop(0, rgba(glow, 0.1))
      source.addColorStop(1, rgba(glow, 0))
      ctx.fillStyle = source
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'source-over'
    },
  }
}

/** The sky drawn in CSS when WebGL is missing. */
function cssSky(look: Look): CSSProperties {
  const [c0, c1, c2, c3] = look.colors
  return {
    background: [
      `radial-gradient(42% 38% at 82% 22%, ${rgba(c2, 0.55)}, transparent 70%)`,
      `radial-gradient(40% 48% at 12% 48%, ${rgba(c0, 0.5)}, transparent 72%)`,
      `radial-gradient(34% 30% at 50% 88%, ${rgba(c3, 0.32)}, transparent 70%)`,
      `radial-gradient(70% 40% at 50% 48%, ${rgba(c1, 0.42)}, transparent 75%)`,
      `radial-gradient(120% 90% at 50% 50%, transparent 55%, ${rgba(look.bg, 0.9)} 100%)`,
      rgba(look.bg, 1),
    ].join(', '),
  }
}

/* ---------- the component ---------- */

const NEBULA_SCALE = 0.6
const MAX_RATIO = 1.5

export function StarfallBackground({
  background = DEFAULT_BG,
  colors = DEFAULT_COLORS,
  rainColor = DEFAULT_RAIN,
  intensity = 0.45,
  detail = 0.55,
  className,
  style,
}: StarfallProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const rainRef = useRef<HTMLCanvasElement>(null)
  const [noGL, setNoGL] = useState(false)

  const colorKey = colors.join(',')
  const target = useRef(toLook(background, colors, rainColor))
  const speed = useRef(fallSpeed(intensity))
  const count = useRef(dropCount(detail))
  const setCountRef = useRef<((n: number) => void) | null>(null)

  useEffect(() => {
    target.current = toLook(background, colorKey.split(','), rainColor)
  }, [background, colorKey, rainColor])

  useEffect(() => {
    speed.current = fallSpeed(intensity)
  }, [intensity])

  useEffect(() => {
    count.current = dropCount(detail)
    setCountRef.current?.(count.current)
  }, [detail])

  useEffect(() => {
    const wrap = wrapRef.current
    const rainCanvas = rainRef.current
    if (!wrap || !rainCanvas) return

    // A new canvas for every mount (StrictMode mounts twice in development), placed behind the rain.
    const nebulaCanvas = document.createElement('canvas')
    nebulaCanvas.setAttribute('aria-hidden', 'true')
    Object.assign(nebulaCanvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' })
    wrap.insertBefore(nebulaCanvas, rainCanvas)

    let nebula: Nebula | null = null
    const buildNebula = () => {
      const made = createNebula(nebulaCanvas)
      if (made === 'unavailable') console.warn('Starfall: WebGL unavailable, using fallback')
      nebula = typeof made === 'string' ? null : made
      setNoGL(made === 'unavailable')
    }
    buildNebula()
    const rain = createRain(rainCanvas, count.current)
    setCountRef.current = rain.setCount

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const motion = reduced ? 0.25 : 1
    const current = copyLook(target.current)
    let time = 0
    let last = performance.now()
    let raf = 0
    let onScreen = true

    const ease = (from: RGB, to: RGB, k: number) => {
      for (let i = 0; i < 3; i++) from[i] += (to[i] - from[i]) * k
    }

    const draw = (dt: number) => {
      nebula?.render(time, current)
      rain.frame(dt, speed.current * motion, current)
    }

    const frame = () => {
      raf = 0
      const now = performance.now()
      // Clamped, so coming back to the tab doesn't jump.
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // Colours melt toward the new palette at the same rate on any frame rate.
      const k = 1 - Math.pow(0.002, dt)
      const to = target.current
      ease(current.bg, to.bg, k)
      ease(current.rain, to.rain, k)
      current.colors.forEach((c, i) => ease(c, to.colors[i], k))
      time += dt * motion
      draw(dt)
      schedule()
    }

    const schedule = () => {
      if (!raf && onScreen && !document.hidden) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }

    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect()
      // The clouds are soft anyway, so they render at 0.6x.
      const sharp = Math.min(window.devicePixelRatio || 1, 2) * NEBULA_SCALE
      nebula?.resize(width * sharp, height * sharp)
      rain.resize(width, height, Math.min(window.devicePixelRatio || 1, MAX_RATIO))
      draw(0)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(wrap)
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      schedule()
    })
    intersection.observe(wrap)
    const onVisibility = () => schedule()
    document.addEventListener('visibilitychange', onVisibility)
    // If the GPU drops the context, wait for it to come back and rebuild, rather than giving up.
    const onLost = (event: Event) => {
      event.preventDefault()
      nebula = null
    }
    const onRestored = () => {
      buildNebula()
      resize()
    }
    nebulaCanvas.addEventListener('webglcontextlost', onLost)
    nebulaCanvas.addEventListener('webglcontextrestored', onRestored)

    resize()
    schedule()

    return () => {
      if (raf) cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      nebulaCanvas.removeEventListener('webglcontextlost', onLost)
      nebulaCanvas.removeEventListener('webglcontextrestored', onRestored)
      nebula?.dispose()
      nebulaCanvas.remove()
      setCountRef.current = null
    }
  }, [])

  const look = toLook(background, colors, rainColor)
  const layer: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background, ...style }}
    >
      {/* Only when the browser has no WebGL at all. The nebula canvas is added behind the rain on mount. */}
      {noGL && <div aria-hidden="true" style={{ ...layer, ...cssSky(look) }} />}
      <canvas ref={rainRef} aria-hidden="true" style={layer} />
    </div>
  )
}

/** A still frame for cards and thumbnails. */
export function renderStarfallPoster(
  width: number,
  height: number,
  options: { background?: string; colors?: string[]; rainColor?: string; detail?: number } = {},
) {
  const look = toLook(options.background ?? DEFAULT_BG, options.colors ?? DEFAULT_COLORS, options.rainColor ?? DEFAULT_RAIN)
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')!
  ctx.fillStyle = rgba(look.bg, 1)
  ctx.fillRect(0, 0, width, height)

  const sky = document.createElement('canvas')
  const nebula = createNebula(sky, true)
  if (typeof nebula !== 'string') {
    nebula.resize(width, height)
    nebula.render(24, look)
    ctx.drawImage(sky, 0, 0, width, height)
    nebula.dispose()
  }

  const rainCanvas = document.createElement('canvas')
  const rain = createRain(rainCanvas, dropCount(options.detail ?? 0.55))
  rain.resize(width, height, 1)
  rain.frame(0, fallSpeed(0.45), look)
  ctx.drawImage(rainCanvas, 0, 0)
  return out.toDataURL('image/jpeg', 0.88)
}
