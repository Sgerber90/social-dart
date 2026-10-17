import { describe, expect, it } from 'vitest'
import { assignKillerNumbers } from './meta'

describe('assignKillerNumbers', () => {
  it('assigns unique numbers 1-20', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `p${i}`)
    const nums = Object.values(assignKillerNumbers(ids, {}))
    expect(new Set(nums).size).toBe(20)
    expect(nums.every((n) => n >= 1 && n <= 20)).toBe(true)
  })
  it('keeps existing valid picks and fixes duplicates', () => {
    const r = assignKillerNumbers(['a', 'b', 'c'], { a: 20, b: 20, c: 7 })
    expect(r.a).toBe(20)
    expect(r.c).toBe(7)
    expect([20, 7]).not.toContain(r.b)
  })
})
