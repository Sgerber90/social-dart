import { useState } from 'react'
import type { ReportTarget } from '../cloud/api'
import type { CloudApi } from '../cloud/useCloud'
import { MAX_REPORT_DETAILS, REPORT_REASONS, REPORT_THANKS, type ReportReason } from '../moderation'
import { Button, Card, cx } from './ui'

const input =
  'min-h-12 w-full rounded-xl bg-white/5 px-3 text-lg outline-none ring-1 ring-white/10 placeholder:text-cream/40 focus:ring-gold'

/** Report a group or a user: pick a reason, optional note, confirmation. */
export function ReportForm({
  api,
  target,
  label,
  onClose,
}: {
  api: CloudApi
  target: ReportTarget
  label: string
  onClose: () => void
}) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const submit = async () => {
    if (!reason) return
    setBusy(true)
    setErr(null)
    try {
      await api.reportContent(target, reason, details)
      setDone(true)
    } catch (e) {
      setErr(api.errorText(e))
    } finally {
      setBusy(false)
    }
  }
  if (done)
    return (
      <Card className="anim-rise flex flex-col gap-3 p-4 ring-1 ring-dgreen/50" role="status">
        <p className="font-bold text-[#7fe0a6]">{REPORT_THANKS}</p>
        <Button onClick={onClose}>Done</Button>
      </Card>
    )
  return (
    <Card className="anim-rise flex flex-col gap-3 p-4 ring-1 ring-amber-400/40" role="dialog" aria-label={`Report ${label}`}>
      <p className="font-bold">Report {label}</p>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Reason">
        {REPORT_REASONS.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={reason === r.id}
            onClick={() => setReason(r.id)}
            className={cx(
              'flex min-h-14 flex-col items-start justify-center rounded-xl px-3 text-left ring-1',
              reason === r.id ? 'bg-gold/15 ring-gold' : 'bg-white/5 ring-white/10',
            )}
          >
            <span className="font-bold">{r.label}</span>
            <span className="text-[11px] text-cream/55">{r.hint}</span>
          </button>
        ))}
      </div>
      <textarea
        className={cx(input, 'min-h-20 py-2 text-base')}
        placeholder="Add details (optional)"
        aria-label="Report details"
        maxLength={MAX_REPORT_DETAILS}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
      />
      {err && <p className="text-sm text-rose-300">{err}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" disabled={busy || !reason} onClick={submit}>
          {busy ? 'Sending…' : 'Send report'}
        </Button>
      </div>
    </Card>
  )
}
