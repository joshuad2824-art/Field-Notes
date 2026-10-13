import { forwardRef } from 'react'
import { navigate, to } from '../lib/router'

export const RouteLink = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>(function RouteLink({ href, children, onClick, ...props }, ref) {
  return <a {...props} ref={ref} href={href} onClick={event => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault(); navigate(href)
  }}>{children}</a>
})

/* The notebook's name is its door: it opens the page list. Search, a new
   page, Ask Siena and Settings are one tap away in the pill and its menu. */
export function DeskHeader({ title, notebook }: { title: string; notebook: string }) {
  return (
    <header className="redesign-desk-header">
      <h1 id="desk-heading" tabIndex={-1}>
        <RouteLink href={to.notebook(notebook)} title="Notebook pages" aria-label={`${title} — notebook pages`}>
          {title}
        </RouteLink>
      </h1>
    </header>
  )
}
