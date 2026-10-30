import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { stackClass } from './classes'
import { IconButton } from './IconButton'

type ModalProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const root = dialogRef.current
    const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    const focusable = () =>
      Array.from(root?.querySelectorAll<HTMLElement>(selector) ?? []).filter((element) => !element.hasAttribute('disabled'))

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    focusable()[0]?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-overlay p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current()
      }}
    >
      <div
        ref={dialogRef}
        className="max-h-[min(85dvh,720px)] w-full max-w-[480px] overflow-auto rounded-lg border border-solid border-border bg-surface p-4 text-text shadow-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="m-0 text-lg font-semibold leading-tight">
            {title}
          </h2>
          <IconButton label="關閉" onClick={() => onCloseRef.current()}>
            <X size={18} aria-hidden />
          </IconButton>
        </div>
        <div className={`${stackClass} [&_p]:m-0`}>{children}</div>
        {footer ? <div className="mt-4 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
