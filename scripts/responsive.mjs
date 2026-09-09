import { mkdirSync } from "node:fs"
import puppeteer from "puppeteer-core"

// Attach to the already-running debug Chrome (port 9222). No profile/auth needed
// for localhost, so this never touches the locked main profile.
const PORT = process.env.CHROME_DEBUG_PORT ?? "9222"
const URL = process.env.SHOT_URL ?? "http://localhost:5173"
const OUTDIR = process.env.SHOT_DIR ?? "shots"
mkdirSync(OUTDIR, { recursive: true })

// No UA spoofing: the app switches layout on viewport SIZE alone.
const devices = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-14", width: 390, height: 844 },
  { name: "iphone-14-pro-max", width: 430, height: 932 },
  { name: "ipad-mini", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
]

const browser = await puppeteer.connect({
  browserURL: `http://127.0.0.1:${PORT}`,
  defaultViewport: null,
})

for (const d of devices) {
  const page = await browser.newPage()
  await page.setViewport({
    width: d.width,
    height: d.height,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 })
  await new Promise((r) => setTimeout(r, 2000))

  const cols = await page.evaluate(() => {
    const items = document.querySelectorAll('[style*="translate3d"]')
    const xs = new Set(
      [...items].map((el) => Math.round(el.getBoundingClientRect().left)),
    )
    return { rendered: items.length, columns: xs.size }
  })

  const out = `${OUTDIR}/${d.name}.png`
  await page.screenshot({ path: out })
  console.log(`${d.name} (${d.width}x${d.height}): ${cols.columns} cols, ${cols.rendered} rendered -> ${out}`)
  await page.close()
}

browser.disconnect()
