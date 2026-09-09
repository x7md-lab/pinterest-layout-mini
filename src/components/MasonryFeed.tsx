import { memo, useCallback, useEffect, useRef, useState } from "react"
import { Link, useViewTransitionState } from "react-router"
import { Search, Share, ArrowUpRight } from "lucide-react"
import { toast } from "sonner"
import type { Pin } from "@/data"
import type { Rect } from "@/lib/taffy"
import { useContainerWidth, useMasonry } from "@/hooks/useMasonry"
import { useCanHover } from "@/hooks/useMediaQuery"
import { Sidebar, BottomBar } from "@/components/Nav"
import { MoreActions } from "@/components/MoreActions"
import { useSaveFly } from "@/components/SaveFly"
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
  const imgRef = useRef<HTMLAnchorElement | null>(null)
  const to = `/pin/${pin.id}`
  // Only the card being navigated to may carry the name: view-transition-name
  // has to be unique across the document while a transition is running.
  const morphing = useViewTransitionState(to)
  const fly = useSaveFly()
  const imgH = rect.h - footerHeight

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
      style={{
        width: rect.w,
        height: rect.h,
        transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
        willChange: "transform",
        contain: "layout paint style",
      }}
    >
      {/* Image — opens the preview page. */}
      <Link
        to={to}
        viewTransition
        ref={imgRef}
        aria-label={`Preview: ${pin.title}`}
        className="relative block w-full overflow-hidden rounded-[16px]"
        style={{
          height: imgH,
          viewTransitionName: morphing ? "pin-image" : undefined,
          background: `linear-gradient(150deg, oklch(0.85 0.12 ${pin.hue}), oklch(0.6 0.16 ${(pin.hue + 40) % 360}))`,
        }}
      >
        <span className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-white/25 select-none">
          {pin.id}
        </span>

        {/* Hover overlay. Rendered only for hover-capable pointers: Tailwind v4
            wraps group-hover in @media (hover:hover), so on touch it stayed at
            opacity-0 while its pointer-events-auto buttons kept hit-testing —
            invisible Save/Share/Visit targets covering the whole card. */}
        {canHover && (
        <div
          onClick={(e) => e.preventDefault()}
          className="pointer-events-none absolute inset-0 bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100"
        >
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
      </Link>

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
}: {
  pins: Pin[]
  onLoadMore: () => void
  hasMore: boolean
}) {
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
  const restored = useRef(false)
  useEffect(() => {
    const el = scrollerRef.current
    if (!el || restored.current || !ready || totalHeight <= 0) return
    restored.current = true
    if (lastScrollTop > 0) el.scrollTop = lastScrollTop
  }, [ready, totalHeight])

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
          <span className="hidden text-xs text-muted-foreground sm:block">
            {pins.length} pins
          </span>
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
