import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig, hasFirebase } from './config.js';

const app = hasFirebase ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

/**
 * People never sign in. Each device quietly gets an anonymous Firebase session so the
 * database rules can tell the app apart from a stranger poking at the database directly.
 * Who someone is in the app is just the name they pick.
 */
export const connect = () => signInAnonymously(auth);
