# Social Dart: iOS release runbook

The Capacitor 8 iOS project lives in `ios/App` and uses **Swift Package Manager**, so you don't need CocoaPods.
Bundle ID: **`za.co.sjgenterprises.socialdart`**. Version **1.0.0 (build 1)**. iPhone only, portrait only, iOS 15+.

## Only Stefan can do these
1. **Apple Developer Program**: enrol at <https://developer.apple.com/programs/enroll/> (US$99/yr). Enrol as an **Organisation** (needs a D-U-N-S number for SJG Enterprises; this can take days) if you want "SJG Enterprises" shown as the seller, or as an **Individual** (faster) to show your own name.
2. Note your **Team ID** (developer.apple.com → Membership details).
3. **Confirm the bundle ID** `za.co.sjgenterprises.socialdart`. It is permanent once the app is created in App Store Connect. To change it, edit `capacitor.config.ts` and `PRODUCT_BUNDLE_IDENTIFIER` in Xcode (Signing & Capabilities) before the first upload.
4. Signing: Xcode "Automatically manage signing" handles the certificates and profiles.
5. App Store Connect: create the app record, fill in the listing, answer age rating and privacy, add screenshots, then submit.
6. Optional: on the Mac, run `xcrun simctl` screenshots, or use a real iPhone for screenshots.

## 0. Mac prerequisites (one time)
- macOS with **Xcode 16 or newer** (App Store). Open it once and accept the licence. Install an iOS Simulator runtime (Xcode → Settings → Components).
- **Node.js 22 or newer** (Capacitor 8 CLI needs it): `brew install node@22`, or use nvm: `nvm install 22`.
- Xcode → Settings → Accounts → **+** → sign in with your Apple ID (the one in the Developer Program).

## 1. Get the code and build the web bundle into iOS
```bash
git clone https://github.com/Sgerber90/social-dart.git
cd social-dart
npm ci                 # or: npm i
npm test               # 134 unit tests
npm run ios:sync       # vite build (bakes Firebase config from .env.production) + cap sync ios
npm run ios:open       # opens ios/App/App.xcodeproj in Xcode
```
On first open, Xcode resolves Swift packages (capacitor-swift-pm plus the local plugin packages). Wait for "Resolving Package Graph" to finish.
Run `npm run ios:sync` again after **every** web change. The built web app (`ios/App/App/public`) is git-ignored and gets regenerated.

## 2. Signing in Xcode
1. In the left navigator select **App** (blue project icon), then **TARGETS → App**, then **Signing & Capabilities**.
2. Tick **Automatically manage signing**. Set **Team** to your team.
3. Check that **Bundle Identifier** is `za.co.sjgenterprises.socialdart`.
4. On **General**, check Display Name **Social Dart**, Version **1.0.0**, Build **1**, iPhone only, Portrait.

## 3. Run it
- **Simulator**: pick an "iPhone 16 Pro" (or similar) next to the scheme **App**, then ⌘R.
- **Device**: plug in the iPhone, then Settings → Privacy & Security → **Developer Mode** on (the phone reboots). Select the phone in Xcode and press ⌘R. Trust the developer if asked.
- Smoke test: start a 501 game (haptics on scoring), check the notch and home-indicator spacing, create an account, sign out and sign back in, kill and relaunch the app (you should stay signed in), and run Profile → **Delete account** on a test account. Privacy and Support links should open and their "← Social Dart" link should return to the app.

## 4. Create the App Store Connect record
<https://appstoreconnect.apple.com> → Apps → **+ New App**: Platform iOS, Name **Social Dart**, Primary language English (U.K.) or (U.S.), Bundle ID `za.co.sjgenterprises.socialdart` (if it isn't listed, register it at developer.apple.com → Identifiers, or just archive once with automatic signing), SKU `social-dart-ios`, User access Full.

## 5. Archive and upload
1. Set the run destination to **Any iOS Device (arm64)**.
2. **Product → Archive**. When it finishes, the Organizer opens.
3. **Distribute App → App Store Connect → Upload**. Keep the defaults (automatic signing, upload symbols).
4. After 5–30 min the build shows up in App Store Connect → TestFlight. Encryption export compliance is already answered (`ITSAppUsesNonExemptEncryption = NO` in Info.plist).
5. For every later upload, bump **Build** (2, 3, …). Bump **Version** for each public release.

## 6. TestFlight
- **Internal testing**: TestFlight → Internal Testing → + group → add yourself and up to 100 team members. Builds are available right away.
- **External testing** (friends): + external group, add emails or a public link. The first build needs a short Beta App Review. Fill in "What to test" and give a reviewer test account.

## 7. Submit for review
In the app's **1.0 Prepare for Submission** page, fill in the listing below, pick the build, and add **App Review Information**: contact details plus a **demo account** (create one in the app, e.g. `review@sjgenterprises.co.za` with a password). Mention: "Accounts are optional. Account deletion: Profile → Delete account." Then **Add for Review → Submit**.

---

## App Store Connect listing (draft)

