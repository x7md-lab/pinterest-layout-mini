import { mkdirSync, writeFileSync } from "node:fs"
import puppeteer from "puppeteer-core"
mkdirSync("shots/our-fly", { recursive: true })
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null })
const p = await b.newPage()
const errors=[]
p.on("console",m=>{if(m.type()==="error")errors.push(m.text())})
p.on("pageerror",e=>errors.push("pageerror: "+e.message))
await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
await p.goto("http://localhost:5173", { waitUntil: "domcontentloaded" })
await new Promise(r=>setTimeout(r,3000))
const box = await p.evaluate(()=>{const el=document.querySelector('[style*="translate3d"]');const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})
await p.mouse.move(box.x+box.w/2, box.y+box.h/2)
await new Promise(r=>setTimeout(r,300))
const client = await p.createCDPSession()
const frames=[]
client.on("Page.screencastFrame", async ({data,metadata,sessionId})=>{frames.push({t:metadata.timestamp,data}); try{await client.send("Page.screencastFrameAck",{sessionId})}catch{}})
await client.send("Page.startScreencast",{format:"jpeg",quality:70,everyNthFrame:1})
await p.mouse.click(box.x+box.w-40, box.y+24) // Save top-right
await new Promise(r=>setTimeout(r,1400))
await client.send("Page.stopScreencast")
const t0=frames.length?frames[0].t:0
frames.forEach((f,i)=>{const ms=Math.round((f.t-t0)*1000);writeFileSync(`shots/our-fly/f-${String(i).padStart(2,"0")}-${ms}ms.jpg`,Buffer.from(f.data,"base64"))})
console.log(JSON.stringify({errors, frames:frames.length}))
b.disconnect()
