import { useEffect, useRef, type CSSProperties } from 'react'
import { START_TIME, type GalaxyOptions, type Scene } from './scenes'

type GalaxyCanvasProps = GalaxyOptions & {
  scene: Scene
  className?: string
  style?: CSSProperties
}

/** Fills its parent with one animated scene. Pauses in background tabs; one still frame with reduced motion. */
export function GalaxyCanvas({ scene, background, colors, intensity, detail, className, style }: GalaxyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const colorKey = colors.join(',')

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const options: GalaxyOptions = { background, colors: colorKey.split(','), intensity, detail }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let draw = scene(1, 1, options)
    let started = performance.now()

    const frame = (ms: number) => draw(ctx, START_TIME + (ms - started) / 1000)

    const resize = () => {
      const box = canvas.getBoundingClientRect()
      const width = Math.max(1, Math.round(box.width))
      const height = Math.max(1, Math.round(box.height))
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      draw = scene(width, height, options)
      if (reducedMotion) {
        started = performance.now()
        frame(started)
      }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    let raf = 0
    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick)
      if (!document.hidden) frame(ms)
    }
    if (!reducedMotion) raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [scene, background, colorKey, intensity, detail])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', background, ...style }}
      aria-hidden="true"
    />
  )
}
