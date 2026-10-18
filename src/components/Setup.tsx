import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Avatar, Button, Card, HandicapTag, SectionTitle, Toggle, cx } from './ui'
import Dartboard from './Dartboard'
import type { Dart } from '../game/types'
import { GAME_CHOICES, ONE_TO_SEVEN_RULES, assignKillerNumbers, type GameChoice } from '../game/meta'
import { HANDICAP, type HandicapInfo } from '../game/history'
import { DEFAULT_OPTIONS, FRIEND_COLORS, type Friend, type GameConfig, type Player, type Side } from '../game/types'
import { loadRoster, saveRoster, uid } from '../storage'

const ART: Record<GameChoice, (d: Dart) => boolean> = {
  '501': (d) => (d.segment === 20 && d.mult === 3) || (d.segment === 25 && d.mult === 2),
  '301': (d) => (d.segment === 20 && d.mult === 3) || d.segment === 25,
  killer: (d) => d.mult === 2 && d.segment !== 25,
  oneToSeven: (d) => d.segment >= 1 && d.segment <= 7,
  cricket: (d) => d.segment >= 15,
  closeOut: (d) => d.segment >= 15 || d.mult > 1,
  atc: (d) => d.mult === 1 && d.segment !== 25,
}

const TEAM_NAMES = ['Team A', 'Team B', 'Team C', 'Team D']
const TEAM_COLORS = ['bg-sky-500', 'bg-amber-500', 'bg-fuchsia-500', 'bg-lime-500']

interface Props {
  header: ReactNode
  nav: ReactNode
  friends: Friend[]
  setFriends: (f: Friend[]) => void
  handicaps: Map<string, HandicapInfo>
  initial?: GameConfig | null
  onStart: (cfg: GameConfig) => void
  onResume?: () => void
}

