// Diagnostic fixture only. Matches the app's current viewport sizing rules;
// it never opens the app database, syncs, or registers a service worker.
const root = document.documentElement
const vv = window.visualViewport
const variant = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content
const probe = document.createElement('div')
probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0'
document.body.append(probe)
const measure = token => {
  probe.style.height = `var(${token})`
  return Math.round(probe.getBoundingClientRect().height)
}
const read = () => {
  const height = vv?.height ?? innerHeight
  const top = vv?.offsetTop ?? 0
  const keyboard = innerHeight - height > 120
  if (keyboard) {
    root.style.setProperty('--app-height', `${Math.round(height)}px`)
    root.style.setProperty('--app-top', `${Math.round(top)}px`)
    root.style.setProperty('--browser-bottom', '0px')
  } else {
    root.style.removeProperty('--app-height')
    root.style.removeProperty('--app-top')
    root.style.setProperty('--browser-bottom', `${Math.max(0, Math.min(160, Math.round(innerHeight-height-top)))}px`)
    const outside = screen.height - innerHeight
    root.style.setProperty('--outside-bottom', `${outside > 0 && outside <= 120 ? Math.round(outside) : 0}px`)
  }
  if (scrollY || scrollX) scrollTo(0, 0)
  const rect = document.getElementById('root').getBoundingClientRect()
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
  document.getElementById('mode').textContent = installed ? 'Opened from Home Screen' : 'Browser preview — install this test to compare'
  document.getElementById('report').textContent = [
    `Field Notes screen comparison: ${document.body.dataset.test}`,
    `Status bar: ${variant}`,
    `Home Screen: ${installed}`,
    `Keyboard detected: ${keyboard}`,
    `Screen: ${screen.width} × ${screen.height}`,
    `Window: ${innerWidth} × ${innerHeight}`,
    `Visual height / top: ${Math.round(height)} / ${Math.round(top)}`,
    `Document height: ${root.clientHeight}`,
    `App top / bottom: ${Math.round(rect.top)} / ${Math.round(rect.bottom)}`,
    `Screen minus window: ${screen.height - innerHeight}`,
    `Safe top / raw bottom: ${measure('--safe-top')} / ${measure('--raw-inset-bottom')}`,
    `Effective bottom padding: ${measure('--safe-bottom')}`,
    `Agent: ${navigator.userAgent}`,
  ].join('\n')
}
for (const event of ['resize', 'orientationchange', 'focusin', 'focusout']) window.addEventListener(event, read)
vv?.addEventListener('resize', read)
vv?.addEventListener('scroll', read)
document.addEventListener('scroll', read, {passive: true})
document.getElementById('dismiss').addEventListener('click', () => { document.activeElement?.blur(); read() })
document.getElementById('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(document.getElementById('report').textContent)
    document.getElementById('copy-status').textContent = 'Report copied. Paste it into our conversation.'
  } catch {
    document.getElementById('copy-status').textContent = 'Copy was unavailable. You can send a screenshot of the report instead.'
  }
})
read()
