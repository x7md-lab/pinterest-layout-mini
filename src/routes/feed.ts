import type { Pin } from "@/data"

/** Feed state the root layout hands down to the Home route via <Outlet>. */
export type FeedContext = {
  pins: Pin[]
  onLoadMore: () => void
  hasMore: boolean
  /** Name of the local folder the feed shows, or null for the generated feed. */
  folder: string | null
  openFolder: () => void
  closeFolder: () => void
}
