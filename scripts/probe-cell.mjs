import puppeteer from "puppeteer-core"
const PORT = process.env.CHROME_DEBUG_PORT ?? "9222"
const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null })
const p = await b.newPage()
await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
await p.goto("https://www.pinterest.com/", { waitUntil: "domcontentloaded" })
await new Promise((r) => setTimeout(r, 6000))

const pin = await p.$('[data-test-id="pin"]')
if (pin) await pin.hover()
await new Promise((r) => setTimeout(r, 900))

const out = await p.evaluate(() => {
  const pin = document.querySelector('[data-test-id="pin"]')
  if (!pin) return { error: "no pin" }
  const pr = pin.getBoundingClientRect()
  // Every interactive control inside the pin, with position relative to the pin.
  const controls = [...pin.querySelectorAll('button, a, [role="button"]')].map((el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      text: (el.textContent || "").trim().slice(0, 40),
      aria: el.getAttribute("aria-label"),
      testid: el.getAttribute("data-test-id"),
      relX: Math.round(r.left - pr.left),
      relY: Math.round(r.top - pr.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
      corner:
        (r.top - pr.left < pr.height / 2 ? "top" : "bottom") +
        "-" +
        (r.left - pr.left < pr.width / 2 ? "left" : "right"),
      bg: cs.backgroundColor,
      color: cs.color,
      radius: cs.borderRadius,
      fontWeight: cs.fontWeight,
    }
  })
  const savedTestIds = [
    ...new Set(
      [...pin.querySelectorAll("[data-test-id]")].map((e) => e.getAttribute("data-test-id")),
    ),
  ]
  return { pinW: Math.round(pr.width), pinH: Math.round(pr.height), controls, savedTestIds }
})
console.log(JSON.stringify(out, null, 2))
b.disconnect()
