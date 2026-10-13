import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { allTags } from '../lib/db'
import { search, type Hit } from '../lib/search'
import { navigate, parentOf, to, up } from '../lib/router'
import { useLive } from '../lib/useLive'
import { liveEvents } from '../lib/events'
import { allSienaItems } from '../lib/siena-items'
import { titleOf } from '../lib/model'
import { useAllNotebooks } from '../lib/notebooks'
import { coverColor } from '../lib/theme'
import { countLabel, shortStamp, readableDay } from '../lib/format'
function Match({ text, query }: { text: string; query: string }) {
  const at = text.toLowerCase().indexOf(query.toLowerCase())
  return at < 0 ? (
    <>{text}</>
  ) : (
    <>
      {text.slice(0, at)}
      <mark className="md-hl md-hl-brass">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  )
}
export function SearchScreen() {
  const [query, setQuery] = useState(''),
    [hits, setHits] = useState<Hit[]>([]),
    [kind, setKind] = useState('Everything'),
    [notebook, setNotebook] = useState(''),
    input = useRef<HTMLInputElement>(null),
    books = useAllNotebooks(),
    events = useLive(liveEvents, [], []),
    items = useLive(allSienaItems, [], []),
    tags = useLive(allTags, [], [])
  useEffect(() => {
    input.current?.focus()
  }, [])
  useEffect(() => {
    let live = true
    void search(query).then((found) => {
      if (live) setHits(found)
    })
    return () => {
      live = false
    }
  }, [query])
  const q = query.trim(),
    pageHits =
      kind === 'Everything' || kind === 'Pages'
        ? hits.filter((h) => !notebook || h.page.notebook === notebook)
        : [],
    eventHits =
      q && !notebook && (kind === 'Everything' || kind === 'Events')
        ? events.filter((e) =>
            `${e.title} ${e.note ?? ''} ${e.location ?? ''}`
              .toLowerCase()
              .includes(q.toLowerCase()),
          )
        : [],
    itemHits =
      q && (kind === 'Everything' || kind === 'From Siena')
        ? items.filter(
            (i) =>
              (!notebook || i.notebook === notebook) &&
              `${i.title ?? ''} ${i.body}`.toLowerCase().includes(q.toLowerCase()),
          )
        : [],
    count = pageHits.length + eventHits.length + itemHits.length
  return (
    <div className="app">
      <main className="search-screen scroll">
        <div className="search-box">
          <Icon name="search" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            type="search"
            aria-label="Search"
            onKeyDown={(e) => {
              /* Search is a back room: Escape in its field leaves it. */
              if (e.key !== 'Escape' || e.defaultPrevented) return
              e.preventDefault()
              up(parentOf({ name: 'search' }) ?? to.overview())
            }}
          />
          <span>{q ? `${count} found` : ''}</span>
        </div>
        <div className="collection-filters search-filters">
          {['Everything', 'Pages', 'Events', 'From Siena'].map((k) => (
            <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
          <span className="filter-divider" />
          {books.map((b) => (
            <button
              key={b.id}
              aria-pressed={notebook === b.id}
              onClick={() => setNotebook(notebook === b.id ? '' : b.id)}
            >
              <i style={{ background: coverColor(b.color) }} />
              {b.name}
            </button>
          ))}
        </div>
        {q ? (
          count ? (
            <div className="search-groups">
              {books.map((b) => {
                const group = pageHits.filter((h) => h.page.notebook === b.id)
                return group.length ? (
                  <section key={b.id}>
                    <h2>
                      <i style={{ background: coverColor(b.color) }} />
                      {b.name}
                      <small>{countLabel(group.length, 'page')}</small>
                    </h2>
                    {group.map((h) => (
                      <button
                        className="search-hit"
                        key={h.page.id}
                        onClick={() => navigate(to.page(h.page.id))}
                      >
                        <div>
                          <strong>
                            <Match text={titleOf(h.page.body)} query={q} />
                          </strong>
                          <p>
                            <Match text={h.excerpt} query={q} />
                          </p>
                        </div>
                        <small>{shortStamp(h.page.updated)}</small>
                      </button>
                    ))}
                  </section>
                ) : null
              })}
              {eventHits.length ? (
                <section>
                  <h2>Events</h2>
                  {eventHits.map((e) => (
                    <button
                      key={e.id}
                      className="search-hit"
                      onClick={() => navigate(to.event(e.id))}
                    >
                      <strong>
                        <Match text={e.title} query={q} />
                      </strong>
                      <small>{readableDay(e.date)}</small>
                    </button>
                  ))}
                </section>
              ) : null}
              {itemHits.length ? (
                <section>
                  <h2>From Siena</h2>
                  {itemHits.map((i) => (
                    <button
                      key={i.id}
                      className="search-hit"
                      onClick={() => navigate(to.fromSiena())}
                    >
                      <div>
                        <strong>
                          <Match text={i.title ?? i.type.replace('_', ' ')} query={q} />
                        </strong>
                        <p>
                          <Match text={i.body.slice(0, 200)} query={q} />
                        </p>
                      </div>
                      <small>{shortStamp(i.created)}</small>
                    </button>
                  ))}
                </section>
              ) : null}
            </div>
          ) : (
            <div className="empty-state">
              <h1>Nothing by that name.</h1>
              <p>
                I looked through{' '}
                {notebook ? 'this notebook' : 'every notebook, the calendar and From Siena'}. A
                shorter word might find it.
              </p>
              <img src="/redesign/pair-puffin-lead.webp" alt="" />
            </div>
          )
        ) : (
          <div className="tagpane" aria-label="Tags">
            <div className="chips">
              {tags.map((t) => (
                <button
                  className="collection-chip"
                  key={t.tag}
                  onClick={() => navigate(to.tag(t.tag))}
                >
                  #{t.tag} · {t.count}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
