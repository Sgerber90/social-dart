import { describe, expect, it } from 'vitest'
import { replay, applyAction } from './engine'
import { CLOSE_OUT_TARGETS, closeOutClosed, closeOutMarks, type CloseOutState } from './engines'
import { cfg, darts, end, parse } from './testutil'
import type { Action } from './types'

const idx = (t: (typeof CLOSE_OUT_TARGETS)[number]) => CLOSE_OUT_TARGETS.indexOf(t)
const st = (a: Action[], n = 2) => replay(cfg('closeOut', n), a).state as CloseOutState
const marksOf = (s: CloseOutState, side = 0) =>
  Object.fromEntries(CLOSE_OUT_TARGETS.map((t, i) => [String(t), s.marks[side][i]]))

describe('Close Out marks per dart', () => {
  it('numbers 15-20: single 1, double 2, treble 3 — plus a Doubles/Trebles mark', () => {
    expect(closeOutMarks(parse('S20'))).toEqual({ 20: 1 })
    expect(closeOutMarks(parse('D17'))).toEqual({ 17: 2, D: 1 })
    expect(closeOutMarks(parse('T15'))).toEqual({ 15: 3, T: 1 })
  })
  it('numbers 1-14 only count via their double/treble rings', () => {
    expect(closeOutMarks(parse('S5'))).toEqual({})
    expect(closeOutMarks(parse('D1'))).toEqual({ D: 1 })
    expect(closeOutMarks(parse('T14'))).toEqual({ T: 1 })
  })
  it('bull: outer 1, bullseye 2 (bullseye is not a Doubles mark)', () => {
    expect(closeOutMarks(parse('25'))).toEqual({ 25: 1 })
    expect(closeOutMarks(parse('BULL'))).toEqual({ 25: 2 })
  })
  it('miss gives nothing', () => {
    expect(closeOutMarks(parse('M'))).toEqual({})
  })
})

describe('Close Out game', () => {
  it('starts with nine open targets and no opening double needed', () => {
    const s = st(darts('S20'))
    expect(CLOSE_OUT_TARGETS).toHaveLength(9)
    expect(s.marks[0][idx(20)]).toBe(1)
  })

  it('caps every target at 3 marks', () => {
    const s = st(darts('T20 T20 D20'))
    expect(s.marks[0][idx(20)]).toBe(3)
    expect(s.marks[0][idx('T')]).toBe(2)
    expect(s.marks[0][idx('D')]).toBe(1)
  })

  it('a treble on a target closes it and adds a Trebles mark', () => {
    const s = st(darts('T19'))
    expect(marksOf(s)).toMatchObject({ 19: 3, T: 1, D: 0 })
  })

  it('records marks added in turn history, ignoring capped overflow', () => {
    const v = replay(cfg('closeOut', 2), darts('T20 T20 S3'))
    expect(v.turns[0].points).toBe(5) // 3 (20) + 1 (T) + 1 (T) + 0 + 0
  })

  it('keeps each side separate and rotates turns', () => {
    const v = replay(cfg('closeOut', 2), darts('T20 M M  D18'))
    const s = v.state as CloseOutState
    expect(s.marks[0][idx(20)]).toBe(3)
    expect(s.marks[1][idx(18)]).toBe(2)
    expect(s.marks[1][idx(20)]).toBe(0)
    expect(v.side).toBe(1)
  })

  it('there are no points: closing a target others have open scores nothing', () => {
    const s = st(darts('T20 T20 T20'))
    expect(Object.keys(s)).toEqual(['kind', 'marks'])
  })

  it('first side to close all nine targets wins immediately, mid-turn', () => {
    // T20 T19 T18 → 20/19/18 closed, Trebles 3
    // T17 T16 T15 → 17/16/15 closed (Trebles already capped)
    // D1 D2 D3 → Doubles closed; BULL + 25 → Bull closed
    const a = darts('T20 T19 T18  M M M  T17 T16 T15  M M M  D1 D2 D3  M M M  BULL 25')
    const v = replay(cfg('closeOut', 2), a)
    expect(v.finished).toBe(true)
    expect(v.winners).toEqual([0])
    expect(v.openDarts).toHaveLength(0)
    expect(closeOutClosed(v.state as CloseOutState, 0)).toBe(9)
    expect(v.turns[v.turns.length - 1].darts).toHaveLength(2)
    expect(applyAction(cfg('closeOut', 2), a, darts('S20')[0])).toBe(a)
  })

  it('is not won with eight of nine closed', () => {
    const a = darts('T20 T19 T18  M M M  T17 T16 T15  M M M  D1 D2 D3')
    const v = replay(cfg('closeOut', 2), a)
    expect(v.finished).toBe(false)
    expect(closeOutClosed(v.state as CloseOutState, 0)).toBe(8)
  })

  it('teams share marks and rotate throwers', () => {
    const c = cfg('closeOut', [['a', 'b'], ['c']])
    const v = replay(c, [...darts('S20'), end, end, ...darts('D20')])
    expect(v.turns.map((t) => t.playerId)).toEqual(['a', 'c', 'b'])
    expect((v.state as CloseOutState).marks[0][idx(20)]).toBe(3)
  })
})
