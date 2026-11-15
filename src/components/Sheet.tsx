import { Icon } from './Icon'
import { type ComponentProps, type ReactNode } from 'react'
import { useDismiss } from '../lib/dismiss'

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useDismiss(true, onClose)

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
  named,
  onClick,
}: {
  label: string
  icon?: ComponentProps<typeof Icon>['name']
  state?: string
  danger?: boolean
  /* An icon and its name, for the action reached for most. */
  named?: boolean
  onClick: () => void
}) {
  if (named && icon)
    return (
      <button className="sheet-item sheet-named-action" onClick={onClick}>
        {/* Wrapped, so the app-wide rule for icon-only buttons stays off it. */}
        <span className="sheet-named-icon" aria-hidden="true"><Icon name={icon} /></span>
        <span className="grow">{label}</span>
        {state ? <span className="state">{state}</span> : null}
      </button>
    )
  return (
    <button className={`sheet-item${danger ? ' danger' : ''}${icon ? ' sheet-icon-action' : ''}`} aria-label={icon ? label : undefined} title={icon ? [label, state].filter(Boolean).join(' · ') : undefined} onClick={onClick}>
      <span className="grow">{icon ? <Icon name={icon} /> : label}</span>
      {!icon && state ? <span className="state">{state}</span> : null}
    </button>
  )
}
