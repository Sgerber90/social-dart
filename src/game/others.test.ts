import { describe, expect, it } from 'vitest'
import { replay } from './engine'
import type { AtcState, CricketState, KillerState, OneToSevenState } from './engines'
import { cfg, darts, end } from './testutil'
import type { Action } from './types'

describe('Killer', () => {
  const kc = (lives = 3, n = 3) =>
    cfg('killer', n, { lives, killerNumbers: { s0: 20, s1: 19, s2: 18 } })
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

  it('singles and trebles do not count', () => {
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
  it('scores only the round number, with multipliers', () => {
    const c = cfg('oneToSeven', 2)
    const v = replay(c, darts('S1 D1 T1  T1 20 M  2 T2 5'))
    const s = v.state as OneToSevenState
    expect(s.scores).toEqual([6 + 8, 3])
    expect(s.rounds).toEqual([2, 1])
  })

  it('finishes after round 7 and highest total wins', () => {
    const c = cfg('oneToSeven', 2)
    const a: Action[] = []
    for (let r = 1; r <= 7; r++) {
      a.push(...darts(`T${r} M M`), ...darts(`S${r} M M`))
    }
    const v = replay(c, a)
    expect(v.finished).toBe(true)
    expect(v.winners).toEqual([0])
    expect((v.state as OneToSevenState).scores).toEqual([84, 28])
  })

  it('ties produce multiple winners', () => {
    const c = cfg('oneToSeven', 2)
    const a: Action[] = []
    for (let r = 1; r <= 7; r++) a.push(end, end)
    expect(replay(c, a).winners).toEqual([0, 1])
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
