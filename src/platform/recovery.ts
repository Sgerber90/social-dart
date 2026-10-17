import { clearAllData } from '../storage'

/** Unregister service workers and delete Cache Storage (does not touch saved games). */
export async function clearOfflineCache() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
  } catch {
    /* ignore */
  }
  try {
    const keys = (await window.caches?.keys?.()) ?? []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } catch {
    /* ignore */
  }
}

/** Full reset: saved data + offline cache, then reload. */
export async function resetApp() {
  clearAllData()
  await clearOfflineCache()
  window.location.replace(window.location.pathname)
}

const RELOAD_FLAG = 'social-dart:recovered-at'

/**
 * Reload once after clearing the offline cache, e.g. when a hashed JS/CSS file 404s
 * because a stale index.html referenced an old deploy. Guarded so it can't loop.
 */
export async function reloadOnce(): Promise<boolean> {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()))
  } catch {
    /* ignore */
  }
  await clearOfflineCache()
  window.location.reload()
  return true
}
