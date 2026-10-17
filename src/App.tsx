import { useEffect, useState } from 'react'
import Game from './components/Game'
import Setup from './components/Setup'
import { rematchConfig } from './game/engine'
import type { Action, GameConfig } from './game/types'
import { loadGame, saveGame } from './storage'

export default function App() {
  const [saved] = useState(() => loadGame())
  const [config, setConfig] = useState<GameConfig | null>(saved?.config ?? null)
  const [actions, setActions] = useState<Action[]>(saved?.actions ?? [])
  const [screen, setScreen] = useState<'setup' | 'game'>(saved ? 'game' : 'setup')

  useEffect(() => {
    saveGame(config ? { config, actions } : null)
  }, [config, actions])

  if (screen === 'game' && config)
    return (
      <Game
        cfg={config}
        actions={actions}
        setActions={setActions}
        onQuit={() => setScreen('setup')}
        onRematch={() => {
          setConfig(rematchConfig(config))
          setActions([])
        }}
        onNewGame={() => {
          setConfig(null)
          setActions([])
          setScreen('setup')
        }}
      />
    )

  return (
    <Setup
      initial={config}
      onResume={config ? () => setScreen('game') : undefined}
      onStart={(c) => {
        setConfig(c)
        setActions([])
        setScreen('game')
      }}
    />
  )
}
