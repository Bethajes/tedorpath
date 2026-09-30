/**
 * A small modal dialog.
 *
 * Built on the native `<dialog>` element so the browser handles the things that
 * are easy to get wrong by hand: the backdrop, Escape to close, and moving focus
 * into the dialog on open. It is only rendered when `open` is true, so the
 * element's own show/close animation is never relied on.
 *
 * `onCancel` intercepts Escape so the caller's `onClose` runs, which matters
 * here because closing a dialog also has to discard whatever was typed into it.
 */

import { useEffect, useRef, type ReactNode } from 'react'

export interface ModalProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children?: ReactNode
  /** The action buttons, usually Cancel + Confirm. */
  footer: ReactNode
}

export function Modal({ open, title, description, onClose, children, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-description' : undefined}
      onCancel={(event) => {
        // Escape was pressed: stop the browser's own close so `onClose` runs and
        // the parent can clear the form state along with it.
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // A click that lands on the dialog element itself is a click on the
        // backdrop, since the inner panel covers everything else.
        if (event.target === ref.current) onClose()
      }}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="p-6">
        <h2 id="modal-title" className="text-lg font-bold text-slate-900">
          {title}
        </h2>
        {description ? (
          <p id="modal-description" className="mt-2 text-sm text-slate-600">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
        {footer}
      </div>
    </dialog>
  )
}
