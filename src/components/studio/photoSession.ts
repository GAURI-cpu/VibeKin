import { autoMode, paletteFromClusters, type Cluster } from '../../lib/photoPalette'
import { fitColors, isDark } from '../../lib/studioSettings'

/** The photo the visitor chose, or the colours a share link carried. Lives only in this tab's memory. */
export type PhotoSession = {
  /** Cached k-means result: Dark/Light, Shuffle and asset switches rebuild from this without re-reading the photo. */
  clusters: Cluster[] | null
  /** Colours restored from a share link (there's no photo then). */
  linkPalette: { bg: string; colors: string[] } | null
  /** Object URL for the thumbnail; null after a share link. */
  thumbUrl: string | null
  mode: 'dark' | 'light'
  rotate: number
  /** The preset to go back to on "Remove photo". */
  previousPaletteId: string
}

// Kept outside React so moving to another background keeps the photo palette.
let current: PhotoSession | null = null

export const getPhotoSession = () => current

export function setPhotoSession(next: PhotoSession | null) {
  current = next
}

export function sessionFromPhoto(clusters: Cluster[], thumbUrl: string, previousPaletteId: string): PhotoSession {
  return { clusters, linkPalette: null, thumbUrl, mode: autoMode(clusters), rotate: 0, previousPaletteId }
}

export function sessionFromLink(palette: { bg: string; colors: string[] }, previousPaletteId: string): PhotoSession {
  return {
    clusters: null,
    linkPalette: palette,
    thumbUrl: null,
    mode: isDark(palette.bg) ? 'dark' : 'light',
    rotate: 0,
    previousPaletteId,
  }
}

/** The session's colours for an asset that needs `count` accents. */
export function sessionPalette(session: PhotoSession, count: number): { bg: string; colors: string[] } {
  if (session.clusters) {
    const p = paletteFromClusters(session.clusters, { count, mode: session.mode, rotate: session.rotate })
    return { bg: p.bg, colors: p.accents }
  }
  const link = session.linkPalette ?? { bg: '#0d0f1a', colors: ['#ffffff'] }
  const colors = fitColors(link.colors, count)
  const r = session.rotate % count
  return { bg: link.bg, colors: [...colors.slice(r), ...colors.slice(0, r)] }
}
