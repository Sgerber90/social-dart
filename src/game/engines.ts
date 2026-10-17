import type { Dart, DartChoice, GameConfig } from './types'
import { dartValue, isDouble } from './types'
import { isCheckoutPossible, isPossibleTurnTotal } from './checkout'

export interface DartResult {
  points?: number
  bust?: boolean
  endTurn?: boolean
  note?: string
}

export interface GameResult {
  finished: boolean
  winners: number[]
}

export interface Engine<S> {
  init(cfg: GameConfig): S
  startTurn(s: S, side: number): void
  dart(s: S, side: number, dart: Dart, cfg: GameConfig, choice?: DartChoice): DartResult
  /** Whole-turn total (keypad). Return null if not supported / invalid. */
  total?(s: S, side: number, n: number, cfg: GameConfig): DartResult | null
  endTurn(s: S, side: number, cfg: GameConfig): void
  eliminated(s: S, side: number): boolean
  result(s: S, cfg: GameConfig): GameResult
}

const NO_RESULT: GameResult = { finished: false, winners: [] }

// ---------------------------------------------------------------- X01
export interface X01State {
  kind: 'x01'
  remaining: number[]
  turnStart: number[]
  darts: number[]
  scored: number[]
}

export const x01: Engine<X01State> = {
  init: (cfg) => ({
    kind: 'x01',
    remaining: cfg.sides.map(() => cfg.options.startScore),
    turnStart: cfg.sides.map(() => cfg.options.startScore),
    darts: cfg.sides.map(() => 0),
    scored: cfg.sides.map(() => 0),
  }),
  startTurn(s, side) {
    s.turnStart[side] = s.remaining[side]
  },
  dart(s, side, dart, cfg) {
    const v = dartValue(dart)
    const next = s.remaining[side] - v
    const dbl = cfg.options.doubleOut
    s.darts[side]++
    const bust = next < 0 || (dbl && next === 1) || (dbl && next === 0 && !isDouble(dart))
    if (bust) {
      s.scored[side] -= s.turnStart[side] - s.remaining[side]
      s.remaining[side] = s.turnStart[side]
      return { bust: true, note: 'Bust' }
    }
    s.remaining[side] = next
    s.scored[side] += v
    return { points: v }
  },
  total(s, side, n, cfg) {
    if (!isPossibleTurnTotal(n)) return null
    const rem = s.remaining[side]
    const next = rem - n
    const dbl = cfg.options.doubleOut
    s.darts[side] += 3
    if (next < 0 || (dbl && next === 1) || (next === 0 && !isCheckoutPossible(n, dbl))) {
      return { bust: true, note: 'Bust' }
    }
    s.remaining[side] = next
    s.scored[side] += n
    return { points: n }
  },
  endTurn() {},
  eliminated: () => false,
  result(s) {
    const w = s.remaining.findIndex((r) => r === 0)
    return w >= 0 ? { finished: true, winners: [w] } : NO_RESULT
  },
}

export function x01Average(s: X01State, side: number): number {
  return s.darts[side] ? (s.scored[side] / s.darts[side]) * 3 : 0
}

// ---------------------------------------------------------------- Killer
export interface KillerState {
  kind: 'killer'
  numbers: number[]
  lives: number[]
  killer: boolean[]
}

export const killer: Engine<KillerState> = {
  init: (cfg) => ({
    kind: 'killer',
    numbers: cfg.sides.map((sd) => cfg.options.killerNumbers[sd.id] ?? 0),
    lives: cfg.sides.map(() => cfg.options.lives),
    killer: cfg.sides.map(() => false),
  }),
  startTurn() {},
  dart(s, side, dart, cfg) {
    if (!isDouble(dart) || dart.segment === 25) return {}
    const target = s.numbers.findIndex((n, i) => n === dart.segment && s.lives[i] > 0)
    if (target < 0) return {}
    const name = (i: number) => cfg.sides[i].name
    if (target === side) {
      if (!s.killer[side]) {
        s.killer[side] = true
        return { note: `${name(side)} is a Killer`, points: 1 }
      }
      s.lives[side]--
      return {
        note: `${name(side)} hit own double (−1 life)`,
        endTurn: s.lives[side] <= 0,
      }
    }
    if (!s.killer[side]) return {}
    s.lives[target]--
    return {
      note: s.lives[target] <= 0 ? `${name(target)} is out!` : `${name(target)} −1 life`,
      points: 1,
    }
  },
  endTurn() {},
  eliminated: (s, side) => s.lives[side] <= 0,
  result(s) {
    const alive = s.lives.map((l, i) => (l > 0 ? i : -1)).filter((i) => i >= 0)
    if (alive.length <= 1 && s.lives.length > 1) return { finished: true, winners: alive }
    return NO_RESULT
  },
}

