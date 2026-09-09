import puppeteer from "puppeteer-core"
const PORT = process.env.CHROME_DEBUG_PORT ?? "9222"
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
await page.goto("https://www.pinterest.com/", { waitUntil: "domcontentloaded" })
await new Promise((r) => setTimeout(r, 6000))
const out = await page.evaluate(() => {
  const pin = document.querySelector('[data-test-id="pin"]')
  // Walk up to find the absolutely-positioned grid item.
  let node = pin, positioned = null
  for (let i = 0; node && i < 6; i++) {
    const cs = getComputedStyle(node)
    if (cs.position === "absolute") { positioned = node; break }
    node = node.parentElement
  }
  const posInfo = positioned
    ? {
        tag: positioned.tagName,
        inlineStyle: positioned.getAttribute("style"),
        position: getComputedStyle(positioned).position,
        transform: getComputedStyle(positioned).transform,
        top: getComputedStyle(positioned).top,
        left: getComputedStyle(positioned).left,
      }
    : "no absolute ancestor found"
  return {
    positioned: posInfo,
    imgLoading: document.querySelector('[data-test-id="pin"] img')?.loading ?? null,
  }
})
console.log(JSON.stringify(out, null, 2))
browser.disconnect()
