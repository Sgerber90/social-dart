import { useState, type FormEvent, type ReactNode } from 'react'
import type { Account as Acc, Profile } from '../cloud/api'
import type { CloudApi } from '../cloud/useCloud'
import { isNativeApp } from '../platform/native'
import { HANDICAP, computeStats, winPct, type GameRecord, type HandicapInfo } from '../game/history'
import type { Friend } from '../game/types'
import { Avatar, Button, Card, HandicapTag, SectionTitle, cx } from './ui'

interface Props {
  header: ReactNode
  nav: ReactNode
  api: CloudApi | null
  account: Acc | null
  setAccount: (a: Acc | null) => void
  profile: Profile | null
  friends: Friend[]
  history: GameRecord[]
  handicaps: Map<string, HandicapInfo>
  onLink: (playerId: string | null) => Promise<void>
  syncStatus: string
}

const input =
  'min-h-12 w-full rounded-xl bg-white/5 px-3 text-lg outline-none ring-1 ring-white/10 placeholder:text-cream/40 focus:ring-gold'

function useAction() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const run = async (fn: () => Promise<string | void>, api: CloudApi | null) => {
    setBusy(true)
    setMsg(null)
    try {
      const ok = await fn()
      if (ok) setMsg({ ok: true, text: ok })
    } catch (e) {
      setMsg({ ok: false, text: api ? api.errorText(e) : String(e) })
    } finally {
      setBusy(false)
    }
  }
  const view = msg && (
    <p role={msg.ok ? 'status' : 'alert'} className={cx('text-sm', msg.ok ? 'text-[#7fe0a6]' : 'text-rose-300')}>
      {msg.text}
    </p>
  )
  return { busy, run, view }
}

export default function Account(p: Props) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col md:max-w-4xl md:px-8 gap-5 px-4 pb-16 pt-6">
      {p.header}
      {p.nav}
      {!p.api ? (
        <Card className="p-4 text-sm text-cream/60">Loading…</Card>
      ) : p.account ? (
        <ProfileView key={p.account.uid + p.account.displayName} {...p} api={p.api} account={p.account} />
      ) : (
        <SignIn api={p.api} setAccount={p.setAccount} />
      )}
      <LegalLinks />
    </div>
  )
}

function SignIn({ api, setAccount }: { api: CloudApi; setAccount: (a: Acc | null) => void }) {
  const [mode, setMode] = useState<'in' | 'up' | 'reset'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const { busy, run, view } = useAction()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(async () => {
      if (mode === 'in') setAccount(await api.signIn(email, password))
      else if (mode === 'up') setAccount(await api.signUp(email, password, name))
      else {
        await api.resetPassword(email)
        return 'If that email has an account, a reset link is on its way. Check your inbox (and spam).'
      }
    }, api)
  }
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Reset password'}</SectionTitle>
      <Card className="p-4">
        <p className="mb-3 text-sm text-cream/60">
          Accounts are optional. Sign in to sync your handicap and join groups. Guest play keeps working without one.
        </p>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          {mode === 'up' && (
            <input
              className={input}
              placeholder="Display name"
              aria-label="Display name"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            className={input}
            type="email"
            autoComplete="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {mode !== 'reset' && (
            <input
              className={input}
              type="password"
              autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
              placeholder={mode === 'up' ? 'Password (6+ characters)' : 'Password'}
              aria-label="Password"
              value={password}
              minLength={6}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          )}
          {view}
          <Button type="submit" variant="primary" className="min-h-14 text-lg" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
          {mode !== 'in' && (
            <button type="button" className="min-h-10 text-gold" onClick={() => setMode('in')}>
              I have an account
            </button>
          )}
          {mode !== 'up' && (
            <button type="button" className="min-h-10 text-gold" onClick={() => setMode('up')}>
              Create an account
            </button>
          )}
          {mode !== 'reset' && (
            <button type="button" className="min-h-10 text-cream/60" onClick={() => setMode('reset')}>
              Forgot password?
            </button>
          )}
        </div>
      </Card>
    </section>
  )
}

