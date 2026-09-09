import puppeteer from "puppeteer-core"
const b = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null })
const sizes = [
  { name:"landscape-phone", w:844, h:390 },
  { name:"landscape-short", w:1200, h:560 },
  { name:"desktop-lg", w:1440, h:820 },
]
for (const s of sizes) {
  const p = await b.newPage()
  await p.setViewport({ width:s.w, height:s.h, deviceScaleFactor:1 })
  await p.goto("http://localhost:5173", { waitUntil:"domcontentloaded" })
  await new Promise(r=>setTimeout(r,2500))
  // find save target + first card image
  const info = await p.evaluate(()=>{
    const tgt=[...document.querySelectorAll("[data-save-target]")].find(e=>e.offsetParent!==null)
    const tr=tgt?.getBoundingClientRect()
    const card=document.querySelector('[style*="translate3d"]')
    const cr=card?.getBoundingClientRect()
    return { vw:innerWidth, vh:innerHeight,
      target: tr?{x:Math.round(tr.left),y:Math.round(tr.top),w:Math.round(tr.width),h:Math.round(tr.height)}:null,
      hasSidebar: !!document.querySelector('aside'),
      sidebarVisible: (()=>{const a=document.querySelector('aside'); return a? getComputedStyle(a).display!=='none': false})(),
      card: cr?{x:Math.round(cr.left),y:Math.round(cr.top),w:Math.round(cr.width),h:Math.round(cr.height)}:null }
  })
  // trigger save on desktop via hover+click; on mobile via footer dots->save
  let flyStats=null
  if (info.sidebarVisible) {
    // hover card, click Save top-right
    await p.mouse.move(info.card.x+info.card.w/2, info.card.y+40)
    await new Promise(r=>setTimeout(r,250))
    await p.mouse.click(info.card.x+info.card.w-40, info.card.y+24)
  } else {
    // click footer more dots, then Save row
    await p.mouse.click(info.card.x+info.card.w-18, info.card.y+info.card.h-18)
    await new Promise(r=>setTimeout(r,500))
    // Save row is the red button near top of drawer
    await p.evaluate(()=>{const btns=[...document.querySelectorAll('button')].filter(b=>/^Save/.test(b.textContent||'')); btns[0]?.click()})
    await new Promise(r=>setTimeout(r,500))
  }
  // poll fly element rect
  const maxes = await p.evaluate(async ()=>{
    let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9,seen=0
    for(let i=0;i<40;i++){
      const el=[...document.querySelectorAll('div')].find(d=>d.style.position==='fixed' && d.style.background?.includes('linear-gradient') && d.parentElement?.className?.includes('pointer-events-none'))
      if(el){const r=el.getBoundingClientRect();seen++;minX=Math.min(minX,r.left);minY=Math.min(minY,r.top);maxX=Math.max(maxX,r.right);maxY=Math.max(maxY,r.bottom)}
      await new Promise(r=>setTimeout(r,25))
    }
    return { seen, minX:Math.round(minX),minY:Math.round(minY),maxX:Math.round(maxX),maxY:Math.round(maxY) }
  })
  console.log(s.name, JSON.stringify({ vw:info.vw, vh:info.vh, sidebarVisible:info.sidebarVisible, target:info.target, fly:maxes,
    offscreen: maxes.seen? (maxes.minX<0||maxes.minY<0||maxes.maxX>info.vw||maxes.maxY>info.vh):"no-fly-seen" }))
  await p.close()
}
b.disconnect()
