import { describe, expect, it } from 'vitest'
import { suggestCheckout, isCheckoutPossible, isPossibleTurnTotal } from './checkout'
import { dartLabel, dartValue, isDouble } from './types'

const route = (r: number, n = 3, dbl = true) => suggestCheckout(r, n, dbl)?.map(dartLabel).join(' ')

describe('checkout suggestions', () => {
  it('suggests classic routes', () => {
    expect(route(170)).toBe('T20 T20 Bull')
    expect(route(100)).toBe('T20 D20')
    expect(route(40)).toBe('D20')
    expect(route(32)).toBe('D16')
    expect(route(50)).toBe('Bull')
  })

  it('returns null for bogey numbers and > 170', () => {
    for (const n of [169, 168, 166, 165, 163, 162, 159, 171, 1]) expect(suggestCheckout(n, 3, true)).toBeNull()
  })

  it('every double-out checkout 2..170 (except bogeys) is valid', () => {
    for (let r = 2; r <= 170; r++) {
      const s = suggestCheckout(r, 3, true)
      expect(!!s).toBe(isCheckoutPossible(r, true))
      if (s) {
        expect(s.reduce((a, d) => a + dartValue(d), 0)).toBe(r)
        expect(isDouble(s[s.length - 1])).toBe(true)
      }
    }
  })

  it('respects darts left', () => {
    expect(suggestCheckout(100, 1, true)).toBeNull()
    expect(route(100, 2)).toBe('T20 D20')
    expect(suggestCheckout(121, 2, true)).toBeNull()
    expect(suggestCheckout(121, 3, true)).toHaveLength(3)
  })

  it('without double-out finishes on anything', () => {
    expect(route(60, 1, false)).toBe('T20')
    expect(route(180, 3, false)).toBe('T20 T20 T20')
    expect(suggestCheckout(179, 3, false)).toBeNull()
  })

  it('knows impossible turn totals', () => {
    expect(isPossibleTurnTotal(180)).toBe(true)
    expect(isPossibleTurnTotal(179)).toBe(false)
    expect(isPossibleTurnTotal(-1)).toBe(false)
    expect(isPossibleTurnTotal(2.5)).toBe(false)
  })
})
