# Dashboard spacing — October 7, 2026

The notebook is smaller on desktop, with Remember beside it at the top of the desk. Projects and plans flow directly beneath the notebook in their own column. A long reminder list scrolls inside its paper panel instead of stretching an empty project row. The complete note and all reminders remain available.

Below 1280px the notebook, reminders, projects and plans stack in that order. A fixed backing-sheet offset on phones prevents long reminder lists from widening the screen.

The Davis agenda panel remains. Only its visible “Read only” label is removed; connection, permissions and calendar behavior are unchanged. No household connection or data changes are part of this update.

The source is based on the October 6 tested approved-app handoff, matching the design in the current live v23 release. The older GitHub main dashboard was not used as the editing baseline. This candidate prepares worker v24.

`tests/dashboard-layout.mjs` exercises long reminder lists, full note text, empty and populated projects, independent column spacing, keyboard scrolling, retained Davis UI and responsive bounds at 1920, 1485, 1024, 768, 390 and 320 pixels. It uses disposable synthetic data, never the live archive.
