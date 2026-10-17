import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'ghost' | 'danger' | 'soft'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-metal text-black font-bold shadow-[0_6px_24px_-8px_rgb(212_166_64/0.7)] hover:brightness-110 active:brightness-95',
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
          className={cx(
            'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all',
            on ? 'left-6' : 'left-1',
          )}
        />
      </span>
    </button>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-cream/45">{children}</h2>
}
