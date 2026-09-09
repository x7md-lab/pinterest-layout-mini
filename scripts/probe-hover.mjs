/**
 * Regression probe for the touch/hover split and the pin preview transition.
 *
 * Needs a Chrome with remote debugging on 9222 and the app on :5199
 * (`pnpm dev --port 5199`).
 *
 * Checks:
 *  1. hover-capable pointers still get the 4-button overlay on a card;
 *  2. coarse pointers get NO overlay — an opacity-0 overlay still hit-tests,
 *     so leaving it mounted put invisible Save/Share/Visit targets over the card;
 *  3. tapping a card routes to /pin/:id through a View Transition.
 */
import puppeteer from "puppeteer-core"

const URL = "http://localhost:5199/"
const b = await puppeteer.connect({
  browserURL: "http://127.0.0.1:9222",
  defaultViewport: null,
  protocolTimeout: 20000,
})

async function open({ width, height, hover, pointer, hasTouch }) {
  const p = await b.newPage()
  await p.setViewport({ width, height, hasTouch, isMobile: hasTouch })
  // Puppeteer's emulateMediaFeatures allowlist has no hover/pointer, so go
  // straight to CDP.
  const cdp = await p.createCDPSession()
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [
      { name: "hover", value: hover },
      { name: "pointer", value: pointer },
      { name: "any-hover", value: hover },
      { name: "any-pointer", value: pointer },
    ],
  })
  await p.goto(URL, { waitUntil: "networkidle2" })
  // Taffy's wasm resolves the layout after load, so wait for real cards.
  await p.waitForSelector('a[aria-label^="Preview"]', { timeout: 15000 })
  await new Promise((r) => setTimeout(r, 600))
  return p
}

async function probeOverlay(label, opts) {
  const p = await open(opts)
  const out = await p.evaluate(() => {
    const card = document.querySelector('a[aria-label^="Preview"]')
    if (!card) return { error: "no pin card found" }
    const r = card.getBoundingClientRect()
    const spots = {
      "top-left (board pill)": [r.left + 30, r.top + 22],
      "top-right (Save)": [r.right - 30, r.top + 22],
      "bottom-left (Visit)": [r.left + 22, r.bottom - 22],
      "bottom-right (Share)": [r.right - 22, r.bottom - 22],
    }
    const hitTest = {}
    for (const [k, [x, y]] of Object.entries(spots)) {
      const el = document.elementFromPoint(x, y)
      const label = el?.getAttribute("aria-label")
      hitTest[k] = el ? el.tagName.toLowerCase() + (label ? `[${label}]` : "") : "none"
    }
    return {
      matchMediaHover: matchMedia("(hover: hover) and (pointer: fine)").matches,
      overlayButtonsInsideCard: card.querySelectorAll("button").length,
      hitTest,
    }
  })
  console.log(`\n--- ${label} ---`)
  console.log(JSON.stringify(out, null, 2))
  await p.close()
}

async function probeTransition(label, opts) {
  const p = await open(opts)
  await p.evaluate(() => {
    window.__vt = { started: 0, names: [] }
    const real = document.startViewTransition?.bind(document)
    if (!real) return
    document.startViewTransition = (cb) => {
      window.__vt.started++
      const named = document.querySelector('a[aria-label^="Preview"][style*="view-transition-name"]')
      window.__vt.names.push(named?.style.viewTransitionName ?? "(none on card)")
      return real(cb)
    }
  })
  await p.evaluate(() => document.querySelector('a[aria-label^="Preview"]').click())
  await new Promise((r) => setTimeout(r, 1500))
  const out = await p.evaluate(() => ({
    supported: typeof document.startViewTransition === "function",
    startViewTransitionCalls: window.__vt.started,
    cardNameAtTransition: window.__vt.names,
    url: location.pathname,
    heroName: getComputedStyle(document.querySelector("h1").closest(".grid").firstElementChild)
      .viewTransitionName,
  }))
  console.log(`\n--- ${label} ---`)
  console.log(JSON.stringify(out, null, 2))
  await p.close()
}

/** Feed -> preview -> back should land at the same place in the feed. */
async function probeScrollRestore(label, opts) {
  const p = await open(opts)
  const sel = "[class*='overflow-y-auto']"
  await p.evaluate((s) => document.querySelector(s).scrollTo(0, 1400), sel)
  await new Promise((r) => setTimeout(r, 900))
  const before = await p.evaluate((s) => document.querySelector(s).scrollTop, sel)
  await p.evaluate(() => document.querySelector('a[aria-label^="Preview"]').click())
  await new Promise((r) => setTimeout(r, 1400))
  const at = await p.evaluate(() => location.pathname)
  await p.evaluate(() => history.back())
  await new Promise((r) => setTimeout(r, 2500))
  const after = await p.evaluate((s) => document.querySelector(s)?.scrollTop ?? -1, sel)
  console.log(`\n--- ${label} ---`)
  console.log(JSON.stringify({ before: Math.round(before), preview: at, afterBack: Math.round(after) }, null, 2))
  await p.close()
}

const DESKTOP = { width: 1440, height: 900, hover: "hover", pointer: "fine", hasTouch: false }
const MOBILE = { width: 390, height: 844, hover: "none", pointer: "coarse", hasTouch: true }

await probeOverlay("DESKTOP (hover:hover, pointer:fine)", DESKTOP)
await probeOverlay("MOBILE (hover:none, pointer:coarse)", MOBILE)
await probeTransition("VIEW TRANSITION on desktop", DESKTOP)
await probeTransition("VIEW TRANSITION on mobile", MOBILE)
await probeScrollRestore("SCROLL RESTORE on mobile", MOBILE)

await b.disconnect()
