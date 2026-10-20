import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Account, Group, GroupDetail, JoinMode } from '../cloud/api'
import type { CloudApi } from '../cloud/useCloud'
import { HANDICAP } from '../game/history'
import { Avatar, Button, Card, HandicapTag, SectionTitle, cx } from './ui'

interface Props {
  header: ReactNode
  nav: ReactNode
  api: CloudApi | null
  account: Account | null
  onSignIn: () => void
}

const input =
  'min-h-12 w-full rounded-xl bg-white/5 px-3 text-lg outline-none ring-1 ring-white/10 placeholder:text-cream/40 focus:ring-gold'

export default function Groups({ header, nav, api, account, onSignIn }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 pb-16 pt-6">
      {header}
      {nav}
      {!api ? (
        <Card className="p-4 text-sm text-cream/60">Loading…</Card>
      ) : open ? (
        <GroupPage api={api} account={account} gid={open} onBack={() => setOpen(null)} onSignIn={onSignIn} />
      ) : (
        <GroupList api={api} account={account} onOpen={setOpen} onSignIn={onSignIn} />
      )}
    </div>
  )
}

function ModeBadge({ mode }: { mode: JoinMode }) {
  return (
    <span
      className={cx(
        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1',
        mode === 'public' ? 'text-[#7fe0a6] ring-dgreen/60' : 'text-amber-300 ring-amber-400/40',
      )}
    >
      {mode === 'public' ? 'Public' : 'Private'}
    </span>
  )
}

