import type { Action, Dart, GameConfig, GameType, GameOptions } from './types'
import { DEFAULT_OPTIONS } from './types'

export function cfg(type: GameType, sides: number | string[][], opts: Partial<GameOptions> = {}): GameConfig {
  const groups = typeof sides === 'number' ? Array.from({ length: sides }, (_, i) => [`p${i}`]) : sides
  const players = groups.flat().map((id) => ({ id, name: id.toUpperCase() }))
  return {
    type,
    players,
    sides: groups.map((ids, i) => ({ id: `s${i}`, name: `Side ${i}`, playerIds: ids })),
    options: { ...DEFAULT_OPTIONS, ...opts },
  }
}

/** Parse 'T20', 'D16', 'S5', '5', '25', 'BULL', 'M' into an action. */
export function d(code: string): Action {
  return { t: 'dart', dart: parse(code) }
}
export function parse(code: string): Dart {
  const c = code.toUpperCase()
  if (c === 'M' || c === 'MISS') return { segment: 0, mult: 1 }
  if (c === 'BULL' || c === 'DB') return { segment: 25, mult: 2 }
  const m = /^([SDT]?)(\d+)$/.exec(c)
  if (!m) throw new Error(code)
  const mult = m[1] === 'T' ? 3 : m[1] === 'D' ? 2 : 1
  return { segment: Number(m[2]), mult }
}
export const darts = (s: string): Action[] => s.split(/\s+/).filter(Boolean).map(d)
export const total = (n: number): Action => ({ t: 'total', n })
export const end: Action = { t: 'end' }
