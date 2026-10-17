import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { applyAction, replay, undo } from '../game/engine'
import { suggestCheckout, isCheckoutPossible } from '../game/checkout'
import { CRICKET_TARGETS, ONE_TO_SEVEN_ROUNDS, x01Average } from '../game/engines'
import { gameTitle, playerName, sideLabel } from '../game/meta'
import { dartLabel, type Action, type Dart, type GameConfig } from '../game/types'
import DartPad from './DartPad'
import Dartboard from './Dartboard'
import { haptic } from '../platform/haptics'
import { Logo } from './Setup'
import Keypad from './Keypad'
import Scoreboard, { TurnDarts } from './Scoreboard'
import { Button, cx } from './ui'

interface Props {
  cfg: GameConfig
  actions: Action[]
  setActions: (a: Action[]) => void
  onQuit: () => void
  onRematch: () => void
  onNewGame: () => void
}

export default function Game({ cfg, actions, setActions, onQuit, onRematch, onNewGame }: Props) {
  const view = useMemo(() => replay(cfg, actions), [cfg, actions])
  const [mode, setModeState] = useState<InputMode>(() => loadMode())
  const setMode = (m: InputMode) => {
    setModeState(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      /* ignore */
    }
  }
  const [showHistory, setShowHistory] = useState(false)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const s = view.state
  const dispatch = (a: Action) => {
    const next = applyAction(cfg, actions, a)
    if (next === actions) return haptic('error')
    setActions(next)
    const nv = replay(cfg, next)
    const last = nv.turns[nv.turns.length - 1]
    if (nv.finished) haptic('success')
    else if (last?.bust) haptic('error')
    else if (a.t === 'dart' && a.dart.mult > 1) haptic('medium')
    else haptic('light')
  }
  const onDart = (d: Dart) => dispatch({ t: 'dart', dart: d })

  const side = cfg.sides[view.side]
  const thrower = playerName(cfg, view.playerId)
  const isTeam = side.playerIds.length > 1
  const dartsLeft = 3 - view.openDarts.length
  const modes: InputMode[] = s.kind === 'x01' ? ['total', 'board', 'grid'] : ['board', 'grid']
  let effectiveMode: InputMode = modes.includes(mode) ? mode : 'board'
  if (effectiveMode === 'total' && view.turnOpen) effectiveMode = 'board'
  const lastTurn = view.turns[view.turns.length - 1]
  const bustFlash = lastTurn?.bust && lastTurn.complete && !view.turnOpen


  let hint: string | null = null
  let highlight: ((n: number) => boolean) | undefined
  if (s.kind === 'x01') {
    const rem = s.remaining[view.side]
    const route = suggestCheckout(rem, dartsLeft, cfg.options.doubleOut)
    hint = route ? `Checkout: ${route.map(dartLabel).join(' · ')}` : null
  } else if (s.kind === 'oneToSeven') {
    const round = Math.min(s.rounds[view.side] + 1, ONE_TO_SEVEN_ROUNDS)
    hint = `Round ${round} of ${ONE_TO_SEVEN_ROUNDS} — aim for ${round}`
    highlight = (n) => n === round
  } else if (s.kind === 'atc') {
    const t = s.target[view.side]
    hint = `Aim for ${t === 25 ? 'the bull' : t}`
    highlight = (n) => n === t
  } else if (s.kind === 'cricket') {
    highlight = (n) => CRICKET_TARGETS.includes(n)
  } else if (s.kind === 'killer') {
    const me = view.side
    hint = s.killer[me]
      ? 'You are a Killer — hit opponents’ doubles'
      : `Hit double ${s.numbers[me]} to become a Killer`
    const live = s.numbers.filter((_, i) => s.lives[i] > 0)
    highlight = (n) => (s.killer[me] ? live.includes(n) : n === s.numbers[me])
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-xl flex-col gap-3 overflow-y-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <header className="flex items-center gap-2">
        <Button variant="ghost" className="w-12 px-0" aria-label="Quit game" onClick={() => setConfirmQuit(true)}>
          ✕
        </Button>
        <h1 className="flex-1 truncate text-center text-base font-semibold text-cream/65">{gameTitle(cfg)}</h1>
        <Button variant="ghost" className="w-12 px-0" aria-label="Turn history" onClick={() => setShowHistory(true)}>
          ☰
        </Button>
      </header>

      <div className={cx(bustFlash && 'anim-shake')} key={bustFlash ? `bust${view.turns.length}` : 'sb'}>
        <Scoreboard cfg={cfg} view={view} />
      </div>
      {bustFlash && (
        <div key={`bm${view.turns.length}`} className="anim-pop pointer-events-none -my-1 text-center text-sm font-black uppercase tracking-[0.3em] text-dred">
          Bust!
        </div>
      )}

      <div
        key={`${view.side}-${view.turns.filter((t) => t.complete).length}`}
        className="anim-rise flex items-center justify-between gap-3 rounded-3xl bg-panel/90 px-4 py-3 ring-1 ring-white/10"
      >
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">
            {thrower}
            {isTeam && <span className="ml-2 text-sm font-normal text-cream/45">{side.name}</span>}
          </div>
          <div className={cx('text-sm leading-snug', hint?.startsWith('Checkout') ? 'text-rose-300' : 'text-cream/65')}>
            {hint ?? `${dartsLeft} dart${dartsLeft === 1 ? '' : 's'} left`}
          </div>
        </div>
        <TurnDarts darts={view.openDarts} />
      </div>

      <div className="mt-auto flex flex-1 flex-col justify-end gap-2">
        <div className={cx('grid gap-1 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10', modes.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              disabled={view.turnOpen && m === 'total'}
              onClick={() => setMode(m)}
              className={cx(
                'min-h-10 rounded-xl text-sm font-semibold transition disabled:opacity-30',
                effectiveMode === m ? 'bg-cream text-black' : 'text-cream/60',
              )}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        {s.kind === 'x01' && effectiveMode === 'total' ? (
          <Keypad
            onSubmit={(n) => dispatch({ t: 'total', n })}
            remaining={s.remaining[view.side]}
            canCheckout={isCheckoutPossible(s.remaining[view.side], cfg.options.doubleOut)}
            disabled={view.finished}
          />
        ) : effectiveMode === 'board' ? (
          <FitSquare>
            <Dartboard onDart={onDart} highlight={highlight} disabled={view.finished} />
          </FitSquare>
        ) : (
          <DartPad onDart={onDart} highlight={highlight} disabled={view.finished} />
        )}

        <div className={cx('grid gap-2', effectiveMode === 'board' ? 'grid-cols-3' : 'grid-cols-2')}>
          <Button className="min-h-14" disabled={actions.length === 0} onClick={() => setActions(undo(actions))}>
            ↶ Undo
          </Button>
          {effectiveMode === 'board' && (
            <Button className="min-h-14" onClick={() => onDart({ segment: 0, mult: 1 })} disabled={view.finished}>
              Miss
            </Button>
          )}
          <Button
            className="min-h-14"
            variant="soft"
            disabled={view.finished || (effectiveMode === 'total' && !view.turnOpen)}
            onClick={() => dispatch({ t: 'end' })}
          >
            {view.turnOpen ? 'End turn' : 'Skip turn'}
          </Button>
        </div>
      </div>

      {showHistory && <History cfg={cfg} view={view} onClose={() => setShowHistory(false)} />}

      {confirmQuit && (
        <Modal onClose={() => setConfirmQuit(false)}>
          <h2 className="text-xl font-bold">Leave this game?</h2>
          <p className="mt-1 text-sm text-cream/65">The game stays saved — you can resume it from the start screen.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button onClick={() => setConfirmQuit(false)}>Keep playing</Button>
            <Button variant="danger" onClick={onQuit}>
              Leave
            </Button>
          </div>
        </Modal>
      )}

      {view.finished && (
        <Modal>
          <div className="text-center">
            <Confetti />
            <div className="mx-auto w-24 anim-pop">
              <Logo className="h-24 w-24 anim-spin-slow" />
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-gold">
              {view.winners.length > 1 ? 'Draw' : 'Winner'}
            </p>
            <h2 className="mt-1 text-3xl font-black">
              {view.winners.map((w) => sideLabel(cfg, cfg.sides[w])).join(' & ') || 'No winner'}
            </h2>
            <WinnerStats cfg={cfg} view={view} />
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <Button variant="primary" className="min-h-14 text-lg" onClick={onRematch}>
              Rematch
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setActions(undo(actions))}>↶ Undo last</Button>
              <Button onClick={onNewGame}>New game</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** Fills the remaining vertical space with the largest square that fits (min 240px). */
function FitSquare({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize(Math.max(240, Math.floor(Math.min(el.clientWidth, el.clientHeight))))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="relative min-h-[240px] flex-1">
      {size > 0 && (
        <div style={{ width: size, height: size }} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {children}
        </div>
      )}
    </div>
  )
}

type InputMode = 'total' | 'board' | 'grid'
const MODE_KEY = 'social-dart:input:v1'
const MODE_LABEL: Record<InputMode, string> = { total: 'Turn total', board: 'Board', grid: 'Pad' }
function loadMode(): InputMode {
  try {
    const m = localStorage.getItem(MODE_KEY)
    if (m === 'total' || m === 'board' || m === 'grid') return m
  } catch {
    /* ignore */
  }
  return 'board'
}

const CONFETTI_COLORS = ['#d42a2f', '#1d8a4a', '#efe2bf', '#d4a640', '#141312']
function Confetti() {
  const [bits] = useState(() =>
    Array.from({ length: 70 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.8 + Math.random() * 1.6,
      dx: `${(Math.random() - 0.5) * 160}px`,
      rot: `${Math.random() * 900 - 450}deg`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    })),
  )
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti"
          style={
            {
              left: `${b.left}%`,
              background: b.color,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.dur}s`,
              '--dx': b.dx,
              '--rot': b.rot,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

function WinnerStats({ cfg, view }: { cfg: GameConfig; view: ReturnType<typeof replay> }) {
  const s = view.state
  const rows = cfg.sides.map((sd, i) => {
    let stat = ''
    if (s.kind === 'x01') stat = `avg ${x01Average(s, i).toFixed(1)} · ${s.remaining[i]} left`
    if (s.kind === 'oneToSeven') stat = `${s.scores[i]} pts`
    if (s.kind === 'cricket') stat = `${s.points[i]} pts`
    if (s.kind === 'killer') stat = s.lives[i] > 0 ? `${s.lives[i]} ♥ left` : 'out'
    if (s.kind === 'atc') stat = s.target[i] === 0 ? 'finished' : `on ${s.target[i] === 25 ? 'bull' : s.target[i]}`
    return { name: sideLabel(cfg, sd), stat, win: view.winners.includes(i) }
  })
  const turns = view.turns.filter((t) => t.complete).length
  return (
    <div className="mt-4 flex flex-col gap-1 text-left">
      {rows.map((r) => (
        <div key={r.name} className="flex justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
          <span className={r.win ? 'font-bold text-gold' : ''}>{r.name}</span>
          <span className="text-cream/65">{r.stat}</span>
        </div>
      ))}
      <p className="mt-1 text-center text-xs text-cream/45">{turns} turns played</p>
    </div>
  )
}

function History({ cfg, view, onClose }: { cfg: GameConfig; view: ReturnType<typeof replay>; onClose: () => void }) {
  const turns = [...view.turns].reverse()
  return (
    <Modal onClose={onClose} tall>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold">Turn history</h2>
        <Button variant="ghost" className="w-12 px-0" onClick={onClose} aria-label="Close history">
          ✕
        </Button>
      </div>
      {turns.length === 0 && <p className="text-sm text-cream/45">No darts thrown yet.</p>}
      <ol className="flex flex-col gap-2 overflow-y-auto">
        {turns.map((t, k) => (
          <li key={k} className="rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold">
                {playerName(cfg, t.playerId)}
                {cfg.sides[t.side].playerIds.length > 1 && (
                  <span className="ml-1 text-xs font-normal text-cream/45">{cfg.sides[t.side].name}</span>
                )}
              </span>
              <span
                className={cx(
                  'shrink-0 text-sm font-bold tabular-nums',
                  t.bust ? 'text-rose-400' : t.win ? 'text-gold' : 'text-cream',
                )}
              >
                {t.bust ? 'BUST' : cfg.type === 'killer' || cfg.type === 'atc' ? '' : t.points}
                {t.win && ' 🏆'}
                {!t.complete && <span className="ml-1 text-xs font-normal text-cream/45">in progress</span>}
              </span>
            </div>
            <div className="text-xs text-cream/65">
              {t.total !== undefined ? `Turn total ${t.total}` : t.darts.map(dartLabel).join(' · ') || 'No darts'}
              {t.note && <span className="ml-2 text-amber-300">{t.note}</span>}
            </div>
          </li>
        ))}
      </ol>
    </Modal>
  )
}

function Modal({ children, onClose, tall }: { children: ReactNode; onClose?: () => void; tall?: boolean }) {
  return (
    <div
      className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className={cx(
          'anim-sheet flex w-full max-w-md flex-col rounded-3xl bg-panel p-5 ring-1 ring-gold/30 shadow-2xl',
          tall && 'max-h-[85dvh]',
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  )
}
