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
  finished: boolean
  winners: number[]
}

export function getEngine(cfg: GameConfig): Engine<GameState> {
  return ENGINES[cfg.type] as unknown as Engine<GameState>
}

export function replay(cfg: GameConfig, actions: Action[]): GameView {
  const engine = getEngine(cfg)
  const s = engine.init(cfg)
  const n = cfg.sides.length
  const sideTurns = cfg.sides.map(() => 0)
  const turns: TurnRecord[] = []
  let side = 0
  let open: TurnRecord | null = null
  let finished = false
  let winners: number[] = []

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
  const close = (t: TurnRecord) => {
    t.complete = true
    engine.endTurn(s, side, cfg)
    sideTurns[side]++
    open = null
    const r = engine.result(s, cfg)
    if (r.finished) {
      finished = true
      winners = r.winners
      t.win = r.winners.includes(side)
      return
    }
    for (let k = 1; k <= n; k++) {
      const c = (side + k) % n
      if (!engine.eliminated(s, c)) {
        side = c
        return
      }
    }
  }
  const addNote = (t: TurnRecord, note?: string) => {
    if (note) t.note = t.note ? `${t.note}; ${note}` : note
  }

  for (const a of actions) {
    if (finished) break
    if (a.t === 'dart') {
      const t: TurnRecord = open ?? begin()
      const res = engine.dart(s, side, a.dart, cfg)
      t.darts.push(a.dart)
      t.points += res.points ?? 0
      addNote(t, res.note)
      if (res.bust) {
        t.bust = true
        t.points = 0
      }
      const r = engine.result(s, cfg)
      if (r.finished || res.bust || res.endTurn || t.darts.length >= 3) close(t)
    } else if (a.t === 'total') {
      if (open || !engine.total) continue
      const probe = structuredClone(s)
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
    finished,
    winners,
  }
}

/** Append an action if it is valid for the current position; otherwise return the list unchanged. */
export function applyAction(cfg: GameConfig, actions: Action[], a: Action): Action[] {
  const v = replay(cfg, actions)
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
