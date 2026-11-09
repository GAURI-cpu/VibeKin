import { useEffect, useMemo, useState } from 'react'
import { generateReactSnippet } from '../../lib/codegen'
import { paletteOf, type AssetMeta, type StudioSettings } from '../../lib/registry'
import {
  PHOTO_PALETTE_ID,
  defaultSettings,
  defaultText,
  queryString,
  readFromQuery,
  type StudioText,
} from '../../lib/studioSettings'
import { followLink } from '../../router'
import { CodePanel } from './CodePanel'
import type { PhotoVibeProps } from './PhotoVibe'
import {
  getPhotoSession,
  sessionFromLink,
  sessionFromPhoto,
  sessionPalette,
  setPhotoSession,
  type PhotoSession,
} from './photoSession'
import { StudioControls } from './StudioControls'
import { StudioPreview } from './StudioPreview'
import '../../galaxy/galaxy.css'
import './studio.css'

type SourceFile = { path: string; code: string }

// Raw source for the Component tab: Vite's build-time stand-in for reading the files with fs.
// Each file is its own small chunk, fetched only when a Studio page needs it.
const RAW_SOURCES = import.meta.glob<string>(
  ['../../backgrounds/*.tsx', '../../galaxy/backgrounds.tsx', '../../galaxy/GalaxyCanvas.tsx', '../../galaxy/scenes.ts'],
  { query: '?raw', import: 'default' },
)

function useSources(files: string[]): SourceFile[] | null {
  const key = files.join('|')
  const [loaded, setLoaded] = useState<{ key: string; files: SourceFile[] } | null>(null)
  useEffect(() => {
    let cancelled = false
    const paths = key.split('|')
    void Promise.all(
      paths.map(async (path) => {
        const load = RAW_SOURCES[`../../${path}`]
        return { path: path.split('/').pop() ?? path, code: load ? await load() : `// ${path} could not be loaded.` }
      }),
    ).then((files) => {
      if (!cancelled) setLoaded({ key, files })
    })
    return () => {
      cancelled = true
    }
  }, [key])
  return loaded?.key === key ? loaded.files : null
}

type Initial = { settings: StudioSettings; text: StudioText; photo: PhotoSession | null }

/** Settings from the address bar, plus the photo palette from a share link or from the last background. */
function readInitial(asset: AssetMeta): Initial {
  const query = new URLSearchParams(window.location.search)
  const { settings, text } = readFromQuery(asset, query)
  const fallbackId = asset.palettes[0].id
  if (settings.paletteId === PHOTO_PALETTE_ID && settings.customPalette) {
    return { settings, text, photo: sessionFromLink(settings.customPalette, fallbackId) }
  }
  // Moving to another background keeps the photo palette, rebuilt for this background's colour count.
  const cached = getPhotoSession()
  if (cached && !query.has('pal')) {
    return { settings: { ...settings, paletteId: PHOTO_PALETTE_ID }, text, photo: cached }
  }
  return { settings, text, photo: cached }
}

/** The fitting room: one background, live, with controls and code that always match. */
export function Studio({ asset }: { asset: AssetMeta }) {
  // A share link restores exactly its settings; anything invalid falls back to the defaults.
  const [initial] = useState(() => readInitial(asset))
  const [baseSettings, setSettings] = useState<StudioSettings>(initial.settings)
  const [text, setText] = useState<StudioText>(initial.text)
  const [photo, setPhoto] = useState<PhotoSession | null>(initial.photo)
  const sources = useSources(asset.files)
  const count = asset.palettes[0].colors.length

  useEffect(() => {
    setPhotoSession(photo)
  }, [photo])

  // The photo palette is derived, so Dark/Light, Shuffle and a new asset just rebuild it from the cached clusters.
  const customPalette = useMemo(() => (photo ? sessionPalette(photo, count) : undefined), [photo, count])
  const settings = useMemo<StudioSettings>(() => ({ ...baseSettings, customPalette }), [baseSettings, customPalette])

  const palette = paletteOf(asset, settings)
  const snippet = useMemo(() => generateReactSnippet(asset, settings, text), [asset, settings, text])

  // Keep the address bar in step, without a history entry per slider move and without scrolling.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = `${window.location.pathname}?${queryString(asset, settings, text)}`
      window.history.replaceState(window.history.state, '', url)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [asset, settings, text])

  const presetOr = (id: string) => (asset.palettes.some((p) => p.id === id) ? id : asset.palettes[0].id)

  const dropPhoto = () => {
    if (photo?.thumbUrl) URL.revokeObjectURL(photo.thumbUrl)
    setPhoto(null)
  }

  const photoProps: PhotoVibeProps = {
    photo,
    palette: customPalette,
    count,
    onExtracted: (clusters, thumbUrl) => {
      if (photo?.thumbUrl) URL.revokeObjectURL(photo.thumbUrl)
      const previous = baseSettings.paletteId === PHOTO_PALETTE_ID ? (photo?.previousPaletteId ?? '') : baseSettings.paletteId
      setPhoto(sessionFromPhoto(clusters, thumbUrl, presetOr(previous)))
      setSettings((s) => ({ ...s, paletteId: PHOTO_PALETTE_ID }))
    },
    onMode: (mode) => setPhoto((p) => p && { ...p, mode }),
    onShuffle: () => setPhoto((p) => p && { ...p, rotate: (p.rotate + 1) % Math.max(1, count) }),
    onRemove: () => {
      const previous = presetOr(photo?.previousPaletteId ?? '')
      dropPhoto()
      setSettings((s) => ({ ...s, paletteId: s.paletteId === PHOTO_PALETTE_ID ? previous : s.paletteId }))
    },
  }

  const reset = () => {
    dropPhoto()
    setSettings(defaultSettings(asset))
    setText(defaultText(asset))
  }

  const shareUrl = () => `${window.location.origin}${window.location.pathname}?${queryString(asset, settings, text)}`

  return (
    // Grid order is the phone order: preview, controls, code. On desktop the controls move to a sticky column.
    <main className="studio">
      <header className="studio-header">
        <a className="galaxy-back-link" href="/galaxy" onClick={followLink}>
          ← Library
        </a>
        <h1 className="studio-title">{asset.name}</h1>
        <span className="studio-vibe">{asset.vibe}</span>
        {/* TODO(pro): "Save to my account" goes here, beside the title. */}
      </header>

      <StudioPreview asset={asset} settings={settings} text={text} palette={palette} />

      <StudioControls
        asset={asset}
        settings={settings}
        text={text}
        onSettingsChange={setSettings}
        onTextChange={setText}
        onReset={reset}
        shareUrl={shareUrl}
        photo={photoProps}
      />

      <CodePanel asset={asset} snippet={snippet} sources={sources} />
    </main>
  )
}
