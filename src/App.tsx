import { useEffect, useState } from 'react'
import { ConstellationPage } from './constellation/ConstellationPage'
import { RibbonsPage } from './ribbons/RibbonsPage'
import { DetailPage, NotFoundPage } from './galaxy/DetailPage'
import { GalleryPage } from './galaxy/GalleryPage'
import { Hero } from './hero/Hero'
import { MOODS } from './hero/vibes'
import { GALAXY_ITEMS } from './lib/galaxy'
import { LibrarySection } from './library/LibrarySection'
import { LightToggle } from './nav/LightToggle'
import { Navbar } from './nav/Navbar'
import { ThemeMenu } from './nav/ThemeMenu'
import { scrollToHash, usePath } from './router'

const THEME_COLORS = { dim: '#241d1a', bright: '#fbf7f0' }

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

  const galaxyId = path.match(/^\/galaxy\/([^/]+)$/)?.[1]
  const galaxyItem = galaxyId ? GALAXY_ITEMS.find((item) => item.id === galaxyId) : undefined

  useEffect(() => {
    document.title = galaxyItem
      ? `${galaxyItem.name} · Galaxy · Vibekin`
      : path === '/galaxy'
        ? 'Galaxy · Vibekin'
        : path === '/constellation'
          ? 'Name Constellation · Vibekin'
          : path === '/ribbons'
            ? 'Wave Ribbons · Vibekin'
        : galaxyId
          ? 'Not found · Vibekin'
          : 'Vibekin'
  }, [path, galaxyId, galaxyItem])

  let page
  if (path === '/galaxy') page = <GalleryPage />
  else if (path === '/constellation') page = <ConstellationPage />
  else if (path === '/ribbons') page = <RibbonsPage />
  else if (galaxyItem) page = <DetailPage key={galaxyItem.id} item={galaxyItem} />
  else if (galaxyId) page = <NotFoundPage />
  else
    page = (
      <main>
        {/* The blobs live only in the hero; the library below is plain paper. */}
        <Hero moodId={moodId} onMoodChange={setMoodId} dim={dim} />
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
