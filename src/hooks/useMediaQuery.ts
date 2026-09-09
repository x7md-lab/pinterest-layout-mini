import { useEffect, useState } from "react"

/** Size-based (not UA-based) media query hook. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])
  return matches
}

/** True below Tailwind's lg breakpoint (1024px): phones + tablets. */
export function useIsMobile() {
  return useMediaQuery("(max-width: 1023px)")
}

/**
 * True only for a fine, hover-capable pointer (mouse/trackpad) — never touch.
 * Matches the `@media (hover:hover)` guard Tailwind v4 puts around `hover:`
 * and `group-hover:`, so JS and CSS agree on what "hoverable" means. Use it to
 * skip rendering hover-only UI: an `opacity-0` overlay is still hit-testable,
 * so leaving one mounted on touch turns it into an invisible tap target.
 */
export function useCanHover() {
  return useMediaQuery("(hover: hover) and (pointer: fine)")
}
