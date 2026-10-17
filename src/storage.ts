import type { Action, GameConfig, Player } from './game/types'

const GAME_KEY = 'social-dart:game:v1'
const ROSTER_KEY = 'social-dart:roster:v1'

export interface SavedGame {
  config: GameConfig
  actions: Action[]
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or unavailable */
  }
}

export const loadGame = () => {
  const g = read<SavedGame>(GAME_KEY)
  return g && g.config && Array.isArray(g.actions) && Array.isArray(g.config.sides) ? g : null
}
export const saveGame = (g: SavedGame | null) => write(GAME_KEY, g)

export interface Roster {
  players: Player[]
  teamsOn: boolean
  teamCount: number
  teamOf: Record<string, number>
}
export const loadRoster = () => read<Roster>(ROSTER_KEY)
export const saveRoster = (r: Roster) => write(ROSTER_KEY, r)

export const uid = () => Math.random().toString(36).slice(2, 10)
