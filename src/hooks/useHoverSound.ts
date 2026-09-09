import { useHover } from "@use-gesture/react"
import { playCue } from "@/lib/sfx"

/** True only for a fine, hover-capable pointer (mouse/trackpad) — never touch. */
function canHover(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches
}

/**
 * Pointer-type-aware hover cue via @use-gesture/react. Plays the brief `hover`
 * cue only on a fine pointer (mouse/pen), never on touch, and throttled with a
 * cooldown so moving across sparse controls doesn't machine-gun. Returns the
 * gesture `bind` — spread `{...bind()}` onto a sparse, important control only.
 */
export function useHoverSound() {
  return useHover(({ active, event }) => {
    if (!active) return
    const pointerType = (event as PointerEvent).pointerType
    if (pointerType && pointerType !== "mouse" && pointerType !== "pen") return
    if (!canHover()) return
    playCue("hover", { volume: 0.4, cooldownMs: 300, retrigger: "ignore" })
  })
}
