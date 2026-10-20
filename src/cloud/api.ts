// Firebase Auth + Firestore client for optional accounts and groups.
// Loaded lazily (dynamic import) so guests never download the Firebase SDK.
import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
  type Auth,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { firebaseConfig } from './config'
import type { GameRecord } from '../game/history'
import { validRecord } from '../game/validate'

let app: FirebaseApp | null = null
let auth: Auth
let db: Firestore
function init() {
  if (app) return
  app = initializeApp(firebaseConfig as Record<string, string>)
  auth = getAuth(app)
  db = getFirestore(app)
}

export interface Account {
  uid: string
  email: string
  emailVerified: boolean
  displayName: string
}
const toAccount = (u: User): Account => ({
  uid: u.uid,
  email: u.email ?? '',
  emailVerified: u.emailVerified,
  displayName: u.displayName ?? (u.email ?? 'Player').split('@')[0],
})

const listeners = new Set<(a: Account | null) => void>()
/** Re-announce the current user (onAuthStateChanged doesn't fire for profile updates). */
function emitCurrent() {
  const u = auth.currentUser
  listeners.forEach((cb) => cb(u ? toAccount(u) : null))
}
export function watchAccount(cb: (a: Account | null) => void): () => void {
  init()
  listeners.add(cb)
  const off = onAuthStateChanged(auth, (u) => cb(u ? toAccount(u) : null))
  return () => {
    listeners.delete(cb)
    off()
  }
}
const current = () => {
  init()
  if (!auth.currentUser) throw new Error('Please sign in first.')
  return auth.currentUser
}

/** Friendly messages for Firebase auth error codes. */
export function errorText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/email-already-in-use': 'There is already an account with that email. Try signing in.',
    'auth/weak-password': 'Use at least 6 characters for the password.',
    'auth/invalid-credential': 'Email or password is wrong.',
    'auth/wrong-password': 'Password is wrong.',
    'auth/user-not-found': 'No account with that email.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
    'auth/requires-recent-login': 'Please enter your current password again.',
    'auth/network-request-failed': 'No connection. Check your internet and try again.',
    'permission-denied': 'You don’t have permission to do that.',
  }
  return map[code] ?? (e instanceof Error ? e.message.replace(/^Firebase: /, '') : 'Something went wrong.')
}

export async function signUp(email: string, password: string, displayName: string) {
  init()
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password)
  const name = displayName.trim().slice(0, 40) || email.split('@')[0].slice(0, 40)
  await updateProfile(user, { displayName: name })
  await setDoc(doc(db, 'users', user.uid), { displayName: name, updatedAt: serverTimestamp() }, { merge: true })
  sendEmailVerification(user).catch(() => {})
  emitCurrent()
  return toAccount(user)
}
export async function signIn(email: string, password: string) {
  init()
  const { user } = await signInWithEmailAndPassword(auth, email.trim(), password)
  return toAccount(user)
}
export async function signOut() {
  init()
  await fbSignOut(auth)
}
export async function resetPassword(email: string) {
  init()
  await sendPasswordResetEmail(auth, email.trim())
}
export async function resendVerification() {
  await sendEmailVerification(current())
}
async function reauth(password: string) {
  const u = current()
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email ?? '', password))
  return u
}
/** Sends a verification link to the new address; the email changes once it is clicked. */
export async function changeEmail(currentPassword: string, newEmail: string) {
  const u = await reauth(currentPassword)
  await verifyBeforeUpdateEmail(u, newEmail.trim())
}
export async function changePassword(currentPassword: string, newPassword: string) {
  const u = await reauth(currentPassword)
  await updatePassword(u, newPassword)
}

