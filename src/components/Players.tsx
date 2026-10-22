import { useState, type ReactNode } from 'react'
import { HANDICAP, computeStats, type GameRecord, type HandicapInfo } from '../game/history'
import { FRIEND_COLORS, type Friend } from '../game/types'
import { uid } from '../storage'
import { Avatar, Button, HandicapTag, SectionTitle, cx } from './ui'

interface Props {
  header: ReactNode
  nav: ReactNode
  friends: Friend[]
  setFriends: (f: Friend[]) => void
  handicaps: Map<string, HandicapInfo>
  history: GameRecord[]
}

export default function Players({ header, nav, friends, setFriends, handicaps, history }: Props) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const stats = computeStats(history)

  const add = () => {
    const n = name.trim().slice(0, 40)
    if (!n) return
    setFriends([...friends, { id: uid(), name: n, color: FRIEND_COLORS[friends.length % FRIEND_COLORS.length] }])
    setName('')
  }
  const update = (id: string, patch: Partial<Friend>) =>
    setFriends(friends.map((f) => (f.id === id ? { ...f, ...patch } : f)))

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col md:max-w-4xl md:px-8 gap-5 px-4 pb-16 pt-6">
      {header}
      {nav}
      <section className="flex flex-col gap-3">
        <SectionTitle>Your players ({friends.length})</SectionTitle>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a friend…"
            maxLength={40}
            aria-label="New player name"
            className="min-h-14 min-w-0 flex-1 rounded-2xl bg-white/5 px-4 text-lg outline-none ring-1 ring-white/10 placeholder:text-cream/45 focus:ring-gold"
          />
          <Button type="submit" variant="soft" className="min-h-14 w-20" disabled={!name.trim()}>
            Add
          </Button>
        </form>
        {friends.length === 0 && (
          <p className="text-sm text-cream/50">
            No players yet. Friends you add here show up as quick-add chips when you set up a game.
          </p>
        )}
        <ul className="flex flex-col gap-2 md:grid md:grid-cols-2 md:items-start">
          {friends.map((f) => {
            const h = handicaps.get(f.id)
            const st = stats.get(f.id)
            const open = editing === f.id
            return (
              <li key={f.id} className="rounded-2xl bg-panel/90 p-3 ring-1 ring-white/10">
                <div className="flex items-center gap-3">
                  <Avatar name={f.name} color={f.color} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-bold leading-tight">{f.name}</div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-cream/55">
                      <HandicapTag
                        h={h?.handicap ?? HANDICAP.start}
                        last={h?.last}
                        provisional={h?.provisional ?? true}
                      />
                      <span>
                        {st?.games ?? 0} games · {st?.wins ?? 0} wins
                      </span>
                    </div>
                  </div>
                  <Button
                    className="min-h-10 text-sm"
                    onClick={() => setEditing(open ? null : f.id)}
                    aria-expanded={open}
                  >
                    {open ? 'Done' : 'Edit'}
                  </Button>
                </div>
                {open && (
                  <div className="anim-rise mt-3 flex flex-col gap-3 border-t border-white/10 pt-3">
                    <input
                      value={f.name}
                      onChange={(e) => update(f.id, { name: e.target.value.slice(0, 40) })}
                      onBlur={(e) => !e.target.value.trim() && update(f.id, { name: 'Player' })}
                      aria-label="Player name"
                      className="min-h-12 rounded-xl bg-white/5 px-3 text-lg outline-none ring-1 ring-white/10 focus:ring-gold"
                    />
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
                      {FRIEND_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          role="radio"
                          aria-checked={f.color === c}
                          aria-label={`Colour ${c}`}
                          onClick={() => update(f.id, { color: c })}
                          className={cx(
                            'h-9 w-9 rounded-full ring-2',
                            f.color === c ? 'ring-cream' : 'ring-transparent',
                          )}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    {confirmDelete === f.id ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Button onClick={() => setConfirmDelete(null)}>Keep</Button>
                        <Button
                          variant="danger"
                          onClick={() => {
                            setFriends(friends.filter((x) => x.id !== f.id))
                            setConfirmDelete(null)
                            setEditing(null)
                          }}
                        >
                          Delete {f.name}
                        </Button>
                      </div>
                    ) : (
                      <Button variant="danger" onClick={() => setConfirmDelete(f.id)}>
                        Delete player
                      </Button>
                    )}
                    <p className="text-[11px] text-cream/40">
                      Deleting removes them from your list; past games stay in history.
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
