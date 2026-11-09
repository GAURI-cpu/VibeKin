import { useEffect, useRef, useState } from 'react'
import { NameConstellationBackground, type NameConstellationHandle } from '../backgrounds/NameConstellationBackground'
import { NameInput } from '../components/NameInput'
import { followLink } from '../router'
import '../galaxy/galaxy.css'
import './constellation.css'

type Flash = 'idle' | 'copied' | 'saved' | 'blocked'

/** /constellation: the sky writes whatever name the visitor types, in the same medium box as the other backgrounds. */
export function ConstellationPage() {
  // The first visit writes "vibekin" on its own, once the font is ready. A shared ?name= link writes that name.
  const [name, setName] = useState(
    () => new URLSearchParams(window.location.search).get('name')?.trim().slice(0, 14) || 'vibekin',
  )
  const [flash, setFlash] = useState<Flash>('idle')
  const skyRef = useRef<NameConstellationHandle>(null)

  useEffect(() => {
    if (flash === 'idle') return
    const reset = window.setTimeout(() => setFlash('idle'), 2000)
    return () => window.clearTimeout(reset)
  }, [flash])

  const saveImage = async () => {
    const blob = await skyRef.current?.toBlob()
    if (!blob) return setFlash('blocked')
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'my-constellation.png'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setFlash('saved')
  }

  const copyCode = async () => {
    const shown = name.trim() || 'Your Name'
    const snippet = `<NameConstellationBackground name="${shown.replace(/"/g, '&quot;')}" background="#050816" intensity={0.5} detail={0.6} />`
    try {
      await navigator.clipboard.writeText(snippet)
      setFlash('copied')
    } catch {
      setFlash('blocked')
    }
  }

  return (
    <main className="galaxy-detail">
      <a className="galaxy-back-link galaxy-detail-back" href="/galaxy" onClick={followLink}>
        ← Back to Galaxy
      </a>

      {/* A medium box in the middle of the page, not full screen. */}
      <div className="galaxy-detail-body">
        <div className="galaxy-detail-stage constellation-stage">
          <NameConstellationBackground ref={skyRef} name={name} />
        </div>
      </div>

      <div className="constellation-controls">
        <NameInput onWrite={setName} tone="paper" />
      </div>

      <div className="galaxy-detail-actions">
        <button type="button" className="press press-ink" onClick={copyCode}>
          {flash === 'copied' ? 'Copied!' : 'Copy code'}
        </button>
        <button type="button" className="press press-paper" onClick={saveImage}>
          {flash === 'saved' ? 'Saved!' : 'Save as image'}
        </button>
        <a
          className="press press-paper galaxy-press-link"
          href={`/studio/name-constellation?x_name=${encodeURIComponent(name.trim().slice(0, 14))}`}
          onClick={followLink}
        >
          Open in Studio
        </a>
      </div>
      <p className="galaxy-sr-only" aria-live="polite">
        {flash === 'copied'
          ? 'Code copied'
          : flash === 'saved'
            ? 'Image saved'
            : flash === 'blocked'
              ? 'Your browser blocked that. Try again.'
              : ''}
      </p>
    </main>
  )
}
