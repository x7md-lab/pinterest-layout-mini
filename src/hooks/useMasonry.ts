import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import type { Pin } from "@/data"
import { ensureTaffy, isTaffyReady, layoutMasonry, type MasonryResult } from "@/lib/taffy"

export type UseMasonry = MasonryResult & {
  columns: number
  columnWidth: number
  ready: boolean
}

// Last observed width, kept across mounts. The ResizeObserver only reports
// after the element exists, so a remounting feed would measure 0 on its first
// render and lay nothing out; seeding from the previous mount avoids that
// empty frame. Self-correcting — the observer overwrites it immediately.
let lastWidth = 0

/** Observe an element's content-box width. */
export function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(lastWidth)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      lastWidth = w
      setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev))
    })
    ro.observe(el)
    lastWidth = el.clientWidth
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * DOM-measure the footer once (title + author row) by rendering an offscreen
 * probe. Keeps per-item layout cheap while still measuring real DOM.
 */
export function useMeasuredFooter(probeRef: RefObject<HTMLElement | null>) {
  const [footer, setFooter] = useState(64)
  useEffect(() => {
    const el = probeRef.current
    if (!el) return
    const h = Math.ceil(el.getBoundingClientRect().height)
    if (h > 0) setFooter(h)
  }, [probeRef])
  return footer
}

export function useMasonry(
  pins: Pin[],
  opts: {
    containerWidth: number
    targetColumnWidth: number
    gutter: number
    footerHeight: number
  },
): UseMasonry {
  const { containerWidth, targetColumnWidth, gutter, footerHeight } = opts

  // Start ready if the engine is already loaded, so a remount (route change
  // back to the feed) lays out on the first render rather than a tick later.
  const [ready, setReady] = useState(isTaffyReady)
  useEffect(() => {
    let alive = true
    ensureTaffy().then(() => {
      if (alive) setReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const columns = Math.max(
    1,
    Math.floor((containerWidth + gutter) / (targetColumnWidth + gutter)),
  )
  const columnWidth =
    columns > 0
      ? Math.floor((containerWidth - (columns - 1) * gutter) / columns)
      : 0

  const layout = useMemo<MasonryResult>(() => {
    if (!ready || containerWidth <= 0 || columnWidth <= 0) {
      return { rects: [], byId: new Map(), totalHeight: 0, totalWidth: 0 }
    }
    const items = pins.map((p) => ({
      id: p.id,
      height: Math.round(columnWidth / p.aspect) + footerHeight,
    }))
    return layoutMasonry({ items, columns, columnWidth, gutter })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pins, columns, columnWidth, gutter, footerHeight])

  return { ...layout, columns, columnWidth, ready }
}
