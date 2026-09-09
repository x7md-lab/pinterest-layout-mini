// End-to-end masonry layout computed by Taffy (Rust layout engine) compiled to WASM.
// We assign items to the shortest column (the masonry heuristic), then let Taffy
// do the real box math: a flex-row of flex-column containers, each stacking its
// items with gaps. Taffy returns exact rects we position absolutely in the DOM.
import init, {
  TaffyTree,
  Style,
  Display,
  FlexDirection,
} from "taffy-layout/wasm"

let readyPromise: Promise<void> | null = null
let loaded = false

/** Load the Taffy WASM module once. Safe to call repeatedly. */
export function ensureTaffy(): Promise<void> {
  if (!readyPromise)
    readyPromise = init().then(() => {
      loaded = true
    })
  return readyPromise
}

/**
 * Synchronous "is the engine already up?". Lets a remounting feed lay out on
 * its very first render instead of waiting a tick for the promise — without it
 * a route change back to the feed paints an empty list for a frame, which the
 * View Transition API captures as an empty incoming state.
 */
export function isTaffyReady(): boolean {
  return loaded
}

export type MasonryItem = { id: number; height: number }
export type Rect = { id: number; x: number; y: number; w: number; h: number }
export type MasonryResult = {
  rects: Rect[]
  byId: Map<number, Rect>
  totalHeight: number
  totalWidth: number
}

/**
 * Compute a masonry layout with Taffy. Heights are the caller's measured pixel
 * heights (image height from aspect ratio + measured footer).
 */
export function layoutMasonry(opts: {
  items: MasonryItem[]
  columns: number
  columnWidth: number
  gutter: number
}): MasonryResult {
  const { items, columns, columnWidth, gutter } = opts
  const empty: MasonryResult = {
    rects: [],
    byId: new Map(),
    totalHeight: 0,
    totalWidth: 0,
  }
  if (columns < 1 || columnWidth <= 0 || items.length === 0) return empty

  // 1) Masonry assignment: shortest-column-first.
  const colHeights = new Array<number>(columns).fill(0)
  const colBuckets: MasonryItem[][] = Array.from({ length: columns }, () => [])
  for (const it of items) {
    let min = 0
    for (let c = 1; c < columns; c++) {
      if (colHeights[c] < colHeights[min]) min = c
    }
    colBuckets[min].push(it)
    colHeights[min] += it.height + gutter
  }

  // 2) Build the Taffy tree and let it lay everything out.
  const tree = new TaffyTree()
  const itemToCol = new Map<number, bigint>()
  const itemNode = new Map<number, bigint>()

  const columnNodes: bigint[] = colBuckets.map((bucket) => {
    const children = bucket.map((it) => {
      const s = new Style()
      s.size = { width: columnWidth, height: it.height }
      const node = tree.newLeaf(s)
      itemNode.set(it.id, node)
      return node
    })
    const colStyle = new Style()
    colStyle.display = Display.Flex
    colStyle.flexDirection = FlexDirection.Column
    colStyle.gap = { width: 0, height: gutter }
    colStyle.size = { width: columnWidth, height: "auto" }
    const colNode = tree.newWithChildren(colStyle, children)
    for (const it of bucket) itemToCol.set(it.id, colNode)
    return colNode
  })

  const rootStyle = new Style()
  rootStyle.display = Display.Flex
  rootStyle.flexDirection = FlexDirection.Row
  rootStyle.gap = { width: gutter, height: 0 }
  const root = tree.newWithChildren(rootStyle, columnNodes)

  const totalWidth = columns * columnWidth + (columns - 1) * gutter
  tree.computeLayout(root, { width: totalWidth, height: "max-content" })

  // 3) Read absolute rects. getLayout is relative to the parent, so add the
  //    column's offset to each item's offset.
  const rects: Rect[] = []
  const byId = new Map<number, Rect>()
  for (const it of items) {
    const node = itemNode.get(it.id)!
    const col = itemToCol.get(it.id)!
    const cl = tree.getLayout(col)
    const l = tree.getLayout(node)
    const rect: Rect = {
      id: it.id,
      x: Math.round(cl.x + l.x),
      y: Math.round(cl.y + l.y),
      w: Math.round(l.width),
      h: Math.round(l.height),
    }
    rects.push(rect)
    byId.set(it.id, rect)
  }
  const totalHeight = Math.round(tree.getLayout(root).height)

  tree.free()
  return { rects, byId, totalHeight, totalWidth }
}
