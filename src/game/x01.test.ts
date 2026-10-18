import { describe, expect, it } from 'vitest'
import { replay, applyAction, undo, rematchConfig } from './engine'
import { x01Average, type X01State } from './engines'
import { cfg, darts, total, end } from './testutil'
import type { Action } from './types'

const rem = (c: ReturnType<typeof cfg>, a: Action[]) => (replay(c, a).state as X01State).remaining

describe('X01', () => {
  it('starts at configured score and subtracts darts', () => {
    const c = cfg('x01', 2, { startScore: 301 })
    expect(rem(c, [])).toEqual([301, 301])
    expect(rem(c, darts('T20 T20 T20'))).toEqual([121, 301])
  })

  it('rotates turns after three darts', () => {
    const c = cfg('x01', 2)
    const v = replay(c, darts('20 20 20 5'))
    expect(v.side).toBe(1)
    expect(v.openDarts).toHaveLength(1)
    expect(v.turnOpen).toBe(true)
  })

  it('accepts keypad totals', () => {
    const c = cfg('x01', 2)
    const v = replay(c, [total(140), total(100), total(60)])
    expect((v.state as X01State).remaining).toEqual([301, 401])
    expect(v.side).toBe(1)
  })

  it('rejects impossible keypad totals', () => {
    const c = cfg('x01', 2)
    expect(applyAction(c, [], total(179))).toEqual([])
    expect(applyAction(c, [], total(181))).toEqual([])
    expect(applyAction(c, [], total(180))).toHaveLength(1)
  })

  it('does not allow a keypad total mid-turn', () => {
    const c = cfg('x01', 2)
    const a = darts('20')
    expect(applyAction(c, a, total(60))).toBe(a)
  })

  it('busts when going below zero and reverts the whole turn', () => {
    const c = cfg('x01', 2, { startScore: 101 })
    // 101 - 60 = 41, - 20 = 21, - 60 → below zero → bust
    const v = replay(c, darts('T20 20 T20'))
    expect((v.state as X01State).remaining[0]).toBe(101)
    expect(v.turns[0].bust).toBe(true)
    expect(v.side).toBe(1)
  })

  it('busts on 1 remaining with double-out', () => {
    const c = cfg('x01', 2, { startScore: 41 })
    const v = replay(c, darts('T10 S10'))
    expect(v.turns[0].bust).toBe(true)
    expect((v.state as X01State).remaining[0]).toBe(41)
  })

  it('requires a double to finish with double-out', () => {
    const c = cfg('x01', 2, { startScore: 40 })
    const bust = replay(c, darts('20 20'))
    expect(bust.turns[0].bust).toBe(true)
    expect(bust.finished).toBe(false)
    const win = replay(c, darts('D20'))
    expect(win.finished).toBe(true)
    expect(win.winners).toEqual([0])
  })

  it('bullseye counts as a double', () => {
    const c = cfg('x01', 2, { startScore: 50 })
    expect(replay(c, darts('BULL')).finished).toBe(true)
  })

  it('allows any finish without double-out', () => {
    const c = cfg('x01', 2, { startScore: 41, doubleOut: false })
    const v = replay(c, darts('T10 S11'))
    expect(v.finished).toBe(true)
    expect(replay(c, darts('T10 S10 S1')).finished).toBe(true)
  })

  it('handles keypad bust and checkout', () => {
    const c = cfg('x01', 2, { startScore: 170 })
    const over = replay(c, [total(171)])
    expect(over.turns[0].bust).toBe(true)
    expect((over.state as X01State).remaining[0]).toBe(170)
    expect(replay(c, [total(170)]).finished).toBe(true)
    const c2 = cfg('x01', 2, { startScore: 169 })
    // 169 is not a possible 3-dart total at all → ignored by replay
    const v = replay(c2, [total(169)])
    expect(v.turns).toHaveLength(0)
    const c3 = cfg('x01', 2, { startScore: 159 })
    const v3 = replay(c3, [total(159)])
    expect(v3.turns[0].bust).toBe(true) // bogey checkout with double-out
  })

  it('ignores actions after the game is finished', () => {
    const c = cfg('x01', 2, { startScore: 40 })
    const a = darts('D20')
    expect(applyAction(c, a, darts('20')[0])).toBe(a)
  })

  it('undo removes the last dart', () => {
    const c = cfg('x01', 2)
    const a = darts('T20 T20 T20 T19')
    expect(rem(c, undo(a))).toEqual([321, 501])
    expect(replay(c, undo(undo(a))).side).toBe(0)
  })

  it('end action finishes a turn early', () => {
    const c = cfg('x01', 2)
    const v = replay(c, [...darts('20'), end])
    expect(v.side).toBe(1)
    expect(v.turns[0].points).toBe(20)
  })

  it('teams share a score and rotate players', () => {
    const c = cfg('x01', [
      ['a', 'b'],
      ['c', 'd'],
    ])
    const v = replay(c, [total(60), total(60), total(60)])
    expect(v.turns.map((t) => t.playerId)).toEqual(['a', 'c', 'b'])
    expect(v.playerId).toBe('d')
    expect((v.state as X01State).remaining).toEqual([381, 441])
  })

  it('computes 3-dart average', () => {
    const c = cfg('x01', 2)
    const v = replay(c, [total(100), total(50), total(60)])
    expect(x01Average(v.state as X01State, 0)).toBe(80)
  })

  it('rematch rotates the starting side', () => {
    const c = cfg('x01', 3)
    expect(rematchConfig(c).sides.map((s) => s.id)).toEqual(['s1', 's2', 's0'])
  })
})
