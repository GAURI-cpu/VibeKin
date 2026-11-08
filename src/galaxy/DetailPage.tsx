import { useEffect, useState } from 'react'
import { GALAXY_ITEMS, type GalaxyItem } from '../lib/galaxy'
import { followLink } from '../router'
import { GALAXY_COMPONENTS } from './backgrounds'
import { ColorRail, useGalaxyPalette } from './ColorRail'
import { SCENE_DEFAULTS, isLightColor, isSceneName, type GalaxyOptions } from './scenes'
import './galaxy.css'

type CopyState = 'idle' | 'copied' | 'blocked'

function usageSnippet(component: string, options: GalaxyOptions) {
  const colors = options.colors.map((color) => `'${color}'`).join(', ')
  return [
    `import { ${component} } from './galaxy/backgrounds'`,
    '',
    `<div style={{ position: 'fixed', inset: 0 }}>`,
    `  <${component}`,
    `    background="${options.background}"`,
    `    colors={[${colors}]}`,
    `    intensity={${options.intensity}}`,
    `    detail={${options.detail}}`,
    '  />',
    '</div>',
  ].join('\n')
}

export function DetailPage({ item }: { item: GalaxyItem }) {
  const [palette, choosePalette] = useGalaxyPalette(item.id)
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const index = GALAXY_ITEMS.indexOf(item)
  const next = GALAXY_ITEMS[(index + 1) % GALAXY_ITEMS.length]

  const sceneName = isSceneName(item.component) ? item.component : null
  const defaults = sceneName ? SCENE_DEFAULTS[sceneName] : null
  const options: GalaxyOptions | null = defaults && {
    ...defaults,
    ...(palette ? { background: palette.background, colors: palette.colors } : {}),
  }
  const Background = sceneName ? GALAXY_COMPONENTS[sceneName] : null
  // The text on top switches to dark ink on a light sky like Cream.
  const sky = options && isLightColor(options.background) ? 'light' : 'dark'

  useEffect(() => {
    if (copyState === 'idle') return
    const reset = window.setTimeout(() => setCopyState('idle'), 2000)
    return () => window.clearTimeout(reset)
  }, [copyState])

  const copy = async () => {
    if (!options) return
    try {
      await navigator.clipboard.writeText(usageSnippet(item.component, options))
      setCopyState('copied')
    } catch {
      setCopyState('blocked')
    }
  }

  return (
    <main className="galaxy-detail">
      <a className="galaxy-back-link galaxy-detail-back" href="/galaxy" onClick={followLink}>
        ← Back to Galaxy
      </a>

      {/* A medium box in the middle of the page, with its name and line on top so people get the idea. */}
      <div className="galaxy-detail-body">
        <div className="galaxy-detail-stage" data-sky={sky}>
          {Background && options && <Background {...options} />}
          <div className="galaxy-detail-copy">
            <h1>{item.name}</h1>
            <p>{item.description}</p>
          </div>
        </div>
        {defaults && <ColorRail value={palette?.id ?? null} original={defaults} onChange={choosePalette} />}
      </div>

      <div className="galaxy-detail-actions">
        <button type="button" className="press press-ink" onClick={copy}>
          {copyState === 'copied' ? 'Copied!' : copyState === 'blocked' ? 'Copy blocked' : 'Copy code'}
        </button>
        <a className="press press-paper galaxy-press-link" href={`/galaxy/${next.id}`} onClick={followLink}>
          Next background →
        </a>
      </div>
      <p className="galaxy-sr-only" aria-live="polite">
        {copyState === 'copied' ? 'Code copied' : copyState === 'blocked' ? 'Your browser blocked copying.' : ''}
      </p>
    </main>
  )
}

export function NotFoundPage() {
  return (
    <main className="galaxy-gallery galaxy-not-found">
      <header className="galaxy-gallery-header">
        <h1>Not found</h1>
        <p>There's no background at this address.</p>
      </header>
      <a className="galaxy-back-link" href="/galaxy" onClick={followLink}>
        ← Back to Galaxy
      </a>
    </main>
  )
}
