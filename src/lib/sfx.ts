// Centralized UI SFX service — one shared, client-only player (singleton so
// React Strict Mode / remounts never create duplicates). Pack: "soft".
import {
  createUISFX,
  type CueName,
  type PlayOptions,
  type PlayingSFX,
  type UISFXPlayer,
} from "uisfx"

export const PACK = "soft" as const
export const SOUND_PREF_KEY = "pinboard.sound"

export type SoundPref = { enabled: boolean; volume: number; keyboard: boolean }
const DEFAULT_PREF: SoundPref = { enabled: true, volume: 0.7, keyboard: false }

/** Semantic action → cue map. Cues describe what happened, not the control. */
export const CUES = {
  save: "success",
  unsave: "toggle-off",
  share: "copy",
  visit: "open",
  hide: "blocked",
  download: "success",
  report: "info",
  navSelect: "select",
  drawerOpen: "open",
  drawerClose: "close",
  soundOn: "toggle-on",
  hover: "hover",
  typing: "typing",
} as const satisfies Record<string, CueName>

export function loadPref(): SoundPref {
  if (typeof window === "undefined") return DEFAULT_PREF
  try {
    const raw = window.localStorage.getItem(SOUND_PREF_KEY)
    if (!raw) return DEFAULT_PREF
    const p = JSON.parse(raw) as Partial<SoundPref>
    return {
      enabled: typeof p.enabled === "boolean" ? p.enabled : DEFAULT_PREF.enabled,
      volume:
        typeof p.volume === "number"
          ? Math.min(1, Math.max(0, p.volume))
          : DEFAULT_PREF.volume,
      keyboard: typeof p.keyboard === "boolean" ? p.keyboard : DEFAULT_PREF.keyboard,
    }
  } catch {
    return DEFAULT_PREF
  }
}

export function savePref(pref: SoundPref): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(SOUND_PREF_KEY, JSON.stringify(pref))
  } catch {
    /* storage unavailable — sound still works for the session */
  }
}

let player: UISFXPlayer | null = null
let unlocked = false
const loops = new Map<string, PlayingSFX>()

/** The shared player. Returns null during SSR — never instantiate on the server. */
export function getSFX(): UISFXPlayer | null {
  if (typeof window === "undefined") return null
  if (!player) {
    const pref = loadPref()
    player = createUISFX({ pack: PACK, volume: pref.volume, enabled: pref.enabled })
  }
  return player
}

export function isSFXUnlocked(): boolean {
  return unlocked
}

/** Resume Web Audio from a genuine user gesture. Safe to call repeatedly. */
export async function unlockSFX(): Promise<void> {
  const p = getSFX()
  if (!p || unlocked) return
  try {
    unlocked = await p.unlock()
  } catch {
    unlocked = false
  }
}

/**
 * One-shot cue. Returns null when muted / not unlocked / on cooldown — which
 * is exactly how background & async cues stay suppressed until a real gesture.
 */
export function playCue(cue: CueName, options?: PlayOptions): PlayingSFX | null {
  const p = getSFX()
  if (!p) return null
  return p.play(cue, options) ?? null
}

/* ---- Loops: idempotent start, always-stoppable, handle-retained ---- */

export function startLoop(key: string, cue: CueName): void {
  const p = getSFX()
  if (!p) return
  if (loops.has(key)) return // idempotent — never stack the same visible process
  const handle = p.play(cue, { loop: true })
  if (handle) loops.set(key, handle)
}

export function stopLoop(key: string): void {
  const handle = loops.get(key)
  if (handle) {
    handle.stop()
    loops.delete(key)
  }
}

export function stopAllLoops(): void {
  for (const handle of loops.values()) handle.stop()
  loops.clear()
}

export function activeLoopCount(): number {
  return loops.size
}

/* ---- Preference application ---- */

export function applyEnabled(enabled: boolean): void {
  const p = getSFX()
  if (!p) return
  if (!enabled) {
    // Silence immediately: stop retained loops, then everything, before muting.
    stopAllLoops()
    p.stopAll()
  }
  p.setEnabled(enabled)
}

export function applyVolume(volume: number): void {
  getSFX()?.setVolume(volume)
}

export function applyPack(pack: typeof PACK): void {
  getSFX()?.setPack(pack)
}

/** Dispose the app-level service (real page teardown only, not remounts). */
export async function destroySFX(): Promise<void> {
  stopAllLoops()
  const p = player
  player = null
  unlocked = false
  if (p) {
    p.stopAll()
    await p.destroy()
  }
}

/** Test-only reset of module singleton state. */
export function __resetSFXForTests(): void {
  player = null
  unlocked = false
  loops.clear()
}
