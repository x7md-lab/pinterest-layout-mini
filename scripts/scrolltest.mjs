import puppeteer from "puppeteer-core"
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null })
const p = await b.newPage()
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await p.goto("http://localhost:5173", { waitUntil: "domcontentloaded" })
await new Promise(r=>setTimeout(r,1500))
const read = () => p.evaluate(() => document.querySelector('header span:last-child')?.textContent)
const before = await read()
for (let i=0;i<8;i++){
  await p.evaluate(() => { const s=document.querySelector('.overflow-y-auto'); if(s) s.scrollTop = s.scrollHeight })
  await new Promise(r=>setTimeout(r,400))
}
const after = await read()
console.log(JSON.stringify({ before, after }))
b.disconnect()
