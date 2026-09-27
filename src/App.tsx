import { useCallback, useEffect, useRef, useState } from "react"
import { Outlet } from "react-router"
import { toast } from "sonner"
import { getPage, type Pin } from "@/data"
import type { FeedContext } from "@/routes/feed"
import { Toaster } from "@/components/ui/sonner"
import { SaveFlyProvider } from "@/components/SaveFly"
import { SoundProvider } from "@/components/SoundProvider"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { folderToPins, pickFolder, revokePins } from "@/lib/folder"

const MAX_PAGES = 12 // cap the demo feed

/**
 * Root layout. Owns the feed state so pages already loaded (and the scroll
 * position) survive a trip to the preview page and back.
 */
export default function App() {
  const [pins, setPins] = useState<Pin[]>(() => getPage(0))
  const [folder, setFolder] = useState<string | null>(null)
  const pageRef = useRef(0)
  const loadingRef = useRef(false)

  // Toast at top in portrait/small screens, at bottom in landscape.
  const isLandscape = useMediaQuery("(orientation: landscape)")
  const toastPosition = isLandscape ? "bottom-center" : "top-center"

  const loadMore = useCallback(() => {
    if (folder) return // a folder is loaded whole; the feed virtualizes it
    if (loadingRef.current) return
    if (pageRef.current >= MAX_PAGES - 1) return
    loadingRef.current = true
    const next = pageRef.current + 1
    setTimeout(() => {
      setPins((prev) => [...prev, ...getPage(next)])
      pageRef.current = next
      loadingRef.current = false
    }, 120)
  }, [folder])

  // Object URLs pin their Files in memory until revoked.
  const pinsRef = useRef(pins)
  useEffect(() => {
    pinsRef.current = pins
  }, [pins])
  useEffect(() => () => revokePins(pinsRef.current), [])

  const openFolder = useCallback(async () => {
    const id = "folder-scan"
    try {
      const picked = await pickFolder()
      if (!picked) return
      toast.loading(`Reading ${picked.name}…`, { id })
      const next = await folderToPins(picked, (done, total) =>
        toast.loading(`Measuring ${done}/${total}`, { id }),
      )
      if (!next.length) {
        toast.error(`No images or videos in ${picked.name}`, { id })
        return
      }
      revokePins(pinsRef.current)
      setPins(next)
      setFolder(picked.name)
      toast.success(`${next.length} files from ${picked.name}`, { id })
    } catch (e) {
      toast.error(`Couldn't open folder: ${(e as Error).message}`, { id })
    }
  }, [])

  const closeFolder = useCallback(() => {
    revokePins(pinsRef.current)
    pageRef.current = 0
    setPins(getPage(0))
    setFolder(null)
  }, [])

  const feed: FeedContext = {
    pins,
    onLoadMore: loadMore,
    hasMore: !folder && pageRef.current < MAX_PAGES - 1,
    folder,
    openFolder,
    closeFolder,
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