// ---------------------------------------------------------------- 1 to 7 (Shanghai-style)
export const ONE_TO_SEVEN_ROUNDS = 7
export interface OneToSevenState {
  kind: 'oneToSeven'
  scores: number[]
  rounds: number[]
}

export const oneToSeven: Engine<OneToSevenState> = {
  init: (cfg) => ({
    kind: 'oneToSeven',
    scores: cfg.sides.map(() => 0),
    rounds: cfg.sides.map(() => 0),
  }),
  startTurn() {},
  dart(s, side, dart) {
    const round = s.rounds[side] + 1
    if (dart.segment !== round) return {}
    const pts = round * dart.mult
    s.scores[side] += pts
    return { points: pts }
  },
  endTurn(s, side) {
    s.rounds[side]++
  },
  eliminated: (s, side) => s.rounds[side] >= ONE_TO_SEVEN_ROUNDS,
  result(s) {
    if (s.rounds.every((r) => r >= ONE_TO_SEVEN_ROUNDS)) {
      const max = Math.max(...s.scores)
      return { finished: true, winners: s.scores.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0) }
    }
    return NO_RESULT
  },
}

// ---------------------------------------------------------------- Cricket
export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25]
export interface CricketState {
  kind: 'cricket'
  marks: number[][] // side -> per CRICKET_TARGETS index
  points: number[]
}

function cricketWinner(s: CricketState): number {
  for (let i = 0; i < s.points.length; i++) {
    const closedAll = s.marks[i].every((m) => m >= 3)
    const others = s.points.filter((_, j) => j !== i)
    if (closedAll && others.every((p) => s.points[i] >= p)) return i
  }
  return -1
}

export const cricket: Engine<CricketState> = {
  init: (cfg) => ({
    kind: 'cricket',
    marks: cfg.sides.map(() => CRICKET_TARGETS.map(() => 0)),
    points: cfg.sides.map(() => 0),
  }),
  startTurn() {},
  dart(s, side, dart) {
    const ti = CRICKET_TARGETS.indexOf(dart.segment)
    if (ti < 0) return {}
    let pts = 0
    for (let k = 0; k < dart.mult; k++) {
      if (s.marks[side][ti] < 3) s.marks[side][ti]++
      else if (s.marks.some((m, j) => j !== side && m[ti] < 3)) pts += dart.segment
    }
    s.points[side] += pts
    return { points: pts }
  },
  endTurn() {},
  eliminated: () => false,
  result(s) {
    const w = cricketWinner(s)
    return w >= 0 ? { finished: true, winners: [w] } : NO_RESULT
  },
}

// ---------------------------------------------------------------- Around the Clock
export interface AtcState {
  kind: 'atc'
  target: number[] // 1..20, 25 = bull, 0 = finished
}

export function atcNext(t: number): number {
  return t === 20 ? 25 : t === 25 ? 0 : t + 1
}

export const atc: Engine<AtcState> = {
  init: (cfg) => ({ kind: 'atc', target: cfg.sides.map(() => 1) }),
  startTurn() {},
  dart(s, side, dart) {
    const t = s.target[side]
    if (t === 0 || dart.segment !== t) return {}
    s.target[side] = atcNext(t)
    return { points: 1 }
  },
  endTurn() {},
  eliminated: () => false,
  result(s) {
    const w = s.target.findIndex((t) => t === 0)
    return w >= 0 ? { finished: true, winners: [w] } : NO_RESULT
  },
}

