import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllData, loadGame, loadRoster, saveGame, STORAGE_VERSION } from './storage'
import { cfg, darts } from './game/testutil'

class MemStorage {
  m = new Map<string, string>()
  get length() {
    return this.m.size
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null
  }
  getItem(k: string) {
    return this.m.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
}
let ls: MemStorage
beforeEach(() => {
  ls = new MemStorage()
  ;(globalThis as unknown as { window: unknown }).window = { localStorage: ls }
})

describe('storage', () => {
  it('round-trips a game in a versioned envelope', () => {
    const g = { config: cfg('x01', 2), actions: darts('T20') }
    saveGame(g)
    expect(JSON.parse(ls.getItem('social-dart:game')!).v).toBe(STORAGE_VERSION)
    expect(loadGame()).toEqual(g)
  })

  it('migrates a valid v1 (legacy) save and removes the old key', () => {
    const g = { config: cfg('cricket', 2), actions: darts('T20 T19') }
    ls.setItem('social-dart:game:v1', JSON.stringify(g))
    expect(loadGame()).toEqual(g)
    expect(ls.getItem('social-dart:game:v1')).toBeNull()
    expect(ls.getItem('social-dart:game')).not.toBeNull()
  })

  it('discards corrupt JSON and invalid data instead of throwing', () => {
    ls.setItem('social-dart:game:v1', '{not json')
    ls.setItem('social-dart:roster:v1', '"oops"')
    expect(loadGame()).toBeNull()
    expect(loadRoster()).toBeNull()
    ls.setItem('social-dart:game', JSON.stringify({ v: STORAGE_VERSION, data: { config: { type: 'x01' }, actions: [] } }))
    expect(loadGame()).toBeNull()
    expect(ls.getItem('social-dart:game')).toBeNull()
  })

  it('discards envelopes from an unknown version', () => {
    ls.setItem('social-dart:game', JSON.stringify({ v: 99, data: { config: cfg('x01', 2), actions: [] } }))
    expect(loadGame()).toBeNull()
  })

  it('clearAllData removes only Social Dart keys', () => {
    ls.setItem('social-dart:game', 'x')
    ls.setItem('social-dart:input:v1', 'board')
    ls.setItem('other-app', 'keep')
    clearAllData()
    expect([...ls.m.keys()]).toEqual(['other-app'])
  })
})
