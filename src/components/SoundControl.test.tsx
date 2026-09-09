import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

const player = {
  unlock: vi.fn().mockResolvedValue(true),
  play: vi.fn(() => ({ stop: vi.fn(), ended: Promise.resolve() })),
  setEnabled: vi.fn(),
  setVolume: vi.fn(),
  setPack: vi.fn(),
  stopAll: vi.fn(),
  destroy: vi.fn().mockResolvedValue(undefined),
}
vi.mock("uisfx", () => ({ createUISFX: () => player }))

import * as sfx from "@/lib/sfx"
import { SoundProvider } from "@/components/SoundProvider"
import { SoundControl } from "@/components/SoundControl"

function renderControl() {
  return render(
    <SoundProvider>
      <SoundControl />
    </SoundProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  sfx.__resetSFXForTests()
  Object.values(player).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockClear())
})
afterEach(() => sfx.__resetSFXForTests())

describe("SoundControl", () => {
  it("exposes an accessible, labeled toggle reflecting enabled state", () => {
    renderControl()
    const btn = screen.getByRole("button", { name: /sound/i })
    expect(btn.getAttribute("aria-pressed")).toBe("true")
  })

  it("mutes immediately and persists when toggled off", () => {
    renderControl()
    const btn = screen.getByRole("button", { name: /sound/i })
    // open the popover, flip the "Interface sounds" checkbox off
    fireEvent.click(btn)
    const checkbox = screen.getByRole("checkbox", { name: /interface sounds/i })
    fireEvent.click(checkbox)

    expect(player.setEnabled).toHaveBeenCalledWith(false)
    expect(player.stopAll).toHaveBeenCalled() // immediate silence
    expect(sfx.loadPref().enabled).toBe(false) // persisted
  })

  it("plays a confirmation only when turning sound ON", () => {
    localStorage.setItem(
      sfx.SOUND_PREF_KEY,
      JSON.stringify({ enabled: false, volume: 0.7, keyboard: false }),
    )
    renderControl()
    const btn = screen.getByRole("button", { name: /sound/i })
    fireEvent.click(btn)
    const checkbox = screen.getByRole("checkbox", { name: /interface sounds/i })
    player.play.mockClear()
    fireEvent.click(checkbox) // turn ON
    expect(player.setEnabled).toHaveBeenCalledWith(true)
    expect(player.play).toHaveBeenCalledWith("toggle-on", undefined)
  })

  it("persists volume changes", () => {
    renderControl()
    fireEvent.click(screen.getByRole("button", { name: /sound/i }))
    const slider = screen.getByRole("slider", { name: /volume/i })
    fireEvent.change(slider, { target: { value: "0.4" } })
    expect(player.setVolume).toHaveBeenCalledWith(0.4)
    expect(sfx.loadPref().volume).toBeCloseTo(0.4)
  })
})
