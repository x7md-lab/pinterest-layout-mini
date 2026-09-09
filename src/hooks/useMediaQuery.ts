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
