import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearOfflineCache, resetApp } from '../platform/recovery'

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Social Dart crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-5xl" aria-hidden>
          🎯
        </div>
        <h1 className="text-2xl font-black text-cream">Something went wrong</h1>
        <p className="text-sm text-cream/60">
          Social Dart hit an error. Try reloading. If it keeps happening, reset the app: this clears saved games and
          players on this device and fetches the latest version.
        </p>
        <div className="mt-2 flex w-full flex-col gap-2">
          <button
            type="button"
            className="min-h-14 rounded-2xl bg-white/10 font-semibold text-cream ring-1 ring-white/15"
            onClick={async () => {
              await clearOfflineCache()
              window.location.reload()
            }}
          >
            Reload
          </button>
          <button
            type="button"
            className="bg-metal min-h-14 rounded-2xl font-bold text-black"
            onClick={() => void resetApp()}
          >
            Reset app
          </button>
        </div>
        <p className="mt-2 break-all text-[11px] text-cream/30">
          {String(this.state.error.message || this.state.error)}
        </p>
      </div>
    )
  }
}
