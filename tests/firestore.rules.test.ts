import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  addDoc,
  type Firestore,
} from 'firebase/firestore'

let env: RulesTestEnvironment
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-social-dart',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  })
})
afterAll(() => env.cleanup())
beforeEach(() => env.clearFirestore())

const as = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore
const guest = () => env.unauthenticatedContext().firestore() as unknown as Firestore

async function create(db: Firestore, gid: string, uid: string, joinMode = 'public') {
  const b = writeBatch(db)
  b.set(doc(db, 'groups', gid), { name: 'G', description: '', joinMode, ownerId: uid, memberCount: 1, lastMember: uid })
  b.set(doc(db, 'groups', gid, 'members', uid), { role: 'owner', displayName: 'Owner' })
  await b.commit()
}
const join = (db: Firestore, gid: string, uid: string) => {
  const b = writeBatch(db)
  b.set(doc(db, 'groups', gid, 'members', uid), { role: 'member', displayName: uid })
  b.update(doc(db, 'groups', gid), { memberCount: increment(1), lastMember: uid })
  return b.commit()
}
const count = async (gid: string) => {
  let n = -1
  await env.withSecurityRulesDisabled(async (c) => {
    n = (await getDoc(doc(c.firestore() as unknown as Firestore, 'groups', gid))).data()!.memberCount
  })
  return n
}

describe('users', () => {
  it('anyone reads profiles, only the owner writes', async () => {
    await assertSucceeds(setDoc(doc(as('a'), 'users', 'a'), { displayName: 'Ann', handicap: -2.5, games: 3, wins: 1 }))
    await assertSucceeds(getDoc(doc(guest(), 'users', 'a')))
    await assertFails(setDoc(doc(as('b'), 'users', 'a'), { displayName: 'Hacked' }))
    await assertFails(setDoc(doc(as('a'), 'users', 'a'), { displayName: 'Ann', handicap: -11 }))
    await assertFails(setDoc(doc(as('a'), 'users', 'a'), { displayName: 'Ann', email: 'x@y.z' }))
    await assertSucceeds(setDoc(doc(as('a'), 'users', 'a', 'games', 'g1'), { endedAt: 1, json: '{}' }))
    await assertFails(getDoc(doc(as('b'), 'users', 'a', 'games', 'g1')))
  })
})

