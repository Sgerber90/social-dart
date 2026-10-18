import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'ghost' | 'danger' | 'soft'
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-metal text-black font-bold shadow-[0_6px_24px_-8px_rgb(212_166_64/0.7)] hover:brightness-110 active:brightness-95',
  ghost: 'bg-transparent text-cream/65 hover:bg-white/5 active:bg-white/10',
  danger: 'bg-dred/15 text-rose-300 hover:bg-dred/25 active:bg-dred/35',
  soft: 'bg-white/5 text-cream hover:bg-white/10 active:bg-white/15 ring-1 ring-white/10',
}

export function Button({
  variant = 'soft',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-2xl px-4 min-h-12 text-base transition select-none',
        'disabled:opacity-35 disabled:pointer-events-none',
        VARIANTS[variant],
        className,
      )}
    />
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-3xl bg-panel/90 ring-1 ring-white/10', className)}>{children}</div>
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl bg-white/5 px-4 min-h-14 ring-1 ring-white/10"
    >
      <span className="text-cream">{label}</span>
      <span className={cx('relative h-7 w-12 rounded-full transition', on ? 'bg-dgreen' : 'bg-[#3a352d]')}>
        <span
          className={cx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')}
        />
      </span>
    </button>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cream/45">{children}</h2>
}

export function Avatar({ name, color, size = 'md' }: { name: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase()
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-black text-black/85 ring-2 ring-black/30',
        size === 'sm' ? 'h-7 w-7 text-sm' : size === 'lg' ? 'h-12 w-12 text-xl' : 'h-9 w-9 text-base',
      )}
      style={{ background: color ?? '#94a3b8' }}
    >
      {initial}
    </span>
  )
}

/** Handicap with the direction of its last change (▼ improved, ▲ got worse). */
export function HandicapTag({ h, last, provisional }: { h: number; last?: number; provisional?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 tabular-nums"
      title={provisional ? 'Provisional handicap' : 'Handicap'}
    >
      <span className="text-cream/45">hcp</span>
      <span className="font-bold text-cream">{h.toFixed(1)}</span>
      {provisional && <span className="text-cream/40">*</span>}
      {last !== undefined && last !== 0 && (
        <span className={last < 0 ? 'text-[#7fe0a6]' : 'text-rose-300'}>
          {last < 0 ? '▼' : '▲'}
          {Math.abs(last).toFixed(1)}
        </span>
      )}
    </span>
  )
}

export function NavTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[]
  value: T
  onChange: (t: T) => void
}) {
  return (
    <nav
      className="grid gap-1 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-current={value === t.id ? 'page' : undefined}
          onClick={() => onChange(t.id)}
          className={cx(
            'min-h-11 rounded-xl text-sm font-semibold transition',
            value === t.id ? 'bg-metal text-black' : 'text-cream/65 hover:text-cream',
          )}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}
