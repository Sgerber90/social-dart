# Android release (Google Play)

Capacitor 8 Android project in `android/` · package `za.co.sjgenterprises.socialdart` · versionCode 2 / versionName 1.0.1 · minSdk 24 (Capacitor default) · targetSdk/compileSdk 36.

## Toolchain
- Node ≥ 22, JDK 21, Android SDK (platform 36, build-tools). On the box: `JAVA_HOME=~/jdk`, `ANDROID_HOME=~/android-sdk`, node 22 at `~/node-v22.21.0-linux-x64/bin`.
- `android/local.properties` (`sdk.dir=...`) is gitignored.

## Scripts
| Script | What it does |
|---|---|
| `npm run android:assets` | Renders icon/splash sources from `public/board.svg` into `assets/`, then runs `@capacitor/assets` to generate adaptive icons + splash in `android/` |
| `npm run android:sync` | `npm run build && cap sync android` |
| `npm run android:open` | Open in Android Studio |
| `npm run android:run` | Sync and run on a device/emulator |
| `npm run android:bundle` | Sync, then `./gradlew bundleRelease assembleDebug` |

Outputs: `android/app/build/outputs/bundle/release/app-release.aab`, `android/app/build/outputs/apk/debug/app-debug.apk`.

## Signing (upload key)
Release signing is read from `android/keystore.properties` (gitignored) or env vars:
```
storeFile=/workspace/secrets/socialdart-upload.jks
storePassword=...
keyAlias=upload
keyPassword=...
```
Env fallback: `SOCIALDART_KEYSTORE`, `SOCIALDART_KEYSTORE_PASSWORD`, `SOCIALDART_KEY_ALIAS`, `SOCIALDART_KEY_PASSWORD`.
Keystore and password live only in `/workspace/secrets/` (never commit; back them up). Enrol in Play App Signing so Google holds the app signing key; if the upload key is lost, request an upload-key reset in Play Console.
Without signing config, `bundleRelease` produces an unsigned bundle.

## Releasing an update
1. Bump `versionCode` (+1) and `versionName` in `android/app/build.gradle`.
2. `npm test && npm run android:bundle`.
3. Upload the AAB in Play Console (closed testing → production).

## Behaviour notes
- Phones are locked to portrait; tablets (smallest width ≥ 600dp) rotate (`MainActivity.java`).
- Edge-to-edge is enforced at targetSdk 35+; the web UI uses `env(safe-area-inset-*)`, which Capacitor 8 provides on Android.
- Firebase auth uses IndexedDB persistence and the service worker is disabled on native (same as iOS).
- Screenshots: `?demo=<scene>` (1, closeout, 501, 1to7, stats, players) rendered with Playwright at 360×640@3 (1080×1920) and 1280×800@2 / 800×1280@2.

## Play Console
Store listing, content rating, data safety and target audience answers: see `/workspace/socialdart-play/listing.md` (box). Account deletion URL: https://social-dart.vercel.app/delete-account.
New personal developer accounts must run a closed test with ≥12 testers opted in for 14 consecutive days before production access.
