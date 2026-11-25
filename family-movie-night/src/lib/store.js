// Two interchangeable stores with the same interface:
//   subscribe(cb, onError)   -> unsubscribe;  cb({ members, entries, shortlist, group })
//   setRating(movie, rating | null)        the signed-in person's own rating
//   updateMovie(movie)                     refresh stored movie details
//   setShortlist(movies)                   tonight's shortlist, shared by the group
// The local store keeps everything on one device for one person.
// The group store keeps it in Firestore, shared live between everyone in the group.

import { collection, deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { LOCAL_MEMBER } from './config.js';
import { db } from './firebase.js';

const LOCAL_KEY = 'fmn-local-v3';

export function createLocalStore() {
  let state = { entries: {}, shortlist: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY));
    if (saved?.entries) state = { entries: saved.entries, shortlist: saved.shortlist || [] };
  } catch { /* start empty */ }
  const listeners = new Set();
  const view = () => ({ ...state, members: [LOCAL_MEMBER], group: null });
  const commit = (next) => {
    state = next;
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch { /* storage unavailable: keep in memory */ }
    listeners.forEach((cb) => cb(view()));
  };

  return {
    kind: 'local',
    me: LOCAL_MEMBER.id,
    subscribe(cb) {
      listeners.add(cb);
      cb(view());
      return () => listeners.delete(cb);
    },
    setRating(movie, rating) {
      const id = String(movie.id);
      const prev = state.entries[id];
      const entries = { ...state.entries };
      if (rating) entries[id] = { movie: prev?.movie?.detailed ? prev.movie : movie, ratings: { [LOCAL_MEMBER.id]: rating } };
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
    clearAll() {
      commit({ entries: {}, shortlist: [] });
    },
  };
}

export function createGroupStore(groupId, uid) {
  const group = doc(db, 'groups', groupId);
  const movies = collection(group, 'movies');

  return {
    kind: 'group',
    me: uid,
    subscribe(cb, onError) {
      let head = null;
      let entries = null;
      const emit = () => head && entries && cb({ ...head, entries });
      const stopGroup = onSnapshot(group, (snap) => {
        const data = snap.data();
        if (!data) { onError?.({ code: 'group-missing' }); return; }
        const members = Object.entries(data.members || {})
          .map(([id, m]) => ({ id, name: m.name || 'Someone', photo: m.photo || null }))
          .sort((a, b) => a.name.localeCompare(b.name));
        head = { members, shortlist: data.shortlist || [], group: { id: groupId, name: data.name || 'Movie night' } };
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
      return () => { stopGroup(); stopMovies(); };
    },
    setRating(movie, rating) {
      return setDoc(
        doc(movies, String(movie.id)),
        { movie, ratings: { [uid]: rating || deleteField() }, updatedAt: serverTimestamp() },
        { merge: true },
      );
    },
    updateMovie(movie) {
      return setDoc(doc(movies, String(movie.id)), { movie }, { merge: true });
    },
    setShortlist(shortlist) {
      return updateDoc(group, { shortlist });
    },
  };
}
