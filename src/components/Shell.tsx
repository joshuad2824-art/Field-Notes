import { useEffect, useState, type ReactNode } from 'react'
import { createPage } from '../lib/db'
import { SIDEBAR_AVAILABLE, SIDEBAR_DOCKED, useMediaQuery } from '../lib/media'
import { firstNotebookId, useNotebooks } from '../lib/notebooks'
import { navigate, to } from '../lib/router'
import { setSettings, useSettings } from '../lib/settings'
import { NotebookManager } from './NotebookManager'
import { PageList } from './PageList'
import { Rail } from './Rail'

interface Props {
  notebook: string
  /* The open page, if there is one. Below 1120 its presence is what decides
     whether the list or the leaf has the screen. */
  activeId?: string
  children: (marks: { toggle: ReactNode; hidden: boolean }) => ReactNode
}

/* Three columns: the rail, the list, and the desk.

   Past 1120px all three are on screen and the rail starts open. Below that the
   app navigates screen by screen — the list is the whole window, a page takes
   the whole window, and the rail slides over as a drawer that starts closed.
   Crossing the boundary reconciles the flag, because a drawer that survived a
   resize into the docked layout would be a second, invisible state. */
export function Shell({ notebook, activeId, children }: Props) {
  const available = useMediaQuery(SIDEBAR_AVAILABLE)
  const docked = useMediaQuery(SIDEBAR_DOCKED)
  const settings = useSettings()
  const books = useNotebooks()

  const [railDrawer, setRailDrawer] = useState(false)
  const [manage, setManage] = useState(false)

  useEffect(() => {
    if (docked) setRailDrawer(false)
  }, [docked])

  const compact = !docked
  const columnsOn = settings.sidebar
  const railDocked = docked && columnsOn
  const listDocked = docked && columnsOn
  const railOver = !docked && railDrawer

  /* Below the boundary the leaf replaces the list rather than joining it. */
  const showList = compact ? !activeId : listDocked
  const showLeaf = compact ? !!activeId : true
  const hidden = docked && !columnsOn

  const pickNotebook = (id: string) => {
    setSettings({ notebook: id })
    setRailDrawer(false)
    navigate(to.notebook(id))
  }

  const newPage = async () => {
    const page = await createPage(notebook)
    setRailDrawer(false)
    navigate(to.page(page.id))
  }

  const toggle = (
    <button
      className={`mark-button${!hidden && available ? ' on' : ''}`}
      onClick={() => {
        if (compact) navigate(to.notebook(notebook))
        else setSettings({ sidebar: !columnsOn })
      }}
      aria-label={compact ? 'The list' : hidden ? 'Show the columns' : 'Hide the columns'}
      title="The list — ⌘\"
    >
      ☰
    </button>
  )

  return (
    <div className="shell">
      {railOver ? (
        <div className="rail-scrim" onMouseDown={() => setRailDrawer(false)} />
      ) : null}

      {railDocked || railOver ? (
        <div className={railOver ? 'rail-drawer' : 'rail-slot'}>
          <Rail
            activeId={notebook}
            onPick={pickNotebook}
            onManage={() => setManage(true)}
            onNewPage={newPage}
          />
        </div>
      ) : null}

      {showList ? (
        <PageList
          notebook={notebook}
          activeId={activeId}
          compact={compact}
          showRailButton={!docked || !columnsOn}
          onOpenRail={() => (docked ? setSettings({ sidebar: true }) : setRailDrawer(true))}
          onNewPage={newPage}
        />
      ) : null}

      {showLeaf ? children({ toggle, hidden }) : null}

      {manage ? (
        <NotebookManager
          onClose={() => setManage(false)}
          onAdded={(id) => {
            setSettings({ notebook: id })
            navigate(to.notebook(id))
          }}
          onDeleted={(id) => {
            if (id !== notebook) return
            const next = books.find((book) => book.id !== id)?.id ?? firstNotebookId()
            setSettings({ notebook: next })
            navigate(to.notebook(next), { replace: true })
          }}
        />
      ) : null}
    </div>
  )
}
