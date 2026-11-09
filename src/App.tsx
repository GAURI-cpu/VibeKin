import { useEffect, useLayoutEffect, useState } from 'react'
import { Studio } from './components/studio/Studio'
import { StudioIndex } from './components/studio/StudioIndex'
import { ConstellationPage } from './constellation/ConstellationPage'
import { GalleryPage } from './galaxy/GalleryPage'
import { NotFoundPage } from './galaxy/NotFoundPage'
import { StarfallPage } from './starfall/StarfallPage'
import { Hero } from './hero/Hero'
import { MOODS } from './hero/vibes'
import { findAsset, studioHref } from './lib/registry'
import { LibrarySection } from './library/LibrarySection'
import { VibekinMarquee } from './components/VibekinMarquee'
import { LightToggle } from './nav/LightToggle'
import { Navbar } from './nav/Navbar'
import { ThemeMenu } from './nav/ThemeMenu'
import { redirect, scrollToHash, usePath } from './router'

const THEME_COLORS = { dim: '#241d1a', bright: '#fbf7f0' }

/**
 * Old customise pages now live in the Studio, so there's one place to customise.
 * This is a Vite single-page app, so the redirects happen here rather than in a server config.
 */
function movedTo(path: string): string | null {
  const old = path.match(/^\/(?:galaxy|assets)\/([^/]+)$/)?.[1]
  if (old && findAsset(old)) return studioHref(old)
  if (path === '/ribbons') {
    // Old share links used ?palette=; the Studio reads ?pal=.
    const palette = new URLSearchParams(window.location.search).get('palette')
    return studioHref('wave-ribbons') + (palette ? `?pal=${encodeURIComponent(palette)}` : '')
  }
  return null
}

export function App() {
  const path = usePath()
  const [moodId, setMoodId] = useState(MOODS[0].id)
  // The inline script in index.html sets this before first paint, so dim visits don't flash cream.
  const [dim, setDim] = useState(() => document.documentElement.dataset.light === 'dim')

  useEffect(() => {
    const light = dim ? 'dim' : 'bright'
    document.documentElement.dataset.light = light
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[light])
    try {
      localStorage.setItem('vibekin-light', light)
    } catch {
      // Storage can be blocked. The toggle still works for this visit.
    }
  }, [dim])

  // A first visit to /#library lands on the section once it has rendered.
  useEffect(() => {
    if (window.location.hash) scrollToHash(window.location.hash, false)
  }, [])

  const moved = movedTo(path)
  useLayoutEffect(() => {
    if (moved) redirect(moved)
  }, [moved])

  const studioId = path.match(/^\/studio\/([^/]+)$/)?.[1]
  const asset = studioId ? findAsset(studioId) : undefined
  const unknown = Boolean(studioId && !asset) || /^\/(galaxy|assets)\/[^/]+$/.test(path)

  useEffect(() => {
    document.title = asset
      ? `${asset.name} · Vibekin Studio`
      : path === '/studio'
        ? 'Vibekin Studio'
        : path === '/galaxy'
        ? 'Galaxy · Vibekin'
        : path === '/constellation'
          ? 'Name Constellation · Vibekin'
          : path === '/starfall'
          ? 'Starfall · Vibekin'
          : unknown
            ? 'Not found · Vibekin'
            : 'Vibekin'
  }, [path, asset, unknown])

  let page
  if (moved) page = null
  else if (path === '/studio') page = <StudioIndex />
  else if (path === '/galaxy') page = <GalleryPage />
  else if (path === '/constellation') page = <ConstellationPage />
  else if (path === '/starfall') page = <StarfallPage />
  else if (asset) page = <Studio key={asset.id} asset={asset} />
  else if (unknown) page = <NotFoundPage />
  else
    page = (
      <main>
        {/* The blobs live only in the hero; the library below is plain paper. */}
        <Hero moodId={moodId} onMoodChange={setMoodId} dim={dim} />
        <VibekinMarquee />
        <LibrarySection />
      </main>
    )

  // The same navbar, themes drawer and light toggle on every page.
  return (
    <>
      <ThemeMenu />
      <Navbar moodId={moodId} onMoodChange={setMoodId} />
      <LightToggle dim={dim} onToggle={() => setDim((value) => !value)} />
      {page}
    </>
  )
}
