import type { Dart, DartChoice, GameConfig } from './types'
import { dartValue, isDouble } from './types'
import { isCheckoutPossible, isPossibleTurnTotal } from './checkout'

export interface DartResult {
  points?: number
  bust?: boolean
  endTurn?: boolean
  note?: string
}

export interface Engine<S> {
  init(cfg: GameConfig): S
  startTurn(s: S, side: number): void
  dart(s: S, side: number, dart: Dart, cfg: GameConfig, choice?: DartChoice): DartResult
  /** Whole-turn total (keypad). Return null if not supported / invalid. */
  total?(s: S, side: number, n: number, cfg: GameConfig): DartResult | null
  endTurn(s: S, side: number, cfg: GameConfig): void
  /** Side is knocked out (Killer) and is skipped in rotation. */
  eliminated(s: S, side: number): boolean
  /**
   * Sides in `pool` (sides still competing) that have now finished/won, considering only
   * the pool. Used for the winner and, in runner-up play, for 2nd, 3rd...
   */
  winnersAmong(s: S, cfg: GameConfig, pool: number[]): number[]
  /** How far a side got (higher = better). Ranks sides that never finished. */
  progress(s: S, side: number): number
  /**
   * How far a side got as a fraction 0..1 (1 = finished). Margin of victory between two
   * sides is the difference of their fractions.
   */
  fraction(s: S, side: number, cfg: GameConfig): number
  /** Darts thrown by a side so far (X01 darts-to-finish). */
  dartsThrown?(s: S, side: number): number
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

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
  winnersAmong: (s, _cfg, pool) => pool.filter((i) => s.remaining[i] === 0),
  progress: (s, side) => -s.remaining[side],
  // share of the start score already scored
  fraction: (s, side, cfg) => clamp01((cfg.options.startScore - s.remaining[side]) / cfg.options.startScore),
  dartsThrown: (s, side) => s.darts[side],
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
  /** Order of elimination (1 = first out), 0 = still alive. */
  outAt: number[]
}

export const killer: Engine<KillerState> = {
  init: (cfg) => ({
    kind: 'killer',
    numbers: cfg.sides.map((sd) => cfg.options.killerNumbers[sd.id] ?? 0),
    lives: cfg.sides.map(() => cfg.options.lives),
    killer: cfg.sides.map(() => false),
    outAt: cfg.sides.map(() => 0),
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
      if (s.lives[side] <= 0) s.outAt[side] = Math.max(0, ...s.outAt) + 1
      return {
        note: `${name(side)} hit own double (−1 life)`,
        endTurn: s.lives[side] <= 0,
      }
    }
    if (!s.killer[side]) return {}
    s.lives[target]--
    if (s.lives[target] <= 0) s.outAt[target] = Math.max(0, ...s.outAt) + 1
    return {
      note: s.lives[target] <= 0 ? `${name(target)} is out!` : `${name(target)} −1 life`,
      points: 1,
    }
  },
  endTurn() {},
  eliminated: (s, side) => s.lives[side] <= 0,
  winnersAmong(s, _cfg, pool) {
    // Last one standing. Everyone else is ranked by when they went out.
    const alive = pool.filter((i) => s.lives[i] > 0)
    return alive.length === 1 && s.lives.length > 1 && s.lives.filter((l) => l > 0).length === 1 ? alive : []
  },
  progress: (s, side) => (s.lives[side] > 0 ? 1000 + s.lives[side] : s.outAt[side]),
  // alive: 0.5 + 0.5 × lives left; out: 0 (first out) up to just under 0.5 (last out)
  fraction: (s, side, cfg) =>
    s.lives[side] > 0
      ? 0.5 + 0.5 * clamp01(s.lives[side] / Math.max(1, cfg.options.lives))
      : (0.5 * (s.outAt[side] - 1)) / Math.max(1, s.lives.length - 1),
}

// ---------------------------------------------------------------- 1 to 7 (race)
/** Targets are 1..7; reaching ONE_TO_SEVEN_FINISH (= "one past 7") finishes. */
export const ONE_TO_SEVEN_LAST = 7
export const ONE_TO_SEVEN_FINISH = ONE_TO_SEVEN_LAST + 1

