import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig, hasFirebase } from './config.js';

const app = hasFirebase ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

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
