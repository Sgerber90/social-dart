import { useEffect, useMemo, useState } from 'react'
import Game from './components/Game'
import Setup, { Logo } from './components/Setup'
import Players from './components/Players'
import Stats from './components/Stats'
import Account from './components/Account'
import Groups from './components/Groups'
import { cloudEnabled } from './cloud/config'
import { useCloud } from './cloud/useCloud'
import type { Profile } from './cloud/api'
import { FRIEND_COLORS } from './game/types'
import { NavTabs, cx } from './components/ui'
import { rematchConfig, replay } from './game/engine'
import { buildRecord, computeHandicaps, computeStats } from './game/history'
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

type Screen = 'setup' | 'game' | 'players' | 'stats' | 'groups' | 'account'
const TABS: { id: Exclude<Screen, 'game' | 'account'>; label: string }[] = [
  { id: 'setup', label: 'Play' },
  { id: 'players', label: 'Players' },
  { id: 'stats', label: 'Stats' },
  ...(cloudEnabled ? [{ id: 'groups' as const, label: 'Groups' }] : []),
]
const syncedKey = (uid: string) => `social-dart:synced:${uid}`

export default function App() {
  const [saved] = useState(() => loadGame())
  const [gameId, setGameId] = useState(saved?.id ?? uid())
  const [config, setConfig] = useState<GameConfig | null>(saved?.config ?? null)
  const [actions, setActions] = useState<Action[]>(saved?.actions ?? [])
  const [screen, setScreen] = useState<Screen>(() => {
    if (saved) return 'game'
    const h = window.location.hash.slice(1)
    return TABS.some((t) => t.id === h) ? (h as Screen) : 'setup'
  })
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

  // ---- optional account: profile + sync of the linked player's games
  const cloud = useCloud()
  const { api, account } = cloud
  const [profile, setProfile] = useState<Profile | null>(null)
  const [syncStatus, setSyncStatus] = useState('')
  useEffect(() => {
    setProfile(null)
    if (!api || !account) return
    api
      .getProfile(account.uid)
      .then((p) => setProfile(p ?? { displayName: account.displayName }))
      .catch(() => setProfile({ displayName: account.displayName }))
  }, [api, account?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const pid = profile?.playerId
  useEffect(() => {
    if (!api || !account || !pid) return
    const t = setTimeout(async () => {
      try {
        setSyncStatus('Syncing…')
        let synced: Set<string>
        try {
          synced = new Set(JSON.parse(localStorage.getItem(syncedKey(account.uid)) ?? '[]'))
        } catch {
          synced = new Set()
        }
        const mine = history.filter((r) => r.players.some((p) => p.id === pid))
        const remote = await api.syncGames(mine, synced)
        const ids = new Set([...remote.map((r) => r.id), ...mine.map((r) => r.id)])
        localStorage.setItem(syncedKey(account.uid), JSON.stringify([...ids]))
        const missing = remote.filter((r) => !history.some((h) => h.id === r.id))
        let merged = history
        if (missing.length) {
          merged = missing.reduce(upsertRecord, history)
          setHistory(merged)
        }
        const h = computeHandicaps(merged).get(pid)
        const st = computeStats(merged).get(pid)
        await api.saveProfile({
          displayName: account.displayName || profile?.displayName || 'Player',
          playerId: pid,
          handicap: h?.handicap ?? 18,
          handicapLast: h?.last ?? 0,
          provisional: h?.provisional ?? true,
          games: st?.games ?? 0,
          wins: st?.wins ?? 0,
        })
        setSyncStatus(
          `Synced ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${st?.games ?? 0} games`,
        )
      } catch (e) {
        setSyncStatus(`Not synced: ${api.errorText(e)}`)
      }
    }, 800)
    return () => clearTimeout(t)
  }, [api, account, pid, history])

  const linkPlayer = async (id: string | null) => {
    if (!api || !account) return
    let playerId = id ?? undefined
    if (id === '__new') {
      const f = { id: uid(), name: account.displayName, color: FRIEND_COLORS[friends.length % FRIEND_COLORS.length] }
      setFriends([...friends, f])
      playerId = f.id
    }
    const next: Profile = { ...(profile ?? { displayName: account.displayName }), playerId }
    if (!playerId) {
      delete next.playerId
      delete next.handicap
    }
    await api.saveProfile(next)
    setProfile(next)
  }
  // a linked player missing on this device (e.g. a new phone) is re-created from the profile
  useEffect(() => {
    if (pid && account && !friends.some((f) => f.id === pid))
      setFriends((fs) => [
        ...fs,
        { id: pid, name: account.displayName, color: FRIEND_COLORS[fs.length % FRIEND_COLORS.length] },
      ])
  }, [pid, account, friends])

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

  const nav = (
    <NavTabs
      tabs={TABS}
      value={screen === 'game' || screen === 'account' ? ('' as never) : screen}
      onChange={setScreen}
    />
  )
  const header = (
    <header className="flex items-center gap-3">
      <Logo className="h-14 w-14 shrink-0 drop-shadow-[0_6px_18px_rgb(212_166_64/0.35)]" />
      <div className="min-w-0 flex-1">
        <h1 className="text-metal text-3xl font-black tracking-tight">Social Dart</h1>
        <p className="text-sm text-cream/60">
          {cloudEnabled ? 'Play as a guest, or sign in to sync.' : 'No sign-ups. Pick a game, add players, throw.'}
        </p>
      </div>
      {cloudEnabled && (
        <button
          type="button"
          onClick={() => setScreen('account')}
          aria-label={account ? 'Your account' : 'Sign in'}
          className={cx(
            'press shrink-0 rounded-full text-sm font-bold ring-1',
            account
              ? 'flex h-11 w-11 items-center justify-center bg-metal text-black ring-gold'
              : 'min-h-11 px-3 text-gold ring-gold/50',
            screen === 'account' && 'ring-2 ring-cream',
          )}
        >
          {account ? (account.displayName.trim()[0] ?? '?').toUpperCase() : 'Sign in'}
        </button>
      )}
    </header>
  )
  if (screen === 'account')
    return (
      <Account
        header={header}
        nav={nav}
        api={api}
        account={account}
        setAccount={cloud.setAccount}
        profile={profile}
        friends={friends}
        history={history}
        handicaps={handicaps}
        onLink={linkPlayer}
        syncStatus={syncStatus}
      />
    )
  if (screen === 'groups')
    return <Groups header={header} nav={nav} api={api} account={account} onSignIn={() => setScreen('account')} />

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
