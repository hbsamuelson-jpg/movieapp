// Two interchangeable stores with the same interface:
//   subscribe(cb, onError)   -> unsubscribe;  cb({ members, entries, shortlist, vote, history })
//   addMember(name)          -> the new (or existing, if the name is taken) member id
//   removeMember(id)
//   linkMember(id, uid | null)   tie a name to a Google account, or untie it
//   setFavorites(id, movies)     a person's all-time favourites
//   setGenreRank(id, names | null)   a person's genres in order, favourite first
//   setRating(movie, memberId, rating | null)
//   updateMovie(movie)       refresh stored movie details
//   setShortlist(movies)     tonight's shortlist
//   startVote(movies, voterIds)            open a secret ballot on those movies
//   castVote(memberId, picks, previous)    vote, or change a vote. picks and previous are movie ids, best first
//   endVote()                              close it and show the result
//   clearVote()                            remove it
//   addHistory(entry) / removeHistory(id)  the log of movies watched together
//   snooze(memberId, movieId, until | null)  hide a movie from that person's suggestions until a date
//   saveMarathon(marathon) / removeMarathon(id)   a series or director laid out over several nights
//   addMember(name, uid, { guest: true, until })  a guest for one night: removed automatically after `until`
//
// A vote is stored as { id, open, ranked, options: [movie], voters: [id], voted: [id], tally: { movieId: n } }.
// In a ranked vote each person orders up to three movies, worth 3, 2 and 1 points.
// Who has voted and how many votes each movie has are kept separately, so nothing stored says
// who voted for what. Each device remembers its own choice so it can be changed.
// The local store keeps everything in one browser. The shared store keeps it in Firestore,
// so every device that opens the site sees the same names, ratings and shortlist.

import { arrayUnion, collection, deleteField, doc, FieldPath, getDocsFromCache, increment, onSnapshot, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import { pref, spaceId as defaultSpace } from './config.js';
import { db } from './firebase.js';
import { voteDeltas } from './votes.js';

const LOCAL_KEY = 'fmn-local-v4';
const newId = () => Math.random().toString(36).slice(2, 10);
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const byName = (a, b) => a.name.localeCompare(b.name);
export const newId8 = () => newId();
export const slim = (m) => ({ id: m.id, title: m.title, year: m.year || null, poster: m.poster || null });
const newVote = (movies, voters) => ({ id: newId(), open: true, ranked: movies.length >= 3, options: movies.map(slim), voters, voted: [], tally: {} });
export function createLocalStore() {
  let state = { members: [], entries: {}, shortlist: [], vote: null, history: [], services: [], marathons: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY));
    if (saved?.members) state = { members: saved.members, entries: saved.entries || {}, shortlist: saved.shortlist || [], vote: saved.vote || null, history: saved.history || [], services: saved.services || [], marathons: saved.marathons || [] };
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
    addMember(name, uid = null, extra = {}) {
      const existing = state.members.find((m) => sameName(m.name, name));
      if (existing) return existing.id;
      const member = { id: newId(), name: name.trim(), ...extra };
      commit({ ...state, members: [...state.members, member].sort(byName) });
      return member.id;
    },
    removeMember(id) {
      commit({ ...state, members: state.members.filter((m) => m.id !== id) });
    },
    linkMember() { /* Google linking needs the shared store */ },
    setFavorites(id, favorites) {
      commit({ ...state, members: state.members.map((m) => (m.id === id ? { ...m, favorites } : m)) });
    },
    setGenreRank(id, genreRank) {
      commit({ ...state, members: state.members.map((m) => (m.id === id ? { ...m, genreRank: genreRank || null } : m)) });
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
    startVote(movies, voters) {
      commit({ ...state, vote: newVote(movies, voters) });
    },
    castVote(memberId, picks, previous = []) {
      const { vote } = state;
      if (!vote?.open) return;
      const tally = { ...vote.tally };
      for (const [id, d] of Object.entries(voteDeltas(vote, picks, previous))) tally[id] = Math.max(0, (tally[id] || 0) + d);
      commit({ ...state, vote: { ...vote, tally, voted: vote.voted.includes(memberId) ? vote.voted : [...vote.voted, memberId] } });
    },
    endVote() {
      if (state.vote) commit({ ...state, vote: { ...state.vote, open: false } });
    },
    clearVote() {
      commit({ ...state, vote: null });
    },
    addHistory(entry) {
      commit({ ...state, history: [...state.history, entry] });
    },
    removeHistory(id) {
      commit({ ...state, history: state.history.filter((h) => h.id !== id) });
    },
    saveMarathon(marathon) {
      commit({ ...state, marathons: [...(state.marathons || []).filter((x) => x.id !== marathon.id), marathon] });
    },
    removeMarathon(id) {
      commit({ ...state, marathons: (state.marathons || []).filter((x) => x.id !== id) });
    },
    snooze(memberId, movieId, until) {
      commit({ ...state, members: state.members.map((m) => {
        if (m.id !== memberId) return m;
        const snoozed = { ...(m.snoozed || {}) };
        if (until) snoozed[movieId] = until; else delete snoozed[movieId];
        return { ...m, snoozed };
      }) });
    },
  };
}

