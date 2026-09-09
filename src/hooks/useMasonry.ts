import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import type { Pin } from "@/data"
import { ensureTaffy, layoutMasonry, type MasonryResult } from "@/lib/taffy"

export type UseMasonry = MasonryResult & {
  columns: number
  columnWidth: number
  ready: boolean
}

/** Observe an element's content-box width. */
export function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev))
    })
    ro.observe(el)
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

  const [ready, setReady] = useState(false)
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
