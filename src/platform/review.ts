/**
 * Native in-app review prompt (SKStoreReviewController on iOS, Play In-App Review on Android).
 * Completed games are counted per device. After the 10th, a short neutral pre-message is shown
 * once; if the user picks "Not now" we may ask one more time 30 games later, then never again.
 * Never shown on the web. No rating is requested, no sentiment gate, no rewards.
 */
import { isNativeApp } from './native'

export const FIRST_ASK_AT = 10
export const REASK_AFTER = 30
const KEY = 'sd-review-state'

export interface ReviewState {
  counted: string[] // ids of completed games already counted (idempotent across undo/redo)
  completed: number
  asks: number // times the pre-message was shown
  lastAskAt: number // completed count at the last ask
  done: boolean // user tapped Rate, or used up the re-ask
}

const EMPTY: ReviewState = { counted: [], completed: 0, asks: 0, lastAskAt: 0, done: false }

export function loadReviewState(): ReviewState {
  try {
    const s: ReviewState = { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
    return { ...s, counted: Array.isArray(s.counted) ? [...s.counted] : [] }
  } catch {
    return { ...EMPTY, counted: [] }
  }
}
function save(s: ReviewState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, counted: s.counted.slice(-50) }))
  } catch {
    /* storage full / unavailable */
  }
}

export function shouldAsk(s: ReviewState): boolean {
  if (s.done) return false
  if (s.asks === 0) return s.completed >= FIRST_ASK_AT
  if (s.asks === 1) return s.completed >= s.lastAskAt + REASK_AFTER
  return false
}

/** Count a finished game once. Returns true if the pre-message should be shown now. */
export function recordCompletedGame(gameId: string, native = isNativeApp()): boolean {
  const s = loadReviewState()
  if (s.counted.includes(gameId)) return false
  s.counted.push(gameId)
  s.completed += 1
  const ask = native && shouldAsk(s)
  if (ask) {
    s.asks += 1
    s.lastAskAt = s.completed
    if (s.asks >= 2) s.done = true
  }
  save(s)
  return ask
}

export function markRated() {
  save({ ...loadReviewState(), done: true })
}

export async function requestNativeReview() {
  if (!isNativeApp()) return
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review')
    await InAppReview.requestReview()
  } catch {
    /* the OS may decline to show it; nothing to do */
  }
}
