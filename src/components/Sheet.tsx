import { useEffect, type ReactNode } from 'react'

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim" onMouseDown={onClose} role="presentation">
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()} role="dialog">
        {children}
      </div>
    </div>
  )
}

export function SheetItem({
  label,
  state,
  danger,
  onClick,
}: {
  label: string
  state?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button className={`sheet-item${danger ? ' danger' : ''}`} onClick={onClick}>
      <span className="grow">{label}</span>
      {state ? <span className="state">{state}</span> : null}
    </button>
  )
}
