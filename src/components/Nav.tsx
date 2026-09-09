import { useState, type ReactNode } from "react"
import {
  Bell,
  Home,
  MessageCircle,
  Plus,
  Search,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/Tooltip"
import { playCue, CUES } from "@/lib/sfx"
import { useHoverSound } from "@/hooks/useHoverSound"

type Tab = "home" | "search" | "create" | "updates" | "profile"

/** A rail button with its own hover-sound controller (one per element). */
function RailButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  const bindHover = useHoverSound()
  return (
    <Tooltip label={label}>
      <button
        {...bindHover()}
        onClick={onClick}
        aria-label={label}
        className={cn(
          "flex size-12 items-center justify-center rounded-2xl transition-colors",
          active
            ? "bg-foreground text-background"
            : "text-foreground hover:bg-muted",
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "search", label: "Search", icon: Search },
  { id: "create", label: "Create", icon: Plus },
  { id: "updates", label: "Updates", icon: Bell },
  { id: "profile", label: "Profile", icon: User },
]

/** Desktop-only vertical rail (shown at lg and up), like Pinterest on wide screens. */
export function Sidebar() {
  const [active, setActive] = useState<Tab>("home")
  const bindAvatarHover = useHoverSound()
  const items: { id: Tab; icon: typeof Home; label: string }[] = [
    { id: "home", icon: Home, label: "Home" },
    { id: "search", icon: Search, label: "Search" },
    { id: "create", icon: Plus, label: "Create" },
    { id: "updates", icon: Bell, label: "Updates" },
    { id: "profile", icon: MessageCircle, label: "Messages" },
  ]
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col items-center border-r bg-background py-4 lg:flex">
      <div className="mb-4 flex size-11 items-center justify-center rounded-full text-2xl font-bold text-rose-500">
        ●
      </div>
      <nav className="flex flex-1 flex-col items-center gap-2">
        {items.map(({ id, icon: Icon, label }) => (
          <RailButton
            key={id}
            label={label}
            active={active === id}
            onClick={() => {
              if (active !== id) playCue(CUES.navSelect)
              setActive(id)
            }}
          >
            <Icon className="size-6" />
          </RailButton>
        ))}
      </nav>
      <Tooltip label="Your profile">
        <button
          {...bindAvatarHover()}
          data-save-target
          aria-label="Account"
          className="mt-2 flex size-10 items-center justify-center rounded-full bg-muted text-xs font-semibold"
        >
          me
        </button>
      </Tooltip>
    </aside>
  )
}

/** Mobile/tablet bottom tab bar (hidden at lg and up). Mirrors Pinterest mobile. */
export function BottomBar() {
  const [active, setActive] = useState<Tab>("home")
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch justify-around border-t bg-background/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => {
            if (active !== id) playCue(CUES.navSelect)
            setActive(id)
          }}
          aria-label={label}
          aria-current={active === id ? "page" : undefined}
          {...(id === "profile" ? { "data-save-target": "" } : {})}
          className={cn(
            "flex flex-1 items-center justify-center",
            active === id ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <Icon className={cn("size-7", active === id && "stroke-[2.5]")} />
        </button>
      ))}
    </nav>
  )
}
