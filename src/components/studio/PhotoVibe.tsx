import { useEffect, useRef, useState, type DragEvent } from 'react'
import { clusterPixels, nameColour, paletteFromClusters, readPixels, type Cluster } from '../../lib/photoPalette'
import type { PhotoSession } from './photoSession'

const MAX_BYTES = 20 * 1024 * 1024

export type PhotoVibeProps = {
  photo: PhotoSession | null
  /** The colours currently drawn from the photo (or share link). */
  palette: { bg: string; colors: string[] } | undefined
  count: number
  onExtracted: (clusters: Cluster[], thumbUrl: string) => void
  onMode: (mode: 'dark' | 'light') => void
  onShuffle: () => void
  onRemove: () => void
}

/** "Vibe from a photo": choose, drop or paste a photo; its colours become a palette. Nothing leaves the browser. */
export function PhotoVibe({ photo, palette, count, onExtracted, onMode, onShuffle, onRemove }: PhotoVibeProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = async (file: File) => {
    setError(null)
    // Some apps drop files with no type; those get a chance to decode.
    if (file.type && !file.type.startsWith('image/')) {
      setError("That file isn't an image. Try a JPG, PNG or WebP photo.")
      return
    }
    if (file.size > MAX_BYTES) {
      setError('That photo is over 20 MB. Try a smaller one.')
      return
    }
    setBusy(true)
    setAnnounce('')
    try {
      const clusters = clusterPixels(await readPixels(file))
      if (!clusters.length) throw new Error('No visible pixels')
      onExtracted(clusters, URL.createObjectURL(file))
      const p = paletteFromClusters(clusters, { count })
      setAnnounce(
        `Colours extracted: ${nameColour(p.bg)} background and ${p.accents.length} accent colour${p.accents.length === 1 ? '' : 's'}.`,
      )
    } catch {
      setError("We couldn't read that image. Try a JPG, PNG or WebP photo.")
    } finally {
      setBusy(false)
    }
  }

  // The paste listener lives for the page, so it always calls the latest handler.
  const handleRef = useRef(handle)
  useEffect(() => {
    handleRef.current = handle
  })

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
      if (!file) return // plain text pastes into the inputs as usual
      event.preventDefault()
      void handleRef.current(file)
    }
    // A photo dropped just outside the zone shouldn't make the browser navigate away to it.
    const keepPage = (event: globalThis.DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
    }
    document.addEventListener('paste', onPaste)
    window.addEventListener('dragover', keepPage)
    window.addEventListener('drop', keepPage)
    return () => {
      document.removeEventListener('paste', onPaste)
      window.removeEventListener('dragover', keepPage)
      window.removeEventListener('drop', keepPage)
    }
  }, [])

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setOver(false)
    const file = event.dataTransfer.files[0]
    if (file) void handle(file)
  }

  return (
    <section className="studio-photo" aria-labelledby="studio-photo-title">
      <h3 id="studio-photo-title" className="studio-photo-title">
        Vibe from a photo
      </h3>

      {photo && palette && (
        <>
          <div className="studio-photo-result">
            {photo.thumbUrl ? (
              <img className="studio-photo-thumb" src={photo.thumbUrl} alt="Your photo" />
            ) : (
              <p className="studio-photo-from">Colours from a photo</p>
            )}
            <div className="studio-photo-swatches">
              {[palette.bg, ...palette.colors].map((hex, i) => (
                <span
                  key={`${i}-${hex}`}
                  className="studio-photo-swatch"
                  role="img"
                  aria-label={i === 0 ? `Background ${hex}` : `Accent ${i} ${hex}`}
                  title={hex}
                  style={{ background: hex }}
                />
              ))}
            </div>
          </div>

          <div className="studio-photo-tools">
            {photo.clusters && (
              <div className="studio-segment" role="group" aria-label="Sky">
                {(['dark', 'light'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className="studio-segment-button"
                    aria-pressed={photo.mode === mode}
                    onClick={() => onMode(mode)}
                  >
                    {mode === 'dark' ? 'Dark sky' : 'Light sky'}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="studio-button" onClick={onShuffle} disabled={count < 2}>
              Shuffle
            </button>
            <button type="button" className="studio-button" onClick={onRemove}>
              Remove photo
            </button>
          </div>
        </>
      )}

      <div
        className="studio-dropzone"
        data-over={over || undefined}
        onDragEnter={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false)
        }}
        onDrop={onDrop}
      >
        {busy ? (
          <span>Reading colours…</span>
        ) : (
          <span>
            {photo?.thumbUrl ? 'Drop another photo, or ' : 'Drop a photo here, or '}
            <button type="button" className="studio-dropzone-button" onClick={() => inputRef.current?.click()}>
              choose a photo
            </button>
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = '' // so choosing the same photo again still fires
            if (file) void handle(file)
          }}
        />
      </div>

      {error && (
        <p className="studio-photo-error" role="alert">
          {error}
        </p>
      )}
      <p className="studio-photo-hint">Your photo never leaves your device. You can also paste one with Ctrl/Cmd+V.</p>
      <p className="galaxy-sr-only" aria-live="polite">
        {announce}
      </p>
    </section>
  )
}
