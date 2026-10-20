import { useEffect, useState } from 'react'
import { cloudEnabled } from './config'
import type { Account } from './api'

export type CloudApi = typeof import('./api')

/** Lazily loads Firebase only when accounts are enabled. Guests never pay for it. */
export function useCloud() {
  const [api, setApi] = useState<CloudApi | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [ready, setReady] = useState(!cloudEnabled)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!cloudEnabled) return
    let alive = true
    let unsub: (() => void) | undefined
    import('./api')
      .then((m) => {
        if (!alive) return
        setApi(m)
        unsub = m.watchAccount((a) => {
          setAccount(a)
          setReady(true)
        })
      })
      .catch(() => {
        setError('Accounts are offline right now. Guest play still works.')
        setReady(true)
      })
    return () => {
      alive = false
      unsub?.()
    }
  }, [])
  return { api, account, setAccount, ready, error }
}
