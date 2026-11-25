// Two interchangeable stores with the same interface:
//   subscribe(cb)                    -> unsubscribe;  cb({ entries, profiles })
//   setRating(movie, profileId, rating | null)
//   updateMovie(movie)               -> refresh stored movie details
//   saveProfiles(profiles)
// The local store powers Demo Mode; the Firestore store syncs across devices.

import { collection, deleteField, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { DEFAULT_PROFILES } from './config.js';
import { demoEntries } from './demoData.js';
import { db } from './firebase.js';

const LOCAL_KEY = 'fmn-demo-v2';

export function createLocalStore() {
  const seed = () => ({ profiles: DEFAULT_PROFILES, entries: demoEntries() });
  let state;
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY));
    state = saved?.entries && saved?.profiles ? saved : seed();
  } catch {
    state = seed();
  }
  const listeners = new Set();
  const commit = (next) => {
    state = next;
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch { /* storage unavailable: keep in memory */ }
    listeners.forEach((cb) => cb(state));
  };

  return {
    kind: 'local',
    subscribe(cb) {
      listeners.add(cb);
      cb(state);
      return () => listeners.delete(cb);
    },
    setRating(movie, profileId, rating) {
      const id = String(movie.id);
      const prev = state.entries[id] || { movie, ratings: {} };
      const ratings = { ...prev.ratings };
      if (rating) ratings[profileId] = rating;
      else delete ratings[profileId];
      const entries = { ...state.entries };
      if (Object.keys(ratings).length) entries[id] = { movie: prev.movie.detailed ? prev.movie : movie, ratings };
      else delete entries[id];
      commit({ ...state, entries });
    },
    updateMovie(movie) {
      const id = String(movie.id);
      if (!state.entries[id]) return;
      commit({ ...state, entries: { ...state.entries, [id]: { ...state.entries[id], movie } } });
    },
    saveProfiles(profiles) {
      commit({ ...state, profiles });
    },
    reset() {
      commit(seed());
    },
  };
}

export function createFirestoreStore(uid) {
  const household = doc(db, 'households', uid);
  const movies = collection(household, 'movies');

  return {
    kind: 'firestore',
    subscribe(cb, onError) {
      let profiles = null;
      let entries = null;
      const emit = () => profiles && entries && cb({ profiles, entries });
      const stopHousehold = onSnapshot(household, (snap) => {
        if (!snap.exists()) {
          // First sign-in: create the household with the three default profiles.
          setDoc(household, { profiles: DEFAULT_PROFILES, createdAt: serverTimestamp() });
          profiles = DEFAULT_PROFILES;
        } else {
          profiles = snap.data().profiles || DEFAULT_PROFILES;
        }
        emit();
      }, onError);
      const stopMovies = onSnapshot(movies, (snap) => {
        entries = {};
        snap.forEach((d) => {
          const data = d.data();
          if (data.ratings && Object.keys(data.ratings).length) entries[d.id] = data;
        });
        emit();
      }, onError);
      return () => { stopHousehold(); stopMovies(); };
    },
    setRating(movie, profileId, rating) {
      return setDoc(
        doc(movies, String(movie.id)),
        { movie, ratings: { [profileId]: rating || deleteField() }, updatedAt: serverTimestamp() },
        { merge: true },
      );
    },
    updateMovie(movie) {
      return setDoc(doc(movies, String(movie.id)), { movie }, { merge: true });
    },
    saveProfiles(profiles) {
      return setDoc(household, { profiles }, { merge: true });
    },
  };
}
