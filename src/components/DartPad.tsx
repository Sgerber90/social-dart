import { useState } from 'react'
import type { Dart, Multiplier } from '../game/types'
import { cx } from './ui'

interface Props {
  onDart: (d: Dart) => void
  bullLabel?: string
  highlight?: (segment: number) => boolean
  disabled?: boolean
}

const NUMS = Array.from({ length: 20 }, (_, i) => i + 1)

export default function DartPad({ onDart, highlight, disabled, bullLabel = 'Bull 50' }: Props) {
  const [mult, setMult] = useState<Multiplier>(1)
  const throwDart = (segment: number, m: Multiplier = mult) => {
    onDart({ segment, mult: segment === 0 ? 1 : m })
    setMult(1)
  }
  const hl = (n: number) => (highlight ? highlight(n) : true)
  const multBtn = (m: Multiplier, label: string, on: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setMult(mult === m ? 1 : m)}
      className={cx(
        'min-h-12 rounded-2xl text-base font-bold tracking-wide ring-1 transition',
        mult === m ? on : 'bg-white/5 text-cream/65 ring-white/10',
      )}
      aria-pressed={mult === m}
    >
      {label}
    </button>
  )

  return (
    <div className={cx('flex flex-col gap-2', disabled && 'pointer-events-none opacity-40')}>
      <div className="grid grid-cols-3 gap-2">
        {multBtn(1, 'Single', 'bg-cream text-black ring-cream')}
        {multBtn(2, 'Double', 'bg-dred text-white ring-dred')}
        {multBtn(3, 'Triple', 'bg-dgreen text-white ring-dgreen')}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {NUMS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => throwDart(n)}
            className={cx(
              'relative min-h-13 rounded-2xl text-xl font-bold tabular-nums transition active:scale-95',
              hl(n) ? 'bg-[#211e1a] text-white ring-1 ring-white/15' : 'bg-panel text-cream/25',
              hl(n) && highlight && 'ring-2 ring-gold/70',
            )}
          >
            {mult > 1 && (
              <span className="absolute left-1.5 top-1 text-[10px] text-cream/65">{mult === 2 ? 'D' : 'T'}</span>
            )}
            {n}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => throwDart(25, 1)}
          className={cx(
            'min-h-13 rounded-2xl font-bold ring-1',
            hl(25) ? 'bg-dgreen/40 text-cream ring-dgreen' : 'bg-panel text-cream/25 ring-white/5',
          )}
        >
          25
        </button>
        <button
          type="button"
          onClick={() => throwDart(25, 2)}
          className={cx(
            'min-h-13 rounded-2xl font-bold ring-1',
            hl(25) ? 'bg-dred/40 text-cream ring-dred' : 'bg-panel text-cream/25 ring-white/5',
          )}
        >
          {bullLabel}
        </button>
        <button
          type="button"
          onClick={() => throwDart(0)}
          className="min-h-13 rounded-2xl bg-white/5 font-bold text-cream/65 ring-1 ring-white/10"
        >
          Miss
        </button>
      </div>
    </div>
  )
}
