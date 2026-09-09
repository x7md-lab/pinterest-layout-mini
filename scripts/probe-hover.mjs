/**
 * Regression probe for the touch/hover split and the pin preview transition.
 *
 * Needs a Chrome with remote debugging on 9222 and the app on :5199
 * (`pnpm dev --port 5199`).
 *
 * Card DOM: .group > div(tile) > [ span, a.stretched-link, div.overlay > 4 buttons ]
 *
 * Checks:
 *  1. hover-capable pointers get the 4-button overlay; coarse pointers get none
 *     (an opacity-0 overlay still hit-tests, so leaving it mounted put
 *     invisible Save/Share/Visit targets over the whole card);
 *  2. overlay buttons win the hit test over the stretched link, and the bare
 *     tile still navigates;
 *  3. navigating runs one View Transition with the name on the tile.
 */
import puppeteer from "puppeteer-core"

const URL = "http://localhost:5199/"
const CARD = 'a[aria-label^="Preview"]'

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
  await p.waitForSelector(CARD, { timeout: 15000 })
  await new Promise((r) => setTimeout(r, 800))
  return p
}

function show(label, out) {
  console.log(`\n--- ${label} ---`)
  console.log(JSON.stringify(out, null, 2))
}

/** 1 + 2: overlay presence and which element owns each corner. */
async function probeOverlay(label, opts) {
  const p = await open(opts)
  show(
    label,
    await p.evaluate((CARD) => {
      const link = document.querySelector(CARD)
      const tile = link.parentElement
      const r = tile.getBoundingClientRect()
      const spots = {
        "top-left (board pill)": [r.left + 30, r.top + 22],
        "top-right (Save)": [r.right - 30, r.top + 22],
        "bottom-left (Visit)": [r.left + 22, r.bottom - 22],
        "bottom-right (Share)": [r.right - 22, r.bottom - 22],
        "centre (bare tile)": [r.left + r.width / 2, r.top + r.height / 2],
      }
      const hitTest = {}
      for (const [k, [x, y]] of Object.entries(spots)) {
        const el = document.elementFromPoint(x, y)
        const al = el?.getAttribute("aria-label")
        hitTest[k] = el ? el.tagName.toLowerCase() + (al ? `[${al}]` : "") : "none"
      }
      return {
        matchMediaHover: matchMedia("(hover: hover) and (pointer: fine)").matches,
        overlayButtons: tile.querySelectorAll("button").length,
        buttonsNestedInAnchor: link.querySelectorAll("button").length,
        hitTest,
      }
    }, CARD),
  )
  await p.close()
}

/** 2: Save must act without navigating; the bare tile must navigate. */
async function probeOverlayClicks(label, opts) {
  const p = await open(opts)
  const saveResult = await p.evaluate((CARD) => {
    const tile = document.querySelector(CARD).parentElement
    const save = [...tile.querySelectorAll("button")].find((x) => x.textContent.trim() === "Save")
    if (!save) return { error: "no Save button" }
    save.click()
    return { urlRightAfterSaveClick: location.pathname }
  }, CARD)
  await new Promise((r) => setTimeout(r, 700))
  const afterSave = await p.evaluate((CARD) => {
    const tile = document.querySelector(CARD).parentElement
    return {
      urlAfterSaveSettled: location.pathname,
      saveButtonNowReads: [...tile.querySelectorAll("button")]
        .map((x) => x.textContent.trim())
        .find((t) => t === "Save" || t === "Saved"),
    }
  }, CARD)
  // Bare tile centre should navigate.
  await p.evaluate((CARD) => {
    const tile = document.querySelector(CARD).parentElement
    const r = tile.getBoundingClientRect()
    document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).click()
  }, CARD)
  await new Promise((r) => setTimeout(r, 1400))
  show(label, {
    ...saveResult,
    ...afterSave,
    urlAfterTileClick: await p.evaluate(() => location.pathname),
  })
  await p.close()
}

/** 3: exactly one View Transition per navigation, name applied to the tile. */
async function probeTransition(label, opts) {
  const p = await open(opts)
  await p.evaluate(() => {
    window.__vt = { started: 0, tileNames: [] }
    const real = document.startViewTransition?.bind(document)
    if (!real) return
    document.startViewTransition = (cb) => {
      window.__vt.started++
      const named = [...document.querySelectorAll('[style*="view-transition-name"]')].map(
        (el) => `${el.tagName.toLowerCase()}:${el.style.viewTransitionName}`,
      )
      window.__vt.tileNames.push(named.join(",") || "(none)")
      return real(cb)
    }
  })
  await p.evaluate((CARD) => {
    const tile = document.querySelector(CARD).parentElement
    const r = tile.getBoundingClientRect()
    document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).click()
  }, CARD)
  await new Promise((r) => setTimeout(r, 1600))
  show(
    label,
    await p.evaluate(() => ({
      supported: typeof document.startViewTransition === "function",
      startViewTransitionCalls: window.__vt.started,
      namedElementsAtTransition: window.__vt.tileNames,
      url: location.pathname,
      heroName: getComputedStyle(
        document.querySelector("h1").closest(".grid").firstElementChild,
      ).viewTransitionName,
    })),
  )
  await p.close()
}

/** Feed -> preview -> back should land at the same place in the feed. */
async function probeScrollRestore(label, opts) {
  const p = await open(opts)
  const sel = "[class*='overflow-y-auto']"
  await p.evaluate((s) => document.querySelector(s).scrollTo(0, 1400), sel)
  await new Promise((r) => setTimeout(r, 900))
  const before = await p.evaluate((s) => document.querySelector(s).scrollTop, sel)
  await p.evaluate((CARD) => document.querySelector(CARD).click(), CARD)
  await new Promise((r) => setTimeout(r, 1400))
  const at = await p.evaluate(() => location.pathname)
  await p.evaluate(() => history.back())
  await new Promise((r) => setTimeout(r, 2500))
  const after = await p.evaluate((s) => document.querySelector(s)?.scrollTop ?? -1, sel)
  show(label, { before: Math.round(before), preview: at, afterBack: Math.round(after) })
  await p.close()
}

const DESKTOP = { width: 1440, height: 900, hover: "hover", pointer: "fine", hasTouch: false }
const MOBILE = { width: 390, height: 844, hover: "none", pointer: "coarse", hasTouch: true }

await probeOverlay("DESKTOP (hover:hover, pointer:fine)", DESKTOP)
await probeOverlay("MOBILE (hover:none, pointer:coarse)", MOBILE)
await probeOverlayClicks("OVERLAY CLICKS on desktop", DESKTOP)
await probeTransition("VIEW TRANSITION on desktop", DESKTOP)
await probeTransition("VIEW TRANSITION on mobile", MOBILE)
await probeScrollRestore("SCROLL RESTORE on mobile", MOBILE)

await b.disconnect()
