import puppeteer from "puppeteer-core"
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null })
const p = await b.newPage()
const errors = []
p.on("console", m => { if (m.type()==="error") errors.push(m.text()) })
p.on("pageerror", e => errors.push("pageerror: "+e.message))
await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 })
await p.goto("http://localhost:5173", { waitUntil: "domcontentloaded" })
await new Promise(r=>setTimeout(r,3000))
// hover first card, then click its Save button
const box = await p.evaluate(() => {
  const el = document.querySelector('[style*="translate3d"]'); const r = el.getBoundingClientRect()
  return { x:r.x, y:r.y, w:r.width, h:r.height }
})
await p.mouse.move(box.x + box.w/2, box.y + box.h/2)
await new Promise(r=>setTimeout(r,400))
// click Save (top-right of image)
await p.mouse.click(box.x + box.w - 40, box.y + 24)
await new Promise(r=>setTimeout(r,700))
await p.screenshot({ path: "shots/act-save-toast.png" })
// open more-actions dropdown (footer bottom-right)
await p.mouse.click(box.x + box.w - 20, box.y + box.h - 18)
await new Promise(r=>setTimeout(r,600))
await p.screenshot({ path: "shots/act-menu.png" })
console.log(JSON.stringify({ errors }, null, 2))
b.disconnect()
