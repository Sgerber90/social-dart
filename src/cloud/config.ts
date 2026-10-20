// Optional accounts. Without these (public) Firebase web config values the app is guest-only.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
}

/** Accounts & groups are on only when configured and not switched off with VITE_ACCOUNTS=off. */
export const cloudEnabled =
  !!firebaseConfig.apiKey && !!firebaseConfig.projectId && import.meta.env.VITE_ACCOUNTS !== 'off'
