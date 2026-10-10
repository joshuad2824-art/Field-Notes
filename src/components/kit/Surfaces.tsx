import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../Icon'
import { RouteLink } from '../DeskHeader'

export type Action = { label: string; onClick: () => void }
export function Actions({ actions = [] }: { actions?: Action[] }) {
  return <div className="kit-actions">{actions.slice(0, 2).map(action => <button key={action.label} onClick={action.onClick}>{action.label}</button>)}{actions.length > 2 ? <details className="kit-more" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}><summary aria-label="More actions"><Icon name="more" /></summary><div>{actions.slice(2).map(action => <button key={action.label} onClick={event => { action.onClick(); const details = event.currentTarget.closest('details'); if (details) { details.open = false; details.querySelector('summary')?.focus() } }}>{action.label}</button>)}</div></details> : null}</div>
}
export function Masthead({ title, dek, back, primary, secondary, child = false }: { title: string; dek?: string; back?: { label: string; href: string }; primary?: Action; secondary?: Action[]; child?: boolean }) {
  return <header className={`kit-masthead${child ? ' is-child' : ''}`}>{back ? <RouteLink className="kit-back" href={back.href}><Icon name="back" />{back.label}</RouteLink> : null}<div className="kit-masthead-line"><div><h1>{title}</h1>{dek ? <p>{dek}</p> : null}</div>{primary ? <button className="kit-primary" onClick={primary.onClick}>{primary.label}</button> : null}</div><Actions actions={secondary} /></header>
}
export function DeskContainer({ children }: { children: ReactNode }) { return <div className="kit-desk">{children}</div> }
export function ReadingColumn({ children, contents }: { children: ReactNode; contents?: ReactNode }) { return <div className="kit-reading-layout">{contents ? <nav className="kit-contents" aria-label="Contents">{contents}</nav> : null}<div className="kit-reading">{children}</div></div> }
export function SectionHead({ eyebrow, title, count, actions }: { eyebrow?: string; title: string; count?: number; actions?: Action[] }) {
  return <header className="kit-section-head">{eyebrow ? <div className="kit-eyebrow">{eyebrow}</div> : null}<div><h2>{title}{count !== undefined ? <span className="kit-count">{count}</span> : null}</h2><Actions actions={actions} /></div></header>
}
export function Paper({ stock = 'cream', rule = 'plain', notebookColor, children }: { stock?: 'cream' | 'manila' | 'plate'; rule?: 'plain' | 'ruled' | 'dot' | 'graph'; notebookColor?: string; children: ReactNode }) {
  return <section className="kit-paper" data-stock={stock} data-rule={rule} style={notebookColor ? { borderTop: `6px solid ${notebookColor}` } : undefined}>{children}</section>
}
export function Meta({ parts, label }: { parts: (ReactNode | null | undefined | false)[]; label?: boolean }) {
  const visible = parts.filter(part => part !== null && part !== undefined && part !== false && part !== '')
  return <span className={`kit-meta${label ? ' is-label' : ''}`}>{visible.map((part, index) => <span key={index}>{index ? <span aria-hidden="true"> · </span> : null}{part}</span>)}</span>
}
export function Card({ skin = 'index', decoration = 0, href, title, body, meta, image, onEdit, notebookColor }: { skin?: 'index' | 'print' | 'tag'; decoration?: number; href: string; title: string; body?: string; meta?: ReactNode; image?: { src: string; alt: string }; onEdit?: () => void; notebookColor?: string }) {
  const angle = [-7, 11, -2][((decoration % 3) + 3) % 3]
  return <article className={`kit-card kit-card-${skin}`} style={{ '--kit-tape-angle': `${angle}deg`, '--kit-cover': notebookColor || '#ae9546' } as CSSProperties}>
    <RouteLink className="kit-card-link" href={href}>{image ? <img src={image.src} alt={image.alt} /> : null}<h3>{title}</h3>{body ? <p>{body}</p> : null}{meta ? <div className="kit-card-foot">{meta}</div> : null}</RouteLink>
    {onEdit ? <button className="kit-card-edit" aria-label={`Edit ${title}`} onClick={onEdit}><Icon name="edit" /></button> : null}
  </article>
}
