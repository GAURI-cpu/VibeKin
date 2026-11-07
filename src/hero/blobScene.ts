import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createClayMaterial, type ClayUniforms } from './clayMaterial'

type Bump = { dir: THREE.Vector3; height: number; width: number }

type Kin = {
  name: string
  rx: number
  ry: number
  rz: number
  /** Positive values narrow the top of the body, like a pear. */
  taper: number
  /** Curves the body sideways, like a bean. */
  bend: number
  lump: number
  seed: number
  bumps: Bump[]
  size: number
  /** Home positions as fractions of the half viewport. */
  wide: [number, number]
  tall: [number, number]
  tallSize: number
  face: { y: number; gap: number; eye: number; mouth: number }
}

const bump = (x: number, y: number, z: number, height: number, width: number): Bump => ({
  dir: new THREE.Vector3(x, y, z).normalize(),
  height,
  width,
})

const KIN: Kin[] = [
  {
    name: 'Mochi',
    rx: 1.16, ry: 0.84, rz: 0.95, taper: 0.1, bend: 0, lump: 0.03, seed: 1.3, bumps: [],
    size: 1.2, wide: [-0.72, -0.6], tall: [-0.56, -0.86], tallSize: 0.8,
    face: { y: 0.1, gap: 0.42, eye: 0.17, mouth: 0.075 },
  },
  {
    name: 'Pear',
    rx: 0.86, ry: 1.2, rz: 0.84, taper: 0.34, bend: 0, lump: 0.035, seed: 2.7, bumps: [],
    size: 1.08, wide: [0.76, -0.34], tall: [0.62, -0.83], tallSize: 0.56,
    face: { y: 0.3, gap: 0.3, eye: 0.15, mouth: 0.065 },
  },
  {
    name: 'Bear',
    rx: 1, ry: 0.93, rz: 0.92, taper: 0, bend: 0, lump: 0.02, seed: 4.1,
    bumps: [bump(-0.62, 0.76, 0.12, 0.3, 0.035), bump(0.62, 0.76, 0.12, 0.3, 0.035)],
    size: 0.8, wide: [-0.76, 0.5], tall: [-0.1, 0.72], tallSize: 0.5,
    face: { y: 0.04, gap: 0.38, eye: 0.17, mouth: 0.07 },
  },
  {
    name: 'Dot',
    rx: 1, ry: 1, rz: 1, taper: 0, bend: 0, lump: 0.015, seed: 5.9, bumps: [],
    size: 0.4, wide: [-0.28, 0.7], tall: [-0.76, 0.66], tallSize: 0.28,
    face: { y: 0.06, gap: 0.38, eye: 0.2, mouth: 0.085 },
  },
  {
    name: 'Tuft',
    rx: 1, ry: 0.9, rz: 0.92, taper: 0.08, bend: 0, lump: 0.03, seed: 7.2,
    bumps: [bump(0.05, 1, 0.05, 0.42, 0.012)],
    size: 0.66, wide: [0.62, 0.68], tall: [0.68, 0.74], tallSize: 0.44,
    face: { y: 0.02, gap: 0.36, eye: 0.17, mouth: 0.07 },
  },
  {
    name: 'Bean',
    rx: 1.05, ry: 0.72, rz: 0.78, taper: 0, bend: 0, lump: 0.025, seed: 8.8, bumps: [bump(1, 0.25, 0, 0.1, 0.1)],
    size: 0.58, wide: [0.3, -0.86], tall: [0.04, -0.97], tallSize: 0.38,
    face: { y: 0.12, gap: 0.4, eye: 0.19, mouth: 0.08 },
  },
]

const LIGHTING = {
  bright: { fill: 1.25, key: 2.1, environment: 0.42, shadow: 0.17, shadowColor: '#6d4a3c' },
  dim: { fill: 0.42, key: 1.15, environment: 0.14, shadow: 0.5, shadowColor: '#0c0806' },
}

const INK = '#2b2320'
const CAMERA_Z = 10
const FOV = 30

