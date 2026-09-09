import type { Pin } from "@/data"

/** Feed state the root layout hands down to the Home route via <Outlet>. */
export type FeedContext = {
  pins: Pin[]
  onLoadMore: () => void
  hasMore: boolean
}
