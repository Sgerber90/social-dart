import type { Action, GameConfig } from './game/types'
import { validateRoster, validateSavedGame, type RosterData } from './game/validate'

/**
 * Persisted data is wrapped in a versioned envelope: { v: STORAGE_VERSION, data }.
 * Older or unknown versions are migrated if they validate, otherwise discarded.
 */
export const STORAGE_VERSION = 2
const PREFIX = 'social-dart:'
const GAME_KEY = `${PREFIX}game`
const ROSTER_KEY = `${PREFIX}roster`
const LEGACY = { game: `${PREFIX}game:v1`, roster: `${PREFIX}roster:v1` }

export interface SavedGame {
  config: GameConfig
  actions: Action[]
}
export type Roster = RosterData

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readRaw(key: string): unknown {
  const ls = storage()
  try {
    const raw = ls?.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    ls?.removeItem(key)
    return null
  }
}

function remove(key: string) {
  try {
    storage()?.removeItem(key)
  } catch {
    /* ignore */
  }
}

function write(key: string, data: unknown) {
  try {
    if (data === null) storage()?.removeItem(key)
    else storage()?.setItem(key, JSON.stringify({ v: STORAGE_VERSION, data }))
  } catch {
    /* storage full or unavailable */
  }
}

/** Read an enveloped value, falling back to the legacy (v1, un-enveloped) key. */
function load<T>(key: string, legacyKey: string, validate: (v: unknown) => T | null): T | null {
  const env = readRaw(key)
  if (env !== null) {
    const ok =
      typeof env === 'object' && env !== null && (env as { v?: unknown }).v === STORAGE_VERSION
        ? validate((env as { data?: unknown }).data)
        : null
    if (ok) return ok
    remove(key)
  }
  const legacy = readRaw(legacyKey)
  if (legacy !== null) {
    remove(legacyKey)
    const ok = validate(legacy)
    if (ok) {
      write(key, ok)
      return ok
    }
  }
  return null
}

export const loadGame = (): SavedGame | null => load(GAME_KEY, LEGACY.game, validateSavedGame)
export const saveGame = (g: SavedGame | null) => write(GAME_KEY, g)
export const loadRoster = (): Roster | null => load(ROSTER_KEY, LEGACY.roster, validateRoster)
export const saveRoster = (r: Roster) => write(ROSTER_KEY, r)

/** Remove every Social Dart key (used by "Reset app"). */
export function clearAllData() {
  const ls = storage()
  if (!ls) return
  try {
    const keys: string[] = []
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i)
      if (k && (k.startsWith(PREFIX) || k.startsWith('darts-scorer:'))) keys.push(k)
    }
    keys.forEach((k) => ls.removeItem(k))
  } catch {
    /* ignore */
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10)
