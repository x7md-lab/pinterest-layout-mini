// Reverse-engineer Pinterest's "Save" animation:
//   1. CDP Animation domain  -> real keyframes, duration, easing, target
//   2. MutationObserver diff -> which nodes/classes/styles change, when
//   3. CDP screencast frames -> the floating-image animation over time
import { mkdirSync, writeFileSync } from "node:fs"
import puppeteer from "puppeteer-core"

const PORT = process.env.CHROME_DEBUG_PORT ?? "9222"
const OUT = "shots/save-anim"
mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.connect({
  browserURL: `http://127.0.0.1:${PORT}`,
  defaultViewport: null,
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
await page.goto("https://www.pinterest.com/", { waitUntil: "domcontentloaded" })
await new Promise((r) => setTimeout(r, 6000))

const client = await page.createCDPSession()

// --- 1. Animation domain -----------------------------------------------------
const animations = []
await client.send("Animation.enable")
client.on("Animation.animationStarted", ({ animation }) => {
  const kf = animation.source?.keyframesRule?.keyframes?.map((k) => ({
    offset: k.offset,
    easing: k.easing,
  }))
  animations.push({
    t: Date.now(),
    type: animation.type,
    name: animation.name || null,
    duration: animation.source?.duration,
    delay: animation.source?.delay,
    easing: animation.source?.easing,
    iterations: animation.source?.iterations,
    keyframes: kf,
  })
})

// --- 2. MutationObserver in the page ----------------------------------------
await page.evaluate(() => {
  window.__mut = []
  const t0 = performance.now()
  const desc = (n) =>
    n.nodeType === 1
      ? `${n.tagName.toLowerCase()}${n.className && typeof n.className === "string" ? "." + n.className.split(/\s+/).slice(0, 2).join(".") : ""}${n.getAttribute?.("data-test-id") ? `[${n.getAttribute("data-test-id")}]` : ""}`
      : `#${n.nodeName}`
  const obs = new MutationObserver((muts) => {
    const now = Math.round(performance.now() - t0)
    for (const m of muts) {
      if (m.type === "childList") {
        m.addedNodes.forEach((n) =>
          window.__mut.push({ t: now, op: "add", node: desc(n) }),
        )
        m.removedNodes.forEach((n) =>
          window.__mut.push({ t: now, op: "remove", node: desc(n) }),
        )
      } else if (m.type === "attributes") {
        const el = m.target
        window.__mut.push({
          t: now,
          op: "attr",
          node: desc(el),
          attr: m.attributeName,
          value: (el.getAttribute(m.attributeName) || "").slice(0, 80),
        })
      }
    }
  })
  obs.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["style", "class", "transform"],
  })
  window.__stopObs = () => obs.disconnect()
})

// --- 3. Screencast -----------------------------------------------------------
const frames = []
client.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  frames.push({ t: metadata.timestamp, data })
  try {
    await client.send("Page.screencastFrameAck", { sessionId })
  } catch {}
})

// Reveal + click the Save button.
const pin = await page.$('[data-test-id="pin"]')
if (pin) await pin.hover()
await new Promise((r) => setTimeout(r, 700))

await client.send("Page.startScreencast", {
  format: "jpeg",
  quality: 70,
  everyNthFrame: 1,
})

const clickInfo = await page.evaluate(() => {
  const pin = document.querySelector('[data-test-id="pin"]')
  const btn =
    pin?.querySelector('[data-test-id="pinrep-save-button"]') ||
    [...(pin?.querySelectorAll("button") || [])].find(
      (b) => (b.textContent || "").trim() === "Save",
    )
  if (!btn) return { clicked: false }
  const r = btn.getBoundingClientRect()
  btn.click()
  return { clicked: true, x: Math.round(r.x), y: Math.round(r.y) }
})

const ANIM_WAIT = Number(process.env.SHOT_ANIM_WAIT ?? 10000)
await new Promise((r) => setTimeout(r, ANIM_WAIT))
await client.send("Page.stopScreencast")
await page.evaluate(() => window.__stopObs?.())

const mutations = await page.evaluate(() => window.__mut)

// Persist frames + a report.
const t0 = frames.length ? frames[0].t : 0
frames.forEach((f, i) => {
  const ms = Math.round((f.t - t0) * 1000)
  writeFileSync(
    `${OUT}/frame-${String(i).padStart(3, "0")}-${ms}ms.jpg`,
    Buffer.from(f.data, "base64"),
  )
})
writeFileSync(
  `${OUT}/report.json`,
  JSON.stringify(
    { clickInfo, frameCount: frames.length, animations, mutations },
    null,
    2,
  ),
)

console.log(
  JSON.stringify(
    {
      clicked: clickInfo.clicked,
      frames: frames.length,
      animationsCaptured: animations.length,
      mutationCount: mutations.length,
      firstAnimations: animations.slice(0, 8),
      firstMutations: mutations.slice(0, 30),
    },
    null,
    2,
  ),
)
browser.disconnect()
