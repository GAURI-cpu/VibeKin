import { renderNameConstellationPoster } from '../backgrounds/NameConstellationBackground'
import { renderWaveRibbonsPoster } from '../backgrounds/WaveRibbonsBackground'
import { SCENE_DEFAULTS, renderPoster } from '../galaxy/scenes'

/** Every still thumbnail a card or box can show. */
export type PosterKey = 'Aurora' | 'WaveRibbons' | 'NameConstellation'

export async function makePoster(key: PosterKey, width: number, height: number): Promise<string> {
  if (key === 'WaveRibbons') return renderWaveRibbonsPoster(width, height)
  if (key === 'NameConstellation') return renderNameConstellationPoster('vibekin', width, height)
  return renderPoster(key, SCENE_DEFAULTS[key], width, height)
}
