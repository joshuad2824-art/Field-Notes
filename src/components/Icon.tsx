// Original Field Notes artwork, shared by navigation and item controls.
const artwork = {
  list: <path d="M8 6h12M8 12h12M8 18h12M3 6h1M3 12h1M3 18h1" />,
  filter: <path d="M4 7h16M7 12h10M10 17h4" />,
  edit: (
    <>
      <path d="m5 15 10.8-11 3.4 3.3L8.3 18.2 4 20zM13.8 6l3.4 3.3M4 20l4.3-1.8" />
    </>
  ),
  add: <path d="M12 4v16M4 12h16" />,
  image: (
    <>
      <path d="M3.8 4.8h16.4v14.4H3.8zM4 17l5-6 4 4 3-3 4 5" />
      <circle cx="15.8" cy="8.5" r="1.2" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  menu: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  undo: <path d="m9 4-5 5 5 5M4 9h9a6 6 0 0 1 0 12" />,
  redo: <path d="m15 4 5 5-5 5M20 9h-9a6 6 0 0 0 0 12" />,
  save: (
    <>
      <path d="M4 3.8h13l3 3v13.4H4zM8 4v6h8V4M8 20v-6h8v6" />
    </>
  ),
  restore: (
    <>
      <path d="M4 9a8 8 0 1 1 0 6M4 4v5h5M12 7v5l4 2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 10v7M12 6.8v.4" />
    </>
  ),
  link: (
    <>
      <path d="m9 15 6-6M7 13l-2 2a4 4 0 0 0 6 6l3-3M17 11l2-2a4 4 0 0 0-6-6l-3 3" />
    </>
  ),
  table: <path d="M4 4h16v16H4zM4 10h16M4 15h16M10 4v16" />,
  upload: <path d="m7 9 5-5 5 5M12 4v12M4 16v4h16v-4" />,
  download: <path d="m7 11 5 5 5-5M12 4v12M4 16v4h16v-4" />,
  refresh: <path d="M20 9a8 8 0 0 0-14-3L3 9M3 4v5h5M4 15a8 8 0 0 0 14 3l3-3M21 20v-5h-5" />,
  pin: <path d="m9 3 8 3-2 5 2 4-5-1-3 5-1-7-4-1 4-3zM9 19l-3 3" />,
  indent: <path d="M11 5h9M11 12h9M11 19h9M3 8l4 4-4 4" />,
  outdent: <path d="M11 5h9M11 12h9M11 19h9M7 8l-4 4 4 4" />,
  copy: (
    <>
      <path d="M8 7h12v14H8zM16 7V3H4v14h4M11 11h6M11 15h6" />
    </>
  ),
  plan: (
    <>
      <path d="M5 3h10l4 4v14H5zM15 3v5h4M8 11h8M8 15h5M8 18h8" />
    </>
  ),
  workshop: (
    <>
      <path d="m15 12-8.4 8.4a2 2 0 0 1-2.8-2.8L12 9M18 15l4-4-3-3-1 1-5-5-5 1 6 6-1 1z" />
    </>
  ),
  print: (
    <>
      <path d="M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7zM16 11h1" />
    </>
  ),
  back: (
    <>
      <path d="M19.5 12H4.8M10.3 6.5 4.8 12l5.5 5.5" />
    </>
  ),
  calendar: (
    <>
      <path d="M4.1 5.8h15.8v14H4.1zM4.1 9.5h15.8M8 3.6v4.2M16 3.6v4.2M8 13h2M13.8 13h2M8 16.6h2M13.8 16.6h2" />
    </>
  ),
  circle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
    </>
  ),
  done: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  forward: (
    <>
      <path d="M4.5 12h14.7M13.7 6.5l5.5 5.5-5.5 5.5" />
    </>
  ),
  'from-siena': (
    <>
      <path d="m4 4-3 11v5h22v-5L20 4ZM1 15h6l2 3h6l2-3h6" />
    </>
  ),
  'manage-notebooks': (
    <>
      <path d="M4.5 5.2h5.2v14H4.5zM10.1 7h4.6v12.2h-4.6zM15 4.6h4.7v14.6H15zM4.4 19.6h15.7" />
      <path d="M6.4 8h1.4M11.5 10h1.6M16.5 7.6h1.6M6.4 16.7h1.4M11.5 16.7h1.6M16.5 16.7h1.6" />
    </>
  ),
  'new-page': (
    <>
      <path d="M5.1 3.8h9.4l4.2 4.2v11.9H5.1zM14.5 3.9V8h4M8 11.3h7.8M11.9 8.9v5" />
      <path d="M8 17.4h7.8" />
    </>
  ),
  notebook: (
    <>
      <path d="M12 7v14M3 3h6a3 3 0 0 1 3 3 3 3 0 0 1 3-3h6v17h-6a3 3 0 0 0-3 1 3 3 0 0 0-3-1H3z" />
    </>
  ),
  overview: (
    <>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  seen: (
    <>
      <path d="M2.7 12c2.5-3.8 5.6-5.7 9.3-5.7s6.8 1.9 9.3 5.7c-2.5 3.8-5.6 5.7-9.3 5.7S5.2 15.8 2.7 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  settings: (
    <>
      <path d="m10.6 3.5-.4 2.1-1.7.7-1.8-1.1-2 2 1.1 1.8-.7 1.7-2.1.4v2.8l2.1.4.7 1.7-1.1 1.8 2 2 1.8-1.1 1.7.7.4 2.1h2.8l.4-2.1 1.7-.7 1.8 1.1 2-2-1.1-1.8.7-1.7 2.1-.4v-2.8l-2.1-.4-.7-1.7 1.1-1.8-2-2-1.8 1.1-1.7-.7-.4-2.1z" />
      <circle cx="12" cy="12.5" r="3.1" />
    </>
  ),
  source: (
    <>
      <path d="M14 4h6v6M20 4l-9 9M10 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-5" />
    </>
  ),
  trash: (
    <>
      <path d="M4.8 6.8h14.4M8.2 6.8V4.5h7.6v2.3M6.7 7.2l.8 12.3h9l.8-12.3M10 10.4v5.7M14 10.4v5.7" />
    </>
  ),
  unseen: (
    <>
      <path d="M2.7 12c2.5-3.8 5.6-5.7 9.3-5.7s6.8 1.9 9.3 5.7c-2.5 3.8-5.6 5.7-9.3 5.7S5.2 15.8 2.7 12Z" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M4 20 20 4" />
    </>
  ),
}

export function Icon({ name }: { name: keyof typeof artwork }) {
  return (
    <svg
      className="fn-icon"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {artwork[name]}
    </svg>
  )
}
