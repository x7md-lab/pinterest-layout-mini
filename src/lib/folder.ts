// Local-folder source: pick a directory, walk it, and turn every image/video in
// it into a Pin carrying real media. Chromium gets the File System Access API
// (showDirectoryPicker); Firefox and Safari fall back to <input webkitdirectory>,
// which yields the same File objects, just without a reusable handle.
//
// The picker, walk and ignore rules come from use-fs, but not its useFs hook:
// that hook calls file.text() on every file on every scan and keeps the strings
// in state, so a folder of videos would be read into memory whole. walkDirectory
// hands back handles only, and the media filter below prunes everything else
// before a single byte is read.
//
// Sizing mirrors the userscript: the feed needs each item's true width/height
// before it lays out, or every tile starts square and jumps once decoded. Image
// dimensions are read from the file header (a few KB, no decode); video from
// loadedmetadata; anything the parser doesn't know falls back to an <img> load.
import {
  commonFilters,
  createFilter,
  getDirectoryPicker,
  isAbortError,
  mapLimit,
  walkDirectory,
} from "use-fs"
import type { Media, MediaKind, Pin } from "@/data"

/** file.type is empty for plenty of real files (and every .mkv/.heic on Windows). */
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", jfif: "image/jpeg", png: "image/png",
  gif: "image/gif", webp: "image/webp", avif: "image/avif", bmp: "image/bmp",
  svg: "image/svg+xml", ico: "image/x-icon", apng: "image/apng",
  mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  ogv: "video/ogg", mkv: "video/x-matroska",
}

export function extOf(name: string) {
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ""
}

export function mimeOf(file: File) {
  return file.type || EXT_MIME[extOf(file.name)] || "application/octet-stream"
}

export function kindOf(mime: string): MediaKind | null {
  if (mime === "image/gif") return "gif"
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  return null
}

type Found = { file: File; dir: string }

/** Keeps only files a browser can show, judged by extension (no read needed). */
const mediaFilter = createFilter({
  shouldIncludeFile: ({ name }) => !name.startsWith(".") && extOf(name) in EXT_MIME,
  shouldProcessDirectory: ({ name }) => !name.startsWith("."),
})

function pickWithInput(): Promise<{ name: string; found: Found[] } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.webkitdirectory = true
    input.multiple = true
    input.addEventListener("change", () => {
      const files = [...(input.files ?? [])]
      if (!files.length) return resolve(null)
      // webkitRelativePath is "root/sub/file.jpg". iOS ignores webkitdirectory
      // and offers a multi-file picker instead, leaving it empty.
      const root = files[0].webkitRelativePath.split("/")[0] || "Selected files"
      resolve({
        name: root,
        found: files
          .filter((f) => !f.name.startsWith("."))
          .map((file) => ({
            file,
            dir: file.webkitRelativePath.split("/").slice(0, -1).join("/") || root,
          })),
      })
    })
    input.addEventListener("cancel", () => resolve(null))
    input.click()
  })
}

/** Ask for a folder. Resolves null if the user cancels. */
export async function pickFolder(): Promise<{ name: string; found: Found[] } | null> {
  const picker = getDirectoryPicker()
  // Only the browser's own picker. iOS extensions (e.g. "File Picker") install
  // a JS showDirectoryPicker that bounces through their app via a universal
  // link; when that link isn't wired up it fails with a bare TypeError, and
  // by then the tap's user activation is spent so we can't fall back.
  if (!picker || !/\[native code\]/.test(String((window as { showDirectoryPicker?: unknown }).showDirectoryPicker)))
    return pickWithInput()
  let root: FileSystemDirectoryHandle
  try {
    root = await picker({ mode: "read", id: "pinboard-folder", startIn: "pictures" })
  } catch (e) {
    if (isAbortError(e)) return null
    throw e
  }
  const filters = await Promise.all([...commonFilters, mediaFilter].map((f) => f()))
  const { files } = await walkDirectory(root, root.name, filters)
  const found: Found[] = []
  await mapLimit([...files], 16, async ([path, handle]) => {
    found.push({ file: await handle.getFile(), dir: path.slice(0, path.lastIndexOf("/")) })
  })
  return { name: root.name, found }
}

// ---------------------------------------------------------------------------
// Header dimension parsing

type Dims = { width: number; height: number }

function pngDims(v: DataView): Dims | null {
  // Signature, then the IHDR chunk: width/height at 16/20.
  if (v.byteLength < 24 || v.getUint32(0) !== 0x89504e47) return null
  return { width: v.getUint32(16), height: v.getUint32(20) }
}

function gifDims(v: DataView): Dims | null {
  if (v.byteLength < 10 || v.getUint32(0) !== 0x47494638) return null // "GIF8"
  return { width: v.getUint16(6, true), height: v.getUint16(8, true) }
}

function bmpDims(v: DataView): Dims | null {
  if (v.byteLength < 26 || v.getUint16(0) !== 0x424d) return null // "BM"
  return { width: v.getInt32(18, true), height: Math.abs(v.getInt32(22, true)) }
}

