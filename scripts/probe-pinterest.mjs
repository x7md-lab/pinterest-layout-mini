import puppeteer from "puppeteer-core"

const PORT = process.env.CHROME_DEBUG_PORT ?? "9222"
const browser = await puppeteer.connect({
  browserURL: `http://127.0.0.1:${PORT}`,
  defaultViewport: null,
})

const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
await page.goto("https://www.pinterest.com/", { waitUntil: "domcontentloaded" })
await new Promise((r) => setTimeout(r, 6000))

const report = await page.evaluate(() => {
  // Pinterest tags each pin with data-test-id="pin" or "pinWrapper".
  const pins = Array.from(
    document.querySelectorAll('[data-test-id="pin"], [data-test-id="pinWrapper"]'),
  )
  const sample = pins.slice(0, 24).map((el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      x: Math.round(r.left),
      y: Math.round(r.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
      position: cs.position,
      transform: cs.transform === "none" ? "none" : cs.transform,
    }
  })

  // Distinct left edges ≈ number of columns.
  const cols = [...new Set(sample.map((s) => s.x))].sort((a, b) => a - b)
  const gutterX = cols.length > 1 ? cols[1] - cols[0] - sample[0].w : null

  // The grid container that positions pins.
  const grid =
    document.querySelector('[role="list"]')?.parentElement ??
    pins[0]?.closest("div[style*='height']")
  const gridStyle = grid ? getComputedStyle(grid) : null

  // One pin's inner structure (truncated).
  const firstHtml = pins[0]?.outerHTML?.slice(0, 900) ?? null

  return {
    pinCount: pins.length,
    columnLefts: cols,
    approxColumns: cols.length,
    itemWidth: sample[0]?.w ?? null,
    gutterX,
    gridContainer: grid
      ? {
          tag: grid.tagName,
          position: gridStyle.position,
          width: gridStyle.width,
          height: gridStyle.height,
        }
      : null,
    sample,
    firstHtml,
  }
})

console.log(JSON.stringify(report, null, 2))
browser.disconnect()
