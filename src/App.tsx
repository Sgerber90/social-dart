import { useEffect, useMemo, useState } from 'react'
import Game from './components/Game'
import Setup, { Logo } from './components/Setup'
import Players from './components/Players'
import Stats from './components/Stats'
import { NavTabs } from './components/ui'
import { rematchConfig, replay } from './game/engine'
import { buildRecord, computeHandicaps } from './game/history'
import type { Action, Friend, GameConfig } from './game/types'
import {
  loadFriends,
  loadGame,
  loadHistory,
  removeRecord,
  saveFriends,
  saveGame,
  saveHistory,
  uid,
  upsertRecord,
} from './storage'

type Screen = 'setup' | 'game' | 'players' | 'stats'
const TABS: { id: Exclude<Screen, 'game'>; label: string }[] = [
  { id: 'setup', label: 'Play' },
  { id: 'players', label: 'Players' },
  { id: 'stats', label: 'Stats' },
]

export default function App() {
  const [saved] = useState(() => loadGame())
  const [gameId, setGameId] = useState(saved?.id ?? uid())
  const [config, setConfig] = useState<GameConfig | null>(saved?.config ?? null)
  const [actions, setActions] = useState<Action[]>(saved?.actions ?? [])
  const [screen, setScreen] = useState<Screen>(saved ? 'game' : 'setup')
  const [friends, setFriends] = useState<Friend[]>(() => loadFriends())
  const [history, setHistory] = useState(() => loadHistory())

  useEffect(() => {
    saveGame(config ? { id: gameId, config, actions } : null)
  }, [gameId, config, actions])
  useEffect(() => saveFriends(friends), [friends])
  useEffect(() => saveHistory(history), [history])

  // Keep the history in sync with the current game: a finished game is recorded,
  // and undoing back out of the finish removes the record again.
  useEffect(() => {
    if (!config) return
    let view
    try {
      view = replay(config, actions)
    } catch {
      return
    }
    setHistory((h) => {
      const prev = h.find((r) => r.id === gameId)
      const rec = buildRecord(gameId, config, view, prev?.endedAt ?? Date.now())
      if (!rec) return removeRecord(h, gameId)
      if (prev && JSON.stringify(prev) === JSON.stringify(rec)) return h
      return upsertRecord(h, rec)
    })
  }, [gameId, config, actions])

  const handicaps = useMemo(() => computeHandicaps(history), [history])

  const startGame = (c: GameConfig) => {
    setGameId(uid())
    setConfig(c)
    setActions([])
    setScreen('game')
  }

  if (screen === 'game' && config)
    return (
      <Game
        cfg={config}
        actions={actions}
        setActions={setActions}
        onQuit={() => setScreen('setup')}
        onRematch={() => startGame(rematchConfig(config))}
        onNewGame={() => {
          setConfig(null)
          setActions([])
          setScreen('setup')
        }}
      />
    )

  const nav = <NavTabs tabs={TABS} value={screen === 'game' ? 'setup' : screen} onChange={setScreen} />
  const header = (
    <header className="flex items-center gap-3">
      <Logo className="h-14 w-14 drop-shadow-[0_6px_18px_rgb(212_166_64/0.35)]" />
      <div>
        <h1 className="text-metal text-3xl font-black tracking-tight">Social Dart</h1>
        <p className="text-sm text-cream/60">No sign-ups. Pick a game, add players, throw.</p>
      </div>
    </header>
  )

  if (screen === 'players')
    return (
      <Players
        header={header}
        nav={nav}
        friends={friends}
        setFriends={setFriends}
        handicaps={handicaps}
        history={history}
      />
    )
  if (screen === 'stats')
    return <Stats header={header} nav={nav} friends={friends} history={history} handicaps={handicaps} />

  return (
    <Setup
      header={header}
      nav={nav}
      friends={friends}
      setFriends={setFriends}
      handicaps={handicaps}
      initial={config}
      onResume={config ? () => setScreen('game') : undefined}
      onStart={startGame}
    />
  )
}
