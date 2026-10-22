/**
 * Store-screenshot demo data. Only active when the URL explicitly carries ?demo=<scene>
 * (scenes: 1 | closeout | 501 | 1to7). Seeds sample players, finished games and,
 * optionally, a game in progress into localStorage. Never runs otherwise.
 */
import { applyAction, replay } from './game/engine'
import { buildRecord } from './game/history'
import type { GameRecord } from './game/history'
import { DEFAULT_OPTIONS, FRIEND_COLORS } from './game/types'
import type { Action, Dart, Friend, GameConfig, GameType, Multiplier } from './game/types'
import { saveFriends, saveGame, saveHistory } from './storage'

const NAMES = ['Stefan', 'Lerato', 'Johan', 'Thandi', 'Pieter', 'Naledi']
const FRIENDS: Friend[] = NAMES.map((name, i) => ({ id: `demo-${i}`, name, color: FRIEND_COLORS[i] }))

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

function config(type: GameType, ids: number[], startScore = 501): GameConfig {
  const sides = ids.map((i) => ({ id: `s${i}`, name: NAMES[i], playerIds: [`demo-${i}`] }))
  return {
    type,
    players: ids.map((i) => ({ id: `demo-${i}`, name: NAMES[i] })),
    sides,
    options: {
      ...DEFAULT_OPTIONS,
      startScore,
      doubleOut: false,
      killerNumbers: type === 'killer' ? Object.fromEntries(sides.map((s, k) => [s.id, [20, 7, 14, 3, 11, 16][k]])) : {},
    },
  }
}

function pickDart(cfg: GameConfig, actions: Action[], r: () => number): Action {
  const v = replay(cfg, actions)
  const s = v.state as unknown as Record<string, number[] | string>
  const m = (): Multiplier => { const x = r(); return x < 0.12 ? 3 : x < 0.25 ? 2 : 1 }
  let dart: Dart
  if (r() < 0.12) dart = { segment: 0, mult: 1 }
  else if (s.kind === 'x01') {
    const rem = (s.remaining as number[])[v.side]
    if (rem <= 20) dart = { segment: rem, mult: 1 }
    else if (rem <= 40 && rem % 2 === 0) dart = { segment: rem / 2, mult: 2 }
    else dart = { segment: r() < 0.6 ? 20 : [1, 5, 19][Math.floor(r() * 3)], mult: m() }
  } else if (s.kind === 'oneToSeven' || s.kind === 'atc') {
    const t = (s.target as number[])[v.side]
    dart = { segment: Math.min(t, 20), mult: m() }
  } else if (s.kind === 'killer') {
    const nums = s.numbers as number[]
    const killer = (s.killer as unknown as boolean[])[v.side]
    const lives = s.lives as number[]
    const live = nums.filter((_, i) => lives[i] > 0 && i !== v.side)
    dart = { segment: killer ? live[Math.floor(r() * live.length)] : nums[v.side], mult: r() < 0.5 ? 2 : 1 }
  } else {
    const seg = [15, 16, 17, 18, 19, 20, 25][Math.floor(r() * 7)]
    dart = { segment: seg, mult: seg === 25 ? (r() < 0.3 ? 2 : 1) : m() }
  }
  return { t: 'dart', dart, ...(s.kind === 'closeOut' ? { to: 'number' as const } : {}) }
}

function play(cfg: GameConfig, seed: number, stopAfter = Infinity): Action[] {
  const r = rng(seed)
  let actions: Action[] = []
  for (let i = 0; i < 4000 && i < stopAfter; i++) {
    const v = replay(cfg, actions)
    if (v.final) break
    if (v.awaitingContinue) { actions = applyAction(cfg, actions, { t: 'stop' }); continue }
    if (v.finished) break
    try {
      actions = applyAction(cfg, actions, pickDart(cfg, actions, r))
    } catch {
      actions = applyAction(cfg, actions, { t: 'dart', dart: { segment: 0, mult: 1 } })
    }
  }
  return actions
}

export function demoHistory(): GameRecord[] {
  const types: [GameType, number][] = [['x01', 501], ['closeOut', 0], ['oneToSeven', 0], ['x01', 301], ['killer', 0]]
  const out: GameRecord[] = []
  const now = Date.now()
  for (let g = 0; g < 18; g++) {
    const [type, start] = types[g % types.length]
    const n = 2 + (g % 3)
    const ids = Array.from({ length: n }, (_, k) => (g + k * 2) % NAMES.length).filter((x, i, a) => a.indexOf(x) === i)
    const cfg = config(type, ids, start || 501)
    const actions = play(cfg, 1000 + g)
    const rec = buildRecord(`demo-g${g}`, cfg, replay(cfg, actions), now - (18 - g) * 86400000 * 1.3)
    if (rec) out.push(rec)
  }
  return out
}

const SCENES: Record<string, [GameType, number, number[], number]> = {
  closeout: ['closeOut', 0, [0, 1, 2], 40],
  '501': ['x01', 501, [0, 2], 22],
  '1to7': ['oneToSeven', 0, [0, 1, 3, 4], 14],
}

/** Screenshot builds (VITE_DEMO_SCREENSHOTS=1) cycle through these scenes, one per app launch. */
const CYCLE = ['1', 'closeout', '501', '1to7', 'stats', 'players']

export function seedDemo() {
  let scene: string | null = null
  try {
    scene = new URLSearchParams(window.location.search).get('demo')
    if (!scene && import.meta.env.VITE_DEMO_SCREENSHOTS === '1') {
      const n = Number(localStorage.getItem('social-dart:demo-cycle') ?? '0')
      localStorage.setItem('social-dart:demo-cycle', String(n + 1))
      scene = CYCLE[n % CYCLE.length]
    }
  } catch {
    return
  }
  if (!scene) return
  saveFriends(FRIENDS)
  saveHistory(demoHistory())
  const sc = SCENES[scene]
  if (sc) {
    const cfg = config(sc[0], sc[2], sc[1] || 501)
    if (sc[0] === 'x01') cfg.options.doubleOut = true
    saveGame({ id: `demo-live-${scene}`, config: cfg, actions: play(cfg, 7, sc[3]) })
  } else saveGame(null)
  const hash = ['stats', 'players', 'groups'].includes(scene) ? `#${scene}` : ''
  // drop the param so a reload keeps the user's own progress
  window.history.replaceState(null, '', window.location.pathname + hash)
}
