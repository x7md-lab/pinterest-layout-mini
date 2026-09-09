import puppeteer from "puppeteer-core"
const PORT = process.env.CHROME_DEBUG_PORT ?? "9222"
const b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null })
const p = await b.newPage()
await p.setUserAgent(
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
)
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await p.goto("https://www.pinterest.com/", { waitUntil: "domcontentloaded" })
await new Promise((r) => setTimeout(r, 6000))

const out = await p.evaluate(() => {
  const vh = window.innerHeight
  // Find fixed/sticky bars at top and bottom.
  const bars = []
  for (const el of document.querySelectorAll("div,nav,header,footer")) {
    const cs = getComputedStyle(el)
    if (cs.position !== "fixed" && cs.position !== "sticky") continue
    const r = el.getBoundingClientRect()
    if (r.width < 200 || r.height < 24 || r.height > 120) continue
    const nearBottom = r.bottom >= vh - 4 && r.top > vh / 2
    const nearTop = r.top <= 4 && r.bottom < vh / 2
    if (!nearBottom && !nearTop) continue
    const icons = el.querySelectorAll("svg, img").length
    const links = el.querySelectorAll("a,[role='button'],button").length
    bars.push({
      where: nearBottom ? "BOTTOM" : "TOP",
      tag: el.tagName,
      pos: cs.position,
      top: Math.round(r.top),
      height: Math.round(r.height),
      bg: cs.backgroundColor,
      icons,
      links,
      testid: el.getAttribute("data-test-id"),
      aria: el.getAttribute("aria-label"),
    })
  }
  // Bottom-nav item labels (Pinterest uses aria-labels on the tabs).
  const bottom = bars.find((x) => x.where === "BOTTOM")
  return { innerHeight: vh, bars }
})
console.log(JSON.stringify(out, null, 2))
b.disconnect()