const FULL_SYNC_EVERY = 7 * 24 * 60 * 60 * 1000;
/** For checking how much the app reads: how the movie list was loaded and how many movies came from the server. */
export const stats = { mode: null, serverDocs: 0 };
if (typeof window !== 'undefined') window.__fmnSync = stats;

/** One shared space per site. Everyone who opens the site lands in it. */
export function createSharedStore(spaceId = defaultSpace) {
  const space = doc(db, 'groups', spaceId);
  const movies = collection(space, 'movies');
  let members = [];
  let history = [];
  let marathons = [];
  let currentVote = null;

  return {
    kind: 'shared',
    subscribe(cb, onError) {
      let head = null;
      let entries = null;
      const emit = () => head && entries && cb({ ...head, entries });
      const stopSpace = onSnapshot(space, (snap) => {
        const data = snap.data() || {}; // no document yet: nobody has added a name
        members = Object.entries(data.members || {}).map(([id, m]) => ({ id, name: m.name || 'Someone', uid: m.uid || null, favorites: m.favorites || [], snoozed: m.snoozed || {}, genreRank: m.genreRank || null, guest: Boolean(m.guest), until: m.until || null })).sort(byName);
        history = data.history || [];
        currentVote = data.vote || null;
        marathons = data.marathons || [];
        head = { members, shortlist: data.shortlist || [], vote: currentVote, history, services: data.services || [], marathons };
        emit();
      }, onError);

      // Movies. Reading the whole collection costs one database read per movie, on every visit,
      // on every phone. So after one full read, a device keeps its copy and from then on asks
      // only for movies changed since the newest one it has (every write stamps `updatedAt`).
      // A full read is repeated weekly as a safety net.
      const syncKey = `synced:${spaceId}`;
      const all = {};
      let stopMovies = () => {};
      let stopped = false;
      const publish = () => {
        entries = {};
        for (const [id, data] of Object.entries(all)) if (data.ratings && Object.keys(data.ratings).length) entries[id] = data;
        emit();
      };
      const count = (snap) => { if (!snap.metadata.fromCache) stats.serverDocs += snap.docChanges().length; };
      const listenToAll = () => {
        stats.mode = 'full';
        stopMovies = onSnapshot(movies, { includeMetadataChanges: true }, (snap) => {
          count(snap);
          for (const id of Object.keys(all)) delete all[id];
          snap.forEach((d) => { all[d.id] = d.data(); });
          publish();
          if (!snap.metadata.fromCache) pref.set(syncKey, Date.now()); // the device's copy is complete as of now
        }, onError);
      };
      const listenToChanges = async () => {
        const cached = await getDocsFromCache(movies);
        if (stopped) return;
        if (!cached.size) { listenToAll(); return; }
        let newest = 0;
        cached.forEach((d) => { all[d.id] = d.data(); newest = Math.max(newest, d.data().updatedAt?.toMillis?.() || 0); });
        publish();
        stats.mode = 'changes';
        // Ten minutes of overlap covers a write that was in flight during the last visit.
        const since = Timestamp.fromMillis(Math.max(0, newest - 10 * 60 * 1000));
        stopMovies = onSnapshot(query(movies, where('updatedAt', '>', since)), (snap) => {
          count(snap);
          snap.docChanges().forEach((change) => { if (change.type !== 'removed') all[change.doc.id] = change.doc.data(); });
          publish();
        }, onError);
      };
      const lastFull = pref.get(syncKey, 0);
      if (Date.now() - lastFull < FULL_SYNC_EVERY) listenToChanges().catch(() => { if (!stopped) listenToAll(); });
      else listenToAll();
      return () => { stopped = true; stopSpace(); stopMovies(); };
    },
    addMember(name, uid = null, extra = {}) {
      // A name that already exists is reused only if nobody has linked it to a Google account.
      const existing = members.find((m) => sameName(m.name, name) && !m.uid);
      if (existing) {
        if (uid) this.linkMember(existing.id, uid);
        return existing.id;
      }
      const id = newId();
      setDoc(space, { members: { [id]: { name: name.trim(), joinedAt: serverTimestamp(), ...(uid ? { uid } : {}), ...extra } } }, { merge: true });
      return id;
    },
    /** Ratings are stored under the member id, so linking moves nothing: the name just gains an owner. */
    linkMember(id, uid) {
      return setDoc(space, { members: { [id]: { uid: uid || deleteField() } } }, { merge: true });
    },
    removeMember(id) {
      return setDoc(space, { members: { [id]: deleteField() } }, { merge: true });
    },
    setFavorites(id, favorites) {
      // updateDoc with a dotted path replaces just this person's list (a merge would not shrink it).
      return updateDoc(space, { [`members.${id}.favorites`]: favorites });
    },
    setGenreRank(id, genreRank) {
      return updateDoc(space, { [`members.${id}.genreRank`]: genreRank || deleteField() });
    },
    setRating(movie, memberId, rating) {
      // mergeFields replaces this person's rating outright. A plain merge would blend the new
      // rating into the old one and leave stale fields behind (e.g. the mark left by a ranking).
      return setDoc(
        doc(movies, String(movie.id)),
        { movie, ratings: { [memberId]: rating || deleteField() }, updatedAt: serverTimestamp() },
        { mergeFields: ['movie', new FieldPath('ratings', memberId), 'updatedAt'] },
      );
    },
    updateMovie(movie) {
      return setDoc(doc(movies, String(movie.id)), { movie, updatedAt: serverTimestamp() }, { merge: true });
    },
    setShortlist(shortlist) {
      return setDoc(space, { shortlist }, { merge: true });
    },
    startVote(movies, voters) {
      return updateDoc(space, { vote: newVote(movies, voters) });
    },
    castVote(memberId, picks, previous = []) {
      if (!currentVote?.open) return undefined;
      // Separate, atomic updates in one write: "this person has voted" and the change to each total.
      const change = { 'vote.voted': arrayUnion(memberId) };
      for (const [id, d] of Object.entries(voteDeltas(currentVote, picks, previous))) change[`vote.tally.${id}`] = increment(d);
      return updateDoc(space, change);
    },
    endVote() {
      return updateDoc(space, { 'vote.open': false });
    },
    clearVote() {
      return updateDoc(space, { vote: deleteField() });
    },
    addHistory(entry) {
      return setDoc(space, { history: arrayUnion(entry) }, { merge: true });
    },
    removeHistory(id) {
      return updateDoc(space, { history: history.filter((h) => h.id !== id) });
    },
    saveMarathon(marathon) {
      return setDoc(space, { marathons: [...marathons.filter((x) => x.id !== marathon.id), marathon] }, { mergeFields: ['marathons'] });
    },
    removeMarathon(id) {
      return updateDoc(space, { marathons: marathons.filter((x) => x.id !== id) });
    },
    snooze(memberId, movieId, until) {
      return updateDoc(space, { [`members.${memberId}.snoozed.${movieId}`]: until || deleteField() });
    },
  };
}
