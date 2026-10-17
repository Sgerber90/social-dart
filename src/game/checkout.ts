import type { Dart, Multiplier } from './types'
import { dartValue } from './types'

const SEG_PREF = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
const DOUBLE_PREF = [20, 16, 18, 12, 10, 8, 4, 2, 14, 6, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1, 25]

const ALL_DARTS: Dart[] = (() => {
  const out: Dart[] = []
  for (const m of [3, 1, 2] as Multiplier[]) for (const s of SEG_PREF) out.push({ segment: s, mult: m })
  out.push({ segment: 25, mult: 1 }, { segment: 25, mult: 2 })
  return out
})()

function setupCost(d: Dart): number {
  if (d.segment === 25) return d.mult === 2 ? 40 : 45
  const seg = SEG_PREF.indexOf(d.segment)
  return seg + (d.mult === 3 ? 0 : d.mult === 1 ? 2 : 25)
}

function finishCost(d: Dart, doubleOut: boolean): number {
  if (doubleOut) return DOUBLE_PREF.indexOf(d.segment) * 100
  return setupCost(d)
}

/** Impossible checkouts with double-out (in 3 darts). */
export const BOGEY_CHECKOUTS = [169, 168, 166, 165, 163, 162, 159]

export function isCheckoutPossible(rem: number, doubleOut: boolean): boolean {
  if (rem < 1) return false
  if (doubleOut) return rem >= 2 && rem <= 170 && !BOGEY_CHECKOUTS.includes(rem)
  return isPossibleTurnTotal(rem)
}

const IMPOSSIBLE_TOTALS = [163, 166, 169, 172, 173, 175, 176, 178, 179]
export function isPossibleTurnTotal(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 180 && !IMPOSSIBLE_TOTALS.includes(n)
}

const cache = new Map<string, Dart[] | null>()

/** Suggest the finishing route for `rem` with `dartsLeft` darts, or null if none. */
export function suggestCheckout(rem: number, dartsLeft: number, doubleOut: boolean): Dart[] | null {
  const key = `${rem}|${dartsLeft}|${doubleOut}`
  if (cache.has(key)) return cache.get(key)!
  let result: Dart[] | null = null
  if (rem > 0 && rem <= 180 && dartsLeft > 0) {
    const finishers = ALL_DARTS.filter((d) => (doubleOut ? d.mult === 2 : true))
    for (let n = 1; n <= Math.min(3, dartsLeft) && !result; n++) {
      let best: { cost: number; darts: Dart[] } | null = null
      for (const f of finishers) {
        const need = rem - dartValue(f)
        if (need < 0) continue
        const fc = finishCost(f, doubleOut)
        if (n === 1) {
          if (need === 0 && (!best || fc < best.cost)) best = { cost: fc, darts: [f] }
        } else if (n === 2) {
          for (const a of ALL_DARTS) {
            if (dartValue(a) !== need) continue
            const c = fc + setupCost(a)
            if (!best || c < best.cost) best = { cost: c, darts: [a, f] }
          }
        } else {
          for (const a of ALL_DARTS) {
            const va = dartValue(a)
            if (va >= need) continue
            for (const b of ALL_DARTS) {
              if (va + dartValue(b) !== need) continue
              const c = fc + setupCost(a) + setupCost(b) + (dartValue(b) > va ? 1 : 0)
              if (!best || c < best.cost) best = { cost: c, darts: [a, b, f] }
            }
          }
        }
      }
      if (best) result = best.darts
    }
  }
  cache.set(key, result)
  return result
}
