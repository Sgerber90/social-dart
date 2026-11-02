// Moderation helpers for user-generated content (App Store guideline 1.2 / Google Play UGC policy).
// Pure functions, no Firebase imports, so they are unit-tested and safe in the guest bundle.

export const TERMS_VERSION = '2026-11'

export type ReportReason = 'offensive' | 'spam' | 'harassment' | 'other'
export type ReportTargetType = 'group' | 'user'

export const REPORT_REASONS: { id: ReportReason; label: string; hint: string }[] = [
  { id: 'offensive', label: 'Offensive or inappropriate', hint: 'Hateful, sexual, violent or otherwise objectionable' },
  { id: 'spam', label: 'Spam or advertising', hint: 'Unwanted promotion, scams or fake content' },
  { id: 'harassment', label: 'Harassment or abuse', hint: 'Bullying, threats or targeting someone' },
  { id: 'other', label: 'Something else', hint: 'Tell us more below' },
]

export const REPORT_THANKS = 'Thanks, we’ll review this within 24 hours.'
export const MAX_REPORT_DETAILS = 500

export interface ReportInput {
  reporterId: string
  targetType: ReportTargetType
  targetId: string
  reason: ReportReason
  groupId?: string
  targetName?: string
  targetText?: string
  details?: string
}

/** The report document written to `reports/{id}` (createdAt is added by the server). */
export interface ReportDoc {
  reporterId: string
  targetType: ReportTargetType
  targetId: string
  reason: ReportReason
  status: 'open'
  groupId?: string
  targetName?: string
  targetText?: string
  details?: string
}

const clip = (s: string | undefined, n: number) => (s ?? '').trim().slice(0, n)

/** Validate and normalise a report; throws a user-readable Error when it can't be filed. */
export function buildReport(i: ReportInput): ReportDoc {
  if (!i.reporterId) throw new Error('Please sign in to report.')
  if (!i.targetId) throw new Error('Nothing to report.')
  if (i.targetType === 'user' && i.targetId === i.reporterId) throw new Error('You can’t report yourself.')
  if (!REPORT_REASONS.some((r) => r.id === i.reason)) throw new Error('Pick a reason first.')
  const doc: ReportDoc = {
    reporterId: i.reporterId,
    targetType: i.targetType,
    targetId: i.targetId,
    reason: i.reason,
    status: 'open',
  }
  const groupId = clip(i.groupId, 128)
  if (groupId) doc.groupId = groupId
  // snapshots so a report stays reviewable even if the content is edited or deleted afterwards
  const name = clip(i.targetName, 60)
  if (name) doc.targetName = name
  const text = clip(i.targetText, 300)
  if (text) doc.targetText = text
  const details = clip(i.details, MAX_REPORT_DETAILS)
  if (details) doc.details = details
  return doc
}

export interface BlockLists {
  /** uids I blocked */
  blocked: string[]
  /** uids that blocked me */
  blockedBy: string[]
}

/** Everyone hidden from my view: people I blocked and people who blocked me. */
export function hiddenSet(l: BlockLists): Set<string> {
  return new Set([...l.blocked, ...l.blockedBy])
}

export const noBlocks: BlockLists = { blocked: [], blockedBy: [] }

/** Items whose `uidOf` is not hidden. */
export function visible<T>(items: T[], hidden: Set<string>, uidOf: (t: T) => string): T[] {
  return hidden.size ? items.filter((t) => !hidden.has(uidOf(t))) : items
}

/** Groups created by a hidden user are not shown. */
export function visibleGroups<T extends { ownerId: string }>(groups: T[], hidden: Set<string>): T[] {
  return visible(groups, hidden, (g) => g.ownerId)
}

/** Can this person remove `target` from the group? (Owner removes anyone but themself; admins remove plain members.) */
export function canRemoveMember(
  myUid: string | null,
  myRole: 'owner' | 'admin' | 'member' | null,
  target: { uid: string; role: 'owner' | 'admin' | 'member' },
): boolean {
  if (!myUid || myUid === target.uid || target.role === 'owner') return false
  return myRole === 'owner' || (myRole === 'admin' && target.role === 'member')
}
