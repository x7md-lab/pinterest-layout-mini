import puppeteer from "puppeteer-core"
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null })
const p = await b.newPage()
await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 })
await p.goto("http://localhost:5173", { waitUntil: "domcontentloaded" })
await new Promise(r=>setTimeout(r,3000)) // let initial page-fills settle
const box = await p.evaluate(() => {
  const el = document.querySelector('[style*="translate3d"]')
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height }
})
const clip = { x: Math.max(0,box.x-6), y: Math.max(0,box.y-6), width: box.width+12, height: box.height+12 }
await p.screenshot({ path: "shots/cell-default.png", clip })
await p.mouse.move(box.x + box.width/2, box.y + box.height/2)
await new Promise(r=>setTimeout(r,500))
await p.screenshot({ path: "shots/cell-hover.png", clip })
console.log("cell shots saved", JSON.stringify(clip))
b.disconnect()
