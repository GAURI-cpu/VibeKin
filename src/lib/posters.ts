import { renderInkBloomPoster } from '../backgrounds/InkBloomBackground'
import { renderGradientOrbsPoster } from './orbsPoster'
import { renderSilkFlowPoster } from './silkPoster'
import { renderNameConstellationPoster } from '../backgrounds/NameConstellationBackground'
import { renderStarfallPoster } from '../backgrounds/StarfallBackground'
import { renderWaveRibbonsPoster } from '../backgrounds/WaveRibbonsBackground'
import { SCENE_DEFAULTS, renderPoster } from '../galaxy/scenes'

/** Every still thumbnail a card or box can show. */
export type PosterKey = 'Aurora' | 'WaveRibbons' | 'NameConstellation' | 'Starfall' | 'InkBloom' | 'SilkFlow' | 'GradientOrbs'

export async function makePoster(key: PosterKey, width: number, height: number): Promise<string> {
  if (key === 'WaveRibbons') return renderWaveRibbonsPoster(width, height)
  if (key === 'GradientOrbs') return renderGradientOrbsPoster(width, height)
  if (key === 'SilkFlow') return renderSilkFlowPoster(width, height)
  if (key === 'InkBloom') return renderInkBloomPoster(width, height)
  if (key === 'Starfall') return renderStarfallPoster(width, height)
  if (key === 'NameConstellation') return renderNameConstellationPoster('vibekin', width, height)
  return renderPoster(key, SCENE_DEFAULTS[key], width, height)
}
