import puppeteer from "puppeteer-core"
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null })
const p = await b.newPage()
const errors = []
p.on("pageerror", e => errors.push("pageerror: "+e.message))
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await p.goto("http://localhost:5173", { waitUntil: "domcontentloaded" })
await new Promise(r=>setTimeout(r,3000))
const box = await p.evaluate(() => {
  const el = document.querySelector('[style*="translate3d"]'); const r = el.getBoundingClientRect()
  return { x:r.x, y:r.y, w:r.width, h:r.height }
})
// tap the footer more-dots (bottom-right of the card)
await p.touchscreen.tap(box.x + box.w - 18, box.y + box.h - 18)
await new Promise(r=>setTimeout(r,700))
await p.screenshot({ path: "shots/mobile-drawer.png" })
console.log(JSON.stringify({ errors }))
b.disconnect()
