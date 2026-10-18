import { describe, expect, it } from 'vitest'
import { replay } from './engine'
import {
  avgFinish,
  bestFinish,
  buildRecord,
  computeHandicaps,
  computeStats,
  expectedVs,
  headToHead,
  placementScore,
  rankPlayers,
  threeDartAvg,
  winPct,
  type GameRecord,
} from './history'
import { cfg, darts, total } from './testutil'

let t = 0
const round = (x: number) => Math.round(x * 100) / 100
function rec(places: number[], ids?: string[][], extra: Partial<GameRecord> = {}): GameRecord {
  const sides = (ids ?? places.map((_, i) => [`p${i}`])).map((p, i) => ({ name: `S${i}`, playerIds: p }))
  return {
    id: `g${++t}`,
    endedAt: t,
    type: 'x01',
    key: '501',
    sides,
    players: sides.flatMap((s) => s.playerIds.map((id) => ({ id, name: id }))),
    places,
    finishDarts: places.map(() => null),
    runnerUp: false,
    ...extra,
  }
}

describe('placement score', () => {
  it('maps 1st..last to 1..0 and averages ties', () => {
    expect(placementScore([1, 2], 0)).toBe(1)
    expect(placementScore([1, 2], 1)).toBe(0)
    expect(placementScore([1, 2, 3, 4], 1)).toBeCloseTo(2 / 3)
    expect(placementScore([1, 2, 2, 4], 1)).toBeCloseTo(0.5)
  })
})

/** 2-player record where side 0 beat side 1 by `m` (progress difference). */
const duel = (m: number, winner = 0) => {
  const places = winner === 0 ? [1, 2] : [2, 1]
  const mm = winner === 0 ? m : -m
  return rec(places, undefined, {
    margins: [
      [0, mm],
      [-mm, 0],
    ],
  })
}
/** n established, equal players (each has played 5 games that cancel out). */
const tie = () =>
  rec([1, 1], undefined, {
    margins: [
      [0, 0],
      [0, 0],
    ],
  })
const warmup = () => [tie(), tie(), tie(), tie(), tie()]