describe('groups', () => {
  it('create needs the owner member doc and count 1; guests can list', async () => {
    await assertSucceeds(create(as('a'), 'g', 'a'))
    await assertSucceeds(getDoc(doc(guest(), 'groups', 'g')))
    await assertFails(
      setDoc(doc(as('b'), 'groups', 'h'), {
        name: 'X',
        description: '',
        joinMode: 'public',
        ownerId: 'b',
        memberCount: 1,
        lastMember: 'b',
      }),
    )
    await assertFails(create(as('b'), 'h2', 'a')) // can't create for someone else
    await assertFails(create(guest(), 'h3', 'x'))
  })

  it('public join is instant and keeps the count exact', async () => {
    await create(as('a'), 'g', 'a')
    await assertSucceeds(join(as('b'), 'g', 'b'))
    expectCount(await count('g'), 2)
    await assertFails(join(as('b'), 'g', 'b')) // already a member
    await assertFails(updateDoc(doc(as('c'), 'groups', 'g'), { memberCount: increment(1), lastMember: 'c' }))
    await assertFails(setDoc(doc(as('c'), 'groups', 'g', 'members', 'c'), { role: 'member', displayName: 'c' }))
    await assertFails(join(as('c'), 'g', 'd')) // can't add someone else
    const cdb = as('c')
    const b = writeBatch(cdb)
    b.set(doc(cdb, 'groups', 'g', 'members', 'c'), { role: 'admin', displayName: 'c' })
    b.update(doc(cdb, 'groups', 'g'), { memberCount: increment(1), lastMember: 'c' })
    await assertFails(b.commit()) // can't self-promote
  })

  it('private: request, only admins approve, leave/remove', async () => {
    await create(as('a'), 'p', 'a', 'private')
    await assertFails(join(as('b'), 'p', 'b'))
    await assertSucceeds(setDoc(doc(as('b'), 'groups', 'p', 'requests', 'b'), { displayName: 'b' }))
    await assertSucceeds(setDoc(doc(as('c'), 'groups', 'p', 'requests', 'c'), { displayName: 'c' }))
    await assertFails(getDoc(doc(as('c'), 'groups', 'p', 'requests', 'b')))
    // c can't approve b
    const approve = (db: Firestore, uid: string) => {
      const w = writeBatch(db)
      w.delete(doc(db, 'groups', 'p', 'requests', uid))
      w.set(doc(db, 'groups', 'p', 'members', uid), { role: 'member', displayName: uid })
      w.update(doc(db, 'groups', 'p'), { memberCount: increment(1), lastMember: uid })
      return w.commit()
    }
    await assertFails(approve(as('c'), 'b'))
    await assertSucceeds(approve(as('a'), 'b'))
    expectCount(await count('p'), 2)
    // owner makes b an admin; admin b approves c
    await assertFails(updateDoc(doc(as('b'), 'groups', 'p', 'members', 'b'), { role: 'admin' }))
    await assertSucceeds(updateDoc(doc(as('a'), 'groups', 'p', 'members', 'b'), { role: 'admin' }))
    await assertSucceeds(approve(as('b'), 'c'))
    expectCount(await count('p'), 3)
    // approve without a request fails
    await assertFails(approve(as('a'), 'zz'))
    // decline
    await setDoc(doc(as('d'), 'groups', 'p', 'requests', 'd'), { displayName: 'd' })
    await assertSucceeds(deleteDoc(doc(as('b'), 'groups', 'p', 'requests', 'd')))
    const remove = (db: Firestore, uid: string) => {
      const w = writeBatch(db)
      w.delete(doc(db, 'groups', 'p', 'members', uid))
      w.update(doc(db, 'groups', 'p'), { memberCount: increment(-1), lastMember: uid })
      return w.commit()
    }
    await assertFails(remove(as('c'), 'b')) // member can't remove others
    await assertFails(remove(as('b'), 'a')) // nobody removes the owner
    await assertSucceeds(remove(as('c'), 'c')) // leave
    expectCount(await count('p'), 2)
    await assertFails(deleteDoc(doc(as('b'), 'groups', 'p', 'members', 'b'))) // leaving without the count
    await assertSucceeds(remove(as('a'), 'b')) // owner removes an admin
    expectCount(await count('p'), 1)
  })

  it('only the owner edits and deletes the group', async () => {
    await create(as('a'), 'g', 'a')
    await join(as('b'), 'g', 'b')
    await assertFails(updateDoc(doc(as('b'), 'groups', 'g'), { name: 'Mine' }))
    await assertFails(updateDoc(doc(as('a'), 'groups', 'g'), { ownerId: 'b' }))
    await assertSucceeds(updateDoc(doc(as('a'), 'groups', 'g'), { name: 'Renamed', joinMode: 'private' }))
    await assertFails(deleteDoc(doc(as('b'), 'groups', 'g')))
    const db = as('a')
    const w = writeBatch(db)
    w.delete(doc(db, 'groups', 'g', 'members', 'a'))
    w.delete(doc(db, 'groups', 'g', 'members', 'b'))
    w.delete(doc(db, 'groups', 'g'))
    await assertSucceeds(w.commit())
  })
})

function expectCount(n: number, want: number) {
  if (n !== want) throw new Error(`memberCount ${n}, expected ${want}`)
}

describe('account deletion', () => {
  it('a user can remove all of their own data, nobody else can', async () => {
    const a = as('a')
    await setDoc(doc(a, 'users', 'a'), { displayName: 'Ann' })
    await setDoc(doc(a, 'users', 'a', 'games', 'g1'), { endedAt: 1, json: '{}' })
    // owner of one group, member of another, pending request in a third
    await create(a, 'mine', 'a')
    await create(as('b'), 'pub', 'b')
    await join(a, 'pub', 'a')
    await create(as('b'), 'priv', 'b', 'private')
    await setDoc(doc(a, 'groups', 'priv', 'requests', 'a'), { displayName: 'Ann' })

    // strangers can't wipe it
    await assertFails(deleteDoc(doc(as('x'), 'users', 'a')))
    await assertFails(deleteDoc(doc(as('x'), 'users', 'a', 'games', 'g1')))

    // the deletion sequence the app runs (src/cloud/api.ts deleteAccount)
    const del = writeBatch(a)
    del.delete(doc(a, 'groups', 'mine', 'members', 'a'))
    del.delete(doc(a, 'groups', 'mine'))
    await assertSucceeds(del.commit())
    const leave = writeBatch(a)
    leave.delete(doc(a, 'groups', 'pub', 'members', 'a'))
    leave.update(doc(a, 'groups', 'pub'), { memberCount: increment(-1), lastMember: 'a' })
    await assertSucceeds(leave.commit())
    await assertSucceeds(deleteDoc(doc(a, 'groups', 'priv', 'requests', 'a')))
    await assertSucceeds(deleteDoc(doc(a, 'users', 'a', 'games', 'g1')))
    await assertSucceeds(deleteDoc(doc(a, 'users', 'a')))
    if ((await count('pub')) !== 1) throw new Error('member count drifted')
  })
})

