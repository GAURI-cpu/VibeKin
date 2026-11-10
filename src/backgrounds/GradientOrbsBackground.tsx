"use client";
import { useEffect, useRef, type CSSProperties } from "react";

export type OrbsPaletteKey = "twilight" | "sunset" | "lagoon" | "midnight" | "cotton" | "ember";
type Palette = { name: string; a: string; b: string };

export const ORBS_PALETTES: Record<OrbsPaletteKey, Palette> = {
  twilight: { name: "Twilight",     a: "#3f5fd8", b: "#e0396e" },
  sunset:   { name: "Sunset",       a: "#ff8a3d", b: "#c2307f" },
  lagoon:   { name: "Lagoon",       a: "#16b5b0", b: "#4b3bc9" },
  midnight: { name: "Midnight",     a: "#1b1e4b", b: "#7b2f8f" },
  cotton:   { name: "Cotton Candy", a: "#8fd3ff", b: "#f7a8d8" },
  ember:    { name: "Ember",        a: "#2f2a6b", b: "#ff6a5c" },
};

export type GradientOrbsProps = {
  palette?: OrbsPaletteKey;
  /** override the two gradient colours [from, to] (hex) */
  colors?: [string, string];
  /** 0..1 — float distance + speed (default 0.5, already very soft) */
  intensity?: number;
  /** 0..1 — how many small dots / rings (default 0.5) */
  detail?: number;
  /** spheres follow the mouse very slightly (default true) */
  parallax?: boolean;
  className?: string;
  style?: CSSProperties;
};

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb = (c: number[], al = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al})`;
const ease = (a: number[], b: number[], k: number) => { for (let i = 0; i < 3; i++) a[i] += (b[i] - a[i]) * k; };

// x, y (0..1), radius (× min side), depth (parallax)
const ORBS: [number, number, number, number][] = [
  [0.66, 0.3, 0.12, 0.6], [0.86, 0.35, 0.056, 0.3], [0.73, 0.66, 0.19, 1], [0.47, 0.75, 0.048, 0.25],
  [0.9, 0.82, 0.088, 0.5], [0.58, 0.12, 0.032, 0.2], [0.34, 0.9, 0.035, 0.2],
];
const RINGS: [number, number, number][] = [[0.5, 0.27, 7], [0.4, 0.66, 6], [0.53, 0.87, 5], [0.2, 0.95, 4], [0.95, 0.12, 5], [0.28, 0.08, 4], [0.62, 0.48, 3]];
const DOTS = Array.from({ length: 70 }, (_, i) => [Math.sin(i * 91.7) * 0.5 + 0.5, Math.sin(i * 37.3) * 0.5 + 0.5, 0.8 + (i % 3) * 0.6, i]);

export default function GradientOrbsBackground(props: GradientOrbsProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const c = ref.current!; const x = c.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targetCols = () => { const p = propsRef.current; const pal = ORBS_PALETTES[p.palette ?? "twilight"]; return (p.colors ?? [pal.a, pal.b]).map(hex); };
    const [ia, ib] = targetCols(); const A = [...ia], B = [...ib];
    let W = 0, H = 0, D = 1, raf = 0, t = 0, last = performance.now(), visible = true;
    const mouse = { x: 0, y: 0, sx: 0, sy: 0 };

    const resize = () => { const r = c.getBoundingClientRect(); D = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height; c.width = Math.max(1, W * D); c.height = Math.max(1, H * D); };
    const ro = new ResizeObserver(resize); ro.observe(c); resize();
    const io = new IntersectionObserver((e) => (visible = e[0].isIntersecting)); io.observe(c);
    const onMove = (e: PointerEvent) => { const r = c.getBoundingClientRect(); mouse.x = (e.clientX - r.left) / r.width - 0.5; mouse.y = (e.clientY - r.top) / r.height - 0.5; };
    addEventListener("pointermove", onMove);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      if (document.hidden || !visible) { last = now; return; }
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      const p = propsRef.current, inten = p.intensity ?? 0.5, detail = p.detail ?? 0.5;
      if (!reduce) t += dt * (0.5 + inten);

      const k = 1 - Math.pow(0.15, dt);                    // ~2.5s colour crossfade
      const [ta, tb] = targetCols(); ease(A, ta, k); ease(B, tb, k);
      const mk = 1 - Math.pow(0.08, dt);                   // very lazy mouse follow
      const par = p.parallax !== false && !reduce;
      mouse.sx += ((par ? mouse.x : 0) - mouse.sx) * mk; mouse.sy += ((par ? mouse.y : 0) - mouse.sy) * mk;

      x.setTransform(D, 0, 0, D, 0, 0);
      const ang = Math.sin(t * 0.05) * 0.15;               // gradient slowly leans
      const cx0 = W / 2, cy0 = H / 2, L = Math.hypot(W, H) / 2;
      const g = x.createLinearGradient(cx0 - Math.cos(0.6 + ang) * L, cy0 + Math.sin(0.6 + ang) * L, cx0 + Math.cos(0.6 + ang) * L, cy0 - Math.sin(0.6 + ang) * L);
      g.addColorStop(0, rgb(A)); g.addColorStop(1, rgb(B)); x.fillStyle = g; x.fillRect(0, 0, W, H);

      const m = Math.min(W, H), amp = m * (0.008 + inten * 0.016);
      ORBS.forEach(([ox, oy, or, depth], i) => {
        const cx = W * ox + Math.sin(t * 0.18 + i * 1.9) * amp - mouse.sx * 40 * depth;
        const cy = H * oy + Math.cos(t * 0.14 + i * 1.3) * amp * 1.4 - mouse.sy * 30 * depth;
        const r = m * or * (1 + 0.015 * Math.sin(t * 0.2 + i));
        x.save(); x.filter = `blur(${Math.max(2, r * 0.35)}px)`; x.fillStyle = "rgba(20,10,60,.26)";
        x.beginPath(); x.arc(cx + r * 0.25, cy + r * 0.35, r * 0.95, 0, 7); x.fill(); x.restore();
        const s = x.createLinearGradient(cx - r, cy - r, cx + r, cy + r); s.addColorStop(0, rgb(B)); s.addColorStop(1, rgb(A));
        x.fillStyle = s; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
        const h = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r * 1.1);
        h.addColorStop(0, "rgba(255,255,255,.22)"); h.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = h; x.fill();
        const e = x.createRadialGradient(cx, cy, r * 0.75, cx, cy, r); e.addColorStop(0, "rgba(0,0,0,0)"); e.addColorStop(1, "rgba(20,10,60,.18)"); x.fillStyle = e; x.fill();
      });

      const nR = Math.round(3 + detail * 8), nD = Math.round(10 + detail * 60);
      x.strokeStyle = "rgba(255,255,255,.85)"; x.lineWidth = 1.5;
      RINGS.slice(0, nR).forEach(([rx, ry, rr], i) => { x.beginPath(); x.arc(W * rx - mouse.sx * 12, H * ry + Math.sin(t * 0.3 + i * 2) * 5 - mouse.sy * 10, rr, 0, 7); x.stroke(); });
      DOTS.slice(0, nD).forEach(([dx, dy, dr, i]) => { x.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(t * 0.5 + i)})`; x.beginPath(); x.arc(W * dx, H * dy + Math.sin(t * 0.2 + i) * 3, dr, 0, 7); x.fill(); });
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); removeEventListener("pointermove", onMove); };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={props.className}
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none", ...props.style }} />;
}

/** Named export too, matching the other backgrounds and the Studio snippet. */
export { GradientOrbsBackground };
