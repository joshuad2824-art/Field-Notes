import { useEffect } from 'react'
import { useRoute, navigate, to } from './lib/router'
import { createPage } from './lib/db'
import { firstNotebookId, notebookOf, useNotebooks } from './lib/notebooks'
import { getSettings, setSettings, useSettings } from './lib/settings'
import { HomeScreen } from './screens/HomeScreen'
import { PageScreen } from './screens/PageScreen'
import { SearchScreen } from './screens/SearchScreen'
import { TagScreen } from './screens/TagScreen'
import { TrashScreen } from './screens/TrashScreen'
import { SettingsScreen } from './screens/SettingsScreen'

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
    case 'notebook':
      return <HomeScreen notebook={notebookOf(route.notebook)?.id ?? remembered} />
    case 'page':
      return <PageScreen key={route.id} id={route.id} />
    case 'search':
      return <SearchScreen />
    case 'tag':
      return <TagScreen tag={route.tag} />
    case 'trash':
      return <TrashScreen />
    case 'settings':
      return <SettingsScreen />
    default:
      return <HomeScreen notebook={remembered} />
  }
}
