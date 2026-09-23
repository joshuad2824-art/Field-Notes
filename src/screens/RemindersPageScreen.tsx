import { useState, type FormEvent } from 'react'
import { Shell } from '../components/Shell'
import type { Page, SienaItem } from '../lib/model'
import { notebookForPage } from '../lib/notebooks'
import { navigate, to } from '../lib/router'
import { completeReminder, createReminder, remindersForNotebook } from '../lib/siena-items'
import { useLive } from '../lib/useLive'

const dueLabel = new Intl.DateTimeFormat([], { dateStyle: 'medium', timeStyle: 'short' })

/* A real, pinned page in the notebook, with its checklist drawn from the same
   reminder rows that Overview uses. Its Markdown body is only the title, so
   completing an item never has to rewrite or reconcile a second task list. */
export function RemindersPageScreen({ page }: { page: Page }) {
  const book = notebookForPage(page.notebook)
  const reminders = useLive<SienaItem[]>(() => remindersForNotebook(page.notebook), [page.notebook], [])
  const active = reminders.filter((item) => !item.completedAt)
  const completed = reminders.filter((item) => item.completedAt)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [error, setError] = useState('')

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const dueAt = new Date(due).getTime()
    if (!title.trim() || !Number.isFinite(dueAt)) {
      setError('Add the reminder and when it is due.')
      return
    }
    await createReminder(page.notebook, title, dueAt, page.id)
    setTitle('')
    setDue('')
    setError('')
  }

  return (
    <div className="app">
      <div className="statusband" data-stock="paper" />
      <Shell notebook={book.id} activeId={page.id}>
        {({ toggle, hidden }) => (
          <main className="desk">
            <article className="leaf reminder-leaf" data-stock="paper" data-pen="ink">
              <div className="tools"><div className="row">
                {toggle}
                {hidden ? <span className="breadcrumb">{book.name} · Reminders</span> : null}
                <span className="grow" />
                <span className="saved">Pinned</span>
              </div></div>
              <div className="reminder-page-scroll scroll">
                <header className="reminder-page-head">
                  <span className="section-label">{book.name}</span>
                  <h1>Reminders</h1>
                  <p>Check one off here or on the dashboard. Completed reminders remain in From Siena.</p>
                </header>

                <section aria-label="Active reminders" className="reminder-page-list">
                  {active.length ? active.map((item) => (
                    <div className="reminder-page-row" key={item.id}>
                      <button className="reminder-page-check" aria-label={`Mark ${item.title ?? item.body} done`} onClick={() => void completeReminder(item.id)}>
                        <span aria-hidden="true" />
                      </button>
                      <div>
                        <strong>{item.title ?? item.body}</strong>
                        {item.title && item.body !== item.title ? <p>{item.body}</p> : null}
                        {item.dueAt ? <small>Due {dueLabel.format(new Date(item.dueAt))}</small> : null}
                      </div>
                    </div>
                  )) : <p className="reminder-page-empty">No active reminders. This page stays here for the next one.</p>}
                </section>

                <form className="reminder-page-form" onSubmit={(event) => void add(event)}>
                  <h2>Add a reminder</h2>
                  <label>Reminder<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={240} required /></label>
                  <label>Due<input type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} required /></label>
                  {error ? <p role="alert">{error}</p> : null}
                  <button type="submit">Add reminder</button>
                </form>

                <button className="reminder-page-history" onClick={() => navigate(to.fromSiena())}>
                  Completed history{completed.length ? ` · ${completed.length}` : ''} ↗
                </button>
              </div>
            </article>
          </main>
        )}
      </Shell>
    </div>
  )
}
