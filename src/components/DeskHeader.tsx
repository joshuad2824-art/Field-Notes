import { useState } from 'react'
import { Icon } from './Icon'
import { AskSiena } from './AskSiena'
import type { Page } from '../lib/model'
import { navigate, to } from '../lib/router'
import { useCalendarView } from '../lib/calendar-view'

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
  const { month } = useCalendarView()
  const date = new Intl.DateTimeFormat([], { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())
  return <>
    <header className="fn-header">
      <RouteLink className="fn-wordmark" href={to.overview()} aria-label="Field Notes home"><img className="fn-rowan" src="/approved-design/rowan.png" alt="" /><span className="fn-mobile-brand">Field<br />Notes</span></RouteLink>
      <nav className="fn-topnav" aria-label="Saved items"><RouteLink href={to.fromSiena()}>Saved</RouteLink></nav>
      <div className="fn-header-actions">
        <RouteLink className="fn-icon-button fn-desktop-search" href={to.search()} aria-label="Search" title="Search"><Icon name="search" /></RouteLink>
        <RouteLink className="fn-new" href={to.newPage(notebook)} aria-label="New page" title="New page"><Icon name="new-page" /></RouteLink>
        <button className="fn-ask ask-siena-button" onClick={() => setAsking(true)} aria-label="Ask Siena"><Icon name="from-siena" /><span>Ask Siena</span></button>
      </div>
    </header>
    <div className="fn-intro overview-head">
      <div><p className="fn-eyebrow">A quieter corner of the day</p><h1 id="desk-heading" tabIndex={-1}>{title}</h1></div>
      <div className="fn-date"><RouteLink className="fn-date-link" href={to.calendar(month)} aria-label={`${date}. Open full calendar`} title="Open full calendar">{date}</RouteLink></div>
    </div>
    {asking ? <AskSiena pages={pages} onClose={() => setAsking(false)} /> : null}
  </>
}
