export type Mood = {
  id: string
  label: string
  /** One clay colour per blob, in the same order as KIN in blobScene.ts. */
  colors: string[]
  cheek: string
  /** How the mood is described in the copied prompt. */
  brief: string
}

export type BackdropId = 'clay' | 'glitter' | 'rain' | 'doodles'

export type Backdrop = {
  id: BackdropId
  label: string
  brief: string
}

export const MOODS: Mood[] = [
  {
    id: 'cute',
    label: 'Cute',
    colors: ['#f7b4c6', '#b2e6cd', '#cbb9f3', '#fbdf8a', '#a7d7f6', '#ffc69f'],
    cheek: '#ef7f9b',
    brief: 'soft candy pastels: pink, mint, lilac, butter, sky and peach',
  },
  {
    id: 'aesthetic',
    label: 'Aesthetic',
    colors: ['#d8b2a0', '#b7c2a2', '#a8b3c2', '#e6d6bb', '#c5a5b3', '#d7a785'],
    cheek: '#b9786f',
    brief: 'muted earthy tones: dusty rose, sage, slate blue, oat and mauve',
  },
  {
    id: 'playful',
    label: 'Playful',
    colors: ['#ff7a6b', '#4fc9a4', '#7a8cff', '#ffcf3f', '#57c7f2', '#ff8fc7'],
    cheek: '#e8415f',
    brief: 'bright toy colours: tomato, teal, periwinkle, sunflower, sky and bubblegum',
  },
  {
    id: 'simple',
    label: 'Simple',
    colors: ['#f4efe6', '#ece5d8', '#f7f3ec', '#e5ddcf', '#f1ebdf', '#ebe4d6'],
    cheek: '#e9a89b',
    brief: 'undyed oat clay in one colour, with only the cheeks tinted',
  },
  {
    id: 'dreamy',
    label: 'Dreamy',
    colors: ['#f3c4ea', '#bfe3f7', '#c9c6f7', '#f8d6e5', '#aad7e8', '#e2cdf8'],
    cheek: '#c88be0',
    brief: 'cool hazy tints: orchid, ice blue, periwinkle and blush',
  },
  {
    id: 'luxury',
    label: 'Luxury',
    colors: ['#d6b36a', '#5f9c85', '#6f82b0', '#eadcbc', '#b0626f', '#c49a6c'],
    cheek: '#a9505f',
    brief: 'rich jewel tones: champagne gold, emerald, sapphire, ivory, garnet and bronze',
  },
  {
    id: 'business',
    label: 'Business',
    colors: ['#9fb3c8', '#c7d0d9', '#7f96ad', '#dfe3e8', '#aebccb', '#b9c2b4'],
    cheek: '#c28b8b',
    brief: 'calm corporate tones: steel blue, slate, cool grey and soft sage',
  },
]

export const BACKDROPS: Backdrop[] = [
  { id: 'clay', label: 'Plain paper', brief: 'plain warm cream paper with nothing else behind the blobs' },
  {
    id: 'glitter',
    label: 'Glitter',
    brief: 'twinkling four-point sparkles on the paper, with glitter flakes on the blobs that catch the light as they turn',
  },
  {
    id: 'rain',
    label: 'Code rain',
    brief: 'columns of monospaced code falling down the paper in stepped frames, fading out behind the headline',
  },
  {
    id: 'doodles',
    label: 'Doodles',
    brief: 'hand-drawn hearts, stars, spirals and squiggles that redraw a few times a second, like boiling line animation',
  },
]

export function buildPrompt(mood: Mood, backdrop: Backdrop, dim: boolean): string {
  const setting = dim ? 'warm dim paper (#241d1a), lit like a lamp-lit room' : 'warm cream paper (#fbf7f0)'
  return [
    'Build a full-screen hero background with Three.js.',
    `Scene: six soft 3D clay blobs with kawaii faces floating behind the headline, on ${setting}, casting soft shadows on it.`,
    'Material: matte clay with fine surface grain, no gradients.',
    'Interaction: their eyes follow the cursor, they blink at random, and they squish with a springy bounce when clicked.',
    `Colour: ${mood.brief} (${mood.colors.join(', ')}).`,
    `Backdrop: ${backdrop.brief}.`,
    'Keep the headline readable, pause rendering when off screen, and respect prefers-reduced-motion.',
  ].join('\n')
}
