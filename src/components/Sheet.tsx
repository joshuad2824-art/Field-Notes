import { Icon } from './Icon'
import { useEffect, type ComponentProps, type ReactNode } from 'react'

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
  icon,
  state,
  danger,
  onClick,
}: {
  label: string
  icon?: ComponentProps<typeof Icon>['name']
  state?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button className={`sheet-item${danger ? ' danger' : ''}${icon ? ' sheet-icon-action' : ''}`} aria-label={icon ? label : undefined} title={icon ? [label, state].filter(Boolean).join(' · ') : undefined} onClick={onClick}>
      <span className="grow">{icon ? <Icon name={icon} /> : label}</span>
      {!icon && state ? <span className="state">{state}</span> : null}
    </button>
  )
}
