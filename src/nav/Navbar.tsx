import { useEffect, useRef, useState } from 'react'
import { MOODS } from '../hero/vibes'
import { followLink } from '../router'
import { NAV_CTA, NAV_ITEMS, isMenu, type NavMenu } from './navConfig'
import './navbar.css'

type NavbarProps = {
  moodId: string
  onMoodChange: (id: string) => void
}

/** Slides the bar away when scrolling down and brings it back when scrolling up. */
function useHideOnScroll(paused: boolean) {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (paused) {
      setHidden(false)
      return
    }
    let last = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (Math.abs(y - last) < 6) return
      setHidden(y > last && y > 80)
      last = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [paused])
  return hidden
}

function VibeList({ moodId, onChoose }: { moodId: string; onChoose: (id: string) => void }) {
  return (
    <ul className="nav-vibes">
      {MOODS.map((mood) => (
        <li key={mood.id}>
          <button
            type="button"
            className="nav-vibe"
            aria-pressed={mood.id === moodId}
            onClick={() => onChoose(mood.id)}
          >
            <span className="chip-swatches" aria-hidden="true">
              {mood.colors.slice(0, 3).map((color) => (
                <i key={color} style={{ background: color }} />
              ))}
            </span>
            {mood.label}
          </button>
        </li>
      ))}
    </ul>
  )
}

