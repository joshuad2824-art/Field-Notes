import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { allTags } from '../lib/db'
import { matchesWords, search, type Found } from '../lib/search'
import { navigate, parentOf, to, up } from '../lib/router'
import { useLive } from '../lib/useLive'
import { liveEvents } from '../lib/events'
import { allSienaItems } from '../lib/siena-items'
import { titleOf } from '../lib/model'
import { useAllNotebooks } from '../lib/notebooks'
import { coverColor } from '../lib/theme'
import { countLabel, shortStamp, readableDay } from '../lib/format'
/* Every word that matched is marked, wherever it falls — not only the whole
   query as one phrase, which a two-word or a misspelled search never is. */
function Match({ text, words }: { text: string; words: string[] }) {
  const wanted = [...new Set(words.map((w) => w.toLowerCase()).filter((w) => w.length > 1))]
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!wanted.length) return <>{text}</>
  const parts = text.split(new RegExp(`(${wanted.join('|')})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          <mark key={i} className="md-hl md-hl-brass">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}
export function SearchScreen() {
  const [query, setQuery] = useState(''),
    [found, setFound] = useState<Found>({ hits: [], total: 0 }),
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
    /* A breath after the last keystroke, so a word typed quickly is one
       search rather than one per letter, each over the whole archive. */
    const timer = window.setTimeout(() => {
      void search(query, { notebook: notebook || undefined }).then((next) => {
        if (live) setFound(next)
      })
    }, query.trim() ? 90 : 0)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query, notebook])
  const q = query.trim(),
    pages = kind === 'Everything' || kind === 'Pages',
    pageHits = pages ? found.hits : [],
    pageTotal = pages ? found.total : 0,
    words = q.split(/\s+/).filter(Boolean),
    eventHits =
      q && !notebook && (kind === 'Everything' || kind === 'Events')
        ? events.filter((e) => matchesWords(`${e.title} ${e.note ?? ''} ${e.location ?? ''}`, q))
        : [],
    itemHits =
      q && (kind === 'Everything' || kind === 'From Siena')
        ? items.filter(
            (i) =>
              (!notebook || i.notebook === notebook) &&
              matchesWords(`${i.title ?? ''} ${i.body}`, q),
          )
        : [],
    count = pageTotal + eventHits.length + itemHits.length,
    /* Notebooks in the order of their best page, so the best match is at the top. */
    groups = [...new Set(pageHits.map((h) => h.page.notebook))]
      .map((id) => books.find((b) => b.id === id))
      .filter((b): b is (typeof books)[number] => !!b)
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
              {groups.map((b) => {
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
                            <Match text={titleOf(h.page.body)} words={[...words, ...h.terms]} />
                          </strong>
                          <p>
                            <Match text={h.excerpt} words={[...words, ...h.terms]} />
                          </p>
                        </div>
                        <small>{shortStamp(h.page.updated)}</small>
                      </button>
                    ))}
                  </section>
                ) : null
              })}
              {pageTotal > pageHits.length ? (
                <p className="search-more">
                  First {pageHits.length} of {pageTotal} pages
                </p>
              ) : null}
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
                        <Match text={e.title} words={words} />
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
                      onClick={() => navigate(`${to.fromSiena()}#siena-${i.id}`)}
                    >
                      <div>
                        <strong>
                          <Match text={i.title ?? i.type.replace('_', ' ')} words={words} />
                        </strong>
                        <p>
                          <Match text={i.body.slice(0, 200)} words={words} />
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
