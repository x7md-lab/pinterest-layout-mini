import { useOutletContext } from "react-router"
import { MasonryFeed } from "@/components/MasonryFeed"
import type { FeedContext } from "@/routes/feed"

/** The feed page. Pin data is owned by the root layout. */
export function Home() {
  return <MasonryFeed {...useOutletContext<FeedContext>()} />
}
