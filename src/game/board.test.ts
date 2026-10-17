import { describe, expect, it } from 'vitest'
import { BOARD_ORDER, RINGS, segmentAngle } from './board'

describe('board geometry', () => {
  it('has all 20 numbers once, 20 at the top, clockwise order', () => {
    expect([...BOARD_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    expect(BOARD_ORDER[0]).toBe(20)
    expect(segmentAngle(0).mid).toBe(-90)
    expect(segmentAngle(5).mid).toBe(0) // 3 o'clock
    expect(BOARD_ORDER[5]).toBe(6)
    expect(BOARD_ORDER[15]).toBe(11) // 11 at 9 o'clock
  })
  it('rings are ordered from the bull outwards', () => {
    const r = [RINGS.bull, RINGS.outerBull, RINGS.trebleIn, RINGS.trebleOut, RINGS.doubleIn, RINGS.doubleOut, RINGS.numbers]
    expect([...r].sort((a, b) => a - b)).toEqual(r)
  })
})
