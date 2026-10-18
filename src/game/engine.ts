import type { Action, GameConfig, TurnRecord, Dart } from './types'
import { ENGINES, type Engine, type GameState } from './engines'

export interface GameView {
  state: GameState
  turns: TurnRecord[]
  /** Side & player to throw now (or the side that just won). */
  side: number
  playerId: string
  /** Darts already thrown in the open turn. */
  openDarts: Dart[]
  turnOpen: boolean
  /** No more darts can be thrown (waiting for a continue/stop decision, or the game is over). */
  finished: boolean
  /** The game is completely over and every side has a place. */
  final: boolean
  /** A winner exists and 2+ sides can still play for runner-up spots. */
  awaitingContinue: boolean
  /** Runner-up play is on. */
  continued: boolean
  /** Places so far: groups of side indices, best first (a group > 1 = tie). */
  placings: number[][]
  /** First place (empty until someone wins). */
  winners: number[]
  /** Darts each side had thrown when it finished (X01), else null. */
  finishDarts: (number | null)[]
  /** Every side's progress fraction (0..1) at the moment each placings group was decided. */
  snapshots: number[][]
}

export function getEngine(cfg: GameConfig): Engine<GameState> {
  return ENGINES[cfg.type] as unknown as Engine<GameState>
}

/** Place (1-based, ties share the better place) of every side, or null if not placed. */
export function placeOf(placings: number[][], sides: number): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: sides }, () => null)
  let p = 1
  for (const g of placings) {
    for (const i of g) out[i] = p
    p += g.length
  }
  return out
}

export function replay(cfg: GameConfig, actions: Action[]): GameView {
  const engine = getEngine(cfg)
  const s = engine.init(cfg)
  const n = cfg.sides.length
  const sideTurns = cfg.sides.map(() => 0)
  const turns: TurnRecord[] = []
  const placings: number[][] = []
  const placed = new Set<number>()
  const finishDarts: (number | null)[] = cfg.sides.map(() => null)
  const snapshots: number[][] = []
  const snap = () => cfg.sides.map((_, i) => Math.round(engine.fraction(s, i, cfg) * 1000) / 1000)
  let side = 0
  let open: TurnRecord | null = null
  let final = false
  let awaiting = false
  let continued = false

  const pool = () => cfg.sides.map((_, i) => i).filter((i) => !placed.has(i))
  /** Sides that can still throw for a place. */
  const contenders = () => pool().filter((i) => !engine.eliminated(s, i))

  const playerFor = (i: number) => {
    const ids = cfg.sides[i].playerIds
    return ids.length ? ids[sideTurns[i] % ids.length] : ''
  }
  const begin = (): TurnRecord => {
    const t: TurnRecord = {
      side,
      playerId: playerFor(side),
      darts: [],
      points: 0,
      bust: false,
      win: false,
      complete: false,
    }
    engine.startTurn(s, side)
    turns.push(t)
    open = t
    return t
  }
  /** Rank everyone not yet placed by progress (ties share a place) and end the game. */
  const finishRest = () => {
    const rest = pool().sort((a, b) => engine.progress(s, b) - engine.progress(s, a))
    let k = 0
    while (k < rest.length) {
      const g = [rest[k]]
      while (k + g.length < rest.length && engine.progress(s, rest[k + g.length]) === engine.progress(s, rest[k])) {
        g.push(rest[k + g.length])
      }
      g.forEach((i) => placed.add(i))
      placings.push(g)
      snapshots.push(snap())
      k += g.length
    }
    final = true
    awaiting = false
  }
  const advance = () => {
    for (let k = 1; k <= n; k++) {
      const c = (side + k) % n
      if (!placed.has(c) && !engine.eliminated(s, c)) {
        side = c
        return
      }
    }
  }
  /** Check for newly finished sides; returns true if play must pause or stop. */
  const checkPlaces = (t: TurnRecord): boolean => {
    const w = engine.winnersAmong(s, cfg, pool())
    if (!w.length) return false
    const place = placed.size + 1
    w.forEach((i) => {
      placed.add(i)
      if (engine.dartsThrown) finishDarts[i] = engine.dartsThrown(s, i)
    })
    placings.push(w)
    snapshots.push(snap())
    if (w.includes(t.side)) {
      t.place = place
      t.win = place === 1
    }
    if (contenders().length <= 1) finishRest()
    else if (!continued) awaiting = true
    return true
  }
  const close = (t: TurnRecord) => {
    t.complete = true
    engine.endTurn(s, side, cfg)
    sideTurns[side]++
    open = null
    checkPlaces(t)
    if (!final && !awaiting) advance()
  }
  const addNote = (t: TurnRecord, note?: string) => {
    if (note) t.note = t.note ? `${t.note}; ${note}` : note
  }

  for (const a of actions) {
    if (final) break
    if (awaiting) {
      if (a.t === 'continue') {
        awaiting = false
        continued = true
        advance()
      } else if (a.t === 'stop') finishRest()
      continue
    }
    if (a.t === 'continue' || a.t === 'stop') continue
    if (a.t === 'dart') {
      const t: TurnRecord = open ?? begin()
      const res = engine.dart(s, side, a.dart, cfg, a.to)
      t.darts.push(a.dart)
      t.points += res.points ?? 0
      addNote(t, res.note)
      if (res.bust) {
        t.bust = true
        t.points = 0
      }
      const someoneDone = engine.winnersAmong(s, cfg, pool()).length > 0
      if (someoneDone || res.bust || res.endTurn || t.darts.length >= 3 || engine.eliminated(s, side)) close(t)
    } else if (a.t === 'total') {
      if (open || !engine.total) continue
      const probe = JSON.parse(JSON.stringify(s)) as typeof s
      if (engine.total(probe, side, a.n, cfg) === null) continue
      const t = begin()
      const res = engine.total(s, side, a.n, cfg)!
      t.total = a.n
      t.points = res.bust ? 0 : (res.points ?? 0)
      t.bust = !!res.bust
      addNote(t, res.note)
      close(t)
    } else {
      close(open ?? begin())
    }
  }

  const cur = open as TurnRecord | null
  return {
    state: s,
    turns,
    side: cur ? cur.side : side,
    playerId: cur ? cur.playerId : playerFor(side),
    openDarts: cur ? cur.darts : [],
    turnOpen: !!cur,
    finished: final || awaiting,
    final,
    awaitingContinue: awaiting,
    continued,
    placings,
    winners: placings[0] ?? [],
    finishDarts,
    snapshots,
  }
}