function surface(kin: Kin, d: THREE.Vector3, out: THREE.Vector3) {
  let r = 1
  for (const b of kin.bumps) r += b.height * Math.exp((d.dot(b.dir) - 1) / b.width)
  r += kin.lump * Math.sin(d.x * 3.1 + kin.seed) * Math.sin(d.y * 2.6 + kin.seed * 2) * Math.sin(d.z * 2.9 + kin.seed * 3)
  const taper = 1 - kin.taper * d.y
  return out.set(d.x * kin.rx * taper * r + kin.bend * (d.y * d.y - 0.3), d.y * kin.ry * r, d.z * kin.rz * taper * r)
}

const scratch = {
  a: new THREE.Vector3(),
  b: new THREE.Vector3(),
  c: new THREE.Vector3(),
  e: new THREE.Vector3(),
  t1: new THREE.Vector3(),
  t2: new THREE.Vector3(),
}

function surfaceNormal(kin: Kin, d: THREE.Vector3, out: THREE.Vector3) {
  const { a, b, c, e, t1, t2 } = scratch
  const step = 0.012
  t1.crossVectors(d, Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize()
  t2.crossVectors(d, t1).normalize()
  surface(kin, c.copy(d).addScaledVector(t1, step).normalize(), a)
  surface(kin, c.copy(d).addScaledVector(t1, -step).normalize(), e)
  a.sub(e)
  surface(kin, c.copy(d).addScaledVector(t2, step).normalize(), b)
  surface(kin, c.copy(d).addScaledVector(t2, -step).normalize(), e)
  b.sub(e)
  out.crossVectors(a, b).normalize()
  if (out.dot(d) < 0) out.negate()
  return out
}

function buildBody(kin: Kin) {
  const geometry = new THREE.SphereGeometry(1, 96, 72)
  const position = geometry.attributes.position as THREE.BufferAttribute
  const normal = geometry.attributes.normal as THREE.BufferAttribute
  const d = new THREE.Vector3()
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    d.fromBufferAttribute(position, i).normalize()
    surface(kin, d, p)
    surfaceNormal(kin, d, n)
    position.setXYZ(i, p.x, p.y, p.z)
    normal.setXYZ(i, n.x, n.y, n.z)
  }
  geometry.computeBoundingSphere()
  return geometry
}

const unitSphere = new THREE.SphereGeometry(1, 24, 18)
const inkMaterial = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.32 })
const eyeWhiteMaterial = new THREE.MeshStandardMaterial({ color: '#fffdf8', roughness: 0.5 })
const highlightMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
const mouthMaterial = new THREE.MeshStandardMaterial({ color: '#8f3a48', roughness: 0.6 })

function ellipsoid(material: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(unitSphere, material)
  mesh.scale.set(x, y, z)
  return mesh
}

/** A rounded stroke of clay. `up` gives a ^ shape, otherwise a smile. */
function clayArc(radius: number, tube: number, up: boolean) {
  const group = new THREE.Group()
  group.add(new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 28, Math.PI), inkMaterial))
  for (const side of [-1, 1]) {
    const cap = ellipsoid(inkMaterial, tube, tube, tube)
    cap.position.x = side * radius
    group.add(cap)
  }
  if (!up) group.rotation.z = Math.PI
  return group
}

function anchorOnSurface(kin: Kin, x: number, y: number, parent: THREE.Object3D) {
  const d = new THREE.Vector3(x, y, 1).normalize()
  const p = surface(kin, d, new THREE.Vector3())
  const n = surfaceNormal(kin, d, new THREE.Vector3())
  const anchor = new THREE.Group()
  anchor.position.copy(p)
  anchor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
  parent.add(anchor)
  return anchor
}

