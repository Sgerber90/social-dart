// Finished-game history, per-player stats and the golf-style handicap.
// Pure and deterministic: everything is derived from the list of GameRecords, so the
// same history (e.g. synced for tournaments later) always gives the same numbers.
import { marginMatrix, placeOf, type GameView } from './engine'
import type { GameConfig, GameType } from './types'

/** Stats bucket: X01 is split by start score. */
export type StatsKey = '501' | '301' | 'x01' | Exclude<GameType, 'x01'>
export const STATS_KEYS: { key: StatsKey | 'all'; label: string }[] = [
  { key: 'all', label: 'All games' },
  { key: '501', label: '501' },
  { key: '301', label: '301' },
  { key: 'killer', label: 'Killer' },
  { key: 'oneToSeven', label: '1 to 7' },
  { key: 'cricket', label: 'Cricket' },
  { key: 'closeOut', label: 'Close Out' },
  { key: 'atc', label: 'Around the Clock' },
]

export interface GameRecord {
  id: string
  /** ms since epoch */
  endedAt: number
  type: GameType
  key: StatsKey
  sides: { name: string; playerIds: string[] }[]
  players: { id: string; name: string }[]
  /** 1-based place of each side (ties share the better place). */
  places: number[]
  /** X01: darts each side needed to finish (null = didn't finish). */
  finishDarts: (number | null)[]
  /** X01: darts thrown and points scored per player. */
  x01?: Record<string, { darts: number; points: number }>
  /** Runner-up spots were played out. */
  runnerUp: boolean
  /**
   * margins[i][j] = how far side i was ahead of side j (progress difference, -1..1), measured
   * when the first of the two was placed. Missing on games recorded before margins existed.
   */
  margins?: number[][]
}

export function statsKeyOf(cfg: GameConfig): StatsKey {
  if (cfg.type !== 'x01') return cfg.type
  return cfg.options.startScore === 501 ? '501' : cfg.options.startScore === 301 ? '301' : 'x01'
}

/** Build the history record for a finished game (view.final must be true). */
export function buildRecord(id: string, cfg: GameConfig, view: GameView, endedAt: number): GameRecord | null {
  if (!view.final) return null
  const places = placeOf(view.placings, cfg.sides.length).map((p) => p ?? cfg.sides.length)
  let x01: GameRecord['x01']
  if (cfg.type === 'x01') {
    x01 = {}
    for (const t of view.turns) {
      if (!t.complete && t.darts.length === 0) continue
      const e = (x01[t.playerId] ??= { darts: 0, points: 0 })
      e.darts += t.total !== undefined ? 3 : t.darts.length
      e.points += t.points
    }
  }
  return {
    id,
    endedAt,
    type: cfg.type,
    key: statsKeyOf(cfg),
    sides: cfg.sides.map((s) => ({ name: s.name, playerIds: [...s.playerIds] })),
    players: cfg.players.map((p) => ({ id: p.id, name: p.name })),
    places,
    finishDarts: cfg.type === 'x01' ? view.finishDarts : cfg.sides.map(() => null),
    x01,
    runnerUp: view.continued,
    margins: marginMatrix(view, cfg.sides.length),
  }
}

/** Placement score: 1 for a win, 0 for last, ties averaged. */
export function placementScore(places: number[], side: number): number {
  const n = places.length
  if (n < 2) return 1
  const p = places[side]
  const tied = places.filter((q) => q === p).length
  const avgPos = p + (tied - 1) / 2
  return (n - avgPos) / (n - 1)
}

// ------------------------------------------------------------------ handicap
export const HANDICAP = {
  start: 18,
  /** better than scratch is allowed (golf "plus" handicaps) */
  min: -10,
  max: 36,
  /** handicap gap that makes the better player ~10× as likely to finish ahead */
  scale: 12,
  /** maximum move per game for established players */
  k: 2,
  /** first games move twice as fast */
  provisionalGames: 5,
  provisionalK: 4,
  /** rises (worse results than expected) are dampened */
  riseFactor: 0.5,
  /** share of a head-to-head result that comes from placing alone; the rest is the margin */
  placingWeight: 0.3,
  /** margin assumed for games recorded before margins were stored */
  legacyMargin: 0.5,
}

/** Chance that a player with handicap `h` finishes ahead of one with `opp` (lower = better). */
export function expectedVs(h: number, opp: number): number {
  return 1 / (1 + Math.pow(10, (h - opp) / HANDICAP.scale))
}

/**
 * Head-to-head result 0..1 against one opponent. Placing decides the direction (ahead = above
 * 0.5, behind = below, tie = margin only); the margin decides how far:
 * a win scores 0.7 (photo finish) up to 1 (opponent hasn't started); a loss 0.3 down to 0.
 */
export function headToHead(placeDiff: number, margin: number): number {
  const w = HANDICAP.placingWeight
  const m = Math.min(1, Math.max(-1, margin))
  const strength = placeDiff === 0 ? (1 - w) * m : Math.sign(placeDiff) * (w + (1 - w) * Math.abs(m))
  return 0.5 + 0.5 * strength
}

export interface HandicapInfo {
  handicap: number
  games: number
  /** last change (negative = improved) */
  last: number
  provisional: boolean
  trend: number[]
}

