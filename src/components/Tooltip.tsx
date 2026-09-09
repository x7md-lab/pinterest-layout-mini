import { cloneElement, useState, type ReactElement } from "react"
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
  useRole,
  FloatingPortal,
  type Placement,
} from "@floating-ui/react"

/** Lightweight hover tooltip built on Floating UI. */
export function Tooltip({
  label,
  placement = "right",
  children,
}: {
  label: string
  placement?: Placement
  children: ReactElement<Record<string, unknown>>
}) {
  const [open, setOpen] = useState(false)
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  })
  const hover = useHover(context, { move: false, delay: { open: 150, close: 0 } })
  const role = useRole(context, { role: "tooltip" })
  const dismiss = useDismiss(context)
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    role,
    dismiss,
  ])

  return (
    <>
      {cloneElement(
        children,
        getReferenceProps({ ref: refs.setReference, ...children.props }),
      )}
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-[70] rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white shadow-md"
          >
            {label}
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
