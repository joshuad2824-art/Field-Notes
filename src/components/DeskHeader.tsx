import { useState } from 'react'
import { Icon } from './Icon'
import { AskSiena } from './AskSiena'
import type { Page } from '../lib/model'
import { navigate, to } from '../lib/router'

export function RouteLink({ href, children, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...props} href={href} onClick={event => {
    onClick?.(event)
    if (event.defaultPrevented) return
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault(); navigate(href)
  }}>{children}</a>
}

export function DeskHeader({ title, notebook, pages }: { title: string; notebook: string; pages: Page[] }) {
  const [asking, setAsking] = useState(false)
  return <>
    <header className="redesign-desk-header"><div><span className="section-label">{title === 'Workshop' ? 'Plans, tools & work in progress' : 'Notebook desk'}</span><h1 id="desk-heading" tabIndex={-1}>{title === 'Workshop' ? 'The Workshop' : title}</h1></div><div className="desk-header-tools"><RouteLink href={to.search()} aria-label="Search" title="Search"><Icon name="search"/></RouteLink><RouteLink href={to.newPage(notebook)} aria-label="New page" title="New page"><Icon name="new-page"/></RouteLink><button onClick={()=>setAsking(true)} aria-label="Ask Siena" title="Ask Siena"><Icon name="from-siena"/></button><RouteLink href={to.settings()} aria-label="Settings" title="Settings"><Icon name="settings"/></RouteLink></div></header>
    {asking ? <AskSiena pages={pages} onClose={() => setAsking(false)} /> : null}
  </>
}
