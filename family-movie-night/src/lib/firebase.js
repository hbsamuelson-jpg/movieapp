import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithPopup, signOut } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { firebaseConfig, hasFirebase } from './config.js';

const app = hasFirebase ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
/**
 * The database keeps a copy of everything it has read on the device (in the browser's IndexedDB),
 * shared between tabs. That copy is what lets the app ask the server only for what changed since
 * last time instead of re-reading every movie on every visit (see store.js). Where the browser
 * has no IndexedDB (some private windows), Firebase falls back to an in-memory copy by itself.
 */
function openDb() {
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    return getFirestore(app);
  }
}
export const db = app ? openDb() : null;
// Local testing against the Firebase emulators (npm run emulators), never the real project.
if (app && import.meta.env.VITE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

/**
 * Two kinds of session, both allowed by the database rules:
 *   anonymous — the default. The device gets a quiet session and the person just picks a name.
 *   Google    — optional. A name can be linked to a Google account; signing in with that
 *               account on any device then opens straight into that name.
 * Calls cb(user) with the current Firebase user (never null: with nobody signed in, an
 * anonymous session is started first). Returns a stop function.
 */
export function watchSession(cb, onError) {
  return onAuthStateChanged(auth, (user) => {
    if (user) cb(user);
    else signInAnonymously(auth).catch(onError);
  }, onError);
}

export const signInWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());

/** Signing out of Google drops back to an anonymous session (watchSession starts it). */
export const signOutGoogle = () => signOut(auth);

/** A short-lived proof of this device's session, sent to the assistant so it only answers the app. */
export const idToken = () => auth.currentUser.getIdToken();
