import puppeteer from "puppeteer-core"
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null })
const p = await b.newPage()
const errors=[]
p.on("pageerror",e=>errors.push("pageerror: "+e.message))
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
await p.goto("http://localhost:5173", { waitUntil:"domcontentloaded" })
await new Promise(r=>setTimeout(r,3000))
// save 3 cards
const boxes = await p.evaluate(()=>[...document.querySelectorAll('[style*="translate3d"]')].slice(0,3).map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}}))
for (const box of boxes){
  await p.mouse.move(box.x+box.w/2, box.y+40)
  await new Promise(r=>setTimeout(r,200))
  await p.mouse.click(box.x+box.w-40, box.y+24)
  await new Promise(r=>setTimeout(r,1200)) // let fly land + stack update
}
await new Promise(r=>setTimeout(r,600))
// clip sidebar avatar area (bottom-left)
await p.screenshot({ path:"shots/stack-avatar.png", clip:{x:0,y:760,width:110,height:120} })
await p.screenshot({ path:"shots/stack-full.png" })
console.log(JSON.stringify({errors}))
b.disconnect()
