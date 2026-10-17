import type { Dart, GameConfig, GameType, Side } from './types'
import { dartLabel } from './types'

export type GameChoice = '501' | '301' | 'killer' | 'oneToSeven' | 'cricket' | 'closeOut' | 'atc'

export const GAME_CHOICES: { id: GameChoice; title: string; blurb: string; casual?: boolean }[] = [
  { id: '501', title: '501', blurb: 'Classic X01 from 501. Double-out optional.' },
  { id: '301', title: '301', blurb: 'Quicker X01 from 301. Double-out optional.' },
  { id: 'killer', title: 'Killer', blurb: 'Hit your double to become a killer, then take lives.' },
  { id: 'oneToSeven', title: '1 to 7', blurb: 'Rounds 1–7, only the round number scores. Highest total wins.' },
  { id: 'cricket', title: 'Cricket', blurb: 'Close 15–20 and bull, score on open numbers.', casual: true },
  {
    id: 'closeOut',
    title: 'Close Out',
    blurb: 'Close 15–20, Doubles, Triples and Bull. Each dart counts once. No points.',
    casual: true,
  },
  { id: 'atc', title: 'Around the Clock', blurb: 'Hit 1 to 20 in order, then the bull.', casual: true },
]

export function gameTitle(cfg: GameConfig): string {
  switch (cfg.type) {
    case 'x01':
      return `${cfg.options.startScore}${cfg.options.doubleOut ? ' · Double out' : ''}`
    case 'killer':
      return `Killer · ${cfg.options.lives} ${cfg.options.lives === 1 ? 'life' : 'lives'}`
    case 'oneToSeven':
      return '1 to 7'
    case 'cricket':
      return 'Cricket'
    case 'closeOut':
      return 'Close Out'
    case 'atc':
      return 'Around the Clock'
  }
}

export function playerName(cfg: GameConfig, id: string): string {
  return cfg.players.find((p) => p.id === id)?.name ?? '?'
}

export function sideLabel(cfg: GameConfig, side: Side): string {
  return side.playerIds.length > 1 ? side.name : playerName(cfg, side.playerIds[0] ?? '')
}

/** Assign unique numbers 1-20, keeping existing valid picks. */
export function assignKillerNumbers(
  sideIds: string[],
  existing: Record<string, number>,
  rand: () => number = Math.random,
): Record<string, number> {
  const out: Record<string, number> = {}
  const used = new Set<number>()
  for (const id of sideIds) {
    const n = existing[id]
    if (n >= 1 && n <= 20 && !used.has(n)) {
      out[id] = n
      used.add(n)
    }
  }
  for (const id of sideIds) {
    if (out[id]) continue
    const free = Array.from({ length: 20 }, (_, i) => i + 1).filter((n) => !used.has(n))
    const n = free[Math.floor(rand() * free.length)]
    out[id] = n
    used.add(n)
  }
  return out
}

/** Dart label with game-specific names (the bullseye is the "Cherry" in Close Out). */
export function dartLabelFor(type: GameType, d: Dart): string {
  if (type === 'closeOut' && d.segment === 25 && d.mult === 2) return 'Cherry'
  return dartLabel(d)
}
