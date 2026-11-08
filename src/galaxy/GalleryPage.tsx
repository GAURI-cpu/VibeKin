import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { NameConstellationBackground } from '../backgrounds/NameConstellationBackground'
import { WaveRibbonsBackground } from '../backgrounds/WaveRibbonsBackground'
import { makePoster, type PosterKey } from '../lib/posters'
import { GALAXY_ITEMS, GALAXY_LINKS } from '../lib/galaxy'
import { followLink } from '../router'
import { GALAXY_COMPONENTS } from './backgrounds'
import { SCENE_DEFAULTS, isSceneName, renderPoster } from './scenes'
import './galaxy.css'

/** The boxes that open their own pages: a still for each, and what plays on hover. */
const LINK_PREVIEWS: Record<string, { poster: PosterKey; sky: string; Live: () => JSX.Element }> = {
  'name-constellation': {
    poster: 'NameConstellation',
    sky: '#050816',
    Live: () => <NameConstellationBackground name="vibekin" className="galaxy-box-live" />,
  },
  'wave-ribbons': {
    poster: 'WaveRibbons',
    sky: '#03050a',
    Live: () => <WaveRibbonsBackground className="galaxy-box-live" />,
  },
}

/** Live previews only where there is a real hover, and never with reduced motion. */
function canPreviewLive() {
  return (
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function GalleryPage() {
  const [posters, setPosters] = useState<Record<string, string>>({})
  // At most one background runs on this page at a time.
  const [liveId, setLiveId] = useState<string | null>(null)
  const [canHover] = useState(canPreviewLive)

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const item of GALAXY_ITEMS) {
      if (isSceneName(item.component)) next[item.id] = renderPoster(item.component, SCENE_DEFAULTS[item.component])
    }
    setPosters(next)
    // Some stills wait for a font, so they arrive a moment later.
    let cancelled = false
    for (const link of GALAXY_LINKS) {
      const preview = LINK_PREVIEWS[link.id]
      if (!preview) continue
      void makePoster(preview.poster, 640, 400).then((url) => {
        if (!cancelled) setPosters((current) => ({ ...current, [link.id]: url }))
      })
    }
    return () => {
      cancelled = true
    }
  }, [])

  const start = (id: string) => canHover && setLiveId(id)
  const stop = (id: string) => setLiveId((current) => (current === id ? null : current))

  return (
    <main className="galaxy-gallery">
      <a className="galaxy-back-link" href="/#library" onClick={followLink}>
        ← All vibes
      </a>
      <header className="galaxy-gallery-header">
        <h1>Galaxy</h1>
        <p>Space-inspired backgrounds. Pick one to open it.</p>
      </header>

      <ul className="galaxy-grid">
        {GALAXY_ITEMS.map((item) => {
          const Live = isSceneName(item.component) ? GALAXY_COMPONENTS[item.component] : null
          return (
            <li key={item.id}>
              <a
                className="galaxy-box"
                href={`/galaxy/${item.id}`}
                onClick={followLink}
                onPointerEnter={() => start(item.id)}
                onPointerLeave={() => stop(item.id)}
                onFocus={() => start(item.id)}
                onBlur={() => stop(item.id)}
              >
                <span className="galaxy-box-preview">
                  {posters[item.id] && <img src={posters[item.id]} alt="" draggable={false} />}
                  {Live && liveId === item.id && <Live className="galaxy-box-live" />}
                </span>
                <span className="galaxy-box-name">{item.name}</span>
                <span className="galaxy-box-tag">{item.tag}</span>
              </a>
            </li>
          )
        })}
        {GALAXY_LINKS.map((link) => {
          const preview = LINK_PREVIEWS[link.id]
          return (
          <li key={link.id}>
            <a
              className="galaxy-box"
              href={link.href}
              onClick={followLink}
              onPointerEnter={() => start(link.id)}
              onPointerLeave={() => stop(link.id)}
              onFocus={() => start(link.id)}
              onBlur={() => stop(link.id)}
            >
              <span className="galaxy-box-preview" style={preview ? { background: preview.sky } : undefined}>
                {posters[link.id] && <img src={posters[link.id]} alt="" draggable={false} />}
                {preview && liveId === link.id && <preview.Live />}
              </span>
              <span className="galaxy-box-name">{link.name}</span>
              <span className="galaxy-box-tag">{link.tag}</span>
            </a>
          </li>
          )
        })}
      </ul>
    </main>
  )
}
