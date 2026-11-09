import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { installCommand } from '../../lib/codegen'
import type { AssetMeta } from '../../lib/registry'

type Tab = 'react' | 'component' | 'install'

const TABS: { id: Tab; label: string }[] = [
  { id: 'react', label: 'React' },
  { id: 'component', label: 'Component' },
  { id: 'install', label: 'Install' },
]

type Props = {
  asset: AssetMeta
  snippet: string
  /** null while the source is still loading. */
  sources: { path: string; code: string }[] | null
}

export function CodePanel({ asset, snippet, sources }: Props) {
  const [tab, setTab] = useState<Tab>('react')
  const [fileIndex, setFileIndex] = useState(0)
  const [copied, setCopied] = useState<'idle' | 'copied' | 'blocked'>('idle')
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ react: null, component: null, install: null })

  useEffect(() => {
    if (copied === 'idle') return
    const timer = window.setTimeout(() => setCopied('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const file = sources?.[Math.min(fileIndex, sources.length - 1)]
  const install = installCommand(asset)
  const folder = asset.importPath.replace(/^@\//, 'src/').replace(/\/[^/]+$/, '/')
  const code =
    tab === 'react' ? snippet : tab === 'component' ? (file?.code ?? 'Loading…') : install

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied('copied')
    } catch {
      setCopied('blocked')
    }
  }

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex((t) => t.id === tab)
    let next = -1
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = TABS.length - 1
    if (next < 0) return
    event.preventDefault()
    setTab(TABS[next].id)
    tabRefs.current[TABS[next].id]?.focus()
  }

  return (
    <section className="studio-code" aria-label="Code">
      <div className="studio-code-frameworks">
        <span className="studio-framework">React</span>
        <span className="studio-framework-soon">HTML / Vue: coming soon</span>
        {/* TODO(pro): HTML and Vue exports, and "Download .zip", go here. */}
      </div>

      <div className="studio-code-bar">
        <div role="tablist" aria-label="Code views" className="studio-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el
              }}
              id={`studio-tab-${t.id}`}
              type="button"
              role="tab"
              className="studio-tab"
              aria-selected={tab === t.id}
              aria-controls={`studio-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={onTabKey}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="studio-button studio-button-ink"
          onClick={copy}
          disabled={(tab === 'component' && !file) || (tab === 'install' && !asset.dependencies.length)}
        >
          {copied === 'copied' ? 'Copied!' : copied === 'blocked' ? 'Copy blocked' : 'Copy'}
        </button>
      </div>

      {TABS.map((t) => (
        <div
          key={t.id}
          id={`studio-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`studio-tab-${t.id}`}
          hidden={tab !== t.id}
          className="studio-panel"
          tabIndex={0}
        >
          {t.id === 'react' && <pre className="studio-pre">{snippet}</pre>}

          {t.id === 'component' && (
            <>
              {sources && sources.length > 1 && (
                <div className="studio-files" role="group" aria-label="Files">
                  {sources.map((s, i) => (
                    <button
                      key={s.path}
                      type="button"
                      className="studio-file"
                      aria-pressed={file === s}
                      onClick={() => setFileIndex(i)}
                    >
                      {s.path}
                    </button>
                  ))}
                </div>
              )}
              <p className="studio-code-note">
                Save {sources && sources.length > 1 ? 'these files' : 'this file'} in <code>{folder}</code>
                {file ? (
                  <>
                    {' '}
                    as <code>{file.path}</code>
                  </>
                ) : null}
                .
              </p>
              <pre className="studio-pre">{file?.code ?? 'Loading…'}</pre>
            </>
          )}

          {t.id === 'install' && (
            <>
              <pre className="studio-pre">{install}</pre>
              {!asset.dependencies.length && (
                <p className="studio-code-note">Only React is needed. Copy the Component file and you're done.</p>
              )}
            </>
          )}
        </div>
      ))}

      <p className="galaxy-sr-only" aria-live="polite">
        {copied === 'copied' ? 'Code copied' : copied === 'blocked' ? 'Your browser blocked copying.' : ''}
      </p>
    </section>
  )
}
