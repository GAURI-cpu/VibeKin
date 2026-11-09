import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { NameConstellationBackground } from '../backgrounds/NameConstellationBackground'
import { StarfallBackground } from '../backgrounds/StarfallBackground'
import { WaveRibbonsBackground } from '../backgrounds/WaveRibbonsBackground'
import { makePoster, type PosterKey } from '../lib/posters'
import { GALAXY_ITEMS, GALAXY_LINKS } from '../lib/galaxy'
import { studioHref } from '../lib/registry'
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
  starfall: {
    poster: 'Starfall',
    sky: '#02030c',
    Live: () => <StarfallBackground className="galaxy-box-live" />,
  },
}

type CardProps = {
  id: string
  name: string
  tag: string
  href: string
  sky?: string
  poster?: string
  live: ReactNode
  onStart: (id: string) => void
  onStop: (id: string) => void
}

/** One background: the card opens its page, and a separate "Open in Studio" button sits under it (links can't nest). */
function Card({ id, name, tag, href, sky, poster, live, onStart, onStop }: CardProps) {
  return (
    <div
      className="galaxy-box"
      onPointerEnter={() => onStart(id)}
      onPointerLeave={() => onStop(id)}
      onFocus={() => onStart(id)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onStop(id)
      }}
    >
      <a className="galaxy-box-link" href={href} onClick={followLink}>
        <span className="galaxy-box-preview" style={sky ? { background: sky } : undefined}>
          {poster && <img src={poster} alt="" draggable={false} />}
          {live}
        </span>
        <span className="galaxy-box-name">{name}</span>
        <span className="galaxy-box-tag">{tag}</span>
      </a>
      <a className="galaxy-box-studio" href={studioHref(id)} onClick={followLink} aria-label={`Open ${name} in Studio`}>
        Open in Studio
      </a>
    </div>
  )
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
              <Card
                id={item.id}
                name={item.name}
                tag={item.tag}
                href={studioHref(item.id)}
                poster={posters[item.id]}
                live={Live && liveId === item.id ? <Live className="galaxy-box-live" /> : null}
                onStart={start}
                onStop={stop}
              />
            </li>
          )
        })}
        {GALAXY_LINKS.map((link) => {
          const preview = LINK_PREVIEWS[link.id]
          return (
            <li key={link.id}>
              <Card
                id={link.id}
                name={link.name}
                tag={link.tag}
                href={link.href}
                sky={preview?.sky}
                poster={posters[link.id]}
                live={preview && liveId === link.id ? <preview.Live /> : null}
                onStart={start}
                onStop={stop}
              />
            </li>
          )
        })}
      </ul>
    </main>
  )
}
