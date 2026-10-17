export type Multiplier = 1 | 2 | 3

/** segment: 1-20, 25 = bull (mult 1 = outer 25, mult 2 = bullseye 50), 0 = miss */
export interface Dart {
  segment: number
  mult: Multiplier
}

/** 'number' = marks on the segment's own number, 'ring' = 1 mark on Doubles / Triples. */
export type DartChoice = 'number' | 'ring'

export type GameType = 'x01' | 'killer' | 'oneToSeven' | 'cricket' | 'closeOut' | 'atc'

export interface Player {
  id: string
  name: string
}

/** A side is one scoring unit: a single player or a team. */
export interface Side {
  id: string
  name: string
  playerIds: string[]
}

export interface GameOptions {
  startScore: number // x01
  doubleOut: boolean // x01
  lives: number // killer
  killerNumbers: Record<string, number> // killer: sideId -> number
}

export interface GameConfig {
  type: GameType
  sides: Side[]
  players: Player[]
  options: GameOptions
}

export type Action =
  /** `to` = where the thrower chose to count it, for games with a choice (Close Out). */
  | { t: 'dart'; dart: Dart; to?: DartChoice }
  | { t: 'total'; n: number }
  | { t: 'end' }

export interface TurnRecord {
  side: number
  playerId: string
  darts: Dart[]
  total?: number
  points: number
  bust: boolean
  win: boolean
  complete: boolean
  note?: string
}

export const MISS: Dart = { segment: 0, mult: 1 }

export function dartValue(d: Dart): number {
  return d.segment * d.mult
}

export function isDouble(d: Dart): boolean {
  return d.mult === 2 && d.segment > 0
}

export function dartLabel(d: Dart): string {
  if (d.segment === 0) return 'Miss'
  if (d.segment === 25) return d.mult === 2 ? 'Bull' : '25'
  return (d.mult === 3 ? 'T' : d.mult === 2 ? 'D' : 'S') + d.segment
}

export const DEFAULT_OPTIONS: GameOptions = {
  startScore: 501,
  doubleOut: true,
  lives: 3,
  killerNumbers: {},
}
