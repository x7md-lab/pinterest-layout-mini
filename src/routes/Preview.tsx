import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useOutletContext, useParams } from "react-router"
import { ArrowLeft, ArrowUpRight, Bookmark, Share } from "lucide-react"
import { toast } from "sonner"
import { makePin } from "@/data"
import { MoreActions } from "@/components/MoreActions"
import { useSaveFly } from "@/components/SaveFly"
import { cn } from "@/lib/utils"
import { playCue, CUES } from "@/lib/sfx"
import { badgeFor, formatBytes } from "@/lib/folder"
import type { FeedContext } from "@/routes/feed"

/**
 * Full-bleed preview of a single pin. Every action is a plain visible control
 * here — no hover required — so touch devices reach the same set of actions
 * the desktop hover overlay exposes on a card.
 */
export function Preview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const index = Number(id)
  const heroRef = useRef<HTMLDivElement | null>(null)
  const fly = useSaveFly()
  const [saved, setSaved] = useState(false)

  const { pins, folder } = useOutletContext<FeedContext>()

  // Folder pins only exist in the layout's state; generated ones can be
  // rebuilt from the id alone, which keeps a reloaded /pin/:id working.
  const pin = useMemo(() => {
    if (!(Number.isInteger(index) && index >= 0)) return null
    return folder ? (pins.find((p) => p.id === index) ?? null) : makePin(index)
  }, [folder, pins, index])
  const media = pin?.media
  const badge = media ? badgeFor(media) : null

  // Escape goes back, the way a lightbox should.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // An open menu or drawer owns Escape; closing it shouldn't also leave.
      if (e.key !== "Escape" || document.querySelector('[role="menu"],[role="dialog"]')) return
      navigate(-1)
    }
    addEventListener("keydown", onKey)
    return () => removeEventListener("keydown", onKey)
  }, [navigate])

  const toggleSave = useCallback(() => {
    if (!pin) return
    if (saved) {
      setSaved(false)
      playCue(CUES.unsave)
      return
    }
    setSaved(true)
    playCue(CUES.save)
    if (heroRef.current) {
      fly({
        from: heroRef.current.getBoundingClientRect(),
        hue: pin.hue,
        title: pin.title,
        board: pin.tag,
      })
    }
  }, [fly, pin, saved])

  if (!pin) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">That pin doesn't exist.</p>
        <Link to="/" className="text-sm font-semibold underline">
          Back to the feed
        </Link>
      </div>
    )
  }

  return (
    <div className="h-dvh overflow-y-auto overscroll-contain">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 px-4 py-2.5 backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex size-9 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <span className="truncate text-sm font-semibold">{pin.title}</span>
      </header>

      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-6 md:grid-cols-2">
        {/* Sized from the pin's own ratio rather than a hard square: real files
            are 9:16 phone shots and 16:9 video, and cropping either to a
            square is the wrong preview. Capped at 78vh so a tall strip doesn't
            turn the page into a scroll, and contain-fit inside, because
            cropping the thing you opened to look at defeats the point. */}
        <div
          ref={heroRef}
          className={cn(
            "relative max-h-[78vh] w-full overflow-hidden rounded-[24px]",
            media && "bg-muted",
          )}
          style={{
            aspectRatio: String(pin.aspect || 1),
            // Pairs with the feed card's name so the tile morphs into the hero.
            viewTransitionName: "pin-image",
            background: media
              ? undefined
              : `linear-gradient(150deg, oklch(0.85 0.12 ${pin.hue}), oklch(0.6 0.16 ${(pin.hue + 40) % 360}))`,
          }}
        >
          {media?.kind === "video" ? (
            // Muted is the price of autoplay; the controls are there to unmute.
            <video
              src={media.url}
              controls
              loop
              muted
              autoPlay
              playsInline
              className="block size-full object-contain"
            />
          ) : media ? (
            <img
              src={media.url}
              alt={pin.title}
              decoding="async"
              className="block size-full object-contain"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-7xl font-bold text-white/25 select-none">
              {pin.id}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                {pin.tag}
              </span>
              {media && (
                <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold tabular-nums">
                  {badge && (
                    <b className="rounded bg-foreground px-1 text-[10px] text-background">{badge}</b>
                  )}
                  {media.width ? `${media.width}×${media.height}` : "unknown size"}
                </span>
              )}
            </div>
            <MoreActions pin={pin} saved={saved} onToggleSave={toggleSave} />
          </div>

          <h1 className="text-2xl font-bold break-words">{pin.title}</h1>

          {media && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-mono text-xs leading-5">{media.mime}</dd>
              <dt className="text-muted-foreground">Size</dt>
              <dd>{formatBytes(media.bytes)}</dd>
              <dt className="text-muted-foreground">Path</dt>
              <dd className="font-mono text-xs leading-5 break-all">{media.path}</dd>
            </dl>
          )}

          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
              {pin.author.slice(0, 2)}
            </span>
            <span className="text-sm text-muted-foreground">{pin.author}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleSave}
              className={cn(
                "flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white",
                saved ? "bg-neutral-900" : "bg-rose-600 hover:bg-rose-700",
              )}
            >
              <Bookmark className={cn("size-4", saved && "fill-current")} />
              {saved ? "Saved" : `Save to ${pin.tag}`}
            </button>
            <button
              aria-label={media ? "Open original" : "Visit"}
              onClick={() => {
                playCue(CUES.visit)
                if (media) open(media.url, "_blank", "noopener")
                else toast("Opening link…")
              }}
              className="flex size-10 items-center justify-center rounded-full bg-muted hover:bg-muted/70"
            >
              <ArrowUpRight className="size-4" />
            </button>
            <button
              aria-label="Share"
              onClick={() => {
                toast.success("Link copied to clipboard")
                playCue(CUES.share)
              }}
              className="flex size-10 items-center justify-center rounded-full bg-muted hover:bg-muted/70"
            >
              <Share className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
