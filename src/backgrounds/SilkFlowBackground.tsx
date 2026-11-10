"use client";
import { useEffect, useRef, type CSSProperties } from "react";

export type SilkPaletteKey = "midnight" | "opal" | "matcha" | "clay" | "oil" | "cherry";
type Palette = { name: string; blobs: string[]; base: string; accent: string; line: [number, number, number]; la: number; hue: number };

export const SILK_PALETTES: Record<SilkPaletteKey, Palette> = {
  midnight: { name: "Midnight Silk",     blobs: ["#4b2fb0", "#c23a8f", "#1d7fa0", "#6a3fe0", "#8f2bd0", "#2a4f9f"], base: "#0a0c1c", accent: "#ff9ad5", line: [205, 215, 255], la: 0.75, hue: 0 },
  opal:     { name: "Opal",              blobs: ["#a9d4ff", "#ffc2e2", "#c6b8ff", "#b8f0ff", "#ffd6ec", "#d0e4ff"], base: "#eef0fb", accent: "#8f7be0", line: [255, 255, 255], la: 1,    hue: 6 },
  matcha:   { name: "Matcha Lilac",      blobs: ["#bcd68a", "#d2bff2", "#e6e2a6", "#b3a2ea", "#9fc77f", "#efd9f7"], base: "#eef0e0", accent: "#6f9a3a", line: [255, 255, 255], la: 1,    hue: 0 },
  clay:     { name: "Clay & Cobalt",     blobs: ["#e8977a", "#3d5ad8", "#f2c2a6", "#6c82ee", "#d6845f", "#f6d6c2"], base: "#f1e3d8", accent: "#3a50c8", line: [255, 255, 255], la: 1,    hue: 0 },
  oil:      { name: "Oil Slick",         blobs: ["#18a88c", "#7a2fd6", "#d23f8c", "#2a6fde", "#c9a23a", "#4a22a0"], base: "#05060b", accent: "#2fb89a", line: [235, 240, 255], la: 0.6,  hue: 5 },
  cherry:   { name: "Cherry Chartreuse", blobs: ["#ff5c8d", "#d6f05e", "#ff9cbb", "#c0e64f", "#ffcfdc", "#ecf8a6"], base: "#f8edf0", accent: "#e0306a", line: [255, 255, 255], la: 1,    hue: 0 },
};

export type SilkFlowProps = {
  palette?: SilkPaletteKey;
  /** override the 6 glow colours (hex) */
  colors?: string[];
  /** override base background colour (hex) */
  background?: string;
  /** 0..1 — animation speed + line strength (default 0.5) */
  intensity?: number;
  /** 0..1 — number of silk lines (default 0.5 ≈ 46 lines) */
  detail?: number;
  /** show dotted corners + accent squiggles (default true) */
  decorations?: boolean;
  className?: string;
  style?: CSSProperties;
};

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgba = (a: number[], al = 1) => `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${al})`;
const ease = (a: number[], b: number[], k: number) => { for (let i = 0; i < a.length; i++) a[i] += (b[i] - a[i]) * k; };
const BLOBS: [number, number, number, number][] = [[0.22, 0.18, 0.55, 0], [0.75, 0.32, 0.55, 1], [0.55, 0.85, 0.6, 2], [0.95, 0.85, 0.45, 3], [0.05, 0.85, 0.45, 4], [0.5, 0.45, 0.4, 5]];

