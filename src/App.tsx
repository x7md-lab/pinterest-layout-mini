import { useCallback, useRef, useState } from "react"
import { Outlet } from "react-router"
import { getPage, type Pin } from "@/data"
import type { FeedContext } from "@/routes/feed"
import { Toaster } from "@/components/ui/sonner"
import { SaveFlyProvider } from "@/components/SaveFly"
import { SoundProvider } from "@/components/SoundProvider"
import { useMediaQuery } from "@/hooks/useMediaQuery"

const MAX_PAGES = 12 // cap the demo feed

/**
 * Root layout. Owns the feed state so pages already loaded (and the scroll
 * position) survive a trip to the preview page and back.
 */
export default function App() {
  const [pins, setPins] = useState<Pin[]>(() => getPage(0))
  const pageRef = useRef(0)
  const loadingRef = useRef(false)

  // Toast at top in portrait/small screens, at bottom in landscape.
  const isLandscape = useMediaQuery("(orientation: landscape)")
  const toastPosition = isLandscape ? "bottom-center" : "top-center"

  const loadMore = useCallback(() => {
    if (loadingRef.current) return
    if (pageRef.current >= MAX_PAGES - 1) return
    loadingRef.current = true
    const next = pageRef.current + 1
    setTimeout(() => {
      setPins((prev) => [...prev, ...getPage(next)])
      pageRef.current = next
      loadingRef.current = false
    }, 120)
  }, [])

  const feed: FeedContext = {
    pins,
    onLoadMore: loadMore,
    hasMore: pageRef.current < MAX_PAGES - 1,
  }

  return (
    <SoundProvider>
      <SaveFlyProvider>
        <div className="bg-background text-foreground">
          <Outlet context={feed} />
          <Toaster position={toastPosition} />
        </div>
      </SaveFlyProvider>
    </SoundProvider>
  )
}
