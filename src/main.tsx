import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { reloadOnce } from './platform/recovery'
import { initNative, isNativeApp } from './platform/native'

declare global {
  interface Window {
    __sdBooted?: boolean
  }
}

// A lazily-imported chunk failed to load (stale HTML from an older deploy): clear cache and reload once.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  void reloadOnce()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
window.__sdBooted = true
void initNative()

// Service worker: new versions activate immediately (skipWaiting + clientsClaim) and the
// page reloads onto them. Check for updates on start, when the app regains focus and hourly.
// The native app serves its files from the bundle (capacitor://localhost): no service worker there,
// and any stale registration is removed.
if ('serviceWorker' in navigator && isNativeApp()) {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {})
} else if ('serviceWorker' in navigator && import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return
      const check = () => {
        if (navigator.onLine !== false) reg.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
      setInterval(check, 60 * 60 * 1000)
    },
  })
}
