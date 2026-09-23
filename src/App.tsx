import { useEffect } from 'react'
import { useRoute, navigate, to } from './lib/router'
import { captureNew, captureToday, wantCaretAtEnd } from './lib/capture'
import { createPage } from './lib/db'
import { firstNotebookId, notebookOf, useNotebooks } from './lib/notebooks'
import { getSettings, setSettings, useSettings } from './lib/settings'
import { HomeScreen } from './screens/HomeScreen'
import { PageScreen } from './screens/PageScreen'
import { SearchScreen } from './screens/SearchScreen'
import { TagScreen } from './screens/TagScreen'
import { TrashScreen } from './screens/TrashScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { CalendarScreen } from './screens/CalendarScreen'
import { DayScreen } from './screens/DayScreen'
import { OAuthConsentScreen } from './screens/OAuthConsentScreen'
import { OverviewScreen } from './screens/OverviewScreen'
import { FromSienaScreen } from './screens/FromSienaScreen'
import { EventScreen } from './screens/EventScreen'
import { ReviewScreen } from './screens/ReviewScreen'

export function App() {
  const route = useRoute()
  const settings = useSettings()
  const books = useNotebooks()

  /* The remembered notebook, unless it has been deleted out from under us. */
  const remembered = notebookOf(settings.notebook)?.id ?? books[0]?.id ?? firstNotebookId()

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()

      if (key === 'k') {
        e.preventDefault()
        navigate(to.search())
      }
      /* Each column folds on its own: ⌘\ the list, ⌘⇧\ the notebooks.
         Read at press time rather than from the closure. */
      if (key === '\\') {
        e.preventDefault()
        if (e.shiftKey) setSettings({ rail: !getSettings().rail })
        else setSettings({ list: !getSettings().list })
      }
      if (key === 'n' && e.shiftKey) {
        e.preventDefault()
        const page = await createPage(remembered)
        navigate(to.page(page.id))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [remembered])

  switch (route.name) {
    case 'oauth-consent':
      return <OAuthConsentScreen />
    case 'overview':
      return <OverviewScreen notebook={remembered} />
    case 'shelf':
      return <OverviewScreen notebook={remembered} />
    case 'from-siena':
      return <FromSienaScreen />
    case 'event-new':
      return <EventScreen date={route.date} notebook={remembered} />
    case 'event':
      return <EventScreen id={route.id} notebook={remembered} />
    case 'notebook':
      return <HomeScreen notebook={notebookOf(route.notebook)?.id ?? remembered} />
    case 'page':
      return <PageScreen key={route.id} id={route.id} />
    case 'review':
      return <ReviewScreen key={route.id} id={route.id} />
    case 'search':
      return <SearchScreen />
    case 'tag':
      return <TagScreen tag={route.tag} />
    case 'day':
      return <DayScreen key={route.iso} iso={route.iso} notebook={remembered} />
    case 'calendar':
      return <CalendarScreen key={route.month ?? 'now'} month={route.month} notebook={remembered} />
    case 'trash':
      return <TrashScreen />
    case 'settings':
      return <SettingsScreen />
    case 'new':
      return <CaptureScreen key={`new-${route.notebook ?? ''}`} kind="new" notebook={route.notebook} />
    case 'today':
      return <CaptureScreen key="today" kind="today" />
    default:
      return <OverviewScreen notebook={remembered} />
  }
}

/* The routes that create. Nothing is drawn — the page they make replaces them
   in history before anything could paint, so back from the new page steps
   over this moment rather than into it, and an abandoned /new can't strand an
   empty page behind the back button. */
function CaptureScreen({ kind, notebook }: { kind: 'new' | 'today'; notebook?: string }) {
  useEffect(() => {
    let live = true
    void (async () => {
      const id = kind === 'new' ? await captureNew(notebook) : await captureToday()
      if (!live) return
      /* An appended line wants the caret after the stamp, not at the top. */
      if (kind === 'today') wantCaretAtEnd(id)
      navigate(to.page(id), { replace: true })
    })()
    return () => {
      live = false
    }
  }, [kind, notebook])
  return null
}