export default function SilkFlowBackground(props: SilkFlowProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const c = ref.current!; const x = c.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = () => {
      const p = propsRef.current, pal = SILK_PALETTES[p.palette ?? "midnight"];
      const blobs = (p.colors?.length ? p.colors : pal.blobs);
      return { pal, blobs: Array.from({ length: 6 }, (_, i) => hex(blobs[i % blobs.length])), base: hex(p.background ?? pal.base), line: [...pal.line], la: pal.la };
    };
    const t0 = target();
    const cur = { blobs: t0.blobs.map((b) => [...b]), base: [...t0.base], line: [...t0.line], la: t0.la };
    let W = 0, H = 0, D = 1, raf = 0, t = 0, hue = 0, last = performance.now(), visible = true;

    const resize = () => { const r = c.getBoundingClientRect(); D = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height; c.width = Math.max(1, W * D); c.height = Math.max(1, H * D); };
    const ro = new ResizeObserver(resize); ro.observe(c); resize();
    const io = new IntersectionObserver((e) => (visible = e[0].isIntersecting)); io.observe(c);

    const dots = (ox: number, oy: number) => { x.fillStyle = rgba(cur.line, 0.4); for (let i = 0; i < 4; i++) for (let j = 0; j < 10; j++) { x.beginPath(); x.arc(ox + i * 12, oy + j * 12, 1.5, 0, 7); x.fill(); } };
    const squiggle = (sx: number, sy: number, col: string) => { x.strokeStyle = col; x.globalAlpha = 0.85; x.lineWidth = 2; x.lineCap = "round"; x.beginPath(); for (let i = 0; i <= 40; i++) { const px = sx + 46 * i / 40, py = sy + Math.sin(i / 40 * Math.PI * 4 + t * 0.45) * 3; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); x.globalAlpha = 1; };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      if (document.hidden || !visible) { last = now; return; }
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      const p = propsRef.current, tg = target();
      const intensity = p.intensity ?? 0.5, detail = p.detail ?? 0.5;
      const speed = 0.4 + intensity * 1.2;               // 0.5 → 1× (very soft)
      if (!reduce) t += dt * speed;

      // soft palette crossfade (~2.5s)
      const k = 1 - Math.pow(0.15, dt);
      cur.blobs.forEach((b, i) => ease(b, tg.blobs[i], k));
      ease(cur.base, tg.base, k); ease(cur.line, tg.line, k); cur.la += (tg.la - cur.la) * k;
      if (tg.pal.hue && !reduce) hue += dt * tg.pal.hue; else hue += (Math.round(hue / 360) * 360 - hue) * k;

      x.setTransform(D, 0, 0, D, 0, 0);
      x.fillStyle = rgba(cur.base); x.fillRect(0, 0, W, H);

      x.save();
      const hr = hue % 360;
      x.filter = `blur(${Math.round(Math.min(W, H) * 0.09)}px)` + (Math.abs(hr) > 0.5 ? ` hue-rotate(${hr.toFixed(1)}deg)` : "");
      for (const [bx, by, br, ci] of BLOBS) {
        const px = W * (bx + 0.05 * Math.sin(t * 0.06 + ci * 1.7)), py = H * (by + 0.06 * Math.cos(t * 0.05 + ci));
        const r = Math.max(W, H) * br * 0.55 * (1 + 0.06 * Math.sin(t * 0.09 + ci * 2.3));
        const g = x.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, rgba(cur.blobs[ci])); g.addColorStop(1, rgba(cur.blobs[ci], 0));
        x.fillStyle = g; x.fillRect(0, 0, W, H);
      }
      x.restore();

      const n = Math.round(24 + detail * 44);             // 24..68 lines
      const gap = 0.874 / n, strength = cur.la * (0.7 + intensity * 0.6) * (0.85 + 0.15 * Math.sin(t * 0.35));
      x.lineWidth = 0.8;
      for (let i = 0; i < n; i++) {
        x.strokeStyle = rgba(cur.line, Math.min(1, strength * (0.18 + 0.32 * Math.sin(i / n * Math.PI))));
        x.beginPath();
        for (let j = 0; j <= 100; j++) {
          const s = j / 100, px = s * W;
          const py = H * (0.08 + i * gap) + Math.sin(s * 5 + t * 0.16 + i * 0.12 * 46 / n) * H * 0.05 + Math.sin(s * 11 - t * 0.11) * H * 0.012;
          j ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.stroke();
      }
      if (p.decorations !== false) { dots(14, H * 0.12); dots(W - 60, H * 0.62); squiggle(W * 0.15, H * 0.42, tg.pal.accent); squiggle(W * 0.74, H * 0.82, tg.pal.accent); }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={props.className}
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none", ...props.style }} />;
}

/** Named export too, matching the other backgrounds and the Studio snippet. */
export { SilkFlowBackground };
