import { useState } from "react"
import { Volume2, VolumeX } from "lucide-react"
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react"
import { useSound } from "@/components/SoundProvider"
import { cn } from "@/lib/utils"

export function SoundControl() {
  const { enabled, volume, keyboard, setEnabled, setVolume, setKeyboard } =
    useSound()
  const [open, setOpen] = useState(false)

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-end",
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  })
  const click = useClick(context)
  const dismiss = useDismiss(context)
  const role = useRole(context)
  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ])

  return (
    <>
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        aria-label={enabled ? "Sound on — sound settings" : "Sound off — sound settings"}
        aria-pressed={enabled}
        title="Sound settings"
        className={cn(
          "flex size-9 items-center justify-center rounded-full transition-colors",
          enabled ? "text-foreground hover:bg-muted" : "text-muted-foreground hover:bg-muted",
        )}
      >
        {enabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
      </button>

      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              className="z-[70] w-64 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg"
            >
              <div className="mb-2 text-sm font-semibold">Sound</div>

              <label className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span>Interface sounds</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="size-4 accent-rose-600"
                />
              </label>

              <label className="flex items-center gap-3 py-1.5 text-sm">
                <span className="w-16 shrink-0">Volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  disabled={!enabled}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Sound volume"
                  className="w-full accent-rose-600 disabled:opacity-40"
                />
              </label>

              <label className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span>Keyboard sounds</span>
                <input
                  type="checkbox"
                  checked={keyboard}
                  disabled={!enabled}
                  onChange={(e) => setKeyboard(e.target.checked)}
                  className="size-4 accent-rose-600 disabled:opacity-40"
                />
              </label>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  )
}
