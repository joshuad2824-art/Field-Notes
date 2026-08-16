import { useEffect, useState, type ReactNode } from 'react'
import { SIDEBAR_AVAILABLE, SIDEBAR_DOCKED, useMediaQuery } from '../lib/media'
import { setSettings, useSettings } from '../lib/settings'
import { Sidebar } from './Sidebar'

interface Props {
  notebook: string
  activeId?: string
  /* Given the sidebar toggle, so the screen can place it in its own bar. */
  children: (toggle: ReactNode) => ReactNode
}

/* Holds the sidebar next to whatever the screen is showing.

   Docked past 1120px, where there's room for a 268px column and a full
   measure beside it. Between 820 and 1120 — an iPad in portrait — it slides
   over the desk instead of squeezing it, and closes again when you pick
   something. Below that there is no sidebar; the phone navigates screen by
   screen, which is the right shape for one hand. */
export function Shell({ notebook, activeId, children }: Props) {
  const available = useMediaQuery(SIDEBAR_AVAILABLE)
  const docked = useMediaQuery(SIDEBAR_DOCKED)
  const settings = useSettings()
  const [drawerOpen, setDrawerOpen] = useState(false)

  /* A drawer that survived a resize into the docked layout would be a second,
     invisible state. */
  useEffect(() => {
    if (docked) setDrawerOpen(false)
  }, [docked])

  const showDocked = available && docked && settings.sidebar
  const showDrawer = available && !docked && drawerOpen
  const showing = showDocked || showDrawer

  const toggle = available ? (
    <button
      className={`tool glyph${showing ? ' on' : ''}`}
      onClick={() =>
        docked ? setSettings({ sidebar: !settings.sidebar }) : setDrawerOpen((v) => !v)
      }
      aria-label={showing ? 'Hide the list' : 'Show the list'}
      title="The list"
    >
      ☰
    </button>
  ) : null

  return (
    <div className="shell">
      {showDocked ? <Sidebar notebook={notebook} activeId={activeId} /> : null}

      <div className="shell-main">{children(toggle)}</div>

      {showDrawer ? (
        <>
          <div className="sidebar-scrim" onMouseDown={() => setDrawerOpen(false)} />
          <div className="sidebar-drawer">
            <Sidebar
              notebook={notebook}
              activeId={activeId}
              onPick={() => setDrawerOpen(false)}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
