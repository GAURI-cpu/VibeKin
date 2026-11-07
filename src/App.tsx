import { useEffect, useState } from 'react'
import { Hero } from './hero/Hero'
import { MOODS } from './hero/vibes'
import { LightToggle } from './nav/LightToggle'
import { Navbar } from './nav/Navbar'
import { ThemeMenu } from './nav/ThemeMenu'

const THEME_COLORS = { dim: '#241d1a', bright: '#fbf7f0' }

export function App() {
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

  return (
    <>
      <ThemeMenu />
      <Navbar moodId={moodId} onMoodChange={setMoodId} />
      <LightToggle dim={dim} onToggle={() => setDim((value) => !value)} />
      <Hero moodId={moodId} onMoodChange={setMoodId} dim={dim} />
    </>
  )
}
