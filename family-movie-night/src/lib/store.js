// Two interchangeable stores with the same interface:
//   subscribe(cb, onError)   -> unsubscribe;  cb({ members, entries, shortlist })
//   addMember(name)          -> the new (or existing, if the name is taken) member id
//   removeMember(id)
//   setRating(movie, memberId, rating | null)
//   updateMovie(movie)       refresh stored movie details
//   setShortlist(movies)     tonight's shortlist
// The local store keeps everything in one browser. The shared store keeps it in Firestore,
// so every device that opens the site sees the same names, ratings and shortlist.

import { collection, deleteField, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';

const LOCAL_KEY = 'fmn-local-v4';
const newId = () => Math.random().toString(36).slice(2, 10);
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const byName = (a, b) => a.name.localeCompare(b.name);

export function createLocalStore() {
  let state = { members: [], entries: {}, shortlist: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY));
    if (saved?.members) state = { members: saved.members, entries: saved.entries || {}, shortlist: saved.shortlist || [] };
  } catch { /* start empty */ }
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
    addMember(name) {
      const existing = state.members.find((m) => sameName(m.name, name));
      if (existing) return existing.id;
      const member = { id: newId(), name: name.trim() };
      commit({ ...state, members: [...state.members, member].sort(byName) });
      return member.id;
    },
    removeMember(id) {
      commit({ ...state, members: state.members.filter((m) => m.id !== id) });
    },
    setRating(movie, memberId, rating) {
      const id = String(movie.id);
      const prev = state.entries[id] || { movie, ratings: {} };
      const ratings = { ...prev.ratings };
      if (rating) ratings[memberId] = rating;
      else delete ratings[memberId];
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
    setShortlist(shortlist) {
      commit({ ...state, shortlist });
    },
  };
}

/** One shared space per site. Everyone who opens the site lands in it. */
export function createSharedStore(spaceId = 'family') {
  const space = doc(db, 'groups', spaceId);
  const movies = collection(space, 'movies');
  let members = [];

  return {
    kind: 'shared',
    subscribe(cb, onError) {
      let head = null;
      let entries = null;
      const emit = () => head && entries && cb({ ...head, entries });
      const stopSpace = onSnapshot(space, (snap) => {
        const data = snap.data() || {}; // no document yet: nobody has added a name
        members = Object.entries(data.members || {}).map(([id, m]) => ({ id, name: m.name || 'Someone' })).sort(byName);
        head = { members, shortlist: data.shortlist || [] };
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
      return () => { stopSpace(); stopMovies(); };
    },
    addMember(name) {
      const existing = members.find((m) => sameName(m.name, name));
      if (existing) return existing.id;
      const id = newId();
      setDoc(space, { members: { [id]: { name: name.trim(), joinedAt: serverTimestamp() } } }, { merge: true });
      return id;
    },
    removeMember(id) {
      return setDoc(space, { members: { [id]: deleteField() } }, { merge: true });
    },
    setRating(movie, memberId, rating) {
      return setDoc(
        doc(movies, String(movie.id)),
        { movie, ratings: { [memberId]: rating || deleteField() }, updatedAt: serverTimestamp() },
        { merge: true },
      );
    },
    updateMovie(movie) {
      return setDoc(doc(movies, String(movie.id)), { movie }, { merge: true });
    },
    setShortlist(shortlist) {
      return setDoc(space, { shortlist }, { merge: true });
    },
  };
}
