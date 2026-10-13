import { PageDaySheet } from './PageDaySheet'
import { Icon } from './Icon'
import { useEffect, useState, type ReactNode } from 'react'
import { SIDEBAR_AVAILABLE, SIDEBAR_DOCKED, useMediaQuery } from '../lib/media'
import { firstNotebookId, isReserved, useNotebooks } from '../lib/notebooks'
import { navigate, to } from '../lib/router'
import { cycleColumns, openColumns, setSettings, useSettings } from '../lib/settings'
import { NotebookManager } from './NotebookManager'
import { useExternalRail } from './ApprovedFrame'
import { PageList } from './PageList'
import { Rail } from './Rail'

/* What a press of the fold mark will do, named by the step it takes. */
const foldLabel = (from: 1 | 2 | 3, to: 1 | 2 | 3) =>
  to === 3
    ? 'Show the notebooks and the list'
    : to === 2 && from === 1
      ? 'Show the list'
      : to === 2
        ? 'Fold the notebooks'
        : 'Fold the list'

/* The fold mark draws the desk as it stands: a frame with a line for each
   column open beside the page. */
export function FoldGlyph({ columns }: { columns: 1 | 2 | 3 }) {
  return (
    <svg
      className="fn-icon fold-glyph"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7.5 4v16" strokeOpacity={columns >= 2 ? 1 : 0} />
      <path d="M12 4v16" strokeOpacity={columns === 3 ? 1 : 0} />
    </svg>
  )
}

interface Props {
  focus?: boolean
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
export function Shell({
  notebook,
  overview = false,
  activeId,
  children,
  focus = false,
}: Props) {
  const externalRail = useExternalRail()
  const tablet = useMediaQuery('(min-width: 820px) and (max-width: 1199px)')
  const available = useMediaQuery(SIDEBAR_AVAILABLE)
  const regularDocked = useMediaQuery(SIDEBAR_DOCKED)
  const desk = useMediaQuery('(min-width: 1200px)')
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
  const railDocked = !externalRail && docked && settings.rail
  const listDocked = docked && settings.list
  const railOver = !docked && railDrawer

  /* Below the boundary the leaf replaces the list rather than joining it. */
  const showList =
    overview || focus || (tablet && !!activeId) ? false : compact ? !activeId : listDocked
  /* From a tablet up there is room beside the list for the empty leaf, so
     a notebook with no page open still offers somewhere to start one. */
  const showLeaf = overview || (compact ? !!activeId || (available && !activeId) : true)
  /* Nothing to the left saying where we are, so the leaf says it itself. */
  const hidden = docked && !listDocked && !railDocked && !(externalRail && settings.rail)

  const railAvailable = desk && externalRail
  const columns = openColumns(settings, railAvailable)
  const nextColumns: 1 | 2 | 3 = railAvailable
    ? columns === 3 ? 2 : columns === 2 ? 1 : 3
    : columns === 2 ? 1 : 2

  const pickNotebook = (id: string) => {
    /* The journal is somewhere you go, not where you live. Remembering it as
       the notebook the app opens into would mean a visit to it quietly became
       the front door. */
    if (!isReserved(id)) setSettings({ notebook: id })
    setRailDrawer(false)
    navigate(to.notebookHome(id))
  }

  const toggle = overview ? (
    <button
      className="mark-button"
      onClick={() => (docked ? setSettings({ rail: !settings.rail }) : setRailDrawer(true))}
      aria-label={railDocked ? 'Hide the notebooks' : 'Show the notebooks'}
    >
      <Icon name="menu" />
    </button>
  ) : compact ? (
    <button
      className="mark-button list-toggle"
      onClick={() => navigate(to.notebook(notebook))}
      aria-label="The list"
      title="The list"
    >
      <Icon name="menu" />
    </button>
  ) : (
    /* One fold mark for both columns (October 13, third pass). It steps
       3 → 2 → 1 → 3 and draws how many columns are open. */
    <button
      className="mark-button list-toggle fold-mark"
      onClick={() => cycleColumns(railAvailable)}
      aria-label={foldLabel(columns, nextColumns)}
      title={`${foldLabel(columns, nextColumns)} — ⌘\\`}
    >
      <FoldGlyph columns={columns} />
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
          railShown={railDocked || (externalRail && docked && settings.rail)}
          onToggleRail={() =>
            docked ? setSettings({ rail: !settings.rail }) : setRailDrawer(true)
          }
        />
      ) : null}

      {tablet && activeId && !focus ? <PageDaySheet id={activeId} /> : null}
      {showLeaf ? children({ toggle, hidden }) : null}

      {manage ? (
        <NotebookManager
          onClose={() => setManage(false)}
          onAdded={(id) => {
            setSettings({ notebook: id })
            navigate(to.notebookHome(id))
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
