import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { deleteField, doc, getDoc, getFirestore, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { firebaseConfig, hasFirebase } from './config.js';

const app = hasFirebase ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

export const watchAuth = (cb) => (auth ? onAuthStateChanged(auth, cb) : () => {});
export const signOutUser = () => signOut(auth);

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    // Home-screen apps and some in-app browsers block popups; fall back to a full-page redirect.
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
    } else {
      throw e;
    }
  }
}

/* ---------- Groups: the set of people who share ratings ---------- */

const me = (user) => ({ name: (user.displayName || user.email || 'Someone').split(' ')[0], photo: user.photoURL || null });
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/I)
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (n) => CODE_CHARS[n % CODE_CHARS.length]).join('');

/** Which group this person is in. cb(groupId | null). */
export function watchMyGroup(uid, cb, onError) {
  return onSnapshot(doc(db, 'users', uid), (snap) => cb(snap.data()?.groupId || null), onError);
}

/** Start a new group. Its id doubles as the invite code. */
export async function createGroup(user, name) {
  const code = newCode();
  await setDoc(doc(db, 'groups', code), { name: name.trim() || 'Movie night', members: { [user.uid]: me(user) }, shortlist: [], createdAt: serverTimestamp() });
  await setDoc(doc(db, 'users', user.uid), { groupId: code }, { merge: true });
  return code;
}

/** Join an existing group by invite code. */
export async function joinGroup(user, rawCode) {
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) throw new Error('Enter the invite code.');
  const ref = doc(db, 'groups', code);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('No group has that code. Check it and try again.');
  await updateDoc(ref, { [`members.${user.uid}`]: me(user) });
  await setDoc(doc(db, 'users', user.uid), { groupId: code }, { merge: true });
  return code;
}

/** Leave the group. Your ratings stay in it in case you come back. */
export async function leaveGroup(user, groupId) {
  await setDoc(doc(db, 'users', user.uid), { groupId: deleteField() }, { merge: true });
  await updateDoc(doc(db, 'groups', groupId), { [`members.${user.uid}`]: deleteField() }).catch(() => {});
}
