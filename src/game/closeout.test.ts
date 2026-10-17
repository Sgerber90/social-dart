import { describe, expect, it } from 'vitest'
import { replay, applyAction, undo } from './engine'
import {
  CLOSE_OUT_TARGETS,
  closeOutClosed,
  closeOutOpenOptions,
  closeOutOptions,
  type CloseOutState,
} from './engines'
import { cfg, darts, end, parse } from './testutil'
import type { Action, DartChoice } from './types'
import { validAction } from './validate'

type T = (typeof CLOSE_OUT_TARGETS)[number]
const idx = (t: T) => CLOSE_OUT_TARGETS.indexOf(t)
const c2 = () => cfg('closeOut', 2)
const st = (a: Action[], c = c2()) => replay(c, a).state as CloseOutState
/** dart with an explicit choice: 'T20>ring' or 'T20>number' */
const ch = (code: string, to: DartChoice): Action => ({ t: 'dart', dart: parse(code), to })
const opts = (code: string) => closeOutOptions(parse(code)).map((o) => `${o.to}:${CLOSE_OUT_TARGETS[o.target]}+${o.marks}`)
const marks = (s: CloseOutState, side = 0) => Object.fromEntries(CLOSE_OUT_TARGETS.map((t, i) => [String(t), s.marks[side][i]]))

describe('Close Out: where a dart can count', () => {
  it('triple on 15-20: 3 on the number OR 1 on Triples', () => {
    expect(opts('T20')).toEqual(['number:20+3', 'ring:T+1'])
  })
  it('double on 15-20: 2 on the number OR 1 on Doubles', () => {
    expect(opts('D15')).toEqual(['number:15+2', 'ring:D+1'])
  })
  it('double/triple on 1-14 only go to Doubles/Triples', () => {
    expect(opts('D7')).toEqual(['ring:D+1'])
    expect(opts('T14')).toEqual(['ring:T+1'])
  })
  it('singles: 15-20 one mark, 1-14 nothing; miss nothing', () => {
    expect(opts('S18')).toEqual(['number:18+1'])
    expect(opts('S9')).toEqual([])
    expect(opts('M')).toEqual([])
  })
  it('outer bull 1 Bull mark; bullseye (Cherry) 2 Bull marks, never a double', () => {
    expect(opts('25')).toEqual(['number:25+1'])
    expect(opts('BULL')).toEqual(['number:25+2'])
  })
})

describe('Close Out: each dart counts once', () => {
  it('T20 counted on the number gives 20 ×3 and nothing on Triples', () => {
    expect(marks(st([ch('T20', 'number')]))).toMatchObject({ 20: 3, T: 0 })
  })
  it('T20 counted on Triples gives Triples +1 and nothing on 20', () => {
    const v = replay(c2(), [ch('T20', 'ring')])
    expect(marks(v.state as CloseOutState)).toMatchObject({ 20: 0, T: 1 })
    expect(v.turns[0].note).toContain('Triples')
  })
  it('D17 counted on Doubles gives Doubles +1 only', () => {
    expect(marks(st([ch('D17', 'ring')]))).toMatchObject({ 17: 0, D: 1 })
  })
  it('without an explicit choice the number is used (default)', () => {
    expect(marks(st(darts('T19')))).toMatchObject({ 19: 3, T: 0 })
  })
  it('a choice for an already-closed target auto-applies the other option', () => {
    const s = st([ch('T20', 'number'), ch('T20', 'number')])
    expect(marks(s)).toMatchObject({ 20: 3, T: 1 })
    const s2 = st([ch('T20', 'ring'), ch('T19', 'ring'), ch('T18', 'ring'), end, ch('T20', 'ring')])
    expect(marks(s2)).toMatchObject({ T: 3, 20: 3 })
  })
  it('a dart whose options are all closed does nothing', () => {
    const s = st([ch('D1', 'ring'), ch('D2', 'ring'), ch('D3', 'ring'), end, ch('D4', 'ring')])
    expect(marks(s).D).toBe(3)
    expect(replay(c2(), [ch('D1', 'ring'), ch('D2', 'ring'), ch('D3', 'ring'), end, end, ch('D4', 'ring')]).turns[2].points).toBe(0)
  })
  it('marks are capped at 3 and history counts only marks that landed', () => {
    const v = replay(c2(), darts('D20 D20'))
    expect((v.state as CloseOutState).marks[0][idx(20)]).toBe(3)
    expect(v.turns[0].points).toBe(3)
  })
  it('Doubles, Triples and Bull each need 3 marks', () => {
    const s = st([...darts('25 BULL'), ch('D5', 'ring'), end, ch('T3', 'ring'), ch('T4', 'ring')])
    expect(marks(s)).toMatchObject({ 25: 3, D: 1, T: 2 })
    expect(closeOutClosed(s, 0)).toBe(1)
  })
  it('open options reflect what the player has closed', () => {
    const s = st([ch('T20', 'number')])
    expect(closeOutOpenOptions(s, 0, parse('T20')).map((o) => o.to)).toEqual(['ring'])
    expect(closeOutOpenOptions(s, 1, parse('T20')).map((o) => o.to)).toEqual(['number', 'ring'])
  })
})

describe('Close Out: game flow', () => {
  it('there are no points', () => {
    expect(Object.keys(st(darts('T20 T20 T20')))).toEqual(['kind', 'marks'])
  })

  it('first side to close all nine wins immediately, mid-turn', () => {
    const a: Action[] = [
      ...darts('T20 T19 T18'), ...darts('M M M'),
      ...darts('T17 T16 T15'), ...darts('M M M'),
      ch('D1', 'ring'), ch('D2', 'ring'), ch('D3', 'ring'), ...darts('M M M'),
      ch('T1', 'ring'), ch('T2', 'ring'), ch('T3', 'ring'), ...darts('M M M'),
      ...darts('BULL 25'),
    ]
    const v = replay(c2(), a)
    expect(v.finished).toBe(true)
    expect(v.winners).toEqual([0])
    expect(closeOutClosed(v.state as CloseOutState, 0)).toBe(9)
    expect(applyAction(c2(), a, darts('S20')[0])).toBe(a)
  })

  it('is not won with eight of nine closed', () => {
    const a: Action[] = [...darts('T20 T19 T18 M M M T17 T16 T15 M M M'), ch('D1', 'ring'), ch('D2', 'ring'), ch('D3', 'ring')]
    expect(replay(c2(), a).finished).toBe(false)
  })

  it('undo removes the dart together with its choice', () => {
    const a = [ch('T20', 'ring')]
    const b = applyAction(c2(), a, ch('T20', 'number'))
    expect(marks(st(b))).toMatchObject({ 20: 3, T: 1 })
    expect(marks(st(undo(b)))).toMatchObject({ 20: 0, T: 1 })
    expect(marks(st(undo(undo(b))))).toMatchObject({ 20: 0, T: 0 })
  })

  it('teams share marks and rotate throwers', () => {
    const c = cfg('closeOut', [['a', 'b'], ['c']])
    const v = replay(c, [...darts('S20'), end, end, ch('D20', 'number')])
    expect(v.turns.map((t) => t.playerId)).toEqual(['a', 'c', 'b'])
    expect((v.state as CloseOutState).marks[0][idx(20)]).toBe(3)
  })

  it('saved actions with a choice validate; bad choices are rejected', () => {
    expect(validAction(ch('T20', 'ring'))).toBe(true)
    expect(validAction({ t: 'dart', dart: { segment: 20, mult: 3 }, to: 'elsewhere' })).toBe(false)
  })
})