type Blob = {
  kin: Kin
  outer: THREE.Group
  body: THREE.Group
  mesh: THREE.Mesh
  material: THREE.MeshPhysicalMaterial
  cheekMaterial: THREE.MeshStandardMaterial
  targetColor: THREE.Color
  targetCheek: THREE.Color
  eyes: THREE.Group[]
  pupils: THREE.Group[]
  happyEyes: THREE.Group[]
  smile: THREE.Group
  openMouth: THREE.Mesh
  home: THREE.Vector3
  scale: number
  phase: number
  squash: number
  squashV: number
  squashTarget: number
  hop: number
  hopV: number
  wiggle: number
  wiggleV: number
  nextBlink: number
  blinkStart: number
  doubleBlink: boolean
  happyUntil: number
  appearDelay: number
  wander: THREE.Vector3
  nextWander: number
  yaw: number
  pitch: number
  gazeX: number
  gazeY: number
}

function buildBlob(kin: Kin, index: number, uniforms: ClayUniforms): Blob {
  const outer = new THREE.Group()
  const body = new THREE.Group()
  outer.add(body)

  const material = createClayMaterial('#ffffff', uniforms)
  const mesh = new THREE.Mesh(buildBody(kin), material)
  mesh.castShadow = true
  body.add(mesh)

  const { y, gap, eye, mouth } = kin.face
  const eyes: THREE.Group[] = []
  const pupils: THREE.Group[] = []
  const happyEyes: THREE.Group[] = []

  for (const side of [-1, 1]) {
    const anchor = anchorOnSurface(kin, side * gap, y, body)
    const blinker = new THREE.Group()
    blinker.add(ellipsoid(eyeWhiteMaterial, eye, eye * 1.14, eye * 0.34))
    const pupil = new THREE.Group()
    pupil.add(ellipsoid(inkMaterial, eye * 0.72, eye * 0.84, eye * 0.32))
    pupil.position.z = eye * 0.18
    const glint = ellipsoid(highlightMaterial, eye * 0.22, eye * 0.22, eye * 0.08)
    glint.position.set(-eye * 0.24, eye * 0.34, eye * 0.3)
    const glintSmall = ellipsoid(highlightMaterial, eye * 0.1, eye * 0.1, eye * 0.05)
    glintSmall.position.set(eye * 0.24, -eye * 0.26, eye * 0.3)
    pupil.add(glint, glintSmall)
    blinker.add(pupil)
    anchor.add(blinker)
    eyes.push(blinker)
    pupils.push(pupil)

    const happy = clayArc(eye * 0.72, eye * 0.17, true)
    happy.position.set(0, -eye * 0.2, eye * 0.06)
    happy.visible = false
    anchor.add(happy)
    happyEyes.push(happy)
  }

  const cheekMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78 })
  for (const side of [-1, 1]) {
    const anchor = anchorOnSurface(kin, side * (gap + eye * 1.25), y - eye * 1.3, body)
    anchor.add(ellipsoid(cheekMaterial, eye * 0.74, eye * 0.46, eye * 0.1))
  }

  const mouthAnchor = anchorOnSurface(kin, 0, y - eye * 1.35, body)
  const smile = clayArc(mouth, mouth * 0.24, false)
  smile.position.z = mouth * 0.12
  mouthAnchor.add(smile)
  const openMouth = ellipsoid(mouthMaterial, mouth * 0.92, mouth * 1.05, mouth * 0.3)
  openMouth.visible = false
  mouthAnchor.add(openMouth)

  return {
    kin, outer, body, mesh, material, cheekMaterial,
    targetColor: new THREE.Color(),
    targetCheek: new THREE.Color(),
    eyes, pupils, happyEyes, smile, openMouth,
    home: new THREE.Vector3(),
    scale: 1,
    phase: index * 1.73,
    squash: 0, squashV: 0, squashTarget: 0,
    hop: 0, hopV: 0,
    wiggle: 0, wiggleV: 0,
    nextBlink: 1 + Math.random() * 4,
    blinkStart: -1,
    doubleBlink: false,
    happyUntil: 0,
    appearDelay: 0.12 + index * 0.1,
    wander: new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, 0),
    nextWander: 2 + Math.random() * 3,
    yaw: 0, pitch: 0, gazeX: 0, gazeY: 0,
  }
}

