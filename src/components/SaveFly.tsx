import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react"
import { AnimatePresence, motion } from "motion/react"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"

type FlyArgs = { from: DOMRect; hue: number; title: string; board: string }
type FlyItem = {
  id: number
  from: DOMRect
  to: { x: number; y: number; size: number }
  hue: number
}
// Transient "saved to a collection" burst: 3 fake-ish photos stacked, then fades.
type Burst = { id: number; x: number; y: number; hues: number[] }

const SaveFlyContext = createContext<(a: FlyArgs) => void>(() => {})
export const useSaveFly = () => useContext(SaveFlyContext)

let counter = 0

function pinGradient(hue: number) {
  return `linear-gradient(150deg, oklch(0.85 0.12 ${hue}), oklch(0.6 0.16 ${(hue + 40) % 360}))`
}

/** Dark pill toast matching Pinterest's "Saved to {board}" + Change. */
function saveToast(board: string, hue: number, title: string) {
  toast.custom(
    (id) => (
      <div className="mx-auto flex w-fit items-center gap-3 rounded-2xl bg-neutral-900 py-2 pr-2 pl-3 text-white shadow-lg">
        <div
          className="size-9 shrink-0 rounded-lg"
          style={{ background: pinGradient(hue) }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[13px] text-white/70">
            <RotateCcw className="size-3.5" />
            Saved to
          </div>
          <div className="truncate text-sm font-semibold">{board}</div>
        </div>
        <button
          onClick={() => toast.dismiss(id)}
          className="ml-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900"
        >
          Change
        </button>
      </div>
    ),
    { duration: 3000, unstyled: true, className: "flex justify-center w-full" },
  )
  void title
}

/** A little stack of 3 photos that pops in at the landing point, then fades. */
function CollectionBurst({
  burst,
  onDone,
}: {
  burst: Burst
  onDone: () => void
}) {
  const SIZE = 44
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: [0, 1, 1, 1, 0], scale: [0.5, 1.1, 1, 1, 0.92] }}
      transition={{
        // Pop in fast, hold ~1.4s so it's clearly noticeable, then fade out.
        duration: 2.2,
        times: [0, 0.1, 0.2, 0.78, 1],
        ease: "easeOut",
      }}
      onAnimationComplete={onDone}
      style={{
        position: "fixed",
        left: burst.x - SIZE / 2,
        top: burst.y - SIZE / 2,
        width: SIZE,
        height: SIZE,
      }}
    >
      {burst.hues.map((h, i) => (
        <span
          key={i}
          className="absolute overflow-hidden rounded-lg border-2 border-background shadow-md"
          style={{
            inset: 0,
            background: pinGradient(h),
            // fan the 3 photos out slightly so it reads as a collection
            transform: `translate(${(i - 1) * 6}px, ${-i * 5}px) rotate(${(i - 1) * 8}deg)`,
            zIndex: 10 - i,
          }}
        />
      ))}
    </motion.div>
  )
}

export function SaveFlyProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FlyItem[]>([])
  const [bursts, setBursts] = useState<Burst[]>([])

  const fly = useCallback((a: FlyArgs) => {
    // Target = the visible profile/save target (sidebar avatar or bottom bar tab).
    const target = [...document.querySelectorAll("[data-save-target]")].find(
      (el) => (el as HTMLElement).offsetParent !== null,
    ) as HTMLElement | undefined
    const tr = target?.getBoundingClientRect()
    // Land at a fixed small size on the target's CENTER — never the target's
    // full width (a bottom-bar tab is ~169px wide and would overflow offscreen).
    const SIZE = 32
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cx = tr ? tr.left + tr.width / 2 : vw - 28
    const cy = tr ? tr.top + tr.height / 2 : 28
    const clamp = (v: number, max: number) => Math.max(4, Math.min(v, max - SIZE - 4))
    const to = {
      x: clamp(cx - SIZE / 2, vw) + SIZE / 2,
      y: clamp(cy - SIZE / 2, vh) + SIZE / 2,
      size: SIZE,
    }

    const id = ++counter
    setItems((prev) => [...prev, { id, from: a.from, to, hue: a.hue }])
    saveToast(a.board, a.hue, a.title)
  }, [])

  const spawnBurst = useCallback((it: FlyItem) => {
    // 3 fake-ish photos: the saved one + two nearby hues, just for the look.
    const hues = [it.hue, (it.hue + 130) % 360, (it.hue + 250) % 360]
    setBursts((prev) => [...prev, { id: it.id, x: it.to.x, y: it.to.y, hues }])
    setItems((prev) => prev.filter((p) => p.id !== it.id))
  }, [])

  return (
    <SaveFlyContext.Provider value={fly}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
        <AnimatePresence>
          {items.map((it) => (
            <motion.div
              key={it.id}
              initial={{
                top: it.from.top,
                left: it.from.left,
                width: it.from.width,
                height: it.from.height,
                opacity: 1,
                borderRadius: 16,
              }}
              animate={{
                top: it.to.y - it.to.size / 2,
                left: it.to.x - it.to.size / 2,
                width: it.to.size,
                height: it.to.size,
                opacity: 0.15,
                borderRadius: 999,
              }}
              transition={{
                // Mirrors SavePin_NavButtonAnimation (~800ms) with a short lead-in.
                duration: 0.8,
                delay: 0.15,
                ease: [0.4, 0, 0.2, 1],
              }}
              onAnimationComplete={() => spawnBurst(it)}
              style={{
                position: "fixed",
                background: pinGradient(it.hue),
                boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
              }}
            />
          ))}
        </AnimatePresence>

        {/* Transient stacked-collection UI that appears then fades out. */}
        {bursts.map((b) => (
          <CollectionBurst
            key={b.id}
            burst={b}
            onDone={() =>
              setBursts((prev) => prev.filter((p) => p.id !== b.id))
            }
          />
        ))}
      </div>
    </SaveFlyContext.Provider>
  )
}
