export const NATIVE_WIDGET_ROUTE_EVENT = 'field-notes:native-widget-route'
export interface NativeWidgetNavigation { path: string; replace: boolean }

// Only navigation destinations emitted by our native widgets are accepted.
// Links cannot pair an archive, carry credentials or create/modify a note.
export function nativeWidgetRoute(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 180) return null
  try {
    const url = new URL(value)
    if (!['fieldnotes:', 'fieldnotes-test:'].includes(url.protocol) || url.username || url.password || url.port || url.search || url.hash) return null
    if (['quick-note', 'weather', 'calendar'].includes(url.hostname) && ['', '/'].includes(url.pathname)) return '/' + url.hostname
    if (url.hostname === 'calendar' && /^\/[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(url.pathname)) return '/calendar' + url.pathname
    if (url.hostname === 'day' && /^\/[1-9]\d{3}-\d{2}-\d{2}$/.test(url.pathname)) {
      const iso = url.pathname.slice(1), day = new Date(iso + 'T12:00:00Z')
      if (Number.isFinite(+day) && day.toISOString().slice(0, 10) === iso) return '/day/' + iso
    }
  } catch { /* Invalid links leave the current page untouched. */ }
  return null
}
