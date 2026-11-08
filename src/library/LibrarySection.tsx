import { useEffect, useState } from 'react'
import { makePoster } from '../lib/posters'
import { THEME_GROUPS } from '../nav/themes'
import { followLink } from '../router'
import './library.css'

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
                {posters[group.label] ? (
                  <img src={posters[group.label]} alt="" draggable={false} />
                ) : (
                  <span className="library-box-initial">{group.label.charAt(0)}</span>
                )}
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
