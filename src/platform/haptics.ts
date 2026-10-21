/**
 * Haptic feedback without sound. In the native app this uses the Taptic Engine via
 * @capacitor/haptics; on the web it falls back to the Vibration API (Android Chrome;
 * iOS Safari ignores it, so visual feedback carries the weight there).
 */
import { isNativeApp } from './native'

type Strength = 'light' | 'medium' | 'heavy' | 'success' | 'error'

const PATTERNS: Record<Strength, number | number[]> = {
  light: 8,
  medium: 15,
  heavy: 30,
  success: [20, 60, 40],
  error: [40, 40, 40],
}

let native: typeof import('@capacitor/haptics') | null = null
if (isNativeApp())
  import('@capacitor/haptics')
    .then((m) => (native = m))
    .catch(() => {})

export function haptic(strength: Strength = 'light') {
  try {
    if (native) {
      const { Haptics, ImpactStyle, NotificationType } = native
      if (strength === 'success') void Haptics.notification({ type: NotificationType.Success })
      else if (strength === 'error') void Haptics.notification({ type: NotificationType.Error })
      else
        void Haptics.impact({
          style: strength === 'heavy' ? ImpactStyle.Heavy : strength === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light,
        })
      return
    }
    navigator.vibrate?.(PATTERNS[strength])
  } catch {
    /* unsupported */
  }
}