function ProfileView({
  api,
  account,
  setAccount,
  profile,
  friends,
  history,
  handicaps,
  onLink,
  syncStatus,
}: Props & { api: CloudApi; account: Acc }) {
  const [name, setName] = useState(account.displayName)
  const [pw, setPw] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPw, setNewPw] = useState('')
  const nameAct = useAction()
  const emailAct = useAction()
  const pwAct = useAction()
  const linkAct = useAction()
  const pid = profile?.playerId
  const linked = friends.find((f) => f.id === pid)
  const h = pid ? handicaps.get(pid) : undefined
  const st = pid ? computeStats(history).get(pid) : undefined

  return (
    <>
      <Card className="flex items-center gap-4 p-4">
        <Avatar name={account.displayName} color={linked?.color ?? '#d4a640'} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-black">{account.displayName}</div>
          <div className="truncate text-sm text-cream/55">{account.email}</div>
          <div className="mt-1 text-sm">
            <HandicapTag h={h?.handicap ?? HANDICAP.start} last={h?.last} provisional={h?.provisional ?? true} />
          </div>
        </div>
        <div className="text-right text-xs leading-tight text-cream/60 tabular-nums">
          <div className="text-2xl font-black text-cream">{st?.games ?? 0}</div>
          games
          <div className="mt-1 font-bold text-cream">
            {st?.wins ?? 0} wins{st ? ` · ${winPct(st).toFixed(0)}%` : ''}
          </div>
        </div>
      </Card>
      {!account.emailVerified && (
        <p className="-mt-2 px-1 text-xs text-amber-300">
          Email not verified yet.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => emailAct.run(async () => (await api.resendVerification(), 'Verification email sent.'), api)}
          >
            Resend link
          </button>
        </p>
      )}

      <section className="flex flex-col gap-2">
        <SectionTitle>Your player</SectionTitle>
        <Card className="flex flex-col gap-3 p-4">
          <p className="text-sm text-cream/60">
            Link yourself to a player on this device. Their games, stats and handicap then sync to your account and show
            in your groups.
          </p>
          <select
            aria-label="Linked player"
            className={input}
            value={pid ?? ''}
            disabled={linkAct.busy}
            onChange={(e) => linkAct.run(() => onLink(e.target.value || null), api)}
          >
            <option value="">— Not linked —</option>
            {friends.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            {!friends.some((f) => f.name.toLowerCase() === account.displayName.toLowerCase()) && (
              <option value="__new">+ New player “{account.displayName}”</option>
            )}
          </select>
          {linkAct.view}
          {pid && <p className="text-xs text-cream/45">{syncStatus}</p>}
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Display name</SectionTitle>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            nameAct.run(async () => {
              await api.saveProfile({ ...(profile ?? {}), displayName: name }, true)
              setAccount({ ...account, displayName: name.trim() || 'Player' })
              return 'Saved.'
            }, api)
          }}
        >
          <input
            className={input}
            aria-label="Display name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" className="min-h-12 w-24" disabled={nameAct.busy || !name.trim()}>
            Save
          </Button>
        </form>
        {nameAct.view}
      </section>

      <section className="flex flex-col gap-2">
        <SectionTitle>Email & password</SectionTitle>
        <Card className="flex flex-col gap-3 p-4">
          <input
            className={input}
            type="password"
            autoComplete="current-password"
            placeholder="Current password (needed for changes)"
            aria-label="Current password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className={input}
              type="email"
              placeholder="New email"
              aria-label="New email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <Button
              className="min-h-12 shrink-0"
              disabled={emailAct.busy || !pw || !newEmail}
              onClick={() =>
                emailAct.run(async () => {
                  await api.changeEmail(pw, newEmail)
                  setNewEmail('')
                  return `Check ${newEmail.trim()} and click the link to confirm. Your email changes after that.`
                }, api)
              }
            >
              Change
            </Button>
          </div>
          {emailAct.view}
          <div className="flex gap-2">
            <input
              className={input}
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              aria-label="New password"
              value={newPw}
              minLength={6}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <Button
              className="min-h-12 shrink-0"
              disabled={pwAct.busy || !pw || newPw.length < 6}
              onClick={() =>
                pwAct.run(async () => {
                  await api.changePassword(pw, newPw)
                  setNewPw('')
                  setPw('')
                  return 'Password changed.'
                }, api)
              }
            >
              Change
            </Button>
          </div>
          {pwAct.view}
        </Card>
      </section>

      <Button variant="danger" onClick={() => api.signOut().then(() => setAccount(null))}>
        Sign out
      </Button>
      <p className="-mt-3 px-1 text-center text-[11px] text-cream/40">
        Signing out keeps your players, games and stats on this device.
      </p>

      <DeleteAccount api={api} setAccount={setAccount} />
    </>
  )
}

export function LegalLinks() {
  // In the native app, open in place (the pages link back); on the web, a new tab.
  const blank = isNativeApp() ? undefined : '_blank'
  return (
    <p className="flex justify-center gap-4 text-xs text-cream/45">
      <a className="underline" href="./privacy.html" target={blank} rel="noopener">
        Privacy policy
      </a>
      <a className="underline" href="./support.html" target={blank} rel="noopener">
        Support
      </a>
      <a className="underline" href="mailto:info@sjgenterprises.co.za">
        info@sjgenterprises.co.za
      </a>
    </p>
  )
}

function DeleteAccount({ api, setAccount }: { api: CloudApi; setAccount: (a: Acc | null) => void }) {
  const [open, setOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const act = useAction()
  if (!open)
    return (
      <button type="button" className="min-h-11 text-sm text-rose-300 underline" onClick={() => setOpen(true)}>
        Delete account
      </button>
    )
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Delete account</SectionTitle>
      <Card className="flex flex-col gap-3 p-4 ring-1 ring-rose-400/40">
        <p className="text-sm text-cream/70">
          This permanently deletes your account, your public profile, your synced games, your group memberships and
          any groups you own. It cannot be undone. Players, games and stats saved on this device stay here.
        </p>
        <input
          className={input}
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          aria-label="Current password to delete account"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <input
          className={input}
          placeholder='Type DELETE to confirm'
          aria-label="Type DELETE to confirm"
          autoCapitalize="characters"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {act.view}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setOpen(false)} disabled={act.busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={act.busy || !pw || confirm.trim().toUpperCase() !== 'DELETE'}
            onClick={() =>
              act.run(async () => {
                await api.deleteAccount(pw)
                setAccount(null)
              }, api)
            }
          >
            {act.busy ? 'Deleting…' : 'Delete forever'}
          </Button>
        </div>
      </Card>
    </section>
  )
}
