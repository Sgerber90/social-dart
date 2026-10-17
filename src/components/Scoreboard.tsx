import type { ReactNode } from 'react'
import type { GameView } from '../game/engine'
import { CRICKET_TARGETS, ONE_TO_SEVEN_ROUNDS, x01Average } from '../game/engines'
import { playerName, sideLabel } from '../game/meta'
import type { GameConfig, TurnRecord } from '../game/types'
import { dartLabel } from '../game/types'
import { cx } from './ui'

interface Props {
  cfg: GameConfig
  view: GameView
}

function lastTurn(view: GameView, side: number): TurnRecord | undefined {
  for (let i = view.turns.length - 1; i >= 0; i--) if (view.turns[i].side === side && view.turns[i].complete) return view.turns[i]
}

function SideShell({
  cfg,
  view,
  i,
  children,
  out,
}: Props & { i: number; children: ReactNode; out?: boolean }) {
  const side = cfg.sides[i]
  const active = view.side === i && !view.finished
  const team = side.playerIds.length > 1
  return (
    <div
      className={cx(
        'relative flex min-w-0 flex-col rounded-3xl p-3 ring-1 transition',
        active ? 'bg-[#1d1913] ring-metal ring-gold' : 'bg-panel/90 ring-white/10',
        out && 'opacity-40 grayscale',
      )}
    >
      <div className="flex items-center gap-2">
        {active && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-gold" />}
        <span className="truncate text-sm font-semibold text-cream">{sideLabel(cfg, side)}</span>
      </div>
      {team && (
        <span className="truncate text-[11px] text-cream/45">
          {side.playerIds.map((id) => playerName(cfg, id)).join(' · ')}
        </span>
      )}
      {children}
    </div>
  )
}

function gridCols(n: number) {
  return n <= 1 ? 'grid-cols-1' : n === 2 ? 'grid-cols-2' : n === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'
}

export default function Scoreboard({ cfg, view }: Props) {
  const s = view.state
  const n = cfg.sides.length

  if (s.kind === 'cricket') return <CricketBoard cfg={cfg} view={view} />

  return (
    <div className={cx('grid gap-2', gridCols(n))}>
      {cfg.sides.map((_, i) => {
        const lt = lastTurn(view, i)
        if (s.kind === 'x01')
          return (
            <SideShell key={i} cfg={cfg} view={view} i={i}>
              <span
                key={s.remaining[i]}
                className={cx('anim-pop font-black tabular-nums leading-none tracking-tight', n > 2 ? 'text-4xl' : 'text-6xl', 'mt-1')}
              >
                {s.remaining[i]}
              </span>
              <span className="mt-1 flex justify-between text-[11px] text-cream/45">
                <span>avg {x01Average(s, i).toFixed(1)}</span>
                {lt && <span className={lt.bust ? 'text-rose-400' : ''}>{lt.bust ? 'bust' : `last ${lt.points}`}</span>}
              </span>
            </SideShell>
          )
        if (s.kind === 'killer') {
          const out = s.lives[i] <= 0
          return (
            <SideShell key={i} cfg={cfg} view={view} i={i} out={out}>
              <div className="mt-1 flex items-end justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-2xl font-black tabular-nums text-cream ring-2 ring-dred/80">
                  {s.numbers[i]}
                </span>
                {s.killer[i] && !out && (
                  <span className="rounded-full bg-dred px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    Killer
                  </span>
                )}
              </div>
              <span className="mt-1 text-sm tracking-widest text-rose-400" aria-label={`${s.lives[i]} lives`}>
                {out ? <span className="text-cream/45">OUT</span> : '♥'.repeat(Math.max(0, s.lives[i]))}
              </span>
            </SideShell>
          )
        }
        if (s.kind === 'oneToSeven')
          return (
            <SideShell key={i} cfg={cfg} view={view} i={i}>
              <span key={s.scores[i]} className="anim-pop mt-1 text-5xl font-black tabular-nums">{s.scores[i]}</span>
              <span className="text-[11px] text-cream/45">
                {s.rounds[i] >= ONE_TO_SEVEN_ROUNDS ? 'done' : `round ${s.rounds[i] + 1} / ${ONE_TO_SEVEN_ROUNDS}`}
              </span>
            </SideShell>
          )
        // atc
        const t = s.target[i]
        const progress = t === 0 ? 21 : t === 25 ? 20 : t - 1
        return (
          <SideShell key={i} cfg={cfg} view={view} i={i}>
            <span className="text-[11px] text-cream/45">next</span>
            <span key={t} className="anim-pop text-5xl font-black tabular-nums">{t === 0 ? '✓' : t === 25 ? 'Bull' : t}</span>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gold" style={{ width: `${(progress / 21) * 100}%` }} />
            </div>
          </SideShell>
        )
      })}
    </div>
  )
}

function Marks({ m }: { m: number }) {
  if (m <= 0) return <span className="text-cream/25">·</span>
  if (m === 1) return <span className="text-cream">/</span>
  if (m === 2) return <span className="text-cream">✕</span>
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-dgreen text-sm font-black text-cream ring-2 ring-gold/60">
      ✕
    </span>
  )
}

