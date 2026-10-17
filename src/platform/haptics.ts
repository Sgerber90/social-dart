/**
 * Haptic-style feedback without sound. On the web this uses the Vibration API
 * where available (Android Chrome); iOS Safari ignores it, so visual feedback
 * carries the weight there. When wrapping with Capacitor, swap the body for
 * `Haptics.impact({ style: ImpactStyle.Light })` from @capacitor/haptics.
 */
type Strength = 'light' | 'medium' | 'heavy' | 'success' | 'error'

const PATTERNS: Record<Strength, number | number[]> = {
  light: 8,
  medium: 15,
  heavy: 30,
  success: [20, 60, 40],
  error: [40, 40, 40],
}

export function haptic(strength: Strength = 'light') {
  try {
    navigator.vibrate?.(PATTERNS[strength])
  } catch {
    /* unsupported */
  }
}