function GroupList({
  api,
  account,
  onOpen,
  onSignIn,
}: {
  api: CloudApi
  account: Account | null
  onOpen: (id: string) => void
  onSignIn: () => void
}) {
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [mode, setMode] = useState<JoinMode>('public')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    api
      .listGroups()
      .then(setGroups)
      .catch((e) => setErr(api.errorText(e)))
  }, [api])
  useEffect(load, [load])
  const create = async () => {
    setBusy(true)
    setErr(null)
    try {
      const id = await api.createGroup(name, desc, mode)
      setCreating(false)
      setName('')
      setDesc('')
      onOpen(id)
    } catch (e) {
      setErr(api.errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <SectionTitle>Groups</SectionTitle>
        {account ? (
          <Button className="mb-1 min-h-10 text-sm" onClick={() => setCreating(!creating)}>
            {creating ? 'Cancel' : '+ New group'}
          </Button>
        ) : (
          <button type="button" className="mb-2 text-xs text-gold" onClick={onSignIn}>
            Sign in to create or join
          </button>
        )}
      </div>
      {creating && (
        <Card className="anim-rise flex flex-col gap-3 p-4">
          <input
            className={input}
            placeholder="Group name"
            aria-label="Group name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            className={cx(input, 'min-h-20 py-2 text-base')}
            placeholder="Description (optional)"
            aria-label="Description"
            maxLength={300}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <JoinModePicker value={mode} onChange={setMode} />
          <Button variant="primary" className="min-h-12" disabled={busy || !name.trim()} onClick={create}>
            Create group
          </Button>
        </Card>
      )}
      {err && <p className="text-sm text-rose-300">{err}</p>}
      {groups === null && !err && <p className="text-sm text-cream/50">Loading groups…</p>}
      {groups?.length === 0 && <Card className="p-4 text-sm text-cream/60">No groups yet. Start the first one!</Card>}
      <ul className="flex flex-col gap-2">
        {groups?.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => onOpen(g.id)}
              className="press flex w-full items-center gap-3 rounded-2xl bg-panel/90 p-3 text-left ring-1 ring-white/10"
            >
              <Avatar name={g.name} color="#d4a640" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-bold">{g.name}</span>
                  <ModeBadge mode={g.joinMode} />
                </span>
                {g.description && <span className="line-clamp-1 block text-xs text-cream/55">{g.description}</span>}
              </span>
              <span className="text-right text-xs leading-tight text-cream/55 tabular-nums">
                <span className="block text-lg font-black text-cream">{g.memberCount}</span>
                member{g.memberCount === 1 ? '' : 's'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function JoinModePicker({ value, onChange }: { value: JoinMode; onChange: (m: JoinMode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Join mode">
      {(['public', 'private'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={cx(
            'flex min-h-14 flex-col items-start justify-center rounded-xl px-3 text-left ring-1',
            value === m ? 'bg-gold/15 ring-gold' : 'bg-white/5 ring-white/10',
          )}
        >
          <span className="font-bold">{m === 'public' ? 'Public' : 'Private'}</span>
          <span className="text-[11px] text-cream/55">
            {m === 'public' ? 'Anyone joins instantly' : 'Admins approve requests'}
          </span>
        </button>
      ))}
    </div>
  )
}

function GroupPage({
  api,
  account,
  gid,
  onBack,
  onSignIn,
}: {
  api: CloudApi
  account: Account | null
  gid: string
  onBack: () => void
  onSignIn: () => void
}) {
  const [d, setD] = useState<GroupDetail | null | undefined>(undefined)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', joinMode: 'public' as JoinMode })
  const uid = account?.uid ?? null
  const load = useCallback(() => {
    api
      .getGroup(gid, uid)
      .then(setD)
      .catch((e) => setErr(api.errorText(e)))
  }, [api, gid, uid])
  useEffect(load, [load])
  const act = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      setConfirm(null)
      after?.()
      load()
    } catch (e) {
      setErr(api.errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (d === undefined) return <p className="text-sm text-cream/50">{err ?? 'Loading…'}</p>
  if (d === null)
    return (
      <Card className="p-4">
        <p className="text-sm text-cream/60">This group no longer exists.</p>
        <Button className="mt-3" onClick={onBack}>
          ← All groups
        </Button>
      </Card>
    )
  const { group, members, requests, myRole, myRequest } = d
  const isOwner = myRole === 'owner'
  const isAdmin = isOwner || myRole === 'admin'
  const ranked = [...members].sort(
    (a, b) => (a.handicap ?? HANDICAP.start) - (b.handicap ?? HANDICAP.start) || (b.wins ?? 0) - (a.wins ?? 0),
  )

  return (
    <section className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="-mb-2 self-start text-sm text-gold">
        ← All groups
      </button>
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-2xl font-black">{group.name}</h2>
          <ModeBadge mode={group.joinMode} />
        </div>
        {group.description && <p className="mt-1 text-sm text-cream/65">{group.description}</p>}
        <p className="mt-2 text-xs text-cream/45">
          {group.memberCount} member{group.memberCount === 1 ? '' : 's'}
          {myRole && ` · you are ${myRole === 'member' ? 'a member' : `the ${myRole}`}`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!account && (
            <Button variant="primary" onClick={onSignIn}>
              Sign in to join
            </Button>
          )}
          {account && !myRole && group.joinMode === 'public' && (
            <Button variant="primary" disabled={busy} onClick={() => act(() => api.joinGroup(gid))}>
              Join group
            </Button>
          )}
          {account && !myRole && group.joinMode === 'private' && !myRequest && (
            <Button variant="primary" disabled={busy} onClick={() => act(() => api.requestJoin(gid))}>
              Request to join
            </Button>
          )}
          {account && !myRole && myRequest && (
            <>
              <span className="self-center text-sm text-amber-300">Request pending</span>
              <Button disabled={busy} onClick={() => act(() => api.cancelRequest(gid))}>
                Cancel request
              </Button>
            </>
          )}
          {myRole && !isOwner && (
            <Button variant="danger" disabled={busy} onClick={() => act(() => api.removeMember(gid, uid!))}>
              Leave group
            </Button>
          )}
          {isOwner && (
            <Button
              onClick={() => {
                setForm({ name: group.name, description: group.description, joinMode: group.joinMode })
                setEditing(!editing)
              }}
            >
              {editing ? 'Close' : 'Edit group'}
            </Button>
          )}
        </div>
        {err && <p className="mt-2 text-sm text-rose-300">{err}</p>}
      </Card>

      {isOwner && editing && (
        <Card className="anim-rise flex flex-col gap-3 p-4">
          <input
            className={input}
            aria-label="Group name"
            maxLength={60}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <textarea
            className={cx(input, 'min-h-20 py-2 text-base')}
            aria-label="Description"
            maxLength={300}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <JoinModePicker value={form.joinMode} onChange={(m) => setForm({ ...form, joinMode: m })} />
          <Button
            variant="primary"
            disabled={busy || !form.name.trim()}
            onClick={() =>
              act(
                () => api.editGroup(gid, form),
                () => setEditing(false),
              )
            }
          >
            Save changes
          </Button>
          {confirm === 'delete' ? (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setConfirm(null)}>Keep</Button>
              <Button variant="danger" disabled={busy} onClick={() => act(() => api.deleteGroup(gid), onBack)}>
                Delete for everyone
              </Button>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirm('delete')}>
              Delete group
            </Button>
          )}
        </Card>
      )}

      {isAdmin && requests.length > 0 && (
        <div>
          <SectionTitle>Join requests ({requests.length})</SectionTitle>
          <ul className="flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.uid} className="flex items-center gap-3 rounded-2xl bg-[#1d1913] p-3 ring-1 ring-gold/40">
                <Avatar name={r.displayName} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold">{r.displayName}</span>
                <Button
                  className="min-h-10 text-sm"
                  variant="primary"
                  disabled={busy}
                  onClick={() => act(() => api.approveRequest(gid, r))}
                >
                  Approve
                </Button>
                <Button
                  className="min-h-10 text-sm"
                  disabled={busy}
                  onClick={() => act(() => api.declineRequest(gid, r.uid))}
                >
                  Decline
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <SectionTitle>Leaderboard · by handicap</SectionTitle>
        <ol className="flex flex-col gap-2">
          {ranked.map((m, k) => {
            const canRemove =
              uid !== m.uid && m.role !== 'owner' && (isOwner || (myRole === 'admin' && m.role === 'member'))
            return (
              <li
                key={m.uid}
                className={cx(
                  'rounded-2xl p-3 ring-1',
                  k === 0 ? 'bg-[#1d1913] ring-gold/50' : 'bg-panel/90 ring-white/10',
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cx(
                      'w-6 text-center text-lg font-black tabular-nums',
                      k === 0 ? 'text-gold' : 'text-cream/50',
                    )}
                  >
                    {k + 1}
                  </span>
                  <Avatar name={m.displayName} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-bold">{m.displayName}</span>
                      {m.role !== 'member' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gold">{m.role}</span>
                      )}
                      {m.uid === uid && <span className="text-[10px] text-cream/45">you</span>}
                    </span>
                    <span className="block text-xs text-cream/55">
                      {m.handicap === undefined ? (
                        'no games synced yet'
                      ) : (
                        <>
                          <HandicapTag h={m.handicap} last={m.handicapLast} provisional={m.provisional} /> ·{' '}
                          {m.wins ?? 0}/{m.games ?? 0} won
                        </>
                      )}
                    </span>
                  </span>
                  {(canRemove || (isOwner && m.role !== 'owner')) && (
                    <button
                      type="button"
                      aria-label={`Manage ${m.displayName}`}
                      className="h-10 w-10 rounded-xl text-cream/50 hover:bg-white/5"
                      onClick={() => setConfirm(confirm === m.uid ? null : m.uid)}
                    >
                      ⋯
                    </button>
                  )}
                </div>
                {confirm === m.uid && (
                  <div className="anim-rise mt-2 grid grid-cols-2 gap-2">
                    {isOwner && (
                      <Button
                        className="min-h-10 text-sm"
                        disabled={busy}
                        onClick={() => act(() => api.setRole(gid, m.uid, m.role === 'admin' ? 'member' : 'admin'))}
                      >
                        {m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                      </Button>
                    )}
                    {canRemove && (
                      <Button
                        className="min-h-10 text-sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => act(() => api.removeMember(gid, m.uid))}
                      >
                        Remove from group
                      </Button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
        <p className="mt-2 px-1 text-[11px] text-cream/40">
          Handicaps come from each member’s own synced games (link your player on the Account page).
        </p>
      </div>
    </section>
  )
}