// ------------------------------------------------------------------ profile
export interface Profile {
  displayName: string
  playerId?: string
  handicap?: number
  handicapLast?: number
  provisional?: boolean
  games?: number
  wins?: number
}
export async function getProfile(uid: string): Promise<Profile | null> {
  init()
  const s = await getDoc(doc(db, 'users', uid))
  return s.exists() ? (s.data() as Profile) : null
}
/** Save the public profile. `rename` also changes the account's display name. */
export async function saveProfile(p: Profile, rename = false) {
  const u = current()
  const name = p.displayName.trim().slice(0, 40) || 'Player'
  if (rename && name !== u.displayName) {
    await updateProfile(u, { displayName: name })
    emitCurrent()
  }
  const data: Record<string, unknown> = { displayName: name, updatedAt: serverTimestamp() }
  for (const k of ['playerId', 'handicap', 'handicapLast', 'provisional', 'games', 'wins'] as const)
    if (p[k] !== undefined) data[k] = p[k]
  await setDoc(doc(db, 'users', u.uid), data, { merge: true })
}

/** Upload records not yet synced; returns all remote records (for merging into this device). */
export async function syncGames(records: GameRecord[], alreadySynced: Set<string>): Promise<GameRecord[]> {
  const u = current()
  const col = collection(db, 'users', u.uid, 'games')
  const todo = records.filter((r) => !alreadySynced.has(r.id))
  for (let i = 0; i < todo.length; i += 400) {
    const b = writeBatch(db)
    for (const r of todo.slice(i, i + 400)) b.set(doc(col, r.id), { endedAt: r.endedAt, json: JSON.stringify(r) })
    await b.commit()
  }
  const snap = await getDocs(query(col, orderBy('endedAt', 'desc'), limit(1000)))
  const out: GameRecord[] = []
  snap.forEach((d) => {
    try {
      const r = JSON.parse(String(d.data().json))
      if (validRecord(r)) out.push(r)
    } catch {
      /* skip */
    }
  })
  return out
}

// ------------------------------------------------------------------ groups
export type JoinMode = 'public' | 'private'
export type Role = 'owner' | 'admin' | 'member'
export interface Group {
  id: string
  name: string
  description: string
  joinMode: JoinMode
  ownerId: string
  memberCount: number
}
export interface Member {
  uid: string
  role: Role
  displayName: string
  handicap?: number
  handicapLast?: number
  provisional?: boolean
  games?: number
  wins?: number
}
export interface JoinRequest {
  uid: string
  displayName: string
}

const groupRef = (gid: string) => doc(db, 'groups', gid)
const memberRef = (gid: string, uid: string) => doc(db, 'groups', gid, 'members', uid)
const requestRef = (gid: string, uid: string) => doc(db, 'groups', gid, 'requests', uid)
const myName = () => {
  const u = current()
  return (u.displayName || (u.email ?? 'Player').split('@')[0]).slice(0, 40)
}

export async function listGroups(): Promise<Group[]> {
  init()
  const snap = await getDocs(query(collection(db, 'groups'), orderBy('memberCount', 'desc'), limit(200)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Group, 'id'>) }))
}

export async function createGroup(name: string, description: string, joinMode: JoinMode): Promise<string> {
  const u = current()
  const ref = doc(collection(db, 'groups'))
  const b = writeBatch(db)
  b.set(ref, {
    name: name.trim().slice(0, 60),
    description: description.trim().slice(0, 300),
    joinMode,
    ownerId: u.uid,
    memberCount: 1,
    lastMember: u.uid,
    createdAt: serverTimestamp(),
  })
  b.set(memberRef(ref.id, u.uid), { role: 'owner', displayName: myName(), joinedAt: serverTimestamp() })
  await b.commit()
  return ref.id
}

export interface GroupDetail {
  group: Group
  members: Member[]
  requests: JoinRequest[]
  myRole: Role | null
  myRequest: boolean
}

