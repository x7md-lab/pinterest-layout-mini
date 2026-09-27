import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Link, useViewTransitionState } from "react-router"
import { Search, Share, ArrowUpRight, FolderOpen, X } from "lucide-react"
import { toast } from "sonner"
import type { Media, Pin } from "@/data"
import { badgeFor } from "@/lib/folder"
import { cn } from "@/lib/utils"
import type { Rect } from "@/lib/taffy"
import { useContainerWidth, useMasonry } from "@/hooks/useMasonry"
import { useCanHover } from "@/hooks/useMediaQuery"
import { Sidebar, BottomBar } from "@/components/Nav"
import { MoreActions } from "@/components/MoreActions"
import { useSaveFly } from "@/components/SaveFly"
import type { FeedContext } from "@/routes/feed"
import { SoundControl } from "@/components/SoundControl"
import { useSound } from "@/components/SoundProvider"
import { playCue, CUES } from "@/lib/sfx"

// Survives unmount so returning from a pin preview lands mid-feed, not at top.
// Written on scroll rather than in an unmount cleanup: passive cleanups run
// after the node is detached, where scrollTop always reads 0.
let lastScrollTop = 0

const GUTTER = 16
const FOOTER = 40 // slim caption-free footer holding the "more actions" dots
const OVERSCAN = 1.25 // screens of buffer above & below the viewport

function targetColWidthFor(width: number) {
  if (width < 500) return Math.floor((width - GUTTER) / 2) // 2 cols on phones
  if (width < 800) return 220
  return 236
}

/**
 * A folder file inside a card. Cover-fit: the cell already has the file's own
 * ratio, so this only crops what TALL_CAP cut off. Video shows its first frame
 * (the #t fragment makes Safari paint one) and plays muted while hovered.
 */
function CardMedia({ media, alt, playing }: { media: Media; alt: string; playing: boolean }) {
  const [loaded, setLoaded] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  // Driven by the card, not the <video>'s own mouse events: the stretched
  // link and the overlay sit on top of it and take every hover.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (playing) v.play().catch(() => {})
    else v.pause()
  }, [playing])
  const cls = cn(
    "absolute inset-0 size-full object-cover transition-opacity duration-300",
    loaded ? "opacity-100" : "opacity-0",
  )
  if (media.kind === "video") {
    return (
      <video
        ref={videoRef}
        src={`${media.url}#t=0.1`}
        muted
        loop
        playsInline
        preload="metadata"
        className={cls}
        onLoadedData={() => setLoaded(true)}
      />
    )
  }
  return (
    <img
      src={media.url}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cls}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
    />
  )
}

/**
 * One pin, matched 1:1 to a real Pinterest cell:
 * - image with an 8px radius and a Save button that appears top-right on hover,
 *   plus a board pill (top-left) and share/visit round buttons (bottom) on hover;
 * - a slim caption-free footer below the image whose bottom-right holds the
 *   always-visible "More actions" (three dots), like data-test-id=more-actions-button.
 * The overlay is mounted only when `canHover`; on touch those same actions are
 * reachable from the footer drawer and the preview page.
 * Memoized so scrolling only re-renders items whose rect changed.
 */
