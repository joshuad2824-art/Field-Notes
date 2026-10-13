import { forwardRef } from 'react'
import { navigate } from '../lib/router'
import { NotebookSwitcher } from './NotebookSwitcher'

export const RouteLink = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>(function RouteLink({ href, children, onClick, ...props }, ref) {
  return <a {...props} ref={ref} href={href} onClick={event => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault(); navigate(href)
  }}>{children}</a>
})

/* The notebook's name is the switcher here as on every notebook, so a desk
   is never a room you cannot leave for another notebook. Its own page list
   is the "From your notebook" heading. */
export function DeskHeader({ title, notebook }: { title: string; notebook: string }) {
  return (
    <header className="redesign-desk-header">
      <h1 id="desk-heading" tabIndex={-1}>
        <NotebookSwitcher notebook={notebook}>{title}</NotebookSwitcher>
      </h1>
    </header>
  )
}