export async function getGroup(gid: string, uid: string | null): Promise<GroupDetail | null> {
  init()
  const g = await getDoc(groupRef(gid))
  if (!g.exists()) return null
  const group = { id: g.id, ...(g.data() as Omit<Group, 'id'>) }
  const ms = await getDocs(collection(db, 'groups', gid, 'members'))
  const members: Member[] = await Promise.all(
    ms.docs.map(async (d) => {
      const m = d.data() as { role: Role; displayName: string }
      const p = await getDoc(doc(db, 'users', d.id)).catch(() => null)
      const prof = (p?.exists() ? p.data() : {}) as Profile
      return {
        uid: d.id,
        role: m.role,
        displayName: prof.displayName ?? m.displayName,
        handicap: prof.handicap,
        handicapLast: prof.handicapLast,
        provisional: prof.provisional,
        games: prof.games,
        wins: prof.wins,
      }
    }),
  )
  const myRole = uid ? (members.find((m) => m.uid === uid)?.role ?? null) : null
  let requests: JoinRequest[] = []
  let myRequest = false
  if (uid && (myRole === 'owner' || myRole === 'admin')) {
    const rs = await getDocs(collection(db, 'groups', gid, 'requests'))
    requests = rs.docs.map((d) => ({ uid: d.id, displayName: String(d.data().displayName ?? 'Player') }))
  } else if (uid && !myRole) {
    myRequest = (await getDoc(requestRef(gid, uid)).catch(() => null))?.exists() ?? false
  }
  return { group, members, requests, myRole, myRequest }
}

export async function joinGroup(gid: string) {
  const u = current()
  const b = writeBatch(db)
  b.set(memberRef(gid, u.uid), { role: 'member', displayName: myName(), joinedAt: serverTimestamp() })
  b.update(groupRef(gid), { memberCount: increment(1), lastMember: u.uid })
  await b.commit()
}
export async function requestJoin(gid: string) {
  const u = current()
  await setDoc(requestRef(gid, u.uid), { displayName: myName(), createdAt: serverTimestamp() })
}
export async function cancelRequest(gid: string) {
  const u = current()
  const b = writeBatch(db)
  b.delete(requestRef(gid, u.uid))
  await b.commit()
}
export async function approveRequest(gid: string, r: JoinRequest) {
  current()
  const b = writeBatch(db)
  b.delete(requestRef(gid, r.uid))
  b.set(memberRef(gid, r.uid), {
    role: 'member',
    displayName: r.displayName.slice(0, 40) || 'Player',
    joinedAt: serverTimestamp(),
  })
  b.update(groupRef(gid), { memberCount: increment(1), lastMember: r.uid })
  await b.commit()
}
export async function declineRequest(gid: string, uid: string) {
  current()
  const b = writeBatch(db)
  b.delete(requestRef(gid, uid))
  await b.commit()
}
/** Leave (uid = me) or remove a member. */
export async function removeMember(gid: string, uid: string) {
  current()
  const b = writeBatch(db)
  b.delete(memberRef(gid, uid))
  b.update(groupRef(gid), { memberCount: increment(-1), lastMember: uid })
  await b.commit()
}
export async function setRole(gid: string, uid: string, role: 'admin' | 'member') {
  current()
  const b = writeBatch(db)
  b.update(memberRef(gid, uid), { role })
  await b.commit()
}
export async function editGroup(gid: string, patch: { name: string; description: string; joinMode: JoinMode }) {
  current()
  const b = writeBatch(db)
  b.update(groupRef(gid), {
    name: patch.name.trim().slice(0, 60),
    description: patch.description.trim().slice(0, 300),
    joinMode: patch.joinMode,
  })
  await b.commit()
}
export async function deleteGroup(gid: string) {
  current()
  const [ms, rs] = await Promise.all([
    getDocs(collection(db, 'groups', gid, 'members')),
    getDocs(collection(db, 'groups', gid, 'requests')),
  ])
  const b = writeBatch(db)
  ms.forEach((d) => b.delete(d.ref))
  rs.forEach((d) => b.delete(d.ref))
  b.delete(groupRef(gid))
  await b.commit()
}
