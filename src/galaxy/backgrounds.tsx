import type { CSSProperties, JSX } from 'react'
import { GalaxyCanvas } from './GalaxyCanvas'
import { SCENES, SCENE_DEFAULTS, type GalaxyOptions, type SceneName } from './scenes'

/** The standard props every galaxy background accepts. Anything left out uses that background's own look. */
export type GalaxyProps = Partial<GalaxyOptions> & {
  className?: string
  style?: CSSProperties
}

function make(name: SceneName) {
  function GalaxyBackground(props: GalaxyProps) {
    const defaults = SCENE_DEFAULTS[name]
    return (
      <GalaxyCanvas
        scene={SCENES[name]}
        background={props.background ?? defaults.background}
        colors={props.colors ?? defaults.colors}
        intensity={props.intensity ?? defaults.intensity}
        detail={props.detail ?? defaults.detail}
        className={props.className}
        style={props.style}
      />
    )
  }
  GalaxyBackground.displayName = name
  return GalaxyBackground
}

export const Aurora = make('Aurora')
export const MilkyWay = make('MilkyWay')
export const Stardust = make('Stardust')
export const BlackHole = make('BlackHole')
export const CometTrail = make('CometTrail')

export const GALAXY_COMPONENTS: Record<SceneName, (props: GalaxyProps) => JSX.Element> = {
  Aurora,
  MilkyWay,
  Stardust,
  BlackHole,
  CometTrail,
}
