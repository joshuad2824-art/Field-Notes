import { useEffect, useState, type ReactNode } from 'react'
import { createPage } from '../lib/db'
import { SIDEBAR_AVAILABLE, SIDEBAR_DOCKED, useMediaQuery } from '../lib/media'
import { firstNotebookId, isReserved, useNotebooks } from '../lib/notebooks'
import { navigate, to } from '../lib/router'
import { setSettings, useSettings } from '../lib/settings'
import { NotebookManager } from './NotebookManager'
import { PageList } from './PageList'
import { Rail } from './Rail'

interface Props {
  notebook: string
  overview?: boolean
  /* The open page, if there is one. Below 1120 its presence is what decides
     whether the list or the leaf has the screen. */
  activeId?: string
  children: (marks: { toggle: ReactNode; hidden: boolean }) => ReactNode
}

/* Three columns: the rail, the list, and the desk.

   Past 1120px all three are on screen and both columns start open. Each folds
   on its own: the mark on the desk folds the list, the mark in the list head
   folds the rail, and the rail can fold itself. Below 1120 the app navigates
   screen by screen — the list is the whole window, a page takes the whole
   window, and the rail slides over as a drawer that starts closed. Crossing
   the boundary reconciles the drawer, because one that survived a resize into
   the docked layout would be a second, invisible state. */
export function Shell({ notebook, overview = false, activeId, children }: Props) {
  const available = useMediaQuery(SIDEBAR_AVAILABLE)
  const regularDocked = useMediaQuery(SIDEBAR_DOCKED)
  /* Overview needs only the rail and the desk, so the familiar sidebar can
     dock sooner than it can on the three-column writing screen. */
  const overviewDocked = useMediaQuery('(min-width: 1000px)')
  const docked = overview ? overviewDocked : regularDocked
  const settings = useSettings()
  const books = useNotebooks()

  const [railDrawer, setRailDrawer] = useState(false)
  const [manage, setManage] = useState(false)

  useEffect(() => {
    if (docked) setRailDrawer(false)
  }, [docked])

  const compact = !docked
  const railDocked = docked && settings.rail
  const listDocked = docked && settings.list
  const railOver = !docked && railDrawer

  /* Below the boundary the leaf replaces the list rather than joining it. */
  const showList = overview ? false : compact ? !activeId : listDocked
  const showLeaf = overview || (compact ? !!activeId : true)
  /* Nothing to the left saying where we are, so the leaf says it itself. */
  const hidden = docked && !listDocked && !railDocked

  const pickNotebook = (id: string) => {
    /* The journal is somewhere you go, not where you live. Remembering it as
       the notebook the app opens into would mean a visit to it quietly became
       the front door. */
    if (!isReserved(id)) setSettings({ notebook: id })
    setRailDrawer(false)
    navigate(to.notebook(id))
  }

  const newPage = async () => {
    const page = await createPage(notebook)
    setRailDrawer(false)
    navigate(to.page(page.id))
  }

  const toggle = overview ? (
    <button
      className="mark-button"
      onClick={() => docked ? setSettings({ rail: !settings.rail }) : setRailDrawer(true)}
      aria-label={railDocked ? 'Hide the notebooks' : 'Show the notebooks'}
    >☰</button>
  ) : (
    <button
      className={`mark-button${listDocked && available ? ' on' : ''}`}
      onClick={() => {
        if (compact) navigate(to.notebook(notebook))
        else setSettings({ list: !settings.list })
      }}
      aria-label={compact ? 'The list' : listDocked ? 'Hide the list' : 'Show the list'}
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
            activeId={overview ? '' : notebook}
            onPick={pickNotebook}
            onManage={() => setManage(true)}
            onFold={() => (docked ? setSettings({ rail: false }) : setRailDrawer(false))}
          />
        </div>
      ) : null}

      {showList ? (
        <PageList
          notebook={notebook}
          activeId={activeId}
          compact={compact}
          railShown={railDocked}
          onToggleRail={() =>
            docked ? setSettings({ rail: !settings.rail }) : setRailDrawer(true)
          }
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
