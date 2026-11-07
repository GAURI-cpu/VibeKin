import * as THREE from 'three'

export type ClayUniforms = {
  uTime: { value: number }
  uGlitter: { value: number }
}

const FRAGMENT_HELPERS = /* glsl */ `
  varying vec3 vObj;
  uniform float uTime;
  uniform float uGlitter;

  float clayHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float clayNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(clayHash(i), clayHash(i + vec3(1, 0, 0)), f.x),
          mix(clayHash(i + vec3(0, 1, 0)), clayHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(clayHash(i + vec3(0, 0, 1)), clayHash(i + vec3(1, 0, 1)), f.x),
          mix(clayHash(i + vec3(0, 1, 1)), clayHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  // Height of the clay surface: broad thumb dents, fine grain, and faint
  // fingerprint ridges in the patches where the broad noise is highest.
  float clayHeight(vec3 p) {
    float dents = clayNoise(p * 3.2);
    float grain = clayNoise(p * 26.0) * 0.32 + clayNoise(p * 58.0) * 0.14;
    float mask = smoothstep(0.62, 0.8, clayNoise(p * 1.7 + 4.0));
    float ridges = sin(length(p.xy + 0.3) * 120.0 + dents * 6.0) * 0.07 * mask;
    return dents * 0.9 + grain + ridges;
  }

  vec3 clayBump(vec3 p) {
    const float e = 0.006;
    float h = clayHeight(p);
    return vec3(
      clayHeight(p + vec3(e, 0, 0)) - h,
      clayHeight(p + vec3(0, e, 0)) - h,
      clayHeight(p + vec3(0, 0, e)) - h) / e;
  }

  vec3 glitterFlakes(vec3 p, vec3 n, vec3 view, vec3 tint) {
    vec3 cell = floor(p * 62.0);
    float seed = clayHash(cell);
    vec3 tilt = vec3(seed, clayHash(cell + 7.1), clayHash(cell + 13.7)) * 2.0 - 1.0;
    vec3 flake = normalize(n + tilt * 0.85);
    vec3 halfway = normalize(view + normalize(vec3(-0.35, 0.5, 0.8)));
    float flash = pow(max(dot(flake, halfway), 0.0), 90.0);
    float twinkle = 0.55 + 0.45 * sin(uTime * 2.6 + seed * 40.0);
    return (tint * 1.4 + 0.75) * flash * twinkle * 3.2;
  }
`

export function createClayMaterial(color: string, uniforms: ClayUniforms) {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.72,
    metalness: 0,
    sheen: 0.8,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color('#fff4ea'),
  })

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.uniforms.uGlitter = uniforms.uGlitter
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HELPERS}`)
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         normal = normalize(normal - clayBump(vObj) * 0.022);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         vec3 clayView = normalize(vViewPosition);
         // Light soaking through the clay keeps the shaded side from going grey.
         totalEmissiveRadiance += diffuseColor.rgb * 0.16 * (1.0 - max(dot(normal, clayView), 0.0));
         if (uGlitter > 0.001) {
           totalEmissiveRadiance += glitterFlakes(vObj, normal, clayView, diffuseColor.rgb) * uGlitter;
         }`,
      )
  }
  material.customProgramCacheKey = () => 'vibekin-clay'
  return material
}
