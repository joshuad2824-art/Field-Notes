import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard'
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.joshuadavis.fieldnotes',
  appName: 'Field Notes',
  webDir: 'dist-ios',
  backgroundColor: '#051B1C',
  plugins: { Keyboard: { resize: KeyboardResize.None, style: KeyboardStyle.Dark, autoBackdropColor: 'dom' } },
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    backgroundColor: '#051B1C',
  },
}

export default config
