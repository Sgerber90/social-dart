// Native (Capacitor iOS/Android) integration. On the web these are no-ops.
import { Capacitor } from '@capacitor/core'

export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/** Status bar + splash setup for the native shell. Plugins load lazily so the web bundle stays lean. */
export async function initNative() {
  if (!isNativeApp()) return
  document.documentElement.classList.add('native')
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Dark }) // light text on the dark board background
    if (Capacitor.getPlatform() === 'android') await StatusBar.setOverlaysWebView({ overlay: true })
  } catch {
    /* plugin unavailable */
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    /* plugin unavailable */
  }
}
