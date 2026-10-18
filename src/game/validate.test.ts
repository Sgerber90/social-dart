import { describe, expect, it } from 'vitest'
import { validateRoster, validateSavedGame, validateConfig, validAction } from './validate'
import { cfg, darts, total } from './testutil'

describe('validateSavedGame', () => {
  it('accepts a real saved game (every game type)', () => {
    for (const type of ['x01', 'oneToSeven', 'cricket', 'closeOut', 'atc'] as const) {
      const saved = { config: cfg(type, 2), actions: darts('T20 D19 25') }
      expect(validateSavedGame(JSON.parse(JSON.stringify(saved)))).not.toBeNull()
    }
    const k = cfg('killer', 2, { killerNumbers: { s0: 20, s1: 19 } })
    expect(validateSavedGame({ config: k, actions: [] })).not.toBeNull()
  })

  it('fills options missing from older saves with defaults', () => {
    const c = cfg('x01', 2) as unknown as Record<string, unknown>
    const old = { ...c, options: { startScore: 501, doubleOut: true } }
    const v = validateSavedGame({ config: old, actions: [total(60)] })
    expect(v?.config.options.lives).toBe(3)
  })

  it.each([
    ['null', null],
    ['string', 'hello'],
    ['array', []],
    ['no config', { actions: [] }],
    ['unknown game type', { config: { ...cfg('x01', 2), type: 'golf' }, actions: [] }],
    ['prototype key as type', { config: { ...cfg('x01', 2), type: 'toString' }, actions: [] }],
    ['no sides', { config: { ...cfg('x01', 2), sides: [] }, actions: [] }],
    [
      'side with unknown player',
      { config: { ...cfg('x01', 2), sides: [{ id: 's', name: 'x', playerIds: ['ghost'] }] }, actions: [] },
    ],
    ['side without playerIds', { config: { ...cfg('x01', 2), sides: [{ id: 's', name: 'x' }] }, actions: [] }],
    ['players not array', { config: { ...cfg('x01', 2), players: {} }, actions: [] }],
    ['options missing', { config: { ...cfg('x01', 2), options: undefined }, actions: [] }],
    ['bad start score', { config: cfg('x01', 2, { startScore: -5 }), actions: [] }],
    ['actions not array', { config: cfg('x01', 2), actions: 'T20' }],
    ['garbage action', { config: cfg('x01', 2), actions: [{ t: 'dart', dart: { segment: 99, mult: 1 } }] }],
    ['treble bull', { config: cfg('x01', 2), actions: [{ t: 'dart', dart: { segment: 25, mult: 3 } }] }],
    ['killer without numbers', { config: cfg('killer', 2), actions: [] }],
    ['killer duplicate numbers', { config: cfg('killer', 2, { killerNumbers: { s0: 5, s1: 5 } }), actions: [] }],
  ])('rejects %s', (_, v) => {
    expect(validateSavedGame(v)).toBeNull()
  })
})

describe('validateConfig / validAction', () => {
  it('validates action shapes', () => {
    expect(validAction({ t: 'end' })).toBe(true)
    expect(validAction({ t: 'total', n: 181 })).toBe(false)
    expect(validAction({ t: 'dart', dart: { segment: 20, mult: 3 } })).toBe(true)
    expect(validAction({ t: 'dart', dart: { segment: 21, mult: 1 } })).toBe(false)
    expect(validAction({ t: 'boom' })).toBe(false)
  })
  it('does not keep extra junk options', () => {
    const c = validateConfig({ ...cfg('x01', 2), options: { ...cfg('x01', 2).options, evil: 1 } })
    expect(c && 'evil' in c.options).toBe(false)
  })
})

describe('validateRoster', () => {
  it('keeps valid players and drops junk', () => {
    const r = validateRoster({
      players: [{ id: 'a', name: 'Stefan' }, { id: 5 }, null],
      teamsOn: 'yes',
      teamCount: 9,
      teamOf: { a: 1, b: 'x' },
    })
    expect(r).toEqual({ players: [{ id: 'a', name: 'Stefan' }], teamsOn: false, teamCount: 2, teamOf: { a: 1 } })
  })
  it('rejects non-objects', () => {
    expect(validateRoster('x')).toBeNull()
    expect(validateRoster({ players: 'x' })).toBeNull()
  })
})
