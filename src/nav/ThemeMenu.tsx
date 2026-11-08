import { useEffect, useRef, useState } from 'react'
import { makePoster } from '../lib/posters'
import { followLink } from '../router'
import { THEME_GROUPS } from './themes'
import './themeMenu.css'

export function ThemeMenu() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState('')
  // A still frame for the card thumbnail, painted once the drawer first opens.
  const [posters, setPosters] = useState<Record<string, string>>({})
  const painted = useRef(false)

  useEffect(() => {
    if (!isOpen || painted.current) return
    painted.current = true
    for (const group of THEME_GROUPS) {
      if (!group.card) continue
      const label = group.label
      void makePoster(group.card.poster, 240, 150).then((url) => setPosters((current) => ({ ...current, [label]: url })))
    }
  }, [isOpen])

  return (
    <>
      <button
        type="button"
        className="theme-button"
        aria-label="Open themes"
        title="Themes"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => {
          dialogRef.current?.showModal()
          setIsOpen(true)
        }}
      >
        <i />
        <i />
        <i />
      </button>

      {/* A native modal dialog handles focus trapping, Escape and returning focus. */}
      <dialog
        ref={dialogRef}
        className="theme-drawer"
        aria-labelledby="theme-drawer-title"
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          // Clicks on the dialog itself can only be on the area outside the panel.
          if (event.target === dialogRef.current) dialogRef.current.close()
        }}
      >
        <div className="theme-panel">
          <header className="theme-header">
            <h2 id="theme-drawer-title">Themes</h2>
            <button
              type="button"
              className="theme-close"
              aria-label="Close themes"
              onClick={() => dialogRef.current?.close()}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m3.5 3.5 9 9m0-9-9 9" />
              </svg>
            </button>
          </header>

          <ul className="theme-groups">
            {THEME_GROUPS.map((group) => {
              if (group.card) {
                const card = group.card
                return (
                  <li key={group.label} className="theme-group">
                    <a
                      className="theme-card"
                      href={card.href}
                      onClick={(event) => {
                        // Opens the type's own page; it never touches the current page's background.
                        dialogRef.current?.close()
                        followLink(event)
                      }}
                    >
                      <span className="theme-card-thumb" aria-hidden="true">
                        {posters[group.label] && <img src={posters[group.label]} alt="" draggable={false} />}
                      </span>
                      <span className="theme-card-text">
                        <span className="theme-card-title">{group.label}</span>
                        <span className="theme-card-subtitle">{card.subtitle}</span>
                      </span>
                      <svg className="theme-card-arrow" viewBox="0 0 12 12" aria-hidden="true">
                        <path d="M4.5 2.5 8 6l-3.5 3.5" />
                      </svg>
                    </a>
                  </li>
                )
              }
              const expanded = openGroup === group.label
              return (
                <li key={group.label} className="theme-group">
                  <button
                    type="button"
                    className="theme-group-button"
                    aria-expanded={expanded}
                    onClick={() => setOpenGroup(expanded ? '' : group.label)}
                  >
                    {group.label}
                    <svg className="nav-caret" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M2.5 4.5 6 8l3.5-3.5" />
                    </svg>
                  </button>
                  {/* inert keeps collapsed templates out of the Tab order. */}
                  <div className="theme-reveal" data-open={expanded || undefined} inert={!expanded}>
                    <div className="theme-reveal-body">
                      {group.templates.length === 0 ? (
                        <p className="theme-empty">Backgrounds coming soon</p>
                      ) : (
                        <ul className="theme-list">
                          {group.templates.map((template) => (
                            <li key={template.href}>
                              <a className="theme-item" href={template.href}>
                                {template.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </dialog>
    </>
  )
}
