/**
 * Builds the React usage snippet the Studio shows and copies.
 * Pure: no React imports and no DOM, so it can be tested or reused anywhere.
 */
import type { AssetMeta, PropValue, StudioSettings } from './registry'
import { TEXT_COLORS, resolvePalette, resolveTone, type StudioText } from './studioSettings'

const INDENT = '  '

/** A JSX attribute. Plain strings stay plain; anything JSX can't hold in quotes becomes {"..."}. */
export function formatProp(name: string, value: PropValue): string {
  if (typeof value === 'string') {
    return /^[^"\\\n\r{}]*$/.test(value) ? `${name}="${value}"` : `${name}={${JSON.stringify(value)}}`
  }
  if (typeof value === 'boolean') return value ? name : `${name}={false}`
  if (Array.isArray(value)) return `${name}={[${value.map((v) => JSON.stringify(v)).join(', ')}]}`
  return `${name}={${Number.isFinite(value) ? value : 0}}`
}

/** JSX text. Characters JSX treats as syntax, or edge spaces it would drop, go inside {"..."}. */
export function formatText(value: string): string {
  return /[{}<>&"'\\]|^\s|\s$/.test(value) ? `{${JSON.stringify(value)}}` : value
}

function element(name: string, props: [string, PropValue][], pad: string): string[] {
  const attrs = props.map(([key, value]) => formatProp(key, value))
  const oneLine = `${pad}<${name}${attrs.length ? ' ' + attrs.join(' ') : ''} />`
  if (oneLine.length <= 100) return [oneLine]
  return [`${pad}<${name}`, ...attrs.map((attr) => `${pad}${INDENT}${attr}`), `${pad}/>`]
}

export function generateReactSnippet(asset: AssetMeta, settings: StudioSettings, text: StudioText): string {
  const palette = resolvePalette(asset.palettes, settings)
  const props = Object.entries(asset.toProps(settings)).filter(([, value]) => value !== undefined)
  const pad = INDENT.repeat(4)
  const lines = [
    `import { ${asset.componentName} } from "${asset.importPath}";`,
    '',
    'export default function Hero() {',
    `${INDENT}return (`,
    `${INDENT.repeat(2)}<section style={{ position: "relative", minHeight: "100vh", overflow: "hidden", background: "${palette.bg}" }}>`,
    `${INDENT.repeat(3)}<div style={{ position: "absolute", inset: 0 }}>`,
    ...element(asset.componentName, props, pad),
    `${INDENT.repeat(3)}</div>`,
  ]

  const parts = [text.headline.trim(), text.subtitle.trim(), text.button.trim()]
  if (text.show && parts.some(Boolean)) {
    const color = TEXT_COLORS[resolveTone(text.tone, palette.bg)]
    const shadow = color === TEXT_COLORS.light ? '0 2px 22px rgba(0, 0, 0, 0.45)' : '0 1px 18px rgba(251, 247, 240, 0.8)'
    lines.push(
      `${INDENT.repeat(3)}<div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", textAlign: "center", color: "${color}", textShadow: "${shadow}" }}>`,
      `${pad}<div>`,
    )
    const [headline, subtitle, button] = parts
    const inner = pad + INDENT
    if (headline)
      lines.push(
        `${inner}<h1 style={{ margin: 0, fontFamily: "Fredoka, system-ui, sans-serif", fontSize: "clamp(2rem, 6vw, 4.5rem)", lineHeight: 1.05 }}>${formatText(headline)}</h1>`,
      )
    if (subtitle)
      lines.push(`${inner}<p style={{ margin: "16px 0 0", fontSize: "clamp(1rem, 2vw, 1.25rem)", opacity: 0.85 }}>${formatText(subtitle)}</p>`)
    if (button) {
      const ink = color === TEXT_COLORS.light ? TEXT_COLORS.dark : TEXT_COLORS.light
      lines.push(
        `${inner}<a href="#" style={{ display: "inline-block", marginTop: "28px", padding: "14px 28px", borderRadius: "999px", background: "${color}", color: "${ink}", fontWeight: 600, textDecoration: "none", textShadow: "none" }}>${formatText(button)}</a>`,
      )
    }
    lines.push(`${pad}</div>`, `${INDENT.repeat(3)}</div>`)
  } else {
    lines.push(`${INDENT.repeat(3)}<div style={{ position: "relative", zIndex: 1 }}>{/* Your content */}</div>`)
  }

  lines.push(`${INDENT.repeat(2)}</section>`, `${INDENT});`, '}', '')
  return lines.join('\n')
}

export function installCommand(asset: Pick<AssetMeta, 'dependencies'>): string {
  return asset.dependencies.length ? `npm i ${asset.dependencies.join(' ')}` : 'No dependencies'
}
