import { mkdirSync, writeFileSync } from "node:fs"
import puppeteer from "puppeteer-core"
mkdirSync("shots/burst",{recursive:true})
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null })
const p = await b.newPage()
const errors=[]; p.on("pageerror",e=>errors.push(""+e.message))
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
await p.goto("http://localhost:5173",{waitUntil:"domcontentloaded"})
await new Promise(r=>setTimeout(r,3000))
const box = await p.evaluate(()=>{const el=document.querySelector('[style*="translate3d"]');const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})
await p.mouse.move(box.x+box.w/2, box.y+40); await new Promise(r=>setTimeout(r,250))
const c = await p.createCDPSession(); const frames=[]
c.on("Page.screencastFrame", async ({data,metadata,sessionId})=>{frames.push({t:metadata.timestamp,data});try{await c.send("Page.screencastFrameAck",{sessionId})}catch{}})
await c.send("Page.startScreencast",{format:"jpeg",quality:75,everyNthFrame:1})
await p.mouse.click(box.x+box.w-40, box.y+24)
await new Promise(r=>setTimeout(r,2200))
await c.send("Page.stopScreencast")
const t0=frames.length?frames[0].t:0
frames.forEach((f,i)=>{const ms=Math.round((f.t-t0)*1000);writeFileSync(`shots/burst/f-${String(i).padStart(2,"0")}-${ms}ms.jpg`,Buffer.from(f.data,"base64"))})
// clip the target area (bottom-left sidebar avatar) at a late-ish moment already saved as frames
console.log(JSON.stringify({errors,frames:frames.length}))
b.disconnect()
