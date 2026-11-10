import { useEffect, useState } from 'react'
import { renderPoster, isSceneName } from '../../galaxy/scenes'
import { GALAXY_ITEMS } from '../../lib/galaxy'
import { makePoster } from '../../lib/posters'
import { REGISTRY, studioHref } from '../../lib/registry'
import { followLink } from '../../router'
import '../../galaxy/galaxy.css'

/** Stills for the cards: the galaxy scenes in their default palette, plus the two posters the site already makes. */
async function posterFor(id: string, componentName: string, bg: string, colors: string[], intensity: number, detail: number) {
  if (id === 'wave-ribbons') return makePoster('WaveRibbons', 640, 400)
  if (id === 'gradient-orbs') return makePoster('GradientOrbs', 640, 400)
  if (id === 'silk-flow') return makePoster('SilkFlow', 640, 400)
  if (id === 'ink-bloom') return makePoster('InkBloom', 640, 400)
  if (id === 'starfall') return makePoster('Starfall', 640, 400)
  if (id === 'name-constellation') return makePoster('NameConstellation', 640, 400)
  if (isSceneName(componentName)) return renderPoster(componentName, { background: bg, colors, intensity, detail })
  return null
}

/** /studio: pick a background to customise. */
export function StudioIndex() {
  const [posters, setPosters] = useState<Record<string, string>>({})
  // /studio?vibe=Aesthetic shows one group, like the Galaxy page does for its backgrounds.
  const vibe = new URLSearchParams(window.location.search).get('vibe')
  const assets = vibe
    ? REGISTRY.filter((asset) => asset.vibe === vibe && !GALAXY_ITEMS.some((item) => item.id === asset.id))
    : REGISTRY

  useEffect(() => {
    let cancelled = false
    for (const asset of REGISTRY) {
      const p = asset.palettes[0]
      void posterFor(asset.id, asset.componentName, p.bg, p.colors, asset.defaults.intensity, asset.defaults.detail).then(
        (url) => {
          if (url && !cancelled) setPosters((current) => ({ ...current, [asset.id]: url }))
        },
      )
    }
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="galaxy-gallery">
      <header className="galaxy-gallery-header">
        <h1>{vibe ? 'Aesthetic & Simple' : 'Studio'}</h1>
        <p>Pick a background, make it yours, and copy the code.</p>
      </header>
      <ul className="galaxy-grid">
        {assets.map((asset) => (
          <li key={asset.id}>
            <div className="galaxy-box">
              <a className="galaxy-box-link" href={studioHref(asset.id)} onClick={followLink}>
                <span className="galaxy-box-preview" style={{ background: asset.palettes[0].bg }}>
                  {posters[asset.id] && <img src={posters[asset.id]} alt="" draggable={false} />}
                </span>
                <span className="galaxy-box-name">{asset.name}</span>
                <span className="galaxy-box-tag">{asset.vibe}</span>
              </a>
              <a
                className="galaxy-box-studio"
                href={studioHref(asset.id)}
                onClick={followLink}
                aria-label={`Open ${asset.name} in Studio`}
              >
                Open in Studio
              </a>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
