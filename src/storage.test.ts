import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAllData,
  loadFriends,
  loadGame,
  loadHistory,
  loadRoster,
  removeRecord,
  saveGame,
  saveHistory,
  saveRoster,
  STORAGE_VERSION,
  upsertRecord,
} from './storage'
import { buildRecord, replay } from './game'
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
    expect(loadGame()).toMatchObject(g)
  })

  it('migrates a valid v1 (legacy) save and removes the old key', () => {
    const g = { config: cfg('cricket', 2), actions: darts('T20 T19') }
    ls.setItem('social-dart:game:v1', JSON.stringify(g))
    expect(loadGame()).toMatchObject(g)
    expect(ls.getItem('social-dart:game:v1')).toBeNull()
    expect(ls.getItem('social-dart:game')).not.toBeNull()
  })

  it('discards corrupt JSON and invalid data instead of throwing', () => {
    ls.setItem('social-dart:game:v1', '{not json')
    ls.setItem('social-dart:roster:v1', '"oops"')
    expect(loadGame()).toBeNull()
    expect(loadRoster()).toBeNull()
    ls.setItem(
      'social-dart:game',
      JSON.stringify({ v: STORAGE_VERSION, data: { config: { type: 'x01' }, actions: [] } }),
    )
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

  it('gives old saves an id and keeps runner-up actions', () => {
    const c = cfg('x01', 3, { startScore: 40 })
    saveGame({ config: c, actions: [...darts('D20'), { t: 'continue' }] })
    const g = loadGame()!
    expect(g.id).toMatch(/\w+/)
    expect(g.actions).toHaveLength(2)
    saveGame(g)
    expect(loadGame()!.id).toBe(g.id)
  })

  it('migrates the last setup players into the friends roster once', () => {
    saveRoster({
      players: [
        { id: 'a', name: 'Anna' },
        { id: 'b', name: 'Ben' },
      ],
      teamsOn: false,
      teamCount: 2,
      teamOf: {},
    })
    const f = loadFriends()
    expect(f.map((x) => x.name)).toEqual(['Anna', 'Ben'])
    expect(f[0].color).toMatch(/^#/)
    expect(JSON.parse(ls.getItem('social-dart:friends')!).data).toHaveLength(2)
    expect(loadFriends()).toEqual(f)
  })

  it('round-trips history, drops invalid records, upserts by id', () => {
    const c = cfg('x01', 2, { startScore: 40 })
    const r = buildRecord('g1', c, replay(c, darts('D20')), 5)!
    saveHistory([r])
    ls.setItem(
      'social-dart:history',
      JSON.stringify({ v: STORAGE_VERSION, data: [r, { id: 'bad' }, { ...r, id: 'g2', places: [9, 1] }] }),
    )
    expect(loadHistory()).toEqual([r])
    const h = upsertRecord([r], { ...r, endedAt: 9 })
    expect(h).toHaveLength(1)
    expect(h[0].endedAt).toBe(9)
    expect(removeRecord(h, 'g1')).toEqual([])
  })
})