export default function Setup({ header, nav, friends, setFriends, handicaps, initial, onStart, onResume }: Props) {
  const roster = useMemo(() => loadRoster(), [])
  const [choice, setChoice] = useState<GameChoice>(() => {
    if (!initial) return '501'
    if (initial.type === 'x01') return initial.options.startScore === 301 ? '301' : '501'
    return initial.type
  })
  const [doubleOut, setDoubleOut] = useState(initial?.options.doubleOut ?? true)
  const [lives, setLives] = useState(initial?.options.lives ?? 3)
  const [selected, setSelected] = useState<string[]>(() => {
    const ids = new Set(friends.map((f) => f.id))
    return (roster?.players ?? []).map((p) => p.id).filter((id) => ids.has(id))
  })
  const players: Player[] = useMemo(() => {
    const byId = new Map(friends.map((f) => [f.id, f]))
    return selected.flatMap((id) => {
      const f = byId.get(id)
      return f ? [{ id: f.id, name: f.name }] : []
    })
  }, [selected, friends])
  const friendOf = (id: string) => friends.find((f) => f.id === id)
  const hcp = (id: string) => handicaps.get(id)?.handicap ?? HANDICAP.start
  const [teamsOn, setTeamsOn] = useState(roster?.teamsOn ?? false)
  const [teamCount, setTeamCount] = useState(roster?.teamCount ?? 2)
  const [teamOf, setTeamOf] = useState<Record<string, number>>(roster?.teamOf ?? {})
  const [name, setName] = useState('')
  const [killerNums, setKillerNums] = useState<Record<string, number>>(initial?.options.killerNumbers ?? {})

  useEffect(() => saveRoster({ players, teamsOn, teamCount, teamOf }), [players, teamsOn, teamCount, teamOf])

  const sides: Side[] = useMemo(() => {
    if (!teamsOn) return players.map((p) => ({ id: p.id, name: p.name, playerIds: [p.id] }))
    return TEAM_NAMES.slice(0, teamCount)
      .map((n, i) => ({
        id: `team-${i}`,
        name: n,
        playerIds: players.filter((p, idx) => (teamOf[p.id] ?? idx % teamCount) === i).map((p) => p.id),
      }))
      .filter((s) => s.playerIds.length > 0)
  }, [players, teamsOn, teamCount, teamOf])

  const sideKey = sides.map((s) => s.id).join(',')
  useEffect(() => {
    setKillerNums((cur) =>
      assignKillerNumbers(
        sides.map((s) => s.id),
        cur,
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sideKey])

  const addNew = () => {
    const n = name.trim().slice(0, 40)
    if (!n) return
    const existing = friends.find((f) => f.name.trim().toLowerCase() === n.toLowerCase())
    if (existing) {
      if (!selected.includes(existing.id)) setSelected([...selected, existing.id])
    } else {
      const f: Friend = { id: uid(), name: n, color: FRIEND_COLORS[friends.length % FRIEND_COLORS.length] }
      setFriends([...friends, f])
      setSelected([...selected, f.id])
    }
    setName('')
  }
  const toggle = (id: string) =>
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= selected.length) return
    const next = [...selected]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSelected(next)
  }
  const shuffle = () => setSelected([...selected].sort(() => Math.random() - 0.5))
  /** Balanced teams: snake draft by handicap (best first). */
  const autoSplit = () => {
    const order = [...selected].sort((a, b) => hcp(a) - hcp(b) || Math.random() - 0.5)
    const t: Record<string, number> = {}
    order.forEach((id, k) => {
      const round = Math.floor(k / teamCount)
      const pos = k % teamCount
      t[id] = round % 2 === 0 ? pos : teamCount - 1 - pos
    })
    setTeamOf(t)
  }
  const bench = friends.filter((f) => !selected.includes(f.id))

  const minSides = choice === 'killer' ? 2 : 1
  const killerDupes = choice === 'killer' && new Set(sides.map((s) => killerNums[s.id])).size !== sides.length
  const canStart = sides.length >= minSides && !killerDupes

  const start = () => {
    const type = choice === '501' || choice === '301' ? 'x01' : choice
    onStart({
      type,
      players: players.map((p) => ({ ...p, name: p.name.trim() || 'Player' })),
      sides: sides.map((s) => ({ ...s, name: s.name.trim() || 'Player' })),
      options: {
        ...DEFAULT_OPTIONS,
        startScore: choice === '301' ? 301 : 501,
        doubleOut,
        lives,
        killerNumbers: choice === 'killer' ? Object.fromEntries(sides.map((s) => [s.id, killerNums[s.id]])) : {},
      },
    })
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pb-36 pt-6">
      {header}
      {nav}

      {onResume && (
        <Button variant="soft" className="min-h-14 w-full justify-between" onClick={onResume}>
          <span>Resume current game</span>
          <span aria-hidden>→</span>
        </Button>
      )}

      <section>
        <SectionTitle>Game</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {GAME_CHOICES.map((g, i) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setChoice(g.id)}
              aria-pressed={choice === g.id}
              className={cx(
                i === GAME_CHOICES.length - 1 && GAME_CHOICES.length % 2 === 1 && 'col-span-2',
                'press anim-rise relative flex min-h-36 flex-col items-start justify-end overflow-hidden rounded-3xl p-4 text-left ring-1 transition',
                choice === g.id ? 'bg-[#1d1913] ring-metal ring-gold' : 'bg-panel/90 ring-white/10 hover:bg-[#1d1a17]',
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span
                className={cx(
                  'pointer-events-none absolute -right-8 -top-8 w-36 transition duration-500',
                  choice === g.id ? 'opacity-100' : 'opacity-75',
                )}
              >
                <Dartboard
                  art
                  numbers={false}
                  emphasize={ART[g.id]}
                  className={choice === g.id ? 'anim-spin-slow' : ''}
                />
              </span>
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-panel via-panel/75 to-transparent" />
              {g.casual && (
                <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cream/70 ring-1 ring-cream/15">
                  casual
                </span>
              )}
              <span className="relative flex w-full items-center gap-2">
                <span
                  className={cx(
                    g.title.length > 8 ? 'text-xl' : 'text-2xl',
                    'font-black leading-tight tracking-tight',
                    choice === g.id ? 'text-metal' : 'text-cream',
                  )}
                >
                  {g.title}
                </span>
              </span>
              <span className="relative mt-1 text-xs leading-snug text-cream/70">{g.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      {(choice === '501' || choice === '301') && (
        <section>
          <SectionTitle>Options</SectionTitle>
          <Toggle label="Double out" on={doubleOut} onChange={setDoubleOut} />
        </section>
      )}

      {choice === 'killer' && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Options</SectionTitle>
          <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 min-h-14 ring-1 ring-white/10">
            <span>Lives</span>
            <div className="flex items-center gap-2">
              <Button className="w-12" onClick={() => setLives(Math.max(1, lives - 1))} aria-label="Fewer lives">
                −
              </Button>
              <span className="w-8 text-center text-xl font-bold tabular-nums">{lives}</span>
              <Button className="w-12" onClick={() => setLives(Math.min(9, lives + 1))} aria-label="More lives">
                +
              </Button>
            </div>
          </div>
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-cream/65">Killer numbers</span>
              <Button
                className="min-h-10 text-sm"
                onClick={() =>
                  setKillerNums(
                    assignKillerNumbers(
                      sides.map((s) => s.id),
                      {},
                    ),
                  )
                }
              >
                Randomise
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              {sides.map((s) => (
                <label key={s.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{s.name}</span>
                  <select
                    value={killerNums[s.id] ?? ''}
                    onChange={(e) => setKillerNums({ ...killerNums, [s.id]: Number(e.target.value) })}
                    className="min-h-11 rounded-xl bg-[#211e1a] px-3 text-lg font-bold ring-1 ring-white/10"
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {killerDupes && <p className="mt-3 text-sm text-rose-300">Each side needs a different number.</p>}
          </Card>
        </section>
      )}

      {choice === 'oneToSeven' && (
        <section>
          <SectionTitle>Rules</SectionTitle>
          <Card className="p-4">
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm leading-snug text-cream/75">
              {ONE_TO_SEVEN_RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <SectionTitle>Players ({players.length})</SectionTitle>
          <button type="button" onClick={shuffle} className="pb-2 text-xs text-gold">
            Shuffle order
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {players.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 rounded-2xl bg-panel/90 p-2 ring-1 ring-white/10">
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label="Move up"
                  className="h-6 w-8 text-cream/45 disabled:opacity-20"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  className="h-6 w-8 text-cream/45 disabled:opacity-20"
                  disabled={i === selected.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ▼
                </button>
              </div>
              <Avatar name={p.name} color={friendOf(p.id)?.color} />
              <div className="flex min-w-0 flex-1 flex-col px-1">
                <span className="truncate text-lg leading-tight">{p.name}</span>
                <span className="text-[11px]">
                  <HandicapTag
                    h={hcp(p.id)}
                    last={handicaps.get(p.id)?.last}
                    provisional={handicaps.get(p.id)?.provisional ?? true}
                  />
                </span>
              </div>
              {teamsOn && (
                <div className="flex gap-1">
                  {TEAM_NAMES.slice(0, teamCount).map((t, ti) => {
                    const active = (teamOf[p.id] ?? i % teamCount) === ti
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-label={`Put in ${t}`}
                        onClick={() => setTeamOf({ ...teamOf, [p.id]: ti })}
                        className={cx(
                          'h-10 w-10 rounded-xl text-sm font-bold',
                          active ? `${TEAM_COLORS[ti]} text-black` : 'bg-white/5 text-cream/45',
                        )}
                      >
                        {t.slice(-1)}
                      </button>
                    )
                  })}
                </div>
              )}
              <button
                type="button"
                aria-label={`Take ${p.name} out of this game`}
                onClick={() => toggle(p.id)}
                className="h-11 w-11 rounded-xl text-xl text-cream/45 hover:bg-dred/15 hover:text-rose-300"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        {players.length === 0 && (
          <p className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-cream/60 ring-1 ring-white/10">
            {friends.length
              ? 'Tap friends below to add them to this game.'
              : 'Add your first player below — they are saved on this device.'}
          </p>
        )}
        {bench.length > 0 && (
          <div>
            <p className="px-1 pb-1.5 text-xs text-cream/45">Quick add</p>
            <div className="flex flex-wrap gap-2" aria-label="Quick add from your players">
              {bench.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggle(f.id)}
                  className="press anim-pop inline-flex min-h-11 items-center gap-2 rounded-full bg-white/5 py-1 pl-1 pr-3 ring-1 ring-white/15 hover:bg-white/10"
                >
                  <Avatar name={f.name} color={f.color} size="sm" />
                  <span className="font-semibold">{f.name}</span>
                  <span className="text-[11px] tabular-nums text-cream/45">{hcp(f.id).toFixed(1)}</span>
                  <span className="text-gold">+</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addNew()
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New player…"
            maxLength={40}
            aria-label="New player name"
            className="min-h-14 min-w-0 flex-1 rounded-2xl bg-white/5 px-4 text-lg outline-none ring-1 ring-white/10 placeholder:text-cream/45 focus:ring-gold"
          />
          <Button type="submit" variant="soft" className="min-h-14 w-20" disabled={!name.trim()}>
            Add
          </Button>
        </form>
        <Toggle label="Play in teams" on={teamsOn} onChange={setTeamsOn} />
        {teamsOn && (
          <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 min-h-14 ring-1 ring-white/10">
            <span>Number of teams</span>
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTeamCount(n)}
                  className={cx(
                    'h-10 w-10 rounded-xl font-bold',
                    teamCount === n ? 'bg-metal text-black' : 'bg-white/5',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
        {teamsOn && (
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-xs text-cream/45">
              Tap A/B/C/D on a player to move them. Teams share one score; members take turns in the order listed.
            </p>
            <Button className="min-h-10 shrink-0 text-sm" onClick={autoSplit} disabled={players.length < 2}>
              Auto-split
            </Button>
          </div>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-board via-board/95 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
        <div className="mx-auto max-w-xl">
          <Button variant="primary" className="min-h-16 w-full text-lg" disabled={!canStart} onClick={start}>
            {canStart
              ? `Start ${GAME_CHOICES.find((g) => g.id === choice)!.title}`
              : choice === 'killer'
                ? killerDupes
                  ? 'Fix killer numbers'
                  : 'Killer needs 2+ sides'
                : 'Add a player'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function Logo({ className = 'h-11 w-11' }: { className?: string }) {
  return (
    <span className={cx('inline-block', className)}>
      <Dartboard art numbers={false} />
    </span>
  )
}