/**
 * Where a hit on your current target takes you. You advance by the multiplier
 * (single 1, double 2, triple 3). Landing exactly one past 7 finishes. If the hit would
 * take you past that, you bounce: overshoot by 1 space = stay where you are, overshoot by
 * 2 = drop back one space (i.e. new = current - (overshoot - 1)).
 *   on 7: S → finish, D → stay on 7, T → back to 6
 *   on 6: S → 7, D → finish, T → stay on 6
 */
export function oneToSevenMove(current: number, mult: number): number {
  const next = current + mult
  if (next <= ONE_TO_SEVEN_FINISH) return next
  const overshoot = next - ONE_TO_SEVEN_FINISH
  return current - (overshoot - 1)
}

export interface OneToSevenState {
  kind: 'oneToSeven'
  /** Current target per side, 1..7; ONE_TO_SEVEN_FINISH when finished. */
  target: number[]
}

export const oneToSeven: Engine<OneToSevenState> = {
  init: (cfg) => ({ kind: 'oneToSeven', target: cfg.sides.map(() => 1) }),
  startTurn() {},
  dart(s, side, dart) {
    const t = s.target[side]
    if (t >= ONE_TO_SEVEN_FINISH || dart.segment !== t) return {}
    const next = oneToSevenMove(t, dart.mult)
    s.target[side] = next
    const note =
      next >= ONE_TO_SEVEN_FINISH
        ? 'Finished'
        : next < t
          ? `Bounced back to ${next}`
          : next === t
            ? `Stays on ${t}`
            : undefined
    return { points: next - t, note }
  },
  endTurn() {},
  eliminated: () => false,
  winnersAmong: (s, _cfg, pool) => pool.filter((i) => s.target[i] >= ONE_TO_SEVEN_FINISH),
  progress: (s, side) => s.target[side],
  // targets 1..7 passed
  fraction: (s, side) => clamp01((s.target[side] - 1) / ONE_TO_SEVEN_LAST),
}

// ---------------------------------------------------------------- Cricket
export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25]
export interface CricketState {
  kind: 'cricket'
  marks: number[][] // side -> per CRICKET_TARGETS index
  points: number[]
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
  winnersAmong(s, _cfg, pool) {
    // Closed everything with at least as many points as everyone still in the pool.
    return pool.filter(
      (i) => s.marks[i].every((m) => m >= 3) && pool.every((j) => j === i || s.points[i] >= s.points[j]),
    )
  },
  progress: (s, side) => s.marks[side].reduce((a, m) => a + Math.min(3, m), 0) * 10000 + s.points[side],
  // marks made toward closing everything
  fraction: (s, side) => s.marks[side].reduce((a, m) => a + Math.min(3, m), 0) / (CRICKET_TARGETS.length * 3),
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
  winnersAmong: (s, _cfg, pool) => pool.filter((i) => s.target[i] === 0),
  progress: (s, side) => (s.target[side] === 0 ? 22 : s.target[side] === 25 ? 21 : s.target[side]),
  // 21 steps: 1..20 and bull
  fraction: (s, side) => ((s.target[side] === 0 ? 22 : s.target[side] === 25 ? 21 : s.target[side]) - 1) / 21,
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
  winnersAmong: (s, _cfg, pool) => pool.filter((i) => s.marks[i].every((x) => x >= CLOSE_OUT_MARKS)),
  progress: (s, side) => s.marks[side].reduce((a, m) => a + Math.min(CLOSE_OUT_MARKS, m), 0),
  fraction: (s, side) =>
    s.marks[side].reduce((a, m) => a + Math.min(CLOSE_OUT_MARKS, m), 0) / (CLOSE_OUT_TARGETS.length * CLOSE_OUT_MARKS),
}

export type GameState = X01State | KillerState | OneToSevenState | CricketState | CloseOutState | AtcState

export const ENGINES = { x01, killer, oneToSeven, cricket, closeOut, atc } as const
