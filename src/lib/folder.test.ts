import { beforeAll, describe, expect, it, vi } from "vitest"
import { folderToPins, kindOf, mimeOf } from "@/lib/folder"

// jsdom has no object URLs.
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:test")
  URL.revokeObjectURL = vi.fn()
})

const bytes = (...parts: number[][]) => new Uint8Array(parts.flat())
const u16be = (n: number) => [n >> 8, n & 0xff]
const u16le = (n: number) => [n & 0xff, n >> 8]
const u32be = (n: number) => [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
const u24le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff]

const png = (w: number, h: number) =>
  bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], u32be(13), [0x49, 0x48, 0x44, 0x52], u32be(w), u32be(h))

const gif = (w: number, h: number) => bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], u16le(w), u16le(h))

/** SOI, optional EXIF APP1 carrying an orientation, then SOF0. */
function jpeg(w: number, h: number, orientation?: number) {
  const parts: number[][] = [[0xff, 0xd8]]
  if (orientation) {
    // "Exif\0\0" + big-endian TIFF header + IFD0 with one entry (0x0112).
    const tiff = [0x4d, 0x4d, 0, 42, ...u32be(8), ...u16be(1), ...u16be(0x0112), ...u16be(3), ...u32be(1), ...u16be(orientation), 0, 0, ...u32be(0)]
    const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]
    parts.push([0xff, 0xe1], u16be(body.length + 2), body)
  }
  parts.push([0xff, 0xc0], u16be(17), [8], u16be(h), u16be(w), [3], new Array(9).fill(0))
  return bytes(...parts)
}

function webpVP8X(w: number, h: number) {
  const riff = [0x52, 0x49, 0x46, 0x46]
  return bytes(riff, [0, 0, 0, 0], [0x57, 0x45, 0x42, 0x50], [0x56, 0x50, 0x38, 0x58], u32be(10), [0, 0, 0, 0], u24le(w - 1), u24le(h - 1))
}

const file = (data: Uint8Array, name: string, type = "") =>
  new File([data as BlobPart], name, { type, lastModified: 1 })

async function dimsOf(f: File) {
  const [pin] = await folderToPins({ name: "root", found: [{ file: f, dir: "root/sub" }] })
  return { w: pin.media!.width, h: pin.media!.height, aspect: pin.aspect }
}

describe("header sizing", () => {
  it("reads PNG, GIF, WebP and JPEG dimensions without decoding", async () => {
    expect(await dimsOf(file(png(640, 480), "a.png"))).toEqual({ w: 640, h: 480, aspect: 640 / 480 })
    expect(await dimsOf(file(gif(300, 900), "b.gif"))).toMatchObject({ w: 300, h: 900 })
    expect(await dimsOf(file(webpVP8X(1920, 1080), "c.webp"))).toMatchObject({ w: 1920, h: 1080 })
    expect(await dimsOf(file(jpeg(4032, 3024), "d.jpg"))).toMatchObject({ w: 4032, h: 3024 })
  })

  it("swaps width and height for EXIF-rotated JPEGs, as the browser draws them", async () => {
    expect(await dimsOf(file(jpeg(4032, 3024, 6), "phone.jpg"))).toMatchObject({ w: 3024, h: 4032 })
    expect(await dimsOf(file(jpeg(4032, 3024, 1), "flat.jpg"))).toMatchObject({ w: 4032, h: 3024 })
  })
})

describe("mime + kind", () => {
  it("falls back to the extension when file.type is empty", () => {
    expect(mimeOf(file(new Uint8Array(), "clip.MKV"))).toBe("video/x-matroska")
    expect(mimeOf(file(new Uint8Array(), "x.bin"))).toBe("application/octet-stream")
  })

  it("classifies and skips non-media", async () => {
    expect(kindOf("image/gif")).toBe("gif")
    expect(kindOf("video/mp4")).toBe("video")
    expect(kindOf("text/plain")).toBeNull()
    const pins = await folderToPins({
      name: "root",
      found: [
        { file: file(new Uint8Array([1]), "notes.txt", "text/plain"), dir: "root" },
        { file: file(png(10, 20), "pic.png", "image/png"), dir: "root/cats" },
      ],
    })
    expect(pins).toHaveLength(1)
    expect(pins[0]).toMatchObject({ id: 0, tag: "cats", author: "root", title: "pic.png" })
    expect(pins[0].media).toMatchObject({ mime: "image/png", kind: "image", path: "root/cats/pic.png" })
  })
})
