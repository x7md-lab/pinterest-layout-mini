import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import puppeteer from "puppeteer-core"

const URL = process.env.SHOT_URL ?? "http://localhost:5173"
const OUT = process.env.SHOT_OUT ?? "shot.png"
const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

const USER_DATA_DIR =
  "C:\\Users\\x7md\\AppData\\Local\\Google\\Chrome\\User Data"

// 1) If a running Chrome exposes a DevTools endpoint, attach to it (reuses the
//    live session's auth + cookies without touching the profile on disk).
async function browserURLFromRunningChrome() {
  // Explicit override wins.
  if (process.env.CHROME_DEBUG_PORT) {
    return `http://127.0.0.1:${process.env.CHROME_DEBUG_PORT}`
  }
  // Chrome writes the chosen port to this file when started with
  // --remote-debugging-port. First line = port, second = ws path.
  const portFile = path.join(USER_DATA_DIR, "DevToolsActivePort")
  if (existsSync(portFile)) {
    const port = readFileSync(portFile, "utf8").split("\n")[0].trim()
    if (port) return `http://127.0.0.1:${port}`
  }
  return null
}

async function tryAttach() {
  const browserURL = await browserURLFromRunningChrome()
  if (!browserURL) return null
  try {
    const res = await fetch(`${browserURL}/json/version`)
    if (!res.ok) return null
    return await puppeteer.connect({ browserURL, defaultViewport: null })
  } catch {
    return null
  }
}

// 2) Fallback: copy the "Default" profile to a temp dir (skipping big caches)
//    and launch headless against the copy. A non-default user-data-dir is also
//    required for the debug port to work on Chrome 136+, and same-user + same
//    Chrome install path lets the app-bound-encrypted cookies still decrypt.
const SKIP_DIRS = new Set([
  "Cache",
  "Code Cache",
  "GPUCache",
  "GraphiteDawnCache",
  "DawnGraphiteCache",
  "DawnWebGPUCache",
  "Service Worker",
  "Component CRX Cache",
  "extensions_crx_cache",
  "Crashpad",
  "GrShaderCache",
  "ShaderCache",
  "optimization_guide_model_store",
])

function copyProfile(snapshot) {
  const srcDefault = path.join(USER_DATA_DIR, "Default")
  const dstDefault = path.join(snapshot, "Default")
  mkdirSync(dstDefault, { recursive: true })

  // Top-level Local State holds the encryption keys the cookies need.
  try {
    cpSync(
      path.join(USER_DATA_DIR, "Local State"),
      path.join(snapshot, "Local State"),
    )
  } catch (e) {
    console.warn(`skip Local State: ${e.message}`)
  }

  // Copy the Default profile recursively, skipping cache/junk dirs.
  cpSync(srcDefault, dstDefault, {
    recursive: true,
    force: true,
    errorOnExist: false,
    filter: (src) => {
      const base = path.basename(src)
      return !SKIP_DIRS.has(base)
    },
  })
}

function launchArgs() {
  const snapshot = path.join(tmpdir(), "chrome-shot-profile")
  mkdirSync(snapshot, { recursive: true })
  if (!existsSync(path.join(snapshot, "Default", "Network", "Cookies"))) {
    console.log("copying profile (cookies + logins) ...")
    copyProfile(snapshot)
  } else {
    console.log("reusing existing profile copy")
  }
  return {
    userDataDir: snapshot,
    args: [
      "--profile-directory=Default",
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
    ],
  }
}

async function main() {
  let browser = await tryAttach()
  let launched = false
  if (browser) {
    console.log("attached to running Chrome via DevTools endpoint")
  } else {
    console.log("no debug endpoint; launching headless against a profile copy")
    const { userDataDir, args } = launchArgs()
    browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROME,
      userDataDir,
      args,
      defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
    })
    launched = true
  }

  try {
    const page = await browser.newPage()
    if (!launched) await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 })
    // Pinterest holds long-poll connections open, so "networkidle" never
    // settles and can fire on the splash screen. Wait for real content.
    const waitMs = Number(process.env.SHOT_WAIT ?? 4000)
    await new Promise((r) => setTimeout(r, waitMs))
    await page.screenshot({ path: OUT, fullPage: true })
    console.log(`saved ${OUT} from ${URL}`)
    await page.close()
  } finally {
    if (launched) await browser.close()
    else browser.disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
