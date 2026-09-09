import { useCallback, useRef, useState } from "react"
import { getPage, type Pin } from "@/data"
import { MasonryFeed } from "@/components/MasonryFeed"
import { Toaster } from "@/components/ui/sonner"
import { SaveFlyProvider } from "@/components/SaveFly"
import { SoundProvider } from "@/components/SoundProvider"
import { useMediaQuery } from "@/hooks/useMediaQuery"

const MAX_PAGES = 12 // cap the demo feed

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

  return (
    <SoundProvider>
      <SaveFlyProvider>
        <div className="bg-background text-foreground">
          <MasonryFeed
            pins={pins}
            onLoadMore={loadMore}
            hasMore={pageRef.current < MAX_PAGES - 1}
          />
          <Toaster position={toastPosition} />
        </div>
      </SaveFlyProvider>
    </SoundProvider>
  )
}
