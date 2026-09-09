import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  applyEnabled,
  applyVolume,
  destroySFX,
  getSFX,
  loadPref,
  playCue,
  savePref,
  stopAllLoops,
  unlockSFX,
  type SoundPref,
} from "@/lib/sfx"

type SoundContextValue = SoundPref & {
  setEnabled: (v: boolean) => void
  setVolume: (v: number) => void
  setKeyboard: (v: boolean) => void
}

const SoundContext = createContext<SoundContextValue | null>(null)

export function useSound(): SoundContextValue {
  const ctx = useContext(SoundContext)
  if (!ctx) throw new Error("useSound must be used within <SoundProvider>")
  return ctx
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState<SoundPref>(() => loadPref())

  useEffect(() => {
    // Instantiate the shared player once (client-only, singleton).
    getSFX()

    // Prime Web Audio unlock from the first genuine user gesture. Never autoplay.
    const onGesture = () => {
      void unlockSFX()
    }
    window.addEventListener("pointerdown", onGesture, { once: true, capture: true })
    window.addEventListener("keydown", onGesture, { once: true, capture: true })

    // Dispose only on real page teardown (not bfcache, not Strict Mode remounts).
    const onPageHide = (e: PageTransitionEvent) => {
      if (!e.persisted) void destroySFX()
    }
    window.addEventListener("pagehide", onPageHide)

    return () => {
      window.removeEventListener("pointerdown", onGesture, { capture: true })
      window.removeEventListener("keydown", onGesture, { capture: true })
      window.removeEventListener("pagehide", onPageHide)
      // Silence loops if this provider unmounts, but keep the singleton alive
      // so a Strict Mode remount does not recreate/destroy the player.
      stopAllLoops()
    }
  }, [])

  const setEnabled = useCallback((v: boolean) => {
    setPref((prev) => {
      const next = { ...prev, enabled: v }
      savePref(next)
      return next
    })
    applyEnabled(v)
    // Audible confirmation only when turning ON (the toggle click is a gesture).
    if (v) playCue("toggle-on")
  }, [])

  const setVolume = useCallback((v: number) => {
    setPref((prev) => {
      const next = { ...prev, volume: v }
      savePref(next)
      return next
    })
    applyVolume(v)
  }, [])

  const setKeyboard = useCallback((v: boolean) => {
    setPref((prev) => {
      const next = { ...prev, keyboard: v }
      savePref(next)
      return next
    })
  }, [])

  const value = useMemo<SoundContextValue>(
    () => ({ ...pref, setEnabled, setVolume, setKeyboard }),
    [pref, setEnabled, setVolume, setKeyboard],
  )

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
}
