import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, increment, setDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'

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
