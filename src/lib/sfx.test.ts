import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// A controllable fake player + spy on createUISFX.
const createUISFX = vi.fn()
let lastPlayer: FakePlayer

type Handle = { stop: ReturnType<typeof vi.fn>; ended: Promise<void> }
type FakePlayer = {
  unlock: ReturnType<typeof vi.fn>
  play: ReturnType<typeof vi.fn>
  setEnabled: ReturnType<typeof vi.fn>
  setVolume: ReturnType<typeof vi.fn>
  setPack: ReturnType<typeof vi.fn>
  stopAll: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
}

function makePlayer(): FakePlayer {
  return {
    unlock: vi.fn().mockResolvedValue(true),
    play: vi.fn(() => ({ stop: vi.fn(), ended: Promise.resolve() }) as Handle),
    setEnabled: vi.fn(),
    setVolume: vi.fn(),
    setPack: vi.fn(),
    stopAll: vi.fn(),
    destroy: vi.fn().mockResolvedValue(undefined),
  }
}

vi.mock("uisfx", () => ({
  createUISFX: (...args: unknown[]) => {
    createUISFX(...args)
    lastPlayer = makePlayer()
    return lastPlayer
  },
}))

import * as sfx from "./sfx"

beforeEach(() => {
  createUISFX.mockClear()
  localStorage.clear()
  sfx.__resetSFXForTests()
})
afterEach(() => {
  sfx.__resetSFXForTests()
})

describe("player singleton", () => {
  it("creates exactly one player across repeated getSFX() calls (Strict Mode safe)", () => {
    const a = sfx.getSFX()
    const b = sfx.getSFX()
    expect(a).toBe(b)
    expect(createUISFX).toHaveBeenCalledTimes(1)
  })

  it("passes saved enabled+volume to createUISFX", () => {
    sfx.savePref({ enabled: false, volume: 0.3, keyboard: true })
    sfx.getSFX()
    expect(createUISFX).toHaveBeenCalledWith(
      expect.objectContaining({ pack: "soft", enabled: false, volume: 0.3 }),
    )
  })
})

describe("playCue", () => {
  it("returns null when the player suppresses playback (muted/locked/cooldown)", () => {
    sfx.getSFX()
    lastPlayer.play.mockReturnValueOnce(null)
    expect(sfx.playCue("success")).toBeNull()
  })

  it("returns the handle on success", () => {
    sfx.getSFX()
    expect(sfx.playCue("success")).not.toBeNull()
  })
})

describe("loops", () => {
  it("startLoop is idempotent per key", () => {
    sfx.getSFX()
    sfx.startLoop("proc", "processing")
    sfx.startLoop("proc", "processing")
    expect(lastPlayer.play).toHaveBeenCalledTimes(1)
    expect(lastPlayer.play).toHaveBeenCalledWith("processing", { loop: true })
    expect(sfx.activeLoopCount()).toBe(1)
  })

  it("stopLoop stops and clears the retained handle", () => {
    sfx.getSFX()
    const handle = { stop: vi.fn(), ended: Promise.resolve() }
    lastPlayer.play.mockReturnValueOnce(handle)
    sfx.startLoop("proc", "processing")
    sfx.stopLoop("proc")
    expect(handle.stop).toHaveBeenCalledTimes(1)
    expect(sfx.activeLoopCount()).toBe(0)
  })

  it("stopAllLoops stops every active loop", () => {
    sfx.getSFX()
    const h1 = { stop: vi.fn(), ended: Promise.resolve() }
    const h2 = { stop: vi.fn(), ended: Promise.resolve() }
    lastPlayer.play.mockReturnValueOnce(h1).mockReturnValueOnce(h2)
    sfx.startLoop("a", "loading")
    sfx.startLoop("b", "scanning")
    sfx.stopAllLoops()
    expect(h1.stop).toHaveBeenCalled()
    expect(h2.stop).toHaveBeenCalled()
    expect(sfx.activeLoopCount()).toBe(0)
  })
})

describe("mute", () => {
  it("applyEnabled(false) stops everything BEFORE disabling (immediate silence)", () => {
    sfx.getSFX()
    sfx.startLoop("proc", "processing")
    sfx.applyEnabled(false)
    expect(lastPlayer.stopAll).toHaveBeenCalled()
    expect(lastPlayer.setEnabled).toHaveBeenCalledWith(false)
    // ordering: stopAll invoked before setEnabled
    const stopOrder = lastPlayer.stopAll.mock.invocationCallOrder[0]
    const disableOrder = lastPlayer.setEnabled.mock.invocationCallOrder[0]
    expect(stopOrder).toBeLessThan(disableOrder)
    expect(sfx.activeLoopCount()).toBe(0)
  })

  it("applyEnabled(true) does not stopAll", () => {
    sfx.getSFX()
    sfx.applyEnabled(true)
    expect(lastPlayer.setEnabled).toHaveBeenCalledWith(true)
    expect(lastPlayer.stopAll).not.toHaveBeenCalled()
  })
})

describe("preferences", () => {
  it("round-trips enabled/volume/keyboard through localStorage", () => {
    sfx.savePref({ enabled: false, volume: 0.2, keyboard: true })
    expect(sfx.loadPref()).toEqual({ enabled: false, volume: 0.2, keyboard: true })
  })

  it("falls back to defaults on missing/corrupt storage", () => {
    localStorage.setItem(sfx.SOUND_PREF_KEY, "{not json")
    expect(sfx.loadPref()).toEqual({ enabled: true, volume: 0.7, keyboard: false })
  })
})

describe("destroy", () => {
  it("stops loops and destroys the player, then recreates lazily", async () => {
    sfx.getSFX()
    sfx.startLoop("proc", "processing")
    const first = lastPlayer
    await sfx.destroySFX()
    expect(first.stopAll).toHaveBeenCalled()
    expect(first.destroy).toHaveBeenCalled()
    expect(sfx.activeLoopCount()).toBe(0)
    // next access creates a fresh player
    sfx.getSFX()
    expect(createUISFX).toHaveBeenCalledTimes(2)
  })
})

describe("cue map", () => {
  it("maps actions to semantic cues", () => {
    expect(sfx.CUES.save).toBe("success")
    expect(sfx.CUES.unsave).toBe("toggle-off")
    expect(sfx.CUES.share).toBe("copy")
    expect(sfx.CUES.visit).toBe("open")
    expect(sfx.CUES.navSelect).toBe("select")
    expect(sfx.CUES.drawerOpen).toBe("open")
    expect(sfx.CUES.drawerClose).toBe("close")
    expect(sfx.CUES.typing).toBe("typing")
  })
})
