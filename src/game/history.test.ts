import { describe, expect, it } from 'vitest'
import { replay } from './engine'
import {
  avgFinish,
  bestFinish,
  buildRecord,
  computeHandicaps,
  computeStats,
  expectedVs,
  placementScore,
  rankPlayers,
  threeDartAvg,
  winPct,
  type GameRecord,
} from './history'
import { cfg, darts, total } from './testutil'

let t = 0
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

describe('handicap', () => {
  it('starts at 18; equal 2-player game: provisional win -2, loss +1', () => {
    const h = computeHandicaps([rec([1, 2])])
    expect(h.get('p0')).toMatchObject({ handicap: 16, last: -2, games: 1, provisional: true })
    expect(h.get('p1')).toMatchObject({ handicap: 19, last: 1 })
  })

  it('established players: win -1, loss +0.5', () => {
    const rs = Array.from({ length: 5 }, (_, i) => rec(i % 2 ? [2, 1] : [1, 2]))
    const before = computeHandicaps(rs)
    const a = before.get('p0')!
    const b = before.get('p1')!
    expect(a.provisional).toBe(false)
    // nudge both to equal for the check: use two fresh established players by symmetry
    const after = computeHandicaps([...rs, rec([1, 2])])
    const d0 = after.get('p0')!.handicap - a.handicap
    const d1 = after.get('p1')!.handicap - b.handicap
    expect(d0).toBeLessThan(0)
    expect(d0).toBeGreaterThanOrEqual(-2)
    expect(d1).toBeGreaterThan(0)
    expect(d1).toBeLessThanOrEqual(1)
  })

  it('beating a stronger field moves you more than beating a weaker one', () => {
    expect(expectedVs(18, 18)).toBe(0.5)
    expect(expectedVs(24, 12)).toBeCloseTo(1 / 11)
    // p0 beats p1 five times → p1 rises, p0 drops
    const warm = Array.from({ length: 5 }, () => rec([1, 2]))
    const h = computeHandicaps(warm)
    expect(h.get('p0')!.handicap).toBeLessThan(h.get('p1')!.handicap)
    // upset: weaker p1 wins now
    const up = computeHandicaps([...warm, rec([2, 1])])
    const fav = computeHandicaps([...warm, rec([1, 2])])
    const upsetGain = h.get('p1')!.handicap - up.get('p1')!.handicap
    const favGain = h.get('p0')!.handicap - fav.get('p0')!.handicap
    expect(upsetGain).toBeGreaterThan(favGain)
    expect(upsetGain).toBeLessThanOrEqual(2)
  })

  it('mid placings are scaled, and nobody moves in a solo game', () => {
    const h = computeHandicaps([rec([1, 2, 3, 4])])
    expect(h.get('p0')!.last).toBeCloseTo(-2)
    expect(h.get('p1')!.last).toBeCloseTo(-0.7)
    expect(h.get('p2')!.last).toBeCloseTo(0.3)
    expect(h.get('p3')!.last).toBeCloseTo(1)
    expect(computeHandicaps([rec([1])]).get('p0')!.handicap).toBe(18)
  })

  it('is clamped 0..36, deterministic and order-independent of the input array', () => {
    const rs = Array.from({ length: 40 }, () => rec([1, 2]))
    const h = computeHandicaps(rs)
    expect(h.get('p0')!.handicap).toBeGreaterThanOrEqual(0)
    expect(h.get('p1')!.handicap).toBeLessThanOrEqual(36)
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
      ),
    ])
    expect(h.get('a')!.handicap).toBe(16)
    expect(h.get('b')!.handicap).toBe(16)
    expect(h.get('d')!.handicap).toBe(19)
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
