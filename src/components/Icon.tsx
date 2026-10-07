// Original Field Notes artwork, shared by navigation and item controls.
const artwork = {
  'copy': <><path d="M8 7h12v14H8zM16 7V3H4v14h4M11 11h6M11 15h6" /></>,
  'plan': <><path d="M5 3h10l4 4v14H5zM15 3v5h4M8 11h8M8 15h5M8 18h8" /></>,
  'workshop': <><path d="m4 20 9-9M13 4a5 5 0 0 0-1 7l1 1a5 5 0 0 0 7-1l-4-1-2-3 1-4zM3 17l4 4" /></>,
  'print': <><path d="M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7zM16 11h1" /></>,
  'back': <><path d="M19.5 12H4.8M10.3 6.5 4.8 12l5.5 5.5"/></>,
  'calendar': <><path d="M4.1 5.8h15.8v14H4.1zM4.1 9.5h15.8M8 3.6v4.2M16 3.6v4.2M8 13h2M13.8 13h2M8 16.6h2M13.8 16.6h2"/></>,
  'circle': <><circle cx="12" cy="12" r="8.5"/></>,
  'done': <><circle cx="12" cy="12" r="8.5"/><path d="m8 12 2.5 2.5L16 9"/></>,
  'forward': <><path d="M4.5 12h14.7M13.7 6.5l5.5 5.5-5.5 5.5"/></>,
  'from-siena': <><path d="M5.2 3.9h9.5l4.1 4v12.2H5.2zM14.6 4v4.1h4M8 16.6h7.7"/>
      <path d="m11.8 9.1.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/></>,
  'manage-notebooks': <><path d="M4.5 5.2h5.2v14H4.5zM10.1 7h4.6v12.2h-4.6zM15 4.6h4.7v14.6H15zM4.4 19.6h15.7"/>
      <path d="M6.4 8h1.4M11.5 10h1.6M16.5 7.6h1.6M6.4 16.7h1.4M11.5 16.7h1.6M16.5 16.7h1.6"/></>,
  'new-page': <><path d="M5.1 3.8h9.4l4.2 4.2v11.9H5.1zM14.5 3.9V8h4M8 11.3h7.8M11.9 8.9v5"/>
      <path d="M8 17.4h7.8"/></>,
  'notebook': <><path d="M6.2 3.7c-.9.1-1.4.9-1.4 1.8v13c0 1 .6 1.7 1.6 1.8l12.1.1c.5 0 .8-.3.8-.8V4.7c0-.5-.3-.8-.8-.8L6.2 3.7Z"/>
      <path d="M8 4v16.2M4.8 17.2c1-.7 2.2-.7 3.2-.2M10.7 7.2h6.2M10.7 16.7h6.2"/>
      <path d="m13.8 9.5.65 1.85 1.85.65-1.85.65-.65 1.85-.65-1.85-1.85-.65 1.85-.65z"/></>,
  'overview': <><path d="M3.6 4.2h7.2v7.2H3.6zM13.2 4.2h7.2v5.2h-7.2zM3.6 13.8h7.2v6H3.6zM13.2 11.8h7.2v8h-7.2z"/>
      <path d="M5.3 7.4h3.7M14.9 6.7h3.6M5.3 16.8h3.7M14.9 15h3.7"/></>,
  'search': <><circle cx="10.4" cy="10.5" r="5.9"/>
      <path d="m14.8 14.9 5.1 5.1M7.5 7.8c.8-.8 1.8-1.2 2.9-1.2"/></>,
  'seen': <><path d="M2.7 12c2.5-3.8 5.6-5.7 9.3-5.7s6.8 1.9 9.3 5.7c-2.5 3.8-5.6 5.7-9.3 5.7S5.2 15.8 2.7 12Z"/><circle cx="12" cy="12" r="2.6"/></>,
  'settings': <><path d="m10.6 3.5-.4 2.1-1.7.7-1.8-1.1-2 2 1.1 1.8-.7 1.7-2.1.4v2.8l2.1.4.7 1.7-1.1 1.8 2 2 1.8-1.1 1.7.7.4 2.1h2.8l.4-2.1 1.7-.7 1.8 1.1 2-2-1.1-1.8.7-1.7 2.1-.4v-2.8l-2.1-.4-.7-1.7 1.1-1.8-2-2-1.8 1.1-1.7-.7-.4-2.1z"/>
      <circle cx="12" cy="12.5" r="3.1"/></>,
  'source': <><path d="M14 4h6v6M20 4l-9 9M10 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-5" /></>,
  'trash': <><path d="M4.8 6.8h14.4M8.2 6.8V4.5h7.6v2.3M6.7 7.2l.8 12.3h9l.8-12.3M10 10.4v5.7M14 10.4v5.7"/></>,
  'unseen': <><path d="M2.7 12c2.5-3.8 5.6-5.7 9.3-5.7s6.8 1.9 9.3 5.7c-2.5 3.8-5.6 5.7-9.3 5.7S5.2 15.8 2.7 12Z"/><circle cx="12" cy="12" r="2.6"/><path d="M4 20 20 4"/></>,
}

export function Icon({ name }: { name: keyof typeof artwork }) {
  return <svg className="fn-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{artwork[name]}</svg>
}