| Field | Value |
|---|---|
| Name (30) | **Social Dart** |
| Subtitle (30) | **Darts scorer for pub & home** |
| Primary category | **Sports** |
| Secondary category | **Games → Board** (or Games → Sports) |
| Price | Free |
| Privacy Policy URL | https://social-dart.vercel.app/privacy |
| Support URL | https://social-dart.vercel.app/support |
| Marketing URL (optional) | https://social-dart.vercel.app |
| Copyright | © 2026 SJG Enterprises |
| Promotional text (170) | Score 501, Cricket, Killer and more in seconds. Tap the board, get checkout hints, and keep a fair handicap for every player. |

**Keywords** (100 chars, comma separated, no spaces):
`darts,scorer,501,301,cricket,killer,checkout,dartboard,handicap,pub,score,counter,around the clock`

**Description**
```
Social Dart is a fast, friendly darts scorer built for the pub, the garage and league night.

Tap where your dart landed on a real dartboard, or use the quick keypad, and Social Dart does the maths: remaining score, busts, checkouts and the winner.

GAMES
• 501 and 301
• Cricket
• Killer
• 1 to 7 race with the bounce rule
• Close Out
• Around the Clock

FEATURES
• Checkout suggestions as you play
• Player roster with colours, stats, win rates and game history
• Fair handicaps that adjust with every game, so beginners and sharpshooters can play together
• Runner-up placings for multi-player games
• Works offline. No account needed to play.

OPTIONAL ACCOUNT
• Sync your handicap and games across devices
• Create or join public and private groups and compare handicaps with your mates
• Delete your account at any time from your profile

No ads. No tracking.
```

**What's New (1.0.0)**: First release.

### Age rating questionnaire
Answer **None / No** to everything: cartoon or realistic violence, sexual content or nudity, profanity, horror, drugs, alcohol or tobacco references, simulated gambling, mature themes, medical info, contests. Unrestricted web access: **No**. User-generated content: groups show display names and group names chosen by users. Answer the "user-generated content / messaging" questions **No** (there is no chat; names are limited to 40/60 characters). Parental controls: No. Age assurance: No. **Result: 4+.**
> If Apple flags darts or pub imagery as alcohol-related, there is none in the app; keep "Alcohol, Tobacco, or Drug Use" = None.

### App Privacy (nutrition labels)
Data collection: **Yes, we collect data.** Tracking: **No** (no data is used for tracking).

| Data type | Collected | Linked to user | Tracking | Purpose |
|---|---|---|---|---|
| Contact Info → **Email Address** | Yes | Yes | No | App Functionality |
| Contact Info → **Name** (display name) | Yes | Yes | No | App Functionality |
| Identifiers → **User ID** (Firebase UID) | Yes | Yes | No | App Functionality |
| User Content → **Gameplay Content** (synced games, handicap, wins, groups) | Yes | Yes | No | App Functionality |

Everything else: Not collected (no analytics, no crash SDK, no location, no ads). These match `ios/App/App/PrivacyInfo.xcprivacy`.

### Screenshots needed
The app is **iPhone only**, so no iPad screenshots are required.
- **6.9" display** (required): 1320 × 2868 portrait (iPhone 16 Pro Max simulator) *or* 1290 × 2796 (iPhone 15 Pro Max). App Store Connect scales these down for smaller iPhones.
- Optional 6.5": 1284 × 2778 or 1242 × 2688.
- 3–10 per size, PNG or JPEG, no alpha. Suggested shots: game setup, 501 in progress with the dartboard, checkout hint, Cricket, stats/handicaps, groups.
- How: run on the "iPhone 16 Pro Max" simulator and press ⌘S (saves to the Desktop at the right size).

---

## What's already in the repo
- `capacitor.config.ts`: appId, appName, `webDir: dist`, dark background, splash and status bar config.
- `ios/App`: Xcode project (SPM). `Info.plist` has Social Dart, portrait, `ITSAppUsesNonExemptEncryption=false`, arm64, and no permission strings (the app uses no camera, location, etc.). `PrivacyInfo.xcprivacy` is part of the target's resources.
- App icon 1024×1024 (no alpha) and 2732×2732 splash in `Assets.xcassets`. Regenerate them with `npm run ios:assets` (needs Chrome + Pillow).
- Native behaviour: the service worker is not registered in the native app. Firebase Auth uses `initializeAuth` with IndexedDB persistence (no popup iframe). The status bar uses light text. Safe areas use `viewport-fit=cover` and `env(safe-area-inset-*)`. The Taptic Engine is used via `@capacitor/haptics`.
- Firebase web config is committed in `.env.production` (public by design), so every build has accounts enabled.
- In-app **Delete account** (Profile): deletes owned groups, memberships and requests, synced games, the profile, and then the Auth user. It asks for the password (Firebase requires a recent login). Covered by the rules tests in `tests/firestore.rules.test.ts`.
- Privacy policy: https://social-dart.vercel.app/privacy. Support: https://social-dart.vercel.app/support (contact info@sjgenterprises.co.za). Both are linked from the Profile screen.

## Troubleshooting
- **"The Capacitor CLI requires NodeJS >=22"**: upgrade Node.
- **Packages fail to resolve**: File → Packages → Reset Package Caches. Run `npm ci && npm run ios:sync` again (the SPM plugin packages point into `node_modules`).
- **White screen**: you forgot `npm run ios:sync`, so `ios/App/App/public` is empty.
- **"No account for team"**: Xcode → Settings → Accounts, sign in, then reselect the Team.
- **Sign-in hangs**: check the device has internet. Email/password auth doesn't need extra Firebase authorised domains.
