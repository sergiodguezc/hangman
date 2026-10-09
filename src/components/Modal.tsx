import { useLayoutEffect, useRef, type ReactNode } from 'react'

type Props = { children: ReactNode; className: string; labelledBy: string; describedBy?: string; onCancel: () => void }

// Mount only while open. The native top layer makes the rest of the document inert.
export function Modal({ children, className, labelledBy, describedBy, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const dialog = ref.current!
    const opener = document.activeElement
    dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-modal-initial-focus]')?.focus()
    return () => {
      dialog.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])

  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby={labelledBy} aria-describedby={describedBy}
    onCancel={(event) => { event.preventDefault(); onCancel() }}
    onKeyDown={(event) => {
      // Do not let game-wide letter shortcuts act on the inert background.
      event.stopPropagation()
      if (event.key !== 'Tab') return
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
        .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>{children}</dialog>
}