const easeOutBack = (x: number) => {
  const c = 1.9
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2)
}

export type BlobScene = {
  setPalette(colors: string[], cheek: string): void
  setGlitter(on: boolean): void
  /** Fades the scene lighting between bright and dim. The blobs blink as it changes. */
  setLight(dim: boolean): void
  /** Bounces every blob in a wave, used when the vibe changes. */
  bounce(): void
  resize(): void
  frame(time: number, dt: number): void
  dispose(): void
}

export function createBlobScene(host: HTMLElement, pointerArea: HTMLElement, reducedMotion: boolean): BlobScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.VSMShadowMap
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60)
  camera.position.z = CAMERA_Z

  const pmrem = new THREE.PMREMGenerator(renderer)
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environment
  scene.environmentIntensity = LIGHTING.bright.environment
  pmrem.dispose()

  const fill = new THREE.HemisphereLight('#fff8ee', '#f3d9cf', LIGHTING.bright.fill)
  scene.add(fill)

  const key = new THREE.DirectionalLight('#fff3e4', LIGHTING.bright.key)
  key.position.set(-2, 2.9, 9)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.radius = 14
  key.shadow.blurSamples = 22
  key.shadow.bias = -0.0005
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 30
  scene.add(key)

  // The paper itself: invisible except for the shadows the blobs drop on it.
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShadowMaterial({ color: LIGHTING.bright.shadowColor, opacity: LIGHTING.bright.shadow }),
  )
  paper.position.z = -1.7
  paper.receiveShadow = true
  scene.add(paper)

  const uniforms: ClayUniforms = { uTime: { value: 0 }, uGlitter: { value: 0 } }
  const blobs = KIN.map((kin, i) => buildBlob(kin, i, uniforms))
  blobs.forEach((blob) => scene.add(blob.outer))

  let lighting = LIGHTING.bright
  const shadowColorTarget = new THREE.Color(lighting.shadowColor)

  function applyLighting(amount: number) {
    fill.intensity += (lighting.fill - fill.intensity) * amount
    key.intensity += (lighting.key - key.intensity) * amount
    scene.environmentIntensity += (lighting.environment - scene.environmentIntensity) * amount
    paper.material.opacity += (lighting.shadow - paper.material.opacity) * amount
    paper.material.color.lerp(shadowColorTarget, amount)
  }

  let glitterTarget = 0
  let startTime = -1
  let viewWidth = 1
  let viewHeight = 1

  const ndc = new THREE.Vector2()
  const raycaster = new THREE.Raycaster()
  const pointerWorld = new THREE.Vector3()
  const gazePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  let pointerSeen = false
  let lastPointerMove = -Infinity
  let needsHoverCheck = false
  let pointerInArea = false
  let hovered: Blob | null = null
  let now = 0

  function updatePointer(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect()
    ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(ndc, camera)
    raycaster.ray.intersectPlane(gazePlane, pointerWorld)
    pointerSeen = true
    lastPointerMove = now
  }

  function blobUnderPointer() {
    const hits = raycaster.intersectObjects(blobs.map((blob) => blob.mesh), false)
    return hits.length ? blobs.find((blob) => blob.mesh === hits[0].object) ?? null : null
  }

  function squish(blob: Blob) {
    blob.squashV += 8.5
    blob.hopV += 2.1 * blob.scale
    blob.wiggleV += (Math.random() < 0.5 ? -1 : 1) * 6
    blob.happyUntil = now + 0.85
  }

  // Listens on the window so the eyes keep following over the fixed navbar,
  // while hover and squish only apply inside the hero itself.
  function onPointerMove(event: PointerEvent) {
    updatePointer(event)
    pointerInArea = pointerArea.contains(event.target as Node)
    needsHoverCheck = true
  }

  function onPointerDown(event: PointerEvent) {
    updatePointer(event)
    if ((event.target as Element).closest('button, a')) return
    const blob = blobUnderPointer()
    if (blob) squish(blob)
  }

  window.addEventListener('pointermove', onPointerMove)
  pointerArea.addEventListener('pointerdown', onPointerDown)

  function resize() {
    const width = host.clientWidth || 1
    const height = host.clientHeight || 1
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()

    viewHeight = 2 * CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    viewWidth = viewHeight * camera.aspect

    const isTall = camera.aspect < 1.1
    const unit = isTall ? Math.min(viewWidth / 3.1, viewHeight / 5.4) : Math.min(viewWidth / 9.5, viewHeight / 5.36)
    blobs.forEach((blob) => {
      const [x, y] = isTall ? blob.kin.tall : blob.kin.wide
      blob.home.set((x * viewWidth) / 2, (y * viewHeight) / 2, (blob.phase % 0.6) - 0.3)
      blob.scale = (isTall ? blob.kin.tallSize : blob.kin.size) * unit
    })

    paper.scale.set(viewWidth * 1.6, viewHeight * 1.6, 1)
    const shadowCamera = key.shadow.camera
    shadowCamera.left = -viewWidth * 0.8
    shadowCamera.right = viewWidth * 0.8
    shadowCamera.top = viewHeight * 0.8
    shadowCamera.bottom = -viewHeight * 0.8
    shadowCamera.updateProjectionMatrix()
  }

  function updateBlob(blob: Blob, t: number, dt: number) {
    const elapsed = t - startTime
    const appear = reducedMotion ? 1 : easeOutBack(THREE.MathUtils.clamp((elapsed - blob.appearDelay) / 0.75, 0, 1))
    const floatAmount = reducedMotion ? 0 : 1

    // Springs: squash for the jelly, hop for the jump, wiggle for the roll.
    const squashForce = (blob.squashTarget - blob.squash) * 210 - blob.squashV * 11
    blob.squashV += squashForce * dt
    blob.squash = THREE.MathUtils.clamp(blob.squash + blob.squashV * dt, -0.32, 0.4)
    blob.hopV += (-blob.hop * 120 - blob.hopV * 11) * dt
    blob.hop += blob.hopV * dt
    blob.wiggleV += (-blob.wiggle * 150 - blob.wiggleV * 9) * dt
    blob.wiggle += blob.wiggleV * dt

    const breathe = Math.sin(t * 1.15 + blob.phase) * 0.012 * floatAmount
    const q = blob.squash + breathe
    const size = blob.scale * appear
    blob.outer.scale.set(size * (1 + q * 0.6), size * (1 - q), size * (1 + q * 0.6))

    blob.outer.position.set(
      blob.home.x + Math.cos(t * 0.46 + blob.phase) * 0.06 * floatAmount,
      blob.home.y + Math.sin(t * 0.72 + blob.phase) * 0.09 * floatAmount + blob.hop,
      blob.home.z,
    )
    blob.outer.rotation.z = Math.sin(t * 0.5 + blob.phase) * 0.04 * floatAmount + blob.wiggle

    // Follow the cursor, or look around when it has been still for a while.
    const looking = pointerSeen && t - lastPointerMove < 4.5
    if (!looking && t > blob.nextWander) {
      blob.wander.set((Math.random() - 0.5) * viewWidth, (Math.random() - 0.5) * viewHeight, 0)
      blob.nextWander = t + 2 + Math.random() * 3.5
    }
    const gaze = looking ? pointerWorld : blob.wander
    const dx = gaze.x - blob.outer.position.x
    const dy = gaze.y - blob.outer.position.y

    const turn = 1 - Math.exp(-(looking ? 6.5 : 2.4) * dt)
    blob.yaw += (THREE.MathUtils.clamp(Math.atan2(dx, 3.4), -0.52, 0.52) - blob.yaw) * turn
    blob.pitch += (THREE.MathUtils.clamp(-Math.atan2(dy, 3.4), -0.4, 0.4) - blob.pitch) * turn
    blob.body.rotation.set(blob.pitch, blob.yaw, 0)

    const dart = 1 - Math.exp(-16 * dt)
    blob.gazeX += (THREE.MathUtils.clamp(dx / 2.2, -1, 1) - blob.gazeX) * dart
    blob.gazeY += (THREE.MathUtils.clamp(dy / 1.8, -1, 1) - blob.gazeY) * dart
    const eyeSize = blob.kin.face.eye
    for (const pupil of blob.pupils) {
      pupil.position.x = blob.gazeX * eyeSize * 0.27
      pupil.position.y = blob.gazeY * eyeSize * 0.27
    }

    // Blinks, sometimes in a pair.
    if (t > blob.nextBlink && blob.blinkStart < 0) {
      blob.blinkStart = t
      blob.doubleBlink = Math.random() < 0.22
    }
    let lid = 1
    if (blob.blinkStart >= 0) {
      const progress = (t - blob.blinkStart) / 0.15
      if (progress >= 1) {
        blob.blinkStart = blob.doubleBlink ? t + 0.08 : -1
        if (blob.doubleBlink) blob.doubleBlink = false
        else blob.nextBlink = t + 2 + Math.random() * 4.5
      } else if (progress >= 0) {
        lid = Math.max(0.07, 1 - Math.sin(progress * Math.PI))
      }
    }
    for (const eye of blob.eyes) eye.scale.y = lid

    const happy = t < blob.happyUntil
    blob.eyes.forEach((eye) => (eye.visible = !happy))
    blob.happyEyes.forEach((eye) => (eye.visible = happy))
    blob.smile.visible = !happy
    blob.openMouth.visible = happy

    const tint = 1 - Math.exp(-5 * dt)
    blob.material.color.lerp(blob.targetColor, tint)
    blob.cheekMaterial.color.lerp(blob.targetCheek, tint)
  }

  return {
    setPalette(colors, cheek) {
      blobs.forEach((blob, i) => {
        blob.targetColor.set(colors[i])
        // Cheeks are a dab of the mood's blush worked into the body colour.
        blob.targetCheek.set(colors[i]).lerp(new THREE.Color(cheek), 0.72)
        if (startTime < 0) {
          blob.material.color.copy(blob.targetColor)
          blob.cheekMaterial.color.copy(blob.targetCheek)
        }
      })
    },
    setGlitter(on) {
      glitterTarget = on ? 1 : 0
    },
    setLight(dim) {
      lighting = dim ? LIGHTING.dim : LIGHTING.bright
      shadowColorTarget.set(lighting.shadowColor)
      if (startTime < 0) {
        applyLighting(1)
        return
      }
      for (const blob of blobs) blob.blinkStart = now
    },
    bounce() {
      if (reducedMotion) return
      blobs.forEach((blob, i) => {
        window.setTimeout(() => {
          blob.squashV += 4.5
          blob.hopV += 1.1 * blob.scale
        }, i * 55)
      })
    },
    resize,
    frame(t, dt) {
      if (startTime < 0) startTime = t
      now = t
      uniforms.uTime.value = t
      uniforms.uGlitter.value += (glitterTarget - uniforms.uGlitter.value) * (1 - Math.exp(-4 * dt))
      applyLighting(1 - Math.exp(-5 * dt))

      if (needsHoverCheck) {
        needsHoverCheck = false
        const next = pointerInArea ? blobUnderPointer() : null
        if (next !== hovered) {
          if (hovered) hovered.squashTarget = 0
          if (next) next.squashTarget = -0.04
          hovered = next
          pointerArea.classList.toggle('is-over-blob', !!next)
        }
      }

      for (const blob of blobs) updateBlob(blob, t, dt)
      renderer.render(scene, camera)
    },
    dispose() {
      window.removeEventListener('pointermove', onPointerMove)
      pointerArea.removeEventListener('pointerdown', onPointerDown)
      pointerArea.classList.remove('is-over-blob')
      for (const blob of blobs) {
        blob.mesh.geometry.dispose()
        blob.material.dispose()
        blob.cheekMaterial.dispose()
      }
      environment.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