function webpDims(v: DataView): Dims | null {
  // "RIFF" .... "WEBP" then a VP8 / VP8L / VP8X chunk.
  if (v.byteLength < 30 || v.getUint32(0) !== 0x52494646 || v.getUint32(8) !== 0x57454250)
    return null
  const chunk = v.getUint32(12)
  if (chunk === 0x56503820) // "VP8 " lossy
    return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff }
  if (chunk === 0x5650384c) { // "VP8L" lossless: 14-bit fields packed from byte 21
    const b = v.getUint32(21, true)
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 0x56503858) { // "VP8X" extended: 24-bit canvas size at 24/27
    const w = v.getUint8(24) | (v.getUint8(25) << 8) | (v.getUint8(26) << 16)
    const h = v.getUint8(27) | (v.getUint8(28) << 8) | (v.getUint8(29) << 16)
    return { width: w + 1, height: h + 1 }
  }
  return null
}

/** EXIF orientation from an APP1 segment; 5-8 mean the image is stored rotated 90°. */
function exifOrientation(v: DataView, start: number, end: number): number {
  if (v.getUint32(start) !== 0x45786966) return 1 // "Exif"
  const tiff = start + 6
  const le = v.getUint16(tiff) === 0x4949
  const ifd = tiff + v.getUint32(tiff + 4, le)
  if (ifd + 2 > end) return 1
  const n = v.getUint16(ifd, le)
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12
    if (e + 12 > end) break
    if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le)
  }
  return 1
}

function jpegDims(v: DataView): Dims | null {
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null
  let off = 2
  let orientation = 1
  while (off + 4 <= v.byteLength) {
    if (v.getUint8(off) !== 0xff) return null
    const marker = v.getUint8(off + 1)
    const len = v.getUint16(off + 2)
    if (marker === 0xe1 && off + 4 + len - 2 <= v.byteLength)
      orientation = exifOrientation(v, off + 4, off + 2 + len)
    // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (off + 9 > v.byteLength) return null
      const height = v.getUint16(off + 5)
      const width = v.getUint16(off + 7)
      // Browsers honour EXIF orientation when drawing, so the box has to too.
      return orientation >= 5 ? { width: height, height: width } : { width, height }
    }
    off += 2 + len
  }
  return null
}

const HEAD = 256 * 1024 // a JPEG's EXIF thumbnail can push SOF well past 64KB

async function headerDims(file: File): Promise<Dims | null> {
  const v = new DataView(await file.slice(0, HEAD).arrayBuffer())
  for (const parse of [jpegDims, pngDims, webpDims, gifDims, bmpDims]) {
    const d = parse(v)
    if (d && d.width > 0 && d.height > 0) return d
  }
  return null
}

function decodedDims(url: string): Promise<Dims | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () =>
      resolve(img.naturalWidth > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function videoDims(url: string): Promise<Dims | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video")
    v.preload = "metadata"
    v.muted = true
    const done = (d: Dims | null) => {
      v.removeAttribute("src")
      v.load() // release the decoder
      resolve(d)
    }
    v.onloadedmetadata = () =>
      done(v.videoWidth > 0 ? { width: v.videoWidth, height: v.videoHeight } : null)
    v.onerror = () => done(null)
    v.src = url
  })
}

async function measure(kind: MediaKind, file: File, url: string): Promise<Dims | null> {
  if (kind === "video") return videoDims(url)
  return (await headerDims(file).catch(() => null)) ?? decodedDims(url)
}

function hashHue(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 360
}

/**
 * Turn a picked folder into pins. Unsupported files are skipped; media whose
 * size can't be determined still shows, laid out square.
 */
export async function folderToPins(
  folder: { name: string; found: Found[] },
  onProgress?: (done: number, total: number) => void,
): Promise<Pin[]> {
  const media = folder.found
    .map(({ file, dir }) => {
      const mime = mimeOf(file)
      const kind = kindOf(mime)
      return kind ? { file, dir, mime, kind } : null
    })
    .filter((m) => m !== null)
    .sort((a, b) => b.file.lastModified - a.file.lastModified)

  let done = 0
  const pins = new Array<Pin>(media.length)
  // Capped: 300 simultaneous <video> metadata probes would stall the tab.
  await mapLimit(media, 6, async ({ file, dir, mime, kind }, i) => {
    const url = URL.createObjectURL(file)
    const dims = await measure(kind, file, url)
    onProgress?.(++done, media.length)
    const m: Media = {
      url,
      kind,
      mime,
      name: file.name,
      path: `${dir}/${file.name}`,
      bytes: file.size,
      width: dims?.width ?? 0,
      height: dims?.height ?? 0,
    }
    const board = dir.split("/").pop() || folder.name
    pins[i] = {
      id: i,
      title: file.name,
      author: folder.name,
      tag: board,
      aspect: dims ? dims.width / dims.height : 1,
      hue: hashHue(file.name),
      media: m,
    }
  })
  return pins
}

export function revokePins(pins: Pin[]) {
  for (const p of pins) if (p.media) URL.revokeObjectURL(p.media.url)
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  const units = ["KB", "MB", "GB"]
  let v = n / 1024
  let u = 0
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024
    u++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[u]}`
}

/** "MP4", "WEBM", "GIF" — the badge text for anything that isn't a still. */
export function badgeFor(m: Media) {
  if (m.kind === "gif") return "GIF"
  if (m.kind === "video") return (extOf(m.name) || m.mime.split("/")[1] || "video").toUpperCase()
  return null
}
