// Validation for persisted data. Anything that doesn't match exactly is discarded,
// so an old or corrupt save can never crash the app.
import { ENGINES } from './engines'
import { replay } from './engine'
import { DEFAULT_OPTIONS, type Action, type GameConfig, type GameOptions, type Player, type Side } from './types'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

export function validPlayer(v: unknown): v is Player {
  return isObj(v) && isStr(v.id) && v.id.length > 0 && isStr(v.name)
}

function validSide(v: unknown, playerIds: Set<string>): v is Side {
  return (
    isObj(v) &&
    isStr(v.id) &&
    isStr(v.name) &&
    Array.isArray(v.playerIds) &&
    v.playerIds.length > 0 &&
    v.playerIds.every((id) => isStr(id) && playerIds.has(id))
  )
}

function validDart(v: unknown): boolean {
  if (!isObj(v) || !isInt(v.mult, 1, 3) || !isInt(v.segment, 0, 25)) return false
  const s = v.segment as number
  if (s > 20 && s !== 25) return false
  if (s === 25 && v.mult === 3) return false
  return true
}

export function validAction(v: unknown): v is Action {
  if (!isObj(v)) return false
  if (v.t === 'dart') return validDart(v.dart) && (v.to === undefined || v.to === 'number' || v.to === 'ring')
  if (v.t === 'total') return isInt(v.n, 0, 180)
  return v.t === 'end'
}

function normaliseOptions(v: unknown): GameOptions | null {
  if (!isObj(v)) return null
  const o = { ...DEFAULT_OPTIONS, ...v } as GameOptions
  if (!isInt(o.startScore, 2, 10001) || typeof o.doubleOut !== 'boolean' || !isInt(o.lives, 1, 99)) return null
  if (!isObj(o.killerNumbers)) return null
  for (const n of Object.values(o.killerNumbers)) if (!isInt(n, 1, 20)) return null
  return {
    startScore: o.startScore,
    doubleOut: o.doubleOut,
    lives: o.lives,
    killerNumbers: { ...o.killerNumbers },
  }
}

export function validateConfig(v: unknown): GameConfig | null {
  if (!isObj(v)) return null
  if (!isStr(v.type) || !Object.prototype.hasOwnProperty.call(ENGINES, v.type)) return null
  if (!Array.isArray(v.players) || !v.players.every(validPlayer) || v.players.length === 0) return null
  const ids = new Set((v.players as Player[]).map((p) => p.id))
  if (!Array.isArray(v.sides) || v.sides.length === 0 || !v.sides.every((s) => validSide(s, ids))) return null
  const options = normaliseOptions(v.options)
  if (!options) return null
  const cfg: GameConfig = {
    type: v.type as GameConfig['type'],
    players: v.players as Player[],
    sides: v.sides as Side[],
    options,
  }
  if (cfg.type === 'killer') {
    if (cfg.sides.length < 2) return null
    const nums = cfg.sides.map((s) => options.killerNumbers[s.id])
    if (nums.some((n) => !n) || new Set(nums).size !== nums.length) return null
  }
  return cfg
}

/** Returns a safe {config, actions} pair or null. Replays the game to be certain it runs. */
export function validateSavedGame(v: unknown): { config: GameConfig; actions: Action[] } | null {
  if (!isObj(v)) return null
  const config = validateConfig(v.config)
  if (!config || !Array.isArray(v.actions) || v.actions.length > 5000 || !v.actions.every(validAction)) return null
  const actions = v.actions as Action[]
  try {
    const view = replay(config, actions)
    if (!config.sides[view.side]) return null
  } catch {
    return null
  }
  return { config, actions }
}

export interface RosterData {
  players: Player[]
  teamsOn: boolean
  teamCount: number
  teamOf: Record<string, number>
}

export function validateRoster(v: unknown): RosterData | null {
  if (!isObj(v) || !Array.isArray(v.players)) return null
  const players = v.players.filter(validPlayer).slice(0, 50)
  const teamCount = isInt(v.teamCount, 2, 4) ? v.teamCount : 2
  const teamOf: Record<string, number> = {}
  if (isObj(v.teamOf)) for (const [k, n] of Object.entries(v.teamOf)) if (isInt(n, 0, 3)) teamOf[k] = n
  return { players, teamsOn: v.teamsOn === true, teamCount, teamOf }
}