const round1 = (x: number) => Math.round(x * 10) / 10
const clampH = (x: number) => Math.min(HANDICAP.max, Math.max(HANDICAP.min, x))

/** One game's handicap change for side `i` given everyone's handicaps before the game. */
export function handicapDelta(r: GameRecord, sideH: number[], i: number, k: number): number {
  const n = r.sides.length
  if (n < 2) return 0
  let actual = 0
  let expected = 0
  for (let j = 0; j < n; j++) {
    if (j === i) continue
    const placeDiff = r.places[j] - r.places[i] // > 0: i finished ahead
    const margin = r.margins?.[i]?.[j] ?? Math.sign(placeDiff) * HANDICAP.legacyMargin
    actual += headToHead(placeDiff, margin)
    expected += expectedVs(sideH[i], sideH[j])
  }
  let d = (-k * (actual - expected)) / (n - 1)
  if (d > 0) d *= HANDICAP.riseFactor
  return d
}

/**
 * Replay the history (oldest first) and return each player's current handicap.
 * `start` optionally seeds known handicaps (e.g. imported for a tournament); others start at 18.
 */
export function computeHandicaps(records: GameRecord[], start?: Map<string, number>): Map<string, HandicapInfo> {
  const info = new Map<string, HandicapInfo>()
  const get = (id: string) => {
    let i = info.get(id)
    if (!i) {
      const h0 = clampH(start?.get(id) ?? HANDICAP.start)
      i = { handicap: h0, games: 0, last: 0, provisional: true, trend: [h0] }
      info.set(id, i)
    }
    return i
  }
  for (const r of [...records].sort((a, b) => a.endedAt - b.endedAt || a.id.localeCompare(b.id))) {
    const sideH = r.sides.map(
      (s) => s.playerIds.reduce((a, id) => a + get(id).handicap, 0) / Math.max(1, s.playerIds.length),
    )
    const changes = r.sides.map((s) =>
      s.playerIds.map((id) => {
        const p = get(id)
        return p.games < HANDICAP.provisionalGames ? HANDICAP.provisionalK : HANDICAP.k
      }),
    )
    r.sides.forEach((s, i) => {
      s.playerIds.forEach((id, m) => {
        const p = get(id)
        const d = handicapDelta(r, sideH, i, changes[i][m])
        const before = p.handicap
        p.handicap = clampH(round1(before + d))
        p.last = round1(p.handicap - before)
        p.games++
        p.provisional = p.games < HANDICAP.provisionalGames
        p.trend.push(p.handicap)
      })
    })
  }
  return info
}

// ------------------------------------------------------------------ stats
export interface PlayerStats {
  games: number
  wins: number
  /** count per place: index 0 = 1st */
  places: number[]
  avgPlace: number
  /** mean placement score 0..1 (1 = always won) */
  rating: number
  /** X01: darts needed for each finish */
  finishes: number[]
  x01Darts: number
  x01Points: number
}

export function computeStats(records: GameRecord[], filter: StatsKey | 'all' = 'all'): Map<string, PlayerStats> {
  const out = new Map<string, PlayerStats>()
  for (const r of records) {
    if (filter !== 'all' && r.key !== filter) continue
    r.sides.forEach((s, i) => {
      const solo = s.playerIds.length === 1
      for (const id of s.playerIds) {
        let st = out.get(id)
        if (!st) {
          st = { games: 0, wins: 0, places: [], avgPlace: 0, rating: 0, finishes: [], x01Darts: 0, x01Points: 0 }
          out.set(id, st)
        }
        const place = r.places[i]
        st.avgPlace = (st.avgPlace * st.games + place) / (st.games + 1)
        st.rating = (st.rating * st.games + placementScore(r.places, i)) / (st.games + 1)
        st.games++
        if (place === 1) st.wins++
        st.places[place - 1] = (st.places[place - 1] ?? 0) + 1
        const fd = r.finishDarts[i]
        if (solo && fd != null) st.finishes.push(fd)
        const x = r.x01?.[id]
        if (x) {
          st.x01Darts += x.darts
          st.x01Points += x.points
        }
      }
    })
  }
  for (const st of out.values()) for (let i = 0; i < st.places.length; i++) st.places[i] ??= 0
  return out
}

export const winPct = (s: PlayerStats) => (s.games ? (s.wins / s.games) * 100 : 0)
export const threeDartAvg = (s: PlayerStats) => (s.x01Darts ? (s.x01Points / s.x01Darts) * 3 : 0)
export const bestFinish = (s: PlayerStats) => (s.finishes.length ? Math.min(...s.finishes) : null)
export const avgFinish = (s: PlayerStats) =>
  s.finishes.length ? s.finishes.reduce((a, b) => a + b, 0) / s.finishes.length : null

/** Rank players best → worst: placement rating, then wins, then games played. */
export function rankPlayers(ids: string[], stats: Map<string, PlayerStats>): string[] {
  return [...ids].sort((a, b) => {
    const A = stats.get(a)
    const B = stats.get(b)
    if (!A || !B) return (B ? 1 : 0) - (A ? 1 : 0)
    return B.rating - A.rating || B.wins - A.wins || B.games - A.games
  })
}