const PinCard = memo(function PinCard({
  pin,
  rect,
  footerHeight,
  canHover,
}: {
  pin: Pin
  rect: Rect
  footerHeight: number
  canHover: boolean
}) {
  const [saved, setSaved] = useState(false)
  const imgRef = useRef<HTMLDivElement | null>(null)
  const to = `/pin/${pin.id}`
  // True on both legs: useViewTransitionState matches the transition's current
  // location as well as its next one, so this card claims the name heading out
  // to the pin and heading back from it. Only the one card matching the pin
  // route ever claims it — the name must be unique per document.
  const morphing = useViewTransitionState(to)
  const fly = useSaveFly()
  const imgH = rect.h - footerHeight
  const badge = pin.media ? badgeFor(pin.media) : null
  const [hovered, setHovered] = useState(false)
  const hoverPlays = canHover && pin.media?.kind === "video"

  const doSave = useCallback(() => {
    if (!imgRef.current) return
    setSaved(true)
    playCue(CUES.save) // confirmed save
    fly({
      from: imgRef.current.getBoundingClientRect(),
      hue: pin.hue,
      title: pin.title,
      board: pin.tag,
    })
  }, [fly, pin.hue, pin.title, pin.tag])

  const toggleSave = useCallback(() => {
    if (saved) {
      setSaved(false)
      playCue(CUES.unsave)
    } else doSave()
  }, [saved, doSave])

  return (
    <div
      className="group absolute top-0 left-0"
      onMouseEnter={hoverPlays ? () => setHovered(true) : undefined}
      onMouseLeave={hoverPlays ? () => setHovered(false) : undefined}
      style={{
        width: rect.w,
        height: rect.h,
        transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
        willChange: "transform",
        contain: "layout paint style",
      }}
    >
      {/* Image */}
      <div
        ref={imgRef}
        className="relative w-full overflow-hidden rounded-[16px]"
        style={{
          height: imgH,
          viewTransitionName: morphing ? "pin-image" : undefined,
          background: `linear-gradient(150deg, oklch(0.85 0.12 ${pin.hue}), oklch(0.6 0.16 ${(pin.hue + 40) % 360}))`,
        }}
      >
        {pin.media ? (
          <CardMedia media={pin.media} alt={pin.title} playing={hovered} />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-white/25 select-none">
            {pin.id}
          </span>
        )}

        {/* The tile is a still (or a paused first frame) either way, so say
            when the file moves. Hidden on hover, where the overlay takes over. */}
        {badge && (
          <span className="pointer-events-none absolute top-2 left-2 z-[5] rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white transition-opacity group-hover:opacity-0">
            {badge}
          </span>
        )}

        {/* Stretched link to the preview. A sibling of the overlay controls,
            not their parent: buttons nested in an anchor are invalid HTML and
            trap screen readers and tab order. Sits below them in the stack, so
            the overlay's own buttons win the hit test and the rest of the tile
            still opens the preview. */}
        <Link
          to={to}
          viewTransition
          aria-label={`Preview: ${pin.title}`}
          className="absolute inset-0 z-0"
        />

        {/* Hover overlay. Rendered only for hover-capable pointers: Tailwind v4
            wraps group-hover in @media (hover:hover), so on touch it stayed at
            opacity-0 while its pointer-events-auto buttons kept hit-testing —
            invisible Save/Share/Visit targets covering the whole card. */}
        {canHover && (
          <div className="pointer-events-none absolute inset-0 z-10 bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
            {/* Board selector pill (top-left) */}
            <button className="pointer-events-auto absolute top-2 left-2 flex items-center gap-1 rounded-full bg-white/95 px-3 py-2 text-sm font-semibold text-neutral-900 shadow-sm">
              {pin.tag}
              <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
                <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" />
              </svg>
            </button>
            {/* Save (top-right) */}
            <button
              onClick={toggleSave}
              className={
                "pointer-events-auto absolute top-2 right-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm " +
                (saved ? "bg-neutral-900" : "bg-rose-600 hover:bg-rose-700")
              }
            >
              {saved ? "Saved" : "Save"}
            </button>
            {/* Visit (bottom-left) + Share (bottom-right) */}
            <button
              aria-label="Visit"
              onClick={() => {
                toast("Opening link…")
                playCue(CUES.visit)
              }}
              className="pointer-events-auto absolute bottom-2 left-2 flex size-9 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-sm hover:bg-white"
            >
              <ArrowUpRight className="size-4" />
            </button>
            <button
              aria-label="Share"
              onClick={() => {
                toast.success("Link copied to clipboard")
                playCue(CUES.share)
              }}
              className="pointer-events-auto absolute right-2 bottom-2 flex size-9 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-sm hover:bg-white"
            >
              <Share className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Footer: avatar (left) + always-visible More actions (right), no caption */}
      <div
        className="flex items-center justify-between px-1"
        style={{ height: footerHeight }}
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
          {pin.author.slice(0, 2)}
        </span>
        <MoreActions pin={pin} saved={saved} onToggleSave={toggleSave} />
      </div>
    </div>
  )
})

export function MasonryFeed({
  pins,
  onLoadMore,
  hasMore,
  folder,
  openFolder,
  closeFolder,
}: FeedContext) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [contentRef, width] = useContainerWidth<HTMLDivElement>()
  const { keyboard: keyboardSounds } = useSound()
  const canHover = useCanHover()

  const { byId, totalHeight, ready } = useMasonry(pins, {
    containerWidth: width,
    targetColumnWidth: targetColWidthFor(width || 1),
    gutter: GUTTER,
    footerHeight: FOOTER,
  })

  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)
  const ticking = useRef(false)

  const onScroll = useCallback(() => {
    if (ticking.current) return
    ticking.current = true
    requestAnimationFrame(() => {
      const el = scrollerRef.current
      if (el) {
        setScrollTop(el.scrollTop)
        setViewportH(el.clientHeight)
        lastScrollTop = el.scrollTop
        if (
          hasMore &&
          el.scrollTop + el.clientHeight > totalHeight - el.clientHeight
        ) {
          onLoadMore()
        }
      }
      ticking.current = false
    })
  }, [hasMore, onLoadMore, totalHeight])

  useEffect(() => {
    const el = scrollerRef.current
    if (el) setViewportH(el.clientHeight)
  }, [])

  // Come back from the preview page at the same place in the feed. Waits for
  // Taffy to report a height — the scroller can't be scrolled while it's 0.
  // Assigning scrollTop fires a real scroll event, so onScroll picks up the
  // virtualization state on its own; no setState needed here.
  // Layout effect, not passive: this has to land before paint, so a returning
  // view transition captures the card at its restored position rather than
  // mid-jump from the top of the feed.
  const restored = useRef(false)
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el || restored.current || !ready || totalHeight <= 0) return
    restored.current = true
    if (lastScrollTop > 0) el.scrollTop = lastScrollTop
  }, [ready, totalHeight])

  // A different source is a different feed: start it from the top. Skips the
  // first run so a remount (back from a preview) keeps its restored position.
  const prevFolder = useRef(folder)
  useLayoutEffect(() => {
    if (prevFolder.current === folder) return
    prevFolder.current = folder
    lastScrollTop = 0
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0
  }, [folder])

  const top = scrollTop - viewportH * OVERSCAN
  const bottom = scrollTop + viewportH * (1 + OVERSCAN)

  const visible = ready
    ? pins.filter((p) => {
        const r = byId.get(p.id)
        return r && r.y + r.h > top && r.y < bottom
      })
    : []

  return (
    <>
      <Sidebar />
      <BottomBar />
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="h-dvh overflow-x-hidden overflow-y-auto overscroll-contain lg:pl-20"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 px-4 py-2.5 backdrop-blur">
          <span className="font-semibold lg:hidden">
            <span className="text-rose-500">●</span> Pinboard
          </span>
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search"
              onInput={() => {
                if (keyboardSounds)
                  playCue(CUES.typing, { volume: 0.35, retrigger: "overlap" })
              }}
              className="h-9 w-full rounded-full bg-muted/60 pr-4 pl-9 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:block">
            {folder ? `${folder} · ${pins.length} files` : `${pins.length} pins`}
          </span>
          {folder ? (
            <button
              onClick={closeFolder}
              aria-label="Close folder"
              title="Back to the generated feed"
              className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
            >
              <X className="size-5" />
            </button>
          ) : (
            <button
              onClick={openFolder}
              aria-label="Open folder"
              title="Show a local folder's images and videos"
              className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
            >
              <FolderOpen className="size-5" />
            </button>
          )}
          <SoundControl />
        </header>

        <div ref={contentRef} className="mx-auto max-w-7xl px-4 pt-4 pb-24">
          <div className="relative w-full" style={{ height: totalHeight }}>
            {visible.map((pin) => (
              <PinCard
                key={pin.id}
                pin={pin}
                rect={byId.get(pin.id)!}
                footerHeight={FOOTER}
                canHover={canHover}
              />
            ))}
          </div>
          {!ready && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Loading Taffy layout engine…
            </p>
          )}
        </div>

        {/* Extra clearance for the fixed bottom bar on mobile/tablet. */}
        <div className="h-16 lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
      </div>
    </>
  )
}
