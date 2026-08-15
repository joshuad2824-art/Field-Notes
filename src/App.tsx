import { useEffect } from 'react'
import { useRoute, navigate, to } from './lib/router'
import { createPage } from './lib/db'
import { DEFAULT_NOTEBOOK } from './lib/model'
import { Shelf } from './screens/Shelf'
import { NotebookScreen } from './screens/NotebookScreen'
import { PageScreen } from './screens/PageScreen'
import { SearchScreen } from './screens/SearchScreen'
import { TagScreen } from './screens/TagScreen'
import { TrashScreen } from './screens/TrashScreen'
import { SettingsScreen } from './screens/SettingsScreen'

export function App() {
  const route = useRoute()

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 'k') {
        e.preventDefault()
        navigate(to.search())
      }
      if (key === 'n' && e.shiftKey) {
        e.preventDefault()
        const page = await createPage(DEFAULT_NOTEBOOK)
        navigate(to.page(page.id))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  switch (route.name) {
    case 'notebook':
      return <NotebookScreen notebook={route.notebook} />
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
      return <Shelf />
  }
}