const removeBan = (db: Firestore, gid: string, uid: string, by: string, ban = true) => {
  const w = writeBatch(db)
  w.delete(doc(db, 'groups', gid, 'members', uid))
  w.update(doc(db, 'groups', gid), { memberCount: increment(-1), lastMember: uid })
  if (ban) w.set(doc(db, 'groups', gid, 'bans', uid), { displayName: uid, by, createdAt: serverTimestamp() })
  return w.commit()
}

describe('removing members (creator moderation)', () => {
  it('owner removes a member and bans them; they cannot rejoin until allowed back', async () => {
    await create(as('a'), 'g', 'a')
    await join(as('b'), 'g', 'b')
    await join(as('c'), 'g', 'c')
    await assertFails(removeBan(as('c'), 'g', 'b', 'c')) // a plain member can't remove or ban
    await assertFails(removeBan(as('a'), 'g', 'a', 'a')) // nobody removes the owner
    await assertSucceeds(removeBan(as('a'), 'g', 'b', 'a'))
    expectCount(await count('g'), 2)
    await assertFails(join(as('b'), 'g', 'b')) // banned: can't rejoin
    await assertFails(getDoc(doc(as('c'), 'groups', 'g', 'bans', 'b'))) // other members can't read bans
    await assertSucceeds(getDoc(doc(as('a'), 'groups', 'g', 'bans', 'b')))
    await assertFails(deleteDoc(doc(as('b'), 'groups', 'g', 'bans', 'b'))) // can't lift own ban
    await assertSucceeds(deleteDoc(doc(as('a'), 'groups', 'g', 'bans', 'b')))
    await assertSucceeds(join(as('b'), 'g', 'b')) // allowed back
  })

  it('banned users cannot request to join a private group; admins ban plain members only', async () => {
    await create(as('a'), 'p', 'a', 'private')
    await env.withSecurityRulesDisabled(async (c) => {
      const d = c.firestore() as unknown as Firestore
      await setDoc(doc(d, 'groups', 'p', 'members', 'adm'), { role: 'admin', displayName: 'adm' })
      await setDoc(doc(d, 'groups', 'p', 'members', 'm1'), { role: 'member', displayName: 'm1' })
      await setDoc(doc(d, 'groups', 'p', 'members', 'adm2'), { role: 'admin', displayName: 'adm2' })
      await updateDoc(doc(d, 'groups', 'p'), { memberCount: 4 })
    })
    await assertFails(removeBan(as('adm'), 'p', 'adm2', 'adm')) // admin can't ban an admin
    await assertSucceeds(removeBan(as('adm'), 'p', 'm1', 'adm')) // admin bans a member
    await assertFails(setDoc(doc(as('m1'), 'groups', 'p', 'requests', 'm1'), { displayName: 'm1' }))
    await assertSucceeds(setDoc(doc(as('zz'), 'groups', 'p', 'requests', 'zz'), { displayName: 'zz' }))
  })

  it('deleting the group clears its bans', async () => {
    await create(as('a'), 'g', 'a')
    await join(as('b'), 'g', 'b')
    await removeBan(as('a'), 'g', 'b', 'a')
    const db = as('a')
    const w = writeBatch(db)
    w.delete(doc(db, 'groups', 'g', 'members', 'a'))
    w.delete(doc(db, 'groups', 'g', 'bans', 'b'))
    w.delete(doc(db, 'groups', 'g'))
    await assertSucceeds(w.commit())
  })
})