describe('handicap', () => {
  it('head-to-head result: placing gives direction, margin gives size', () => {
    expect(headToHead(1, 0)).toBeCloseTo(0.65)
    expect(headToHead(1, 1)).toBeCloseTo(1)
    expect(headToHead(-1, -0.04)).toBeCloseTo(0.336)
    expect(headToHead(-1, -1)).toBeCloseTo(0)
    expect(headToHead(0, 0)).toBe(0.5)
    // a winner with lower measured progress (e.g. Cricket on points) still counts as a narrow win
    expect(headToHead(1, -0.3)).toBeCloseTo(0.5 + 0.5 * (0.3 + 0.7 * 0.3))
  })

  it('narrow vs big wins (equal players, established K=2)', () => {
    const narrow = computeHandicaps([
      rec([1, 2], [['a'], ['b']], {
        margins: [
          [0, 0.04],
          [-0.04, 0],
        ],
      }),
    ])
    expect(narrow.get('a')!.last).toBeCloseTo(-0.7) // provisional: K=4 → -4 × 0.164
    const h = (m: number) => {
      const base = computeHandicaps(warmup())
      const after = computeHandicaps([...warmup(), duel(m)])
      return round(after.get('p0')!.handicap - base.get('p0')!.handicap)
    }
    expect(h(0.04)).toBeCloseTo(-0.3, 1)
    expect(h(0.6)).toBeCloseTo(-0.7, 1)
    expect(h(1)).toBeCloseTo(-1, 1)
    expect(h(0.04)).toBeGreaterThan(h(0.6))
  })

  it('narrow vs big losses: a narrow loss barely moves you, a hammering clearly does', () => {
    const h = (m: number) => {
      const base = computeHandicaps(warmup())
      const after = computeHandicaps([...warmup(), duel(m)])
      return round(after.get('p1')!.handicap - base.get('p1')!.handicap)
    }
    expect(h(0.04)).toBeCloseTo(0.2, 1)
    expect(h(0.6)).toBeCloseTo(0.4, 1)
    expect(h(1)).toBeCloseTo(0.5, 1)
    expect(h(0.04)).toBeLessThan(h(1))
  })

  it('can go below scratch (negative), bounded at -10', () => {
    // a scratch player hammering a strong (2.0) opponent goes negative
    const win = rec([1, 2], [['star'], ['pro']], {
      margins: [
        [0, 1],
        [-1, 0],
      ],
    })
    const start = new Map([
      ['star', 0],
      ['pro', 2],
    ])
    const h = computeHandicaps([win], start).get('star')!
    expect(h.handicap).toBeLessThan(0)
    expect(h.last).toBeLessThan(0)
    const many = Array.from({ length: 50 }, () => ({ ...win, id: `w${++t}`, endedAt: t }))
    const end = computeHandicaps(
      many,
      new Map([
        ['star', -9],
        ['pro', -8],
      ]),
    )
    expect(end.get('star')!.handicap).toBe(-10)
    // and the old 0 floor is gone for ordinary history too
    const streak = Array.from({ length: 30 }, (_, k) =>
      rec([1, 2], [['ace'], [k % 2 ? 'b' : 'c']], {
        margins: [
          [0, 1],
          [-1, 0],
        ],
      }),
    )
    const pros = computeHandicaps(
      streak,
      new Map([
        ['b', 0],
        ['c', 0],
      ]),
    )
    expect(pros.get('ace')!.handicap).toBeLessThan(0)
  })

  it('beating a stronger field moves you more than beating a weaker one', () => {
    expect(expectedVs(18, 18)).toBe(0.5)
    expect(expectedVs(24, 12)).toBeCloseTo(1 / 11)
    const warm = Array.from({ length: 5 }, () => duel(0.5))
    const h = computeHandicaps(warm)
    expect(h.get('p0')!.handicap).toBeLessThan(h.get('p1')!.handicap)
    const up = computeHandicaps([...warm, duel(0.5, 1)])
    const fav = computeHandicaps([...warm, duel(0.5)])
    const upsetGain = h.get('p1')!.handicap - up.get('p1')!.handicap
    const favGain = h.get('p0')!.handicap - fav.get('p0')!.handicap
    expect(upsetGain).toBeGreaterThan(favGain)
    expect(upsetGain).toBeLessThanOrEqual(2)
  })

  it('multi-player: averaged over opponents; nobody moves in a solo game', () => {
    const m = [
      [0, 0.2, 0.5, 0.9],
      [-0.2, 0, 0.3, 0.7],
      [-0.5, -0.3, 0, 0.4],
      [-0.9, -0.7, -0.4, 0],
    ]
    const h = computeHandicaps([rec([1, 2, 3, 4], undefined, { margins: m })])
    const d = [0, 1, 2, 3].map((i) => h.get(`p${i}`)!.last)
    expect(d[0]).toBeLessThan(d[1])
    expect(d[1]).toBeLessThan(0)
    expect(d[2]).toBeGreaterThan(0)
    expect(d[3]).toBeGreaterThan(d[2])
    expect(computeHandicaps([rec([1])]).get('p0')!.handicap).toBe(18)
  })

  it('old records without margins use a medium margin', () => {
    const h = computeHandicaps([rec([1, 2])])
    // provisional K=4, head-to-head 0.5 + 0.5 × (0.3 + 0.7 × 0.5) = 0.825
    expect(h.get('p0')!.last).toBeCloseTo(-1.3)
    expect(h.get('p1')!.last).toBeCloseTo(0.7)
  })

  it('is deterministic and independent of the input order', () => {
    const rs = Array.from({ length: 40 }, (_, k) => duel((k % 10) / 10, k % 3 ? 0 : 1))
    const h = computeHandicaps(rs)
    expect(computeHandicaps([...rs].reverse())).toEqual(h)
  })

  it('team members share the team result', () => {
    const h = computeHandicaps([
      rec(
        [1, 2],
        [
          ['a', 'b'],
          ['c', 'd'],
        ],
        {
          margins: [
            [0, 0.5],
            [-0.5, 0],
          ],
        },
      ),
    ])
    expect(h.get('a')!.handicap).toBe(h.get('b')!.handicap)
    expect(h.get('c')!.handicap).toBe(h.get('d')!.handicap)
    expect(h.get('a')!.handicap).toBeLessThan(18)
  })
})

