import { App as NativeApp } from '@capacitor/app'
import { nativeIOS } from './native-ios'
import { nativeWidgetRoute, NATIVE_WIDGET_ROUTE_EVENT, type NativeWidgetNavigation } from './native-widget-route'
import { navigate } from './router'
import { closeTop } from './dismiss'

function openWidgetPath(path: string, replace = false): void {
  // An open quick-note sheet gets the chance to finish its normal save before
  // changing rooms. On failure it keeps the draft and its existing error UI.
  const opening = new CustomEvent<NativeWidgetNavigation>(NATIVE_WIDGET_ROUTE_EVENT, {
    cancelable: true, detail: { path, replace },
  })
  if (window.dispatchEvent(opening)) {
    closeTop()
    navigate(path, { replace })
  }
}

export async function configureNativeWidgetLinks(): Promise<void> {
  if (!nativeIOS) return
  try {
    // Register before reading the cold-launch URL, so an opening link is not
    // lost between startup and listener registration. Duplicate paths are a
    // no-op in the normal router, which retains the usual editor save path.
    await NativeApp.addListener('appUrlOpen', ({ url }) => {
      const path = nativeWidgetRoute(url)
      if (path) openWidgetPath(path)
    })
    const launch = await NativeApp.getLaunchUrl()
    const path = nativeWidgetRoute(launch?.url)
    if (path) openWidgetPath(path, true)
  } catch (error) { console.warn('Native widget links unavailable', error) }
}