function MenuBody({ menu, moodId, onChoose, onNavigate }: {
  menu: NavMenu
  moodId: string
  onChoose: (id: string) => void
  onNavigate: () => void
}) {
  return (
    <>
      {menu.showVibes && (
        <div className="nav-menu-column">
          <p className="nav-menu-title">Try a vibe</p>
          <VibeList moodId={moodId} onChoose={onChoose} />
        </div>
      )}
      <div className="nav-menu-column">
        <p className="nav-menu-title">Browse</p>
        <ul className="nav-menu-links">
          {menu.links.map((link) => (
            <li key={link.href}>
              <a href={link.href} onClick={(event) => {
                onNavigate()
                followLink(event)
              }}>
                <strong>{link.label}</strong>
                {link.description && <span>{link.description}</span>}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

export function Navbar({ moodId, onMoodChange }: NavbarProps) {
  const navRef = useRef<HTMLElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const indicatorRef = useRef<HTMLLIElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)
  const openedByHover = useRef(false)
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const sheetToggleRef = useRef<HTMLButtonElement>(null)

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const hidden = useHideOnScroll(openMenu !== null || sheetOpen)

  // The soft pill that slides between links, with the same bounce as the blobs.
  const moveIndicator = (target: HTMLElement) => {
    const indicator = indicatorRef.current!
    const wasHidden = indicator.style.opacity !== '1'
    if (wasHidden) indicator.style.transition = 'none'
    indicator.style.width = `${target.offsetWidth}px`
    indicator.style.transform = `translateX(${target.offsetLeft}px)`
    if (wasHidden) {
      void indicator.offsetWidth
      indicator.style.transition = ''
    }
    indicator.style.opacity = '1'
  }

  const hideIndicator = () => {
    if (indicatorRef.current) indicatorRef.current.style.opacity = '0'
  }

  const closeEverything = () => {
    window.clearTimeout(closeTimer.current)
    setOpenMenu(null)
    setSheetOpen(false)
    hideIndicator()
  }

  const chooseVibe = (id: string) => {
    onMoodChange(id)
    closeEverything()
  }

  // Escape and clicking elsewhere close whatever is open.
  useEffect(() => {
    if (!openMenu && !sheetOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const focusTarget = openMenu ? triggerRefs.current.get(openMenu) : sheetToggleRef.current
      closeEverything()
      focusTarget?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) closeEverything()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [openMenu, sheetOpen])

  // The phone menu has no place on a wide screen, so close it when the window grows.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 861px)')
    const onChange = () => setSheetOpen(false)
    wide.addEventListener('change', onChange)
    return () => wide.removeEventListener('change', onChange)
  }, [])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  return (
    <header className="navbar" data-hidden={hidden || undefined}>
      <nav ref={navRef} className="navbar-inner" aria-label="Main">
        <a className="wordmark" href="/" onClick={followLink}>
          <img src="/vibekin-icon.svg" alt="" width="36" height="36" />
          Vibekin
        </a>

        <ul
          ref={listRef}
          className="nav-links"
          onPointerLeave={() => {
            if (!openMenu) hideIndicator()
          }}
          onBlur={(event) => {
            if (!listRef.current?.contains(event.relatedTarget as Node)) {
              setOpenMenu(null)
              hideIndicator()
            }
          }}
        >
          <li ref={indicatorRef} className="nav-indicator" role="presentation" aria-hidden="true" />
          {NAV_ITEMS.map((item) =>
            isMenu(item) ? (
              <li
                key={item.label}
                className="nav-has-menu"
                onPointerEnter={(event) => {
                  if (event.pointerType !== 'mouse') return
                  window.clearTimeout(closeTimer.current)
                  if (openMenu !== item.label) openedByHover.current = true
                  setOpenMenu(item.label)
                  moveIndicator(event.currentTarget)
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType !== 'mouse') return
                  closeTimer.current = window.setTimeout(() => {
                    setOpenMenu(null)
                    hideIndicator()
                  }, 160)
                }}
              >
                <button
                  ref={(node) => {
                    if (node) triggerRefs.current.set(item.label, node)
                    else triggerRefs.current.delete(item.label)
                  }}
                  type="button"
                  className="nav-link"
                  aria-expanded={openMenu === item.label}
                  onFocus={(event) => moveIndicator(event.currentTarget.parentElement!)}
                  onClick={() => {
                    // A hover already opened it, so this click keeps it open.
                    if (openedByHover.current) {
                      openedByHover.current = false
                      return
                    }
                    setOpenMenu(openMenu === item.label ? null : item.label)
                  }}
                >
                  {item.label}
                  <svg className="nav-caret" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2.5 4.5 6 8l3.5-3.5" />
                  </svg>
                </button>
                {openMenu === item.label && (
                  <div className="nav-menu">
                    <MenuBody menu={item} moodId={moodId} onChoose={chooseVibe} onNavigate={closeEverything} />
                  </div>
                )}
              </li>
            ) : (
              <li key={item.label}>
                <a
                  className="nav-link"
                  href={item.href}
                  onPointerEnter={(event) => {
                    setOpenMenu(null)
                    moveIndicator(event.currentTarget.parentElement!)
                  }}
                  onFocus={(event) => moveIndicator(event.currentTarget.parentElement!)}
                >
                  {item.label}
                </a>
              </li>
            ),
          )}
        </ul>

        <div className="nav-end">
          <a className="nav-cta" href={NAV_CTA.href} onClick={followLink}>
            {NAV_CTA.label}
          </a>
          <button
            ref={sheetToggleRef}
            type="button"
            className="nav-toggle"
            aria-expanded={sheetOpen}
            aria-controls="nav-sheet"
            aria-label={sheetOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setSheetOpen((open) => !open)}
          >
            <i />
            <i />
          </button>
        </div>

        {sheetOpen && (
          <div id="nav-sheet" className="nav-sheet">
            {NAV_ITEMS.map((item) =>
              isMenu(item) ? (
                <div key={item.label} className="nav-sheet-group">
                  <MenuBody menu={item} moodId={moodId} onChoose={chooseVibe} onNavigate={closeEverything} />
                </div>
              ) : (
                <a key={item.label} className="nav-sheet-link" href={item.href} onClick={(event) => {
                  closeEverything()
                  followLink(event)
                }}>
                  {item.label}
                </a>
              ),
            )}
            <a className="nav-cta nav-sheet-cta" href={NAV_CTA.href} onClick={(event) => {
              closeEverything()
              followLink(event)
            }}>
              {NAV_CTA.label}
            </a>
          </div>
        )}
      </nav>
    </header>
  )
}
