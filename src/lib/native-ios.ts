import { Capacitor } from '@capacitor/core'
import { Keyboard, type KeyboardInfo } from '@capacitor/keyboard'

export const nativeIOS = Capacitor.getPlatform() === 'ios'
if (nativeIOS) document.documentElement.classList.add('native-ios')

// Keep the browser/PWA unchanged. The web viewport remains the single resize
// owner; the native plugin supplies keyboard presence and removes Safari's
// previous/next/Done accessory so the note's own formatting dock can use it.
export function configureNativeKeyboard(changed: (height: number) => void) {
  if (!nativeIOS) return
  void Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(console.warn)
  let windowFrameReported = false
  window.addEventListener('fieldNotesKeyboardFrame', event => {
    // Capacitor window events expose their JSON fields on the event itself.
    const height = (event as Event & KeyboardInfo).keyboardHeight
    if (!Number.isFinite(height) || height < 0) return
    windowFrameReported = true
    changed(height)
  })
  const show = ({ keyboardHeight }: KeyboardInfo) => {
    if (!windowFrameReported) changed(keyboardHeight)
  }
  void Keyboard.addListener('keyboardWillShow', show).catch(console.warn)
  void Keyboard.addListener('keyboardDidShow', show).catch(console.warn)
  void Keyboard.addListener('keyboardDidHide', () => { if (!windowFrameReported) changed(0) }).catch(console.warn)
}

export function hideNativeKeyboard() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  if (nativeIOS) void Keyboard.hide().catch(console.warn)
}
