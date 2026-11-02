import { describe, expect, it } from 'vitest'
import {
  MAX_REPORT_DETAILS,
  REPORT_REASONS,
  REPORT_THANKS,
  buildReport,
  canRemoveMember,
  hiddenSet,
  noBlocks,
  visible,
  visibleGroups,
} from './moderation'

const base = { reporterId: 'me', targetType: 'user' as const, targetId: 'them', reason: 'harassment' as const }

describe('buildReport', () => {
  it('offers offensive, spam, harassment and other', () => {
    expect(REPORT_REASONS.map((r) => r.id)).toEqual(['offensive', 'spam', 'harassment', 'other'])
    expect(REPORT_THANKS).toBe('Thanks, we’ll review this within 24 hours.')
  })

  it('builds an open report with trimmed, clipped snapshots', () => {
    const r = buildReport({
      ...base,
      groupId: 'g1',
      targetName: '  Bad Name  ',
      targetText: 'x'.repeat(400),
      details: '  rude  ',
    })
    expect(r).toEqual({
      reporterId: 'me',
      targetType: 'user',
      targetId: 'them',
      reason: 'harassment',
      status: 'open',
      groupId: 'g1',
      targetName: 'Bad Name',
      targetText: 'x'.repeat(300),
      details: 'rude',
    })
  })

  it('omits empty optional fields and clips details', () => {
    const r = buildReport({ ...base, details: '   ', targetName: '' })
    expect(r).not.toHaveProperty('details')
    expect(r).not.toHaveProperty('targetName')
    expect(r).not.toHaveProperty('groupId')
    expect(buildReport({ ...base, details: 'y'.repeat(900) }).details).toHaveLength(MAX_REPORT_DETAILS)
  })

  it('reports groups, but never yourself or an unknown reason', () => {
    expect(buildReport({ ...base, targetType: 'group', targetId: 'g1', targetName: 'Pub' }).targetType).toBe('group')
    expect(() => buildReport({ ...base, targetId: 'me' })).toThrow(/yourself/)
    expect(() => buildReport({ ...base, reason: 'nope' as never })).toThrow(/reason/)
    expect(() => buildReport({ ...base, reporterId: '' })).toThrow(/sign in/i)
    expect(() => buildReport({ ...base, targetId: '' })).toThrow()
  })
})

describe('blocking filters', () => {
  const members = [{ uid: 'a' }, { uid: 'b' }, { uid: 'c' }]
  it('hides people I blocked and people who blocked me', () => {
    const hidden = hiddenSet({ blocked: ['a'], blockedBy: ['c'] })
    expect([...hidden].sort()).toEqual(['a', 'c'])
    expect(visible(members, hidden, (m) => m.uid)).toEqual([{ uid: 'b' }])
  })
  it('hides nothing without blocks and returns the same list', () => {
    expect(visible(members, hiddenSet(noBlocks), (m) => m.uid)).toBe(members)
  })
  it('hides groups owned by a hidden user', () => {
    const groups = [
      { id: '1', ownerId: 'a' },
      { id: '2', ownerId: 'b' },
    ]
    expect(visibleGroups(groups, new Set(['a']))).toEqual([{ id: '2', ownerId: 'b' }])
  })
})

describe('canRemoveMember', () => {
  const m = (role: 'owner' | 'admin' | 'member') => ({ uid: 'x', role })
  it('the owner removes admins and members, never themself or an owner', () => {
    expect(canRemoveMember('o', 'owner', m('member'))).toBe(true)
    expect(canRemoveMember('o', 'owner', m('admin'))).toBe(true)
    expect(canRemoveMember('o', 'owner', m('owner'))).toBe(false)
    expect(canRemoveMember('x', 'owner', m('member'))).toBe(false)
  })
  it('admins remove only plain members; members and guests remove nobody', () => {
    expect(canRemoveMember('a', 'admin', m('member'))).toBe(true)
    expect(canRemoveMember('a', 'admin', m('admin'))).toBe(false)
    expect(canRemoveMember('a', 'member', m('member'))).toBe(false)
    expect(canRemoveMember(null, null, m('member'))).toBe(false)
  })
})
