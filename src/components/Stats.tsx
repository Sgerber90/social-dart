import { useMemo, useState, type ReactNode } from 'react'
import {
  HANDICAP,
  STATS_KEYS,
  avgFinish,
  bestFinish,
  computeStats,
  rankPlayers,
  threeDartAvg,
  winPct,
  type GameRecord,
  type HandicapInfo,
  type StatsKey,
} from '../game/history'
import type { Friend } from '../game/types'
import { placeText } from '../game/meta'
import { Avatar, Card, HandicapTag, SectionTitle, cx } from './ui'

interface Props {
  header: ReactNode
  nav: ReactNode
  friends: Friend[]
  history: GameRecord[]
  handicaps: Map<string, HandicapInfo>
}

export default function Stats({ header, nav, friends, history, handicaps }: Props) {
  const [filter, setFilter] = useState<StatsKey | 'all'>('all')
  const [open, setOpen] = useState<string | null>(null)
  const stats = useMemo(() => computeStats(history, filter), [history, filter])
  const all = useMemo(() => computeStats(history), [history])
  const ranked = rankPlayers(
    friends.filter((f) => stats.has(f.id)).map((f) => f.id),
    stats,
  )
  const byId = new Map(friends.map((f) => [f.id, f]))
  const isX01 = filter === '501' || filter === '301' || filter === 'x01'
  const games = history.filter((r) => filter === 'all' || r.key === filter).length
  const keys = STATS_KEYS.filter((k) => k.key === 'all' || history.some((r) => r.key === k.key) || k.key === filter)

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col md:max-w-4xl md:px-8 gap-5 px-4 pb-16 pt-6">
      {header}
      {nav}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Game type">
        {keys.map((k) => (
          <button
            key={k.key}
            type="button"
            role="tab"
            aria-selected={filter === k.key}
            onClick={() => setFilter(k.key)}
            className={cx(
              'min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ring-1',
              filter === k.key ? 'bg-cream text-black ring-cream' : 'bg-white/5 text-cream/70 ring-white/10',
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      <section>
        <SectionTitle>
          Ranking · {games} game{games === 1 ? '' : 's'}
        </SectionTitle>
        {ranked.length === 0 && (
          <Card className="p-4 text-sm text-cream/60">
            No finished games yet{filter === 'all' ? '' : ' of this type'}. Play a game with players from your list and
            it shows up here.
          </Card>
        )}
        <ol className="flex flex-col gap-2 md:grid md:grid-cols-2">
          {ranked.map((id, k) => {
            const f = byId.get(id)!
            const st = stats.get(id)!
            const h = handicaps.get(id)
            const expanded = open === id
            const best = bestFinish(st)
            const avg = avgFinish(st)
            return (
              <li
                key={id}
                className={cx(
                  'rounded-2xl ring-1',
                  k === 0 ? 'bg-[#1d1913] ring-gold/50' : 'bg-panel/90 ring-white/10',
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  <span
                    className={cx(
                      'w-6 text-center text-lg font-black tabular-nums',
                      k === 0 ? 'text-gold' : 'text-cream/50',
                    )}
                  >
                    {k + 1}
                  </span>
                  <Avatar name={f.name} color={f.color} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold leading-tight">{f.name}</span>
                    <span className="block text-xs text-cream/55">
                      <HandicapTag
                        h={h?.handicap ?? HANDICAP.start}
                        last={h?.last}
                        provisional={h?.provisional ?? true}
                      />
                    </span>
                  </span>
                  <span className="text-right text-xs leading-tight text-cream/60 tabular-nums">
                    <span className="block text-base font-black text-cream">{winPct(st).toFixed(0)}%</span>
                    {st.wins}/{st.games} won
                  </span>
                </button>
                {expanded && (
                  <div className="anim-rise grid grid-cols-2 gap-2 border-t border-white/10 p-3 text-sm">
                    <Stat label="Games" value={st.games} />
                    <Stat label="Avg place" value={st.avgPlace.toFixed(1)} />
                    <Stat
                      label="Placings"
                      wide
                      value={
                        st.places
                          .map((n, p) => (n ? `${placeText(p + 1)}×${n}` : ''))
                          .filter(Boolean)
                          .join('  ') || '–'
                      }
                    />
                    {(isX01 || filter === 'all') && (st.x01Darts > 0 || st.finishes.length > 0) && (
                      <>
                        <Stat label="3-dart avg" value={threeDartAvg(st).toFixed(1)} />
                        <Stat label="Finishes" value={st.finishes.length} />
                        <Stat label="Best finish" value={best ? `${best} darts` : '–'} />
                        <Stat label="Avg finish" value={avg ? `${avg.toFixed(1)} darts` : '–'} />
                      </>
                    )}
                    {filter === 'all' && <PerGame id={id} history={history} />}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
        {ranked.length > 0 && (
          <p className="mt-2 px-1 text-[11px] text-cream/40">
            Ranked by average placing (1st = 100%, last = 0%), then wins. Tap a player for details. All-time:{' '}
            {[...all.values()].reduce((a, s) => a + s.games, 0)} player-games.
          </p>
        )}
      </section>

      <section>
        <SectionTitle>How the handicap works</SectionTitle>
        <Card className="p-4 text-sm leading-relaxed text-cream/75">
          <p>
            Like golf: lower is better and 0 is scratch. Really good players can go below scratch, down to{' '}
            {HANDICAP.min}. The highest is {HANDICAP.max}. Everyone starts on {HANDICAP.start}.
          </p>
          <p className="mt-2">
            After each finished game, you are compared with every opponent: did you finish ahead, and{' '}
            <b className="text-cream">by how much</b>? The margin is how far each of you got when the first of you
            finished, e.g. the share of 501 already scored, targets closed, numbers passed or lives left. A photo finish
            counts as a narrow win, and winning before they&apos;ve really started counts as a full one.
          </p>
          <p className="mt-2">
            That result is set against what your handicaps predicted. Beating a stronger player, or winning by more,
            lowers your handicap more (up to −{HANDICAP.k} a game, or −{HANDICAP.provisionalK} in your first{' '}
            {HANDICAP.provisionalGames} games, marked *). Losing raises it by half as much: a narrow loss barely moves
            you, a hammering clearly does. Teams share the team result.
          </p>
          <p className="mt-2 text-xs text-gold/80">
            New: the winning and losing margin now counts. Thanks for the idea!
          </p>
        </Card>
      </section>
    </div>
  )
}

function Stat({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={cx('rounded-xl bg-white/5 px-3 py-2', wide && 'col-span-2')}>
      <div className="text-[11px] uppercase tracking-wider text-cream/45">{label}</div>
      <div className="font-bold tabular-nums">{value}</div>
    </div>
  )
}

function PerGame({ id, history }: { id: string; history: GameRecord[] }) {
  const rows = STATS_KEYS.filter((k) => k.key !== 'all').flatMap((k) => {
    const st = computeStats(history, k.key).get(id)
    return st ? [{ label: k.label, st }] : []
  })
  if (rows.length < 1) return null
  return (
    <div className="col-span-2 rounded-xl bg-white/5 px-3 py-2">
      <div className="mb-1 text-[11px] uppercase tracking-wider text-cream/45">Per game</div>
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between text-xs">
          <span>{r.label}</span>
          <span className="tabular-nums text-cream/65">
            {r.st.wins}/{r.st.games} won · avg place {r.st.avgPlace.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  )
}
