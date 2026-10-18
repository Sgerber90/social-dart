import { describe, expect, it } from 'vitest'
import { replay } from './engine'
import { oneToSevenMove, type AtcState, type CricketState, type KillerState, type OneToSevenState } from './engines'
import { cfg, darts, end } from './testutil'
import type { Action } from './types'

describe('Killer', () => {
  const kc = (lives = 3, n = 3) => cfg('killer', n, { lives, killerNumbers: { s0: 20, s1: 19, s2: 18 } })
  const st = (c: ReturnType<typeof kc>, a: Action[]) => replay(c, a).state as KillerState

  it('uses configured lives and numbers', () => {
    const s = st(kc(5), [])
    expect(s.lives).toEqual([5, 5, 5])
    expect(s.numbers).toEqual([20, 19, 18])
  })

  it('becomes a killer by hitting own double', () => {
    const s = st(kc(), darts('D20'))
    expect(s.killer).toEqual([true, false, false])
  })

  it('non-killers cannot take lives', () => {
    const s = st(kc(), darts('D19 D18'))
    expect(s.lives).toEqual([3, 3, 3])
  })

  it('singles and triples do not count', () => {
    const s = st(kc(), darts('S20 T20'))
    expect(s.killer[0]).toBe(false)
  })

  it('killers take lives with doubles of other numbers', () => {
    const s = st(kc(), darts('D20 D19 D19'))
    expect(s.lives).toEqual([3, 1, 3])
  })

  it('killer hitting own double loses a life', () => {
    const s = st(kc(), darts('D20 D20'))
    expect(s.lives[0]).toBe(2)
  })

  it('eliminated players are skipped and last standing wins', () => {
    const c = kc(1)
    const a = darts('D20 D19') // p0 killer, p1 out
    const v = replay(c, a)
    expect(v.side).toBe(0) // still p0's turn (1 dart left)
    const v2 = replay(c, [...a, end])
    expect(v2.side).toBe(2) // side 1 skipped
    const v3 = replay(c, [...a, end, end, ...darts('D18')])
    expect(v3.finished).toBe(true)
    expect(v3.winners).toEqual([0])
  })

  it('self-elimination ends the turn', () => {
    const c = kc(1, 2)
    const v = replay(c, darts('D20 D20'))
    expect(v.finished).toBe(true)
    expect(v.winners).toEqual([1])
  })
})

describe('1 to 7', () => {
  const st = (a: Action[], n = 2) => replay(cfg('oneToSeven', n), a).state as OneToSevenState

  it('everyone starts on 1', () => {
    expect(st([]).target).toEqual([1, 1])
  })
  it('only hits on your current target count', () => {
    expect(st(darts('S2 T5 20')).target[0]).toBe(1)
  })
  it('single +1, double +2, triple +3 (on 1, a triple 1 moves you to 4)', () => {
    expect(st(darts('S1')).target[0]).toBe(2)
    expect(st(darts('D1')).target[0]).toBe(3)
    expect(st(darts('T1')).target[0]).toBe(4)
  })
  it('advances through several darts in a turn', () => {
    expect(st(darts('T1 D4 S6')).target[0]).toBe(7)
  })

  describe("Stefan's bounce examples", () => {
    it.each([
      [7, 1, 8, 'on 7 a single finishes'],
      [7, 2, 7, 'on 7 a double keeps you on 7'],
      [7, 3, 6, 'on 7 a triple moves you back to 6'],
      [6, 1, 7, 'on 6 a single goes to 7'],
      [6, 2, 8, 'on 6 a double finishes'],
      [6, 3, 6, 'on 6 a triple keeps you on 6'],
    ])('from %i with x%i → %i (%s)', (from, mult, to) => {
      expect(oneToSevenMove(from, mult)).toBe(to)
    })
    it('no other start position can overshoot', () => {
      for (let t = 1; t <= 5; t++) for (const m of [1, 2, 3]) expect(oneToSevenMove(t, m)).toBe(t + m)
    })
  })

  it('bounce in a real game: T6 on 6 stays, T7 on 7 goes back to 6', () => {
    // T1: 1→4, T4: 4→7, D7: stay on 7 | p1 misses | T7: 7→6, T6: stay on 6
    const b = replay(cfg('oneToSeven', 2), darts('T1 T4 D7  M M M  T7 T6 M'))
    expect((b.state as OneToSevenState).target[0]).toBe(6)
  })

  it('first to finish wins; no points involved', () => {
    const v = replay(cfg('oneToSeven', 2), darts('T1 T4 S7'))
    expect(v.finished).toBe(true)
    expect(v.winners).toEqual([0])
    expect(v.turns[0].note).toContain('Finished')
    expect(Object.keys(v.state)).toEqual(['kind', 'target'])
  })
})

describe('Cricket', () => {
  const st = (a: Action[], n = 2) => replay(cfg('cricket', n), a).state as CricketState

  it('counts marks with multipliers', () => {
    const s = st(darts('T20 D19 S18'))
    expect(s.marks[0].slice(0, 3)).toEqual([3, 2, 1])
  })

  it('ignores numbers below 15', () => {
    const s = st(darts('T14 D1 M'))
    expect(s.marks[0].every((m) => m === 0)).toBe(true)
  })

  it('scores on closed numbers while an opponent is open', () => {
    const s = st(darts('T20 T20 S20'))
    expect(s.points[0]).toBe(80)
  })

  it('no points once all opponents closed', () => {
    const s = st(darts('T20 M M  T20 M M  T20 M M'))
    expect(s.points).toEqual([0, 0])
    const s2 = st(darts('T20 M M  M M M  T20 M M  T20 M M  T20 M M'))
    expect(s2.points).toEqual([60, 0])
  })

  it('bull: outer 1 mark, bullseye 2 marks, scores 25 per mark', () => {
    const s = st(darts('25 BULL BULL'))
    expect(s.marks[0][6]).toBe(3)
    expect(s.points[0]).toBe(50)
  })

  it('wins when all closed and points >= opponents', () => {
    const a = darts('T20 T19 T18  M M M  T17 T16 T15  M M M  BULL 25')
    const v = replay(cfg('cricket', 2), a)
    expect(v.finished).toBe(true)
    expect(v.winners).toEqual([0])
  })

  it('does not win while behind on points', () => {
    // p1 scores 60 on 20 first
    const a = darts('M M M  T20 T20 T20  T20 T19 T18  M M M  T17 T16 T15  M M M  BULL 25')
    const v = replay(cfg('cricket', 2), a)
    expect((v.state as CricketState).points).toEqual([0, 120])
    expect(v.finished).toBe(false)
  })
})

describe('Around the Clock', () => {
  it('advances on any hit of the target', () => {
    const v = replay(cfg('atc', 2), darts('1 D2 5'))
    expect((v.state as AtcState).target).toEqual([3, 1])
  })

  it('goes to bull after 20 and wins on bull', () => {
    const a: Action[] = []
    for (let n = 1; n <= 20; n += 3) {
      a.push(...darts([n, n + 1, n + 2].map((x) => (x > 20 ? 'M' : String(x))).join(' ')), end)
    }
    const s = replay(cfg('atc', 2), a).state as AtcState
    expect(s.target[0]).toBe(25)
    const v = replay(cfg('atc', 2), [...a, ...darts('25')])
    expect(v.finished).toBe(true)
    expect(v.winners).toEqual([0])
  })
})
