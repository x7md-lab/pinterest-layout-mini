export type Pin = {
  id: number
  title: string
  author: string
  tag: string
  /** width / height of the "image", drives masonry variety (like Pinterest's known dims) */
  aspect: number
  hue: number
}

const titles = [
  "Golden hour over the fjords", "Minimal workspace setup", "Ramen bowl, close up",
  "Brutalist concrete stairwell", "Wildflower field at dusk", "Ceramic mugs, handmade",
  "Neon alley in the rain", "Cozy reading nook", "Mountain trail switchbacks",
  "Retro film camera collection", "Pastel gradient study", "Street food night market",
  "Scandinavian living room", "Desert road, long exposure", "Terrazzo texture detail",
  "Autumn leaves macro", "Vintage typography poster", "Modern kitchen in oak",
  "Tide pools at low tide", "Origami paper cranes", "Rooftop garden in summer",
  "Analog synth close-up", "Foggy pine forest", "Handbound leather journal",
]

const authors = [
  "maya.k", "studio.noir", "leafandloom", "north.frames", "pixel.pantry",
  "clayworks", "duskrider", "hana.m", "trailhead", "oldglass",
]

const tags = ["Design", "Travel", "Food", "Home", "Photography", "Craft", "Nature"]

// A spread of realistic pin aspect ratios (portrait-heavy, like Pinterest).
const aspects = [0.66, 0.75, 0.8, 1, 0.7, 1.33, 0.62, 0.9, 0.75, 1.5, 0.68, 0.85]

/** Deterministically synthesize a pin for any index, so the feed is effectively infinite. */
export function makePin(i: number): Pin {
  return {
    id: i,
    title: titles[i % titles.length],
    author: authors[(i * 7) % authors.length],
    tag: tags[(i * 3) % tags.length],
    aspect: aspects[(i * 5) % aspects.length],
    hue: (i * 41) % 360,
  }
}

export const PAGE_SIZE = 24

/** Page `page` (0-based) of the infinite feed. */
export function getPage(page: number): Pin[] {
  const start = page * PAGE_SIZE
  return Array.from({ length: PAGE_SIZE }, (_, k) => makePin(start + k))
}
