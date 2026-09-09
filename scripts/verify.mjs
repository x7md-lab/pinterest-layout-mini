import puppeteer from "puppeteer-core"
const PORT = process.env.CHROME_DEBUG_PORT ?? "9222"
const URL = process.env.SHOT_URL ?? "http://localhost:5173"
const OUT = process.env.SHOT_OUT ?? "verify.png"
const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
const errors = []
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })
page.on("pageerror", (e) => errors.push("pageerror: " + e.message))
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 })
await new Promise((r) => setTimeout(r, 2500))
const stats = await page.evaluate(() => {
  const items = document.querySelectorAll('[class*="absolute"][style*="translate3d"]')
  const container = document.querySelector('.relative[style*="height"]')
  const rects = [...items].slice(0, 8).map((el) => {
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
  })
  return {
    renderedItems: items.length,
    containerHeight: container?.style.height ?? null,
    firstRects: rects,
  }
})
await page.screenshot({ path: OUT, fullPage: false })
console.log(JSON.stringify({ errors, ...stats }, null, 2))
browser.disconnect()