// ---------------------------------------------------------------- Close Out (no-score closing race)
/** Target order on the mark grid. 'D' = any double ring, 'T' = any triple ring, 25 = bull. */
export const CLOSE_OUT_TARGETS = [20, 19, 18, 17, 16, 15, 'D', 'T', 25] as const
export type CloseOutTarget = (typeof CLOSE_OUT_TARGETS)[number]
export const CLOSE_OUT_MARKS = 3

export interface CloseOutState {
  kind: 'closeOut'
  marks: number[][] // side -> per CLOSE_OUT_TARGETS index (capped at 3)
}

export interface CloseOutOption {
  to: DartChoice
  /** index into CLOSE_OUT_TARGETS */
  target: number
  marks: number
}

const coIndex = (t: CloseOutTarget) => CLOSE_OUT_TARGETS.indexOf(t)

/**
 * Where a dart can count in Close Out. Each dart counts ONCE:
 * - D/T on 15-20: either 2/3 marks on the number, or 1 mark on Doubles/Triples (thrower picks)
 * - D/T on 1-14: only 1 mark on Doubles/Triples
 * - single 15-20: 1 mark on the number; single 1-14 / miss: nothing
 * - outer bull 1 Bull mark; bullseye ("Cherry") 2 Bull marks, never a double
 */
export function closeOutOptions(dart: Dart): CloseOutOption[] {
  const { segment, mult } = dart
  if (segment === 25) return [{ to: 'number', target: coIndex(25), marks: mult }]
  if (segment < 1 || segment > 20) return []
  const out: CloseOutOption[] = []
  if (segment >= 15) out.push({ to: 'number', target: coIndex(segment as CloseOutTarget), marks: mult })
  if (mult === 2) out.push({ to: 'ring', target: coIndex('D'), marks: 1 })
  if (mult === 3) out.push({ to: 'ring', target: coIndex('T'), marks: 1 })
  return out
}

/** Options that still do something for this side (target not yet closed). */
export function closeOutOpenOptions(s: CloseOutState, side: number, dart: Dart): CloseOutOption[] {
  return closeOutOptions(dart).filter((o) => s.marks[side][o.target] < CLOSE_OUT_MARKS)
}

export function closeOutTargetName(t: CloseOutTarget): string {
  return t === 'D' ? 'Doubles' : t === 'T' ? 'Triples' : t === 25 ? 'Bull' : String(t)
}

export function closeOutClosed(s: CloseOutState, side: number): number {
  return s.marks[side].filter((m) => m >= CLOSE_OUT_MARKS).length
}

export const closeOut: Engine<CloseOutState> = {
  init: (cfg) => ({ kind: 'closeOut', marks: cfg.sides.map(() => CLOSE_OUT_TARGETS.map(() => 0)) }),
  startTurn() {},
  dart(s, side, dart, _cfg, choice) {
    const open = closeOutOpenOptions(s, side, dart)
    // Use the chosen option if it is still open; otherwise the only/first open option.
    const opt = open.find((o) => o.to === choice) ?? open[0]
    if (!opt) return { points: 0 }
    const take = Math.min(opt.marks, CLOSE_OUT_MARKS - s.marks[side][opt.target])
    s.marks[side][opt.target] += take
    const both = closeOutOptions(dart).length > 1
    return {
      points: take,
      note: both && opt.to === 'ring' ? `→ ${closeOutTargetName(CLOSE_OUT_TARGETS[opt.target])}` : undefined,
    }
  },
  endTurn() {},
  eliminated: () => false,
  result(s) {
    const w = s.marks.findIndex((m) => m.every((x) => x >= CLOSE_OUT_MARKS))
    return w >= 0 ? { finished: true, winners: [w] } : NO_RESULT
  },
}

export type GameState = X01State | KillerState | OneToSevenState | CricketState | CloseOutState | AtcState

export const ENGINES = { x01, killer, oneToSeven, cricket, closeOut, atc } as const
