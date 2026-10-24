import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadReviewState, markRated, recordCompletedGame } from './review'

const mem = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage)

const play = (n: number, from: number, native = true) =>
  Array.from({ length: n }, (_, i) => recordCompletedGame(`g${from + i}`, native))

describe('review prompt', () => {
  beforeEach(() => mem.clear())
  it('asks on the 10th game only, counts each game once', () => {
    expect(play(9, 0).some(Boolean)).toBe(false)
    expect(recordCompletedGame('g0', true)).toBe(false)
    expect(recordCompletedGame('g9', true)).toBe(true)
    expect(loadReviewState().completed).toBe(10)
  })
  it('re-asks once after 30 more games, then never', () => {
    play(10, 0)
    const r = play(60, 10)
    expect(r.filter(Boolean).length).toBe(1)
    expect(r.indexOf(true)).toBe(29)
  })
  it('never re-asks after Rate', () => {
    play(10, 0)
    markRated()
    expect(play(60, 10).some(Boolean)).toBe(false)
  })
  it('never asks on the web', () => {
    expect(play(50, 0, false).some(Boolean)).toBe(false)
  })
})