describe('margins from real games', () => {
  it('X01: margin = share of the start score; measured when the winner finished', () => {
    const c = cfg('x01', 3, { startScore: 101 })
    const r = buildRecord(
      'm',
      c,
      replay(c, [...darts('T20 S1 D20'), { t: 'continue' }, total(60), total(41), ...darts('S1 D20')]),
      1,
    )!
    // at p0's finish: p1 101 left (0), p2 101 left (0) → margin 1
    expect(r.margins![0][1]).toBe(1)
    expect(r.margins![0][2]).toBe(1)
    // p1 vs p2 measured when p1 finished: p1 1.0, p2 41/101
    expect(r.margins![1][2]).toBeCloseTo(1 - 41 / 101, 2)
    expect(r.margins![2][1]).toBeCloseTo(-(1 - 41 / 101), 2)
  })

  it('narrow X01 win gives a small margin', () => {
    const c = cfg('x01', 2, { startScore: 101 })
    const r = buildRecord('n', c, replay(c, [total(61), total(81), ...darts('D20')]), 1)!
    expect(r.margins![0][1]).toBeCloseTo(1 - 81 / 101, 2)
    const r2 = buildRecord('n2', c, replay(c, [total(61), total(99), ...darts('D20')]), 1)!
    expect(r2.margins![0][1]).toBeCloseTo(1 - 99 / 101, 2)
  })

  it('other games report a 0..1 fraction', () => {
    const c7 = cfg('oneToSeven', 2)
    const r7 = buildRecord('a', c7, replay(c7, darts('T1 T4 S7')), 1)!
    expect(r7.margins![0][1]).toBe(1) // opponent still on 1
    const ck = cfg('killer', 2, { lives: 3, killerNumbers: { s0: 20, s1: 19 } })
    const rk = buildRecord('k', ck, replay(ck, darts('D20 D19 D19 M M M D19')), 1)!
    expect(rk.margins![0][1]).toBe(1) // won with all 3 lives vs first out
  })
})

describe('stats', () => {
  it('counts games, wins, placings and ranks best first', () => {
    const rs = [
      rec([1, 2, 3]),
      rec([2, 1, 3]),
      rec([1, 3, 2]),
      rec([1, 2], undefined, { key: 'cricket', type: 'cricket' }),
    ]
    const s = computeStats(rs)
    expect(s.get('p0')).toMatchObject({ games: 4, wins: 3, places: [3, 1] })
    expect(winPct(s.get('p0')!)).toBe(75)
    expect(s.get('p2')).toMatchObject({ games: 3, wins: 0, places: [0, 1, 2] })
    expect(rankPlayers(['p2', 'p1', 'p0'], s)).toEqual(['p0', 'p1', 'p2'])
    expect(computeStats(rs, 'cricket').get('p2')).toBeUndefined()
    expect(computeStats(rs, 'cricket').get('p0')!.games).toBe(1)
  })

  it('records X01 darts to finish and 3-dart average from a real game, incl. runner-up', () => {
    const c = cfg('x01', 3, { startScore: 101 })
    const v = replay(c, [
      ...darts('T20 S1 D20'), // p0 finishes in 3 darts
      { t: 'continue' },
      total(60),
      total(41),
      ...darts('S1 D20'), // p1: 101-60=41 → S1 D20 finishes in 5 darts
    ])
    expect(v.final).toBe(true)
    const r = buildRecord('x', c, v, 1)!
    expect(r.places).toEqual([1, 2, 3])
    expect(r.finishDarts).toEqual([3, 5, null])
    expect(r.runnerUp).toBe(true)
    const s = computeStats([r])
    expect(bestFinish(s.get('p0')!)).toBe(3)
    expect(avgFinish(s.get('p1')!)).toBe(5)
    expect(threeDartAvg(s.get('p0')!)).toBeCloseTo(101)
    expect(threeDartAvg(s.get('p2')!)).toBeCloseTo(41)
    expect(r.key).toBe('x01')
  })

  it('no record for an unfinished game', () => {
    const c = cfg('x01', 3)
    expect(buildRecord('x', c, replay(c, darts('T20')), 1)).toBeNull()
  })
})
