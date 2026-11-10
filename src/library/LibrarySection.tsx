import { Suspense, useEffect, useState, type JSX } from 'react'
import { SilkFlowBackground } from '../backgrounds/SilkFlowBackground'
import { Aurora } from '../galaxy/backgrounds'
import { makePoster } from '../lib/posters'
import { findAsset } from '../lib/registry'
import { defaultSettings } from '../lib/studioSettings'
import { THEME_GROUPS, type ThemeGroup } from '../nav/themes'
import { followLink } from '../router'
import './library.css'

/** Live covers chosen by hand; every other group plays its first background. */
const COVERS: Record<string, () => JSX.Element> = {
  Galaxy: () => <Aurora />,
  'Aesthetic & Simple': () => <SilkFlowBackground palette="opal" decorations={false} intensity={0.4} />,
}

/** A group's first background, live, in its default settings. */
function FirstBackground({ href }: { href: string }) {
  const asset = findAsset(href.split('/').pop() ?? '')
  if (!asset) return null
  const { Preview } = asset
  return (
    <Suspense fallback={null}>
      <Preview settings={defaultSettings(asset)} />
    </Suspense>
  )
}

/** The live cover for a group, or null when it has no backgrounds yet (it keeps the letter). */
function liveCover(group: ThemeGroup) {
  const Cover = COVERS[group.label]
  if (Cover) return <Cover />
  const first = group.templates[0]
  return first ? <FirstBackground href={first.href} /> : null
}

/** The home page's scroll-down section: one box per background type, on plain paper (no blobs). */
export function LibrarySection() {
  const [posters, setPosters] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    for (const group of THEME_GROUPS) {
      if (!group.card) continue
      const label = group.label
      void makePoster(group.card.poster, 640, 400).then((url) => {
        if (!cancelled) setPosters((current) => ({ ...current, [label]: url }))
      })
    }
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section id="library" className="library" aria-labelledby="library-title">
      <header className="library-header">
        <h2 id="library-title">Library</h2>
        <p>Every type of background in one place. Pick one to see what's inside.</p>
      </header>

      <ul className="library-grid">
        {THEME_GROUPS.map((group) => {
          const href = group.card?.href
          const count = group.card?.subtitle ?? (group.templates.length ? `${group.templates.length} backgrounds` : '')
          const body = (
            <>
              <span className="library-box-preview" aria-hidden="true">
                {posters[group.label] && <img src={posters[group.label]} alt="" draggable={false} />}
                {liveCover(group) ??
                  (!posters[group.label] && <span className="library-box-initial">{group.label.charAt(0)}</span>)}
              </span>
              <span className="library-box-name">{group.label}</span>
              <span className="library-box-count">{count || 'Coming soon'}</span>
            </>
          )
          return (
            <li key={group.label}>
              {href ? (
                <a className="library-box" href={href} onClick={followLink}>
                  {body}
                </a>
              ) : (
                <div className="library-box" data-soon="">
                  {body}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
