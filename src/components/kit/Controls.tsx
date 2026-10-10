import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Meta } from './Surfaces'

export type MenuOption = { value: string; label: string; color?: string }
/* A native modal supplies focus containment and inert background behavior.
   The listbox keeps one focus stop and explicit keyboard selection. */
export function Menu({ label, value, options, onChange }: { label: string; value: string; options: MenuOption[]; onChange: (value: string) => void }) {
  const id = useId(), dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null), list = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false), [active, setActive] = useState(0)
  const selected = options.find(option => option.value === value)
  function close() { dialog.current?.close(); setOpen(false); trigger.current?.focus() }
  function show() { setActive(Math.max(0, options.findIndex(option => option.value === value))); dialog.current?.showModal(); setOpen(true); list.current?.focus() }
  function choose(index: number) { if (!options[index]) return; onChange(options[index].value); close() }
  useEffect(() => { if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' }) }, [active, open, id])
  return <div className="kit-menu"><button ref={trigger} className="kit-menu-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} disabled={!options.length} onClick={show}>{selected?.label || label}<span aria-hidden="true">▾</span></button>
    <dialog ref={dialog} className="kit-menu-dialog" aria-label={label} onCancel={event => { event.preventDefault(); close() }} onClose={() => setOpen(false)} onClick={event => { if (event.target === dialog.current) { const r = dialog.current.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close() } }}>
      <div className="kit-menu-heading"><span>{label}</span><button aria-label={`Close ${label}`} onClick={close}>Close</button></div>
      <div id={id} ref={list} role="listbox" aria-label={label} aria-activedescendant={`${id}-${active}`} tabIndex={0} onKeyDown={event => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) event.preventDefault()
        if (event.key === 'ArrowDown') setActive(index => (index + 1) % options.length)
        if (event.key === 'ArrowUp') setActive(index => (index + options.length - 1) % options.length)
        if (event.key === 'Home') setActive(0)
        if (event.key === 'End') setActive(options.length - 1)
        if (event.key === 'Enter' || event.key === ' ') choose(active)
      }}>{options.map((option, index) => <div id={`${id}-${index}`} key={option.value} role="option" aria-selected={value === option.value} className={active === index ? 'is-active' : ''} onPointerMove={() => setActive(index)} onClick={() => choose(index)}>{option.color ? <span className="kit-cover-square" style={{ background: option.color }} /> : null}{option.label}{value === option.value ? <span aria-hidden="true">✓</span> : null}</div>)}</div>
    </dialog>
  </div>
}
export function Fold({ label, count, children }: { label: string; count?: number; children: ReactNode }) {
  const id = useId(), [open, setOpen] = useState(false), button = useRef<HTMLButtonElement>(null)
  return <section className="kit-fold" onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); button.current?.focus() } }}><button ref={button} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}><span>{label}{count !== undefined ? ` · ${count}` : ''}</span><span aria-hidden="true">{open ? '▴' : '▾'}</span></button><div id={id} className="kit-fold-body" hidden={!open}>{children}</div></section>
}
export function Row({ kind, title, meta, trailing, late, onToggle, details, time, cover, completed = false }: { kind: 'reminder' | 'event' | 'page'; title: string; meta?: ReactNode; trailing?: ReactNode; late?: string; onToggle?: () => void | Promise<void>; details?: ReactNode; time?: string; cover?: string; completed?: boolean }) {
  const id = useId(), [open, setOpen] = useState(false), [done, setDone] = useState(completed), [collapsed, setCollapsed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const point = useRef<{ x: number; y: number } | null>(null), pending = useRef(false)
  useEffect(() => { if (!done || completed) return; const timer = setTimeout(() => setCollapsed(true), 1200); return () => clearTimeout(timer) }, [done, completed])
  async function toggle() {
    if (!onToggle || pending.current || done) return
    pending.current = true; setBusy(true); setError('')
    try { await onToggle(); setDone(true) } catch { setError('Could not complete this reminder. Please try again.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <div className={`kit-row-wrap${done ? ' is-done' : ''}${collapsed ? ' is-collapsed' : ''}`}>
    <div className={`kit-row kit-row-${kind}`} onPointerDown={event => { if (event.pointerType === 'touch') point.current = { x: event.clientX, y: event.clientY } }} onPointerCancel={() => { point.current = null }} onPointerUp={event => { const start = point.current; point.current = null; if (kind === 'reminder' && start && event.clientX - start.x > 70 && Math.abs(event.clientY - start.y) < 30) void toggle() }}>
      {kind === 'reminder' ? <button className="kit-row-toggle" aria-label={`Complete ${title}`} disabled={!onToggle || busy || done} onClick={() => void toggle()}><span>{done ? '✓' : ''}</span></button> : kind === 'event' ? <span className="kit-row-time">{time || 'All day'}</span> : <span className="kit-cover-square" style={{ background: cover || '#082744' }} />}
      <button className="kit-row-words" aria-expanded={details ? open : undefined} aria-controls={details ? id : undefined} disabled={!details} onClick={() => setOpen(value => !value)}><span className="kit-row-title">{title}</span>{meta || late ? <Meta parts={[meta, late ? <span className="kit-late">{late}</span> : null]} /> : null}</button>
      {trailing ? <span className="kit-row-trailing">{trailing}</span> : null}
    </div>
    {details ? <div className="kit-row-details" id={id} hidden={!open}>{details}</div> : null}{error ? <p role="alert">{error}</p> : null}
  </div>
}