function CricketBoard({ cfg, view }: Props) {
  const s = view.state
  if (s.kind !== 'cricket') return null
  const cols = `3.5rem repeat(${cfg.sides.length}, minmax(0, 1fr))`
  return (
    <div className="overflow-hidden rounded-3xl bg-panel/90 ring-1 ring-white/10">
      <div className="grid items-center border-b border-white/10" style={{ gridTemplateColumns: cols }}>
        <span />
        {cfg.sides.map((sd, i) => (
          <div
            key={sd.id}
            className={cx(
              'flex min-w-0 flex-col items-center px-1 py-2',
              view.side === i && !view.finished && 'bg-gold/10',
            )}
          >
            <span className="w-full truncate text-center text-xs font-semibold text-cream/65">{sideLabel(cfg, sd)}</span>
            <span key={s.points[i]} className="anim-pop text-2xl font-black tabular-nums">{s.points[i]}</span>
          </div>
        ))}
      </div>
      {CRICKET_TARGETS.map((t, ti) => {
        const closedByAll = s.marks.every((m) => m[ti] >= 3)
        return (
          <div
            key={t}
            className={cx('grid items-center border-b border-white/5 last:border-0', closedByAll && 'opacity-35')}
            style={{ gridTemplateColumns: cols }}
          >
            <span className="py-1 text-center text-base font-bold text-cream/65">{t === 25 ? 'B' : t}</span>
            {cfg.sides.map((sd, i) => (
              <span
                key={sd.id}
                className={cx(
                  'flex h-8 items-center justify-center text-lg font-bold',
                  view.side === i && !view.finished && 'bg-gold/10',
                )}
              >
                <span key={s.marks[i][ti]} className="anim-pop">
                  <Marks m={s.marks[i][ti]} />
                </span>
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export function TurnDarts({ darts }: { darts: TurnRecord['darts'] }) {
  return (
    <div className="flex gap-2">
      {[0, 1, 2].map((k) => (
        <span
          key={k}
          className={cx(
            'flex h-10 min-w-14 items-center justify-center rounded-xl px-2 text-sm font-bold tabular-nums ring-1',
            darts[k]
              ? darts[k].mult === 3
                ? 'bg-dgreen/30 text-[#7fe0a6] ring-dgreen/70'
                : darts[k].mult === 2
                  ? 'bg-dred/20 text-rose-200 ring-rose-400/40'
                  : 'bg-cream/10 text-cream ring-cream/20'
              : 'text-cream/25 ring-white/10 ring-dashed',
          )}
        >
          {darts[k] ? <span key={dartLabel(darts[k])} className="anim-pop">{dartLabel(darts[k])}</span> : k + 1}
        </span>
      ))}
    </div>
  )
}