/**
 * Margin between two sides: progress difference measured when the first of them was placed
 * (so runner-up play afterwards doesn't shrink the winner's margin). Range -1..1.
 */
export function marginMatrix(view: Pick<GameView, 'placings' | 'snapshots'>, sides: number): number[][] {
  const group: number[] = Array.from({ length: sides }, () => -1)
  view.placings.forEach((g, k) => g.forEach((i) => (group[i] = k)))
  return Array.from({ length: sides }, (_, i) =>
    Array.from({ length: sides }, (_, j) => {
      if (i === j || group[i] < 0 || group[j] < 0) return 0
      const snapRow = view.snapshots[Math.min(group[i], group[j])]
      if (!snapRow) return 0
      return Math.round((snapRow[i] - snapRow[j]) * 1000) / 1000
    }),
  )
}

/** Append an action if it is valid for the current position; otherwise return the list unchanged. */
export function applyAction(cfg: GameConfig, actions: Action[], a: Action): Action[] {
  const v = replay(cfg, actions)
  if (a.t === 'continue' || a.t === 'stop') return v.awaitingContinue ? [...actions, a] : actions
  if (v.finished) return actions
  if (a.t === 'total' && v.turnOpen) return actions
  const next = [...actions, a]
  if (a.t === 'total' && replay(cfg, next).turns.length === v.turns.length) return actions
  return next
}

export function undo(actions: Action[]): Action[] {
  return actions.slice(0, -1)
}

/** Rematch config: same players & options, starting order rotated by one. */
export function rematchConfig(cfg: GameConfig): GameConfig {
  const sides = cfg.sides.length > 1 ? [...cfg.sides.slice(1), cfg.sides[0]] : cfg.sides
  return { ...cfg, sides }
}
