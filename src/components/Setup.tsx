import { useEffect, useMemo, useState } from 'react'
import { Button, Card, SectionTitle, Toggle, cx } from './ui'
import Dartboard from './Dartboard'
import type { Dart } from '../game/types'
import { GAME_CHOICES, assignKillerNumbers, type GameChoice } from '../game/meta'
import { DEFAULT_OPTIONS, type GameConfig, type Player, type Side } from '../game/types'
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
  initial?: GameConfig | null
  onStart: (cfg: GameConfig) => void
  onResume?: () => void
}

export default function Setup({ initial, onStart, onResume }: Props) {
  const roster = useMemo(() => loadRoster(), [])
  const [choice, setChoice] = useState<GameChoice>(() => {
    if (!initial) return '501'
    if (initial.type === 'x01') return initial.options.startScore === 301 ? '301' : '501'
    return initial.type
  })
  const [doubleOut, setDoubleOut] = useState(initial?.options.doubleOut ?? true)
  const [lives, setLives] = useState(initial?.options.lives ?? 3)
  const [players, setPlayers] = useState<Player[]>(
    roster?.players?.length
      ? roster.players
      : [
          { id: uid(), name: 'Player 1' },
          { id: uid(), name: 'Player 2' },
        ],
  )
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
    setKillerNums((cur) => assignKillerNumbers(sides.map((s) => s.id), cur))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sideKey])

  const addPlayer = () => {
    const n = name.trim() || `Player ${players.length + 1}`
    setPlayers([...players, { id: uid(), name: n }])
    setName('')
  }
  const removePlayer = (id: string) => setPlayers(players.filter((p) => p.id !== id))
  const renamePlayer = (id: string, n: string) => setPlayers(players.map((p) => (p.id === id ? { ...p, name: n } : p)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= players.length) return
    const next = [...players]
    ;[next[i], next[j]] = [next[j], next[i]]
    setPlayers(next)
  }
  const shuffle = () => setPlayers([...players].sort(() => Math.random() - 0.5))

  const minSides = choice === 'killer' ? 2 : 1
  const killerDupes =
    choice === 'killer' && new Set(sides.map((s) => killerNums[s.id])).size !== sides.length
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
      <header className="flex items-center gap-3">
        <Logo className="h-14 w-14 drop-shadow-[0_6px_18px_rgb(212_166_64/0.35)]" />
        <div>
          <h1 className="text-metal text-3xl font-black tracking-tight">Social Dart</h1>
          <p className="text-sm text-cream/60">No sign-ups. Pick a game, add players, throw.</p>
        </div>
      </header>

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
                <Dartboard art numbers={false} emphasize={ART[g.id]} className={choice === g.id ? 'anim-spin-slow' : ''} />
              </span>
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-panel via-panel/75 to-transparent" />
              {g.casual && (
                <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cream/70 ring-1 ring-cream/15">
                  casual
                </span>
              )}
              <span className="relative flex w-full items-center gap-2">
                <span className={cx(g.title.length > 8 ? 'text-xl' : 'text-2xl', 'font-black leading-tight tracking-tight', choice === g.id ? 'text-metal' : 'text-cream')}>
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
                onClick={() => setKillerNums(assignKillerNumbers(sides.map((s) => s.id), {}))}
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
                  disabled={i === players.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ▼
                </button>
              </div>
              <input
                value={p.name}
                onChange={(e) => renamePlayer(p.id, e.target.value)}
                className="min-h-11 min-w-0 flex-1 rounded-xl bg-transparent px-2 text-lg outline-none focus:bg-white/5"
                aria-label="Player name"
              />
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
                aria-label={`Remove ${p.name}`}
                onClick={() => removePlayer(p.id)}
                className="h-11 w-11 rounded-xl text-xl text-cream/45 hover:bg-dred/15 hover:text-rose-300"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addPlayer()
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add player…"
            className="min-h-14 min-w-0 flex-1 rounded-2xl bg-white/5 px-4 text-lg outline-none ring-1 ring-white/10 placeholder:text-cream/45 focus:ring-gold"
          />
          <Button type="submit" variant="soft" className="min-h-14 w-20">
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
          <p className="px-1 text-xs text-cream/45">
            Teams share one score; team members take turns in the order listed.
          </p>
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
