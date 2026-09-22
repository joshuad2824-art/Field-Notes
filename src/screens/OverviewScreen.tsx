import { useState } from 'react'
import { livePages } from '../lib/db'
import { summarizeOverview } from '../lib/overview'
import { type Page, titleOf } from '../lib/model'
import { notebookForPage, useNotebooks } from '../lib/notebooks'
import { navigate, to } from '../lib/router'
import { useLive } from '../lib/useLive'
import { useSyncStatus, statusLabel } from '../sync/status'

export function OverviewScreen({ notebook }: { notebook: string }) {
  const pages = useLive<Page[]>(() => livePages(), [], [])
  const books = useNotebooks()
  const sync = useSyncStatus()
  const [allTasks, setAllTasks] = useState(false)
  const [allPinned, setAllPinned] = useState(false)
  const overview = summarizeOverview(pages)

  return (
    <div className="app">
      <div className="statusband" />
      <main className="overview-screen scroll">
        <div className="overview-wrap">
          <div className="overview-top">
            <button className="overview-back" onClick={() => navigate(to.notebook(notebook))}>‹ Notebooks</button>
            <span className="overview-sync">{statusLabel(sync) || 'On this device'}</span>
          </div>

          <header className="overview-intro">
            <div className="section-label">Field Notes</div>
            <h1>Overview</h1>
            <p>A place to pick up a thought, find an open loop, or begin again.</p>
          </header>

          <div className="overview-actions" aria-label="Quick actions">
            <button className="overview-action primary" onClick={() => navigate(to.newPage(notebook))}>New page <span aria-hidden="true">↗</span></button>
            <button className="overview-action" onClick={() => navigate(to.today())}>Add to today <span aria-hidden="true">↗</span></button>
            <button className="overview-action" onClick={() => navigate(to.search())}>Search pages <span aria-hidden="true">↗</span></button>
          </div>

          <div className="overview-stats" aria-label="Pages on this device at a glance">
            <div><strong>{overview.pageCount}</strong><span>{overview.pageCount === 1 ? 'Page' : 'Pages'}</span></div>
            <div><strong>{books.length}</strong><span>{books.length === 1 ? 'Notebook' : 'Notebooks'}</span></div>
            <div><strong>{overview.taskCount}</strong><span>{overview.taskCount === 1 ? 'Open checkbox' : 'Open checkboxes'}</span></div>
          </div>

          <div className="overview-grid">
            <section className="overview-card">
              <div className="overview-card-head"><h2>Continue writing</h2><span>Recently edited</span></div>
              {overview.recent.length ? overview.recent.map((page) => (
                <button key={page.id} className="overview-row" onClick={() => navigate(to.page(page.id))}>
                  <span className="overview-row-title">{titleOf(page.body)}</span>
                  <span className="overview-row-meta">{notebookForPage(page.notebook).name}</span>
                </button>
              )) : <p className="overview-empty">Your recent pages will appear here.</p>}
            </section>

            <section className="overview-card">
              <div className="overview-card-head"><h2>Open loops</h2><span>Unchecked on your pages</span></div>
              {overview.tasks.length ? overview.tasks.slice(0, allTasks ? undefined : 6).map((task, index) => (
                <button key={`${task.page.id}-${index}`} className="overview-row task" onClick={() => navigate(to.page(task.page.id))}>
                  <span className="overview-task-mark" aria-hidden="true" />
                  <span><span className="overview-row-title">{task.text}</span><span className="overview-row-meta">{titleOf(task.page.body)}</span></span>
                </button>
              )) : <p className="overview-empty">No unchecked boxes in your pages.</p>}
              {overview.taskCount > 6 ? (
                <button className="overview-more" onClick={() => setAllTasks(!allTasks)}>
                  {allTasks ? 'Show fewer' : `Show all ${overview.taskCount} open checkboxes`}
                </button>
              ) : null}
            </section>

            <section className="overview-card">
              <div className="overview-card-head"><h2>Pinned pages</h2><span>Close at hand</span></div>
              {overview.pinned.length ? overview.pinned.slice(0, allPinned ? undefined : 4).map((page) => (
                <button key={page.id} className="overview-row" onClick={() => navigate(to.page(page.id))}>
                  <span className="overview-row-title">{titleOf(page.body)}</span>
                  <span className="overview-row-meta">{notebookForPage(page.notebook).name}</span>
                </button>
              )) : <p className="overview-empty">Pin a page to keep it close at hand.</p>}
              {overview.pinned.length > 4 ? (
                <button className="overview-more" onClick={() => setAllPinned(!allPinned)}>
                  {allPinned ? 'Show fewer' : `Show all ${overview.pinned.length} pinned pages`}
                </button>
              ) : null}
            </section>

            <section className="overview-card">
              <div className="overview-card-head"><h2>Notebooks</h2><span>Your writing, by place</span></div>
              {books.map((book) => (
                <button key={book.id} className="overview-row book" onClick={() => navigate(to.notebook(book.id))}>
                  <span className="overview-book-dot" style={{ background: book.color }} />
                  <span className="overview-row-title">{book.name}</span>
                  <span className="overview-row-meta">{overview.notebookCounts[book.id] ?? 0}</span>
                </button>
              ))}
            </section>
          </div>

          <section className="overview-siena">
            <div><span className="section-label">Working with Siena</span><h2>Your notes, within reach</h2></div>
            <p>Once connected, Siena can find synced pages, read them with you, capture a new thought, and revise a page you choose. Access is controlled in Settings.</p>
            <button onClick={() => navigate(to.settings())}>Siena settings ↗</button>
          </section>
        </div>
      </main>
    </div>
  )
}
