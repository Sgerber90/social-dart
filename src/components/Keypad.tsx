import { useState } from 'react'
import { isPossibleTurnTotal } from '../game/checkout'
import { cx } from './ui'

interface Props {
  onSubmit: (n: number) => void
  remaining: number
  canCheckout: boolean
  disabled?: boolean
}

export default function Keypad({ onSubmit, remaining, canCheckout, disabled }: Props) {
  const [value, setValue] = useState('')
  const n = value === '' ? 0 : Number(value)
  const valid = isPossibleTurnTotal(n)
  const press = (k: string) => {
    const next = (value + k).replace(/^0+(?=\d)/, '')
    if (Number(next) <= 180) setValue(next)
  }
  const submit = (x: number) => {
    onSubmit(x)
    setValue('')
  }
  const key =
    'min-h-14 rounded-2xl text-2xl font-semibold tabular-nums bg-[#211e1a] ring-1 ring-white/10 active:scale-95 transition'
  return (
    <div className={cx('flex flex-col gap-2', disabled && 'pointer-events-none opacity-40')}>
      <div className="flex items-center gap-2">
        <div
          className={cx(
            'flex min-h-14 flex-1 items-center justify-end rounded-2xl bg-black/40 px-4 text-4xl font-bold tabular-nums ring-1',
            value && !valid ? 'text-rose-400 ring-rose-500/50' : 'ring-white/10',
          )}
          aria-live="polite"
        >
          {value || <span className="text-cream/25">0</span>}
        </div>
        {canCheckout && (
          <button
            type="button"
            onClick={() => submit(remaining)}
            className="min-h-14 rounded-2xl bg-dred px-4 text-sm font-bold text-white"
          >
            Checkout
            <br />
            {remaining}
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((k) => (
          <button key={k} type="button" className={key} onClick={() => press(k)}>
            {k}
          </button>
        ))}
        <button type="button" className={cx(key, 'text-lg text-cream/65')} onClick={() => setValue(value.slice(0, -1))}>
          ⌫
        </button>
        <button type="button" className={key} onClick={() => press('0')}>
          0
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => submit(n)}
          className="min-h-14 rounded-2xl bg-dgreen text-lg font-bold text-black disabled:opacity-35"
        >
          {value ? 'Enter' : 'No score'}
        </button>
      </div>
    </div>
  )
}
