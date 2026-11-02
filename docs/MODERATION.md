# Moderation of user-generated content (App Store 1.2 / Google Play UGC)

User-generated content = group names/descriptions and display names (accounts are optional).

| Requirement | Where |
|---|---|
| Terms users must accept; zero tolerance for objectionable content / abusive users | `public/terms.html` (https://social-dart.vercel.app/terms). Sign-up has a required "I agree to the Terms of Use" checkbox (`Account.tsx`, `api.signUp` refuses without it) and stores `users/{uid}.termsAcceptedAt/termsVersion`. Accounts created before the terms existed see an "Agree and continue" gate in Groups before they can create/join (`needsTerms` in `App.tsx`). Bump `TERMS_VERSION` in `src/moderation.ts` when terms change. |
| Report content | Group page → "⚑ Report group"; ⋯ next to a member → Report (also on join requests). Reason: offensive / spam / harassment / other + optional text (`components/Moderation.tsx`). Confirmation: "Thanks, we'll review this within 24 hours." |
| Block users | ⋯ next to a member → Block. Hides the user (names, rankings, requests, their groups) from the blocker and the blocker from them. Manage/unblock: Profile → Blocked users. |
| Remove members | Group creator (and admins, for plain members): ⋯ → Remove from group. Removal also bans re-joining until the owner taps "Allow back" (Edit group → Removed members). |
| Rules | `firestore.rules` (reports, blocks, blockedBy, bans, terms keys). Tests: `tests/firestore.rules.test.ts` (`npm run test:rules`), `src/moderation.test.ts`. |

## Data
- `reports/{id}`: `reporterId, targetType ('group'|'user'), targetId, groupId?, targetName?, targetText?, reason, details?, status:'open', createdAt`. Name/description are snapshotted so reports stay reviewable after edits/deletes. Clients can only create; nobody can read/update/delete from the client.
- `users/{uid}/blocks/{other}`: `displayName, createdAt` (owner only).
- `users/{uid}/blockedBy/{blocker}`: `createdAt`; written by the blocker alongside their block; readable only by `{uid}`, used to hide the blocker from the blocked user. A blocked user can also no longer read the blocker's `users/{uid}` profile doc (enforced in rules).
- `groups/{gid}/bans/{uid}`: `displayName, by, createdAt` (owner/admin read).

## Reviewing reports (Stefan)
No email/notification backend exists (no Cloud Functions / Trigger Email extension, no Vercel API routes), so reports are stored in Firestore only.
Open https://console.firebase.google.com/project/social-dart-sg/firestore/databases/-default-/data/~2Freports , sort by `createdAt`, and check daily (the app promises review within 24 hours). `status` is `open`; edit it to `closed` in the console when handled.
To act: delete or rename the offending group (`groups/{gid}`), or the user's `displayName` in `users/{uid}`; to remove an abusive account use Authentication → Users → Delete. Email notifications can be added later with the Firebase "Trigger Email from Firestore" extension (needs Blaze plan + SMTP) watching `reports`.

## Deploying rules
`firebase deploy --only firestore:rules --project social-dart-sg`
