/**
 * Opens a tab in your already-running debug Chrome and leaves it open for you
 * to drive by hand, recording everything the page logs.
 *
 * Every console message and uncaught error is timestamped and appended to
 * scripts/console.log, tagged with the script URL it came from — so an error
 * injected by an extension (no url / a chrome-extension:// url) is
 * distinguishable from one thrown by the app bundle.
 *
 * Run: node scripts/watch-console.mjs   (Ctrl+C to stop; the tab stays open)
 */
import { appendFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import puppeteer from "puppeteer-core"

const APP_URL = process.env.APP_URL ?? "http://localhost:5199/"
const OUT = path.join(import.meta.dirname, "console.log")

writeFileSync(OUT, `# watching ${APP_URL} — started ${new Date().toISOString()}\n`)

const b = await puppeteer.connect({
  browserURL: "http://127.0.0.1:9222",
  defaultViewport: null,
  protocolTimeout: 0,
})

const p = await b.newPage()

function record(line) {
  const stamped = `[${new Date().toISOString().slice(11, 23)}] ${line}`
  console.log(stamped)
  appendFileSync(OUT, stamped + "\n")
}

p.on("console", (m) => {
  const t = m.type()
  if (t !== "error" && t !== "warning") return
  const loc = m.location()
  record(`${t.toUpperCase()} @ ${loc.url || "(no url — eval/extension)"}:${loc.lineNumber ?? "?"}\n    ${m.text()}`)
})

p.on("pageerror", (e) => {
  const stack = (e.stack ?? "").split("\n").slice(0, 6).join("\n    ")
  record(`PAGEERROR ${e.message}\n    ${stack}`)
})

p.on("requestfailed", (r) => {
  record(`REQUESTFAILED ${r.url().slice(0, 160)} — ${r.failure()?.errorText}`)
})

await p.goto(APP_URL, { waitUntil: "domcontentloaded" })
record(`navigated to ${APP_URL} — open DevTools (F12) on this tab, then click a pin and press Back`)

// Stay alive so the tab keeps recording. The tab is intentionally never closed.
process.on("SIGINT", () => {
  record("watcher stopped (tab left open)")
  process.exit(0)
})
await new Promise(() => {})
