import { useCallback, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router"
import { ArrowLeft, ArrowUpRight, Bookmark, Share } from "lucide-react"
import { toast } from "sonner"
import { makePin } from "@/data"
import { MoreActions } from "@/components/MoreActions"
import { useSaveFly } from "@/components/SaveFly"
import { cn } from "@/lib/utils"
import { playCue, CUES } from "@/lib/sfx"

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

  const pin = Number.isInteger(index) && index >= 0 ? makePin(index) : null

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
        <div
          ref={heroRef}
          className="relative aspect-square w-full overflow-hidden rounded-[24px]"
          style={{
            // Pairs with the feed card's name so the tile morphs into the hero.
            viewTransitionName: "pin-image",
            background: `linear-gradient(150deg, oklch(0.85 0.12 ${pin.hue}), oklch(0.6 0.16 ${(pin.hue + 40) % 360}))`,
          }}
        >
          <span className="absolute inset-0 flex items-center justify-center text-7xl font-bold text-white/25 select-none">
            {pin.id}
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
              {pin.tag}
            </span>
            <MoreActions pin={pin} saved={saved} onToggleSave={toggleSave} />
          </div>

          <h1 className="text-2xl font-bold">{pin.title}</h1>

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
              aria-label="Visit"
              onClick={() => {
                toast("Opening link…")
                playCue(CUES.visit)
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
