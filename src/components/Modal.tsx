import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog ref={ref} className="modal" onClose={onClose} onCancel={onClose}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="btn ghost small" onClick={onClose} aria-label="Fermer">
          <Icon name="x" />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  )
}