describe('blocking users', () => {
  const block = (db: Firestore, me: string, other: string) => {
    const w = writeBatch(db)
    w.set(doc(db, 'users', me, 'blocks', other), { displayName: other, createdAt: serverTimestamp() })
    w.set(doc(db, 'users', other, 'blockedBy', me), { createdAt: serverTimestamp() })
    return w.commit()
  }
  it('only the blocker manages their list; the blocked user can read who blocked them', async () => {
    await assertSucceeds(block(as('a'), 'a', 'b'))
    await assertSucceeds(getDocs(collection(as('a'), 'users', 'a', 'blocks')))
    await assertFails(getDocs(collection(as('b'), 'users', 'a', 'blocks'))) // blocked user can't see my list
    await assertSucceeds(getDocs(collection(as('b'), 'users', 'b', 'blockedBy')))
    await assertFails(getDocs(collection(as('c'), 'users', 'b', 'blockedBy')))
    await assertFails(deleteDoc(doc(as('b'), 'users', 'b', 'blockedBy', 'a'))) // can't evade a block
  })
  it('cannot block yourself, forge someone else’s block or add a blockedBy without the block', async () => {
    await assertFails(block(as('a'), 'a', 'a'))
    await assertFails(block(as('c'), 'a', 'b')) // writing as someone else
    await assertFails(setDoc(doc(as('a'), 'users', 'b', 'blockedBy', 'a'), { createdAt: serverTimestamp() })) // no block doc
    await assertFails(setDoc(doc(as('a'), 'users', 'a', 'blocks', 'b'), { displayName: 'b', extra: 1 }))
  })
  it('unblocking removes both records', async () => {
    await block(as('a'), 'a', 'b')
    const a = as('a')
    const w = writeBatch(a)
    w.delete(doc(a, 'users', 'a', 'blocks', 'b'))
    w.delete(doc(a, 'users', 'b', 'blockedBy', 'a'))
    await assertSucceeds(w.commit())
    expectCount((await getDocs(collection(as('b'), 'users', 'b', 'blockedBy'))).size, 0)
  })
  it('a blocked user can no longer read the blocker’s profile; others and guests still can', async () => {
    await setDoc(doc(as('a'), 'users', 'a'), { displayName: 'Ann' })
    await block(as('a'), 'a', 'b')
    await assertFails(getDoc(doc(as('b'), 'users', 'a')))
    await assertSucceeds(getDoc(doc(as('c'), 'users', 'a')))
    await assertSucceeds(getDoc(doc(guest(), 'users', 'a')))
    await assertSucceeds(getDoc(doc(as('a'), 'users', 'b'))) // the blocker still reads the blocked user
  })
})

describe('reports', () => {
  const ok = () => ({
    reporterId: 'a',
    targetType: 'group',
    targetId: 'g1',
    targetName: 'Bad group',
    reason: 'offensive',
    status: 'open',
    createdAt: serverTimestamp(),
  })
  it('signed-in users file reports as themselves; nobody can read, edit or delete them', async () => {
    const a = as('a')
    await assertSucceeds(addDoc(collection(a, 'reports'), ok()))
    await assertSucceeds(
      addDoc(collection(a, 'reports'), { ...ok(), targetType: 'user', targetId: 'u2', groupId: 'g1', reason: 'other', details: 'rude name' }),
    )
    await assertFails(addDoc(collection(guest(), 'reports'), ok()))
    await assertFails(addDoc(collection(as('b'), 'reports'), ok())) // reporterId must be me
    await assertFails(addDoc(collection(a, 'reports'), { ...ok(), reason: 'because' }))
    await assertFails(addDoc(collection(a, 'reports'), { ...ok(), details: 'x'.repeat(501) }))
    await assertFails(addDoc(collection(a, 'reports'), { ...ok(), status: 'closed' }))
    await assertFails(addDoc(collection(a, 'reports'), { ...ok(), extra: 1 }))
    await assertFails(addDoc(collection(a, 'reports'), { ...ok(), targetType: 'user', targetId: 'a' })) // self
    await assertFails(addDoc(collection(a, 'reports'), { ...ok(), createdAt: Timestamp.fromMillis(1) })) // forged time
    await assertFails(getDocs(collection(a, 'reports')))
    let id = ''
    await env.withSecurityRulesDisabled(async (c) => {
      id = (await addDoc(collection(c.firestore() as unknown as Firestore, 'reports'), { ...ok() })).id
    })
    await assertFails(getDoc(doc(a, 'reports', id)))
    await assertFails(updateDoc(doc(a, 'reports', id), { status: 'closed' }))
    await assertFails(deleteDoc(doc(a, 'reports', id)))
  })
})

describe('terms acceptance', () => {
  it('a user can record their terms acceptance on their own profile', async () => {
    await assertSucceeds(
      setDoc(doc(as('a'), 'users', 'a'), { displayName: 'Ann', termsAcceptedAt: serverTimestamp(), termsVersion: '2026-11' }),
    )
    await assertFails(setDoc(doc(as('b'), 'users', 'a'), { displayName: 'Ann', termsVersion: 'x' }))
  })
})
