import { describe, expect, it } from 'vitest'
import { applyAction, placeOf, replay, undo } from './engine'
import { cfg, darts, end, total } from './testutil'
import type { Action } from './types'

const C: Action = { t: 'continue' }
const STOP: Action = { t: 'stop' }

describe('runner-up play', () => {
  const c3 = () => cfg('x01', 3, { startScore: 40 })

  it('pauses after the winner when 2+ sides remain', () => {
    const v = replay(c3(), darts('D20'))
    expect(v.winners).toEqual([0])
    expect(v.awaitingContinue).toBe(true)
    expect(v.finished).toBe(true)
    expect(v.final).toBe(false)
    expect(applyAction(c3(), darts('D20'), darts('S1')[0])).toHaveLength(1) // darts ignored while paused
  })

  it('two-sided games end immediately with both placed', () => {
    const v = replay(cfg('x01', 2, { startScore: 40 }), darts('D20'))
    expect(v.final).toBe(true)
    expect(v.awaitingContinue).toBe(false)
    expect(v.placings).toEqual([[0], [1]])
  })

  it('continue: winner is skipped and play goes on until 2nd is decided', () => {
    const a = [...darts('D20'), C]
    const v = replay(c3(), a)
    expect(v.finished).toBe(false)
    expect(v.continued).toBe(true)
    expect(v.side).toBe(1)
    // p1 misses, p2 checks out → 2nd; one left → 3rd, game over
    const v2 = replay(c3(), [...a, ...darts('M M M'), ...darts('D20')])
    expect(v2.placings).toEqual([[0], [2], [1]])
    expect(v2.final).toBe(true)
    expect(placeOf(v2.placings, 3)).toEqual([1, 3, 2])
  })

  it('rotation skips placed sides', () => {
    const c = cfg('x01', 4, { startScore: 40 })
    const v = replay(c, [...darts('D20'), C, end, end, end, end])
    expect(v.turns.map((t) => t.side)).toEqual([0, 1, 2, 3, 1])
  })

  it('stop: everyone else ranked by progress (X01: lowest remaining first)', () => {
    const c = cfg('x01', 4, { startScore: 101 })
    // p0 101-61 = 40 then D20 checks out; p1 has 2 left, p2 81, p3 41 → stop ranks p1, p3, p2
    const v = replay(c, [total(61), total(99), total(20), total(60), ...darts('D20'), STOP])
    expect(v.placings).toEqual([[0], [1], [3], [2]])
    expect(v.final).toBe(true)
  })

  it('ties in progress share a place', () => {
    const c = cfg('x01', 4, { startScore: 101 })
    const v = replay(c, [total(61), total(50), total(50), total(10), ...darts('D20'), STOP])
    expect(v.placings).toEqual([[0], [1, 2], [3]])
    expect(placeOf(v.placings, 4)).toEqual([1, 2, 2, 4])
  })

  it('continue/stop are only accepted while waiting, and undo works', () => {
    expect(applyAction(c3(), [], C)).toEqual([])
    const a = applyAction(c3(), darts('D20'), C)
    expect(a).toHaveLength(2)
    expect(applyAction(c3(), a, C)).toBe(a)
    expect(replay(c3(), undo(a)).awaitingContinue).toBe(true)
  })

  it('records darts to finish for X01', () => {
    const v = replay(c3(), [...darts('S20 S10 D5'), C, ...darts('M M M'), ...darts('D20')])
    expect(v.finishDarts).toEqual([3, null, 1])
  })

  it('killer ranks by elimination order without a continue prompt', () => {
    const c = cfg('killer', 3, { lives: 1, killerNumbers: { s0: 20, s1: 19, s2: 18 } })
    const v = replay(c, darts('D20 D18 D19'))
    expect(v.final).toBe(true)
    expect(v.awaitingContinue).toBe(false)
    expect(v.placings).toEqual([[0], [1], [2]]) // s2 out first, s1 out second
  })

  it('1 to 7 runner-up race', () => {
    const c = cfg('oneToSeven', 3)
    const v = replay(c, [...darts('T1 T4 S7'), C, ...darts('T1 T4 S7')])
    expect(v.placings).toEqual([[0], [1], [2]])
    expect(v.final).toBe(true)
  })
})
