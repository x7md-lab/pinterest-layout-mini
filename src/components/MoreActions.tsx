import { useState } from "react"
import {
  MoreHorizontal,
  EyeOff,
  Flag,
  Download,
  Share2,
  Bookmark,
} from "lucide-react"
import { toast } from "sonner"
import type { Pin } from "@/data"
import { useIsMobile } from "@/hooks/useMediaQuery"
import { playCue, CUES } from "@/lib/sfx"
import type { CueName } from "uisfx"
import { cn } from "@/lib/utils"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"

type Action = {
  id: string
  label: string
  icon: typeof EyeOff
  cue: CueName
  run: (pin: Pin) => void
}

const ACTIONS: Action[] = [
  {
    id: "hide",
    label: "Hide Pin",
    icon: EyeOff,
    cue: CUES.hide,
    run: () => toast("Pin hidden", { description: "We'll show fewer like it." }),
  },
  {
    id: "download",
    label: "Download image",
    icon: Download,
    cue: CUES.download,
    run: () => toast.success("Downloading image…"),
  },
  {
    id: "share",
    label: "Share",
    icon: Share2,
    cue: CUES.share,
    run: () => toast.success("Link copied to clipboard"),
  },
  {
    id: "report",
    label: "Report Pin",
    icon: Flag,
    cue: CUES.report,
    run: () => toast("Report submitted", { description: "Thanks for the flag." }),
  },
]

function runAction(a: Action, pin: Pin) {
  a.run(pin)
  playCue(a.cue)
}

const dotsClass =
  "flex size-8 items-center justify-center rounded-full text-neutral-700 hover:bg-muted"

export function MoreActions({
  pin,
  saved,
  onToggleSave,
}: {
  pin: Pin
  saved?: boolean
  onToggleSave?: () => void
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  if (isMobile) {
    return (
      <>
        <button
          aria-label="More actions"
          className={dotsClass}
          onClick={() => setOpen(true)}
        >
          <MoreHorizontal className="size-5" />
        </button>
        <Drawer
          open={open}
          onOpenChange={(next) => {
            playCue(next ? CUES.drawerOpen : CUES.drawerClose)
            setOpen(next)
          }}
          showSwipeHandle
        >
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Pin options</DrawerTitle>
            </DrawerHeader>
            <div
              className="flex flex-col px-2 pb-2"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
            >
              {/* Save — mobile can't hover, so it lives here. Closing the
                  drawer first, then the fly animation starts. */}
              <button
                onClick={() => {
                  setOpen(false)
                  // Toggle after the drawer's close transition so the fly (on
                  // save) starts from the visible card.
                  if (onToggleSave) window.setTimeout(() => onToggleSave(), 450)
                }}
                className={cn(
                  "mb-1 flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold",
                  saved
                    ? "bg-muted text-foreground"
                    : "bg-rose-600 text-white",
                )}
              >
                <Bookmark className={cn("size-5", saved && "fill-current")} />
                {saved ? "Saved — tap to remove" : `Save to ${pin.tag}`}
              </button>
              {ACTIONS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    runAction(a, pin)
                    setOpen(false)
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-muted"
                >
                  <a.icon className="size-5 text-muted-foreground" />
                  {a.label}
                </button>
              ))}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="More actions" className={dotsClass}>
        <MoreHorizontal className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onToggleSave?.()}>
          <Bookmark className={cn("size-4", saved && "fill-current")} />
          {saved ? "Remove" : "Save"}
        </DropdownMenuItem>
        {ACTIONS.map((a) => (
          <DropdownMenuItem key={a.id} onClick={() => runAction(a, pin)}>
            <a.icon className="size-4" />
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
