import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListOrdered, LogOut, Search, Settings2, Star, Ticket } from 'lucide-react';
import Browse from './components/Browse.jsx';
import MyTickets from './components/MyTickets.jsx';
import Profiles from './components/Profiles.jsx';
import RateSheet from './components/RateSheet.jsx';
import Queue from './components/Queue.jsx';
import Rate from './components/Rate.jsx';
import { Avatar } from './components/ui.jsx';
import { applyUpdate, buildLabel, watchForUpdates } from './lib/autoUpdate.js';
import { hasFirebase } from './lib/config.js';
import { signInWithGoogle, signOutUser, watchAuth } from './lib/firebase.js';
import { createFirestoreStore, createLocalStore } from './lib/store.js';
import { enrich } from './lib/tmdb.js';

const TABS = [
  { id: 'queue', label: 'Queue', icon: ListOrdered },
  { id: 'rate', label: 'Rate', icon: Star },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'mine', label: 'Mine', icon: Ticket },
];

const remembered = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const remember = (key, value) => { try { localStorage.setItem(key, value); } catch { /* fine without it */ } };

let localStore; // one shared demo store

export default function App() {
  // undefined = still checking, null = signed out
  const [user, setUser] = useState(hasFirebase ? undefined : null);
  const [demo, setDemo] = useState(!hasFirebase);
  const [data, setData] = useState(null);
  const [syncError, setSyncError] = useState('');
  const [signInError, setSignInError] = useState('');
  const [tab, setTab] = useState('queue');
  const [activeId, setActiveId] = useState(() => remembered('fmn-active-profile') || 'parent');
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => watchForUpdates(() => setUpdateReady(true)), []);

  useEffect(() => watchAuth((u) => setUser(u || null)), []);

  const store = useMemo(() => {
    if (demo) return (localStore ||= createLocalStore());
    return user ? createFirestoreStore(user.uid) : null;
  }, [demo, user]);

  useEffect(() => {
    setData(null);
    setSyncError('');
    if (!store) return undefined;
    return store.subscribe(setData, (e) =>
      setSyncError(e.code === 'permission-denied' ? 'Firestore refused access. Publish the rules from firestore.rules (see README, step 4).' : e.message));
  }, [store]);

  const rate = useCallback((movie, profileId, rating) => {
    store.setRating(movie, profileId, rating);
    // List results don't carry runtime or MPAA rating; fetch them once so the filters work.
    if (rating && !movie.detailed) enrich(movie).then((full) => full.detailed && store.updateMovie(full));
  }, [store]);

  const signIn = async () => {
    setSignInError('');
    try { await signInWithGoogle(); } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') setSignInError(e.code === 'auth/unauthorized-domain' ? 'This domain is not authorized for sign-in. Add it under Firebase Auth → Settings → Authorized domains.' : e.message);
    }
  };

  /* ----- Gate screens ----- */

  if (user === undefined) return <Shell><Centered>Loading…</Centered></Shell>;

  if (!store) {
    return (
      <Shell>
        <div className="mx-auto flex max-w-sm flex-col items-center gap-5 py-12 text-center">
          <p className="text-cream/90">Each of you rates movies. The queue shows what all three of you will happily watch.</p>
          <button type="button" onClick={signIn} className="flex w-full items-center justify-center gap-3 rounded-lg bg-cream px-4 py-3 font-bold text-house hover:brightness-95">
            <GoogleG /> Sign in with Google
          </button>
          {signInError && <p className="w-full rounded-lg border border-velvet bg-velvet/15 p-3 text-sm">{signInError}</p>}
          <button type="button" onClick={() => setDemo(true)} className="text-sm text-dim underline hover:text-cream">Try the demo without signing in</button>
        </div>
      </Shell>
    );
  }

  if (syncError) return <Shell><Centered>{syncError}</Centered></Shell>;
  if (!data) return <Shell><Centered>Loading your ratings…</Centered></Shell>;

  const { profiles, entries } = data;
  const active = profiles.find((p) => p.id === activeId) || profiles[0];
  const pick = (id) => { setActiveId(id); remember('fmn-active-profile', id); };

  return (
    <Shell
      right={
        <div className="flex items-center gap-2" role="group" aria-label="Who is rating">
          {profiles.map((p) => (
            <button key={p.id} type="button" onClick={() => pick(p.id)} aria-pressed={p.id === active.id} aria-label={`Rate as ${p.name}`} title={p.name} className={`rounded-full transition ${p.id === active.id ? '' : 'opacity-40 hover:opacity-80'}`}>
              <Avatar avatar={p.avatar} size={32} ring={p.id === active.id} />
            </button>
          ))}
        </div>
      }
      nav={
        <nav className="shrink-0 border-t border-aisle bg-house" aria-label="Sections">
          <div className="mx-auto grid max-w-2xl grid-cols-4">
            {TABS.map((t) => (
              <button key={t.id} type="button" aria-current={tab === t.id && !editing ? 'page' : undefined} onClick={() => { setTab(t.id); setEditing(false); }} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition ${tab === t.id && !editing ? 'text-gold' : 'text-dim hover:text-cream'}`}>
                <t.icon size={21} />
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      }
    >
      {updateReady && (
        <button type="button" onClick={applyUpdate} className="mb-4 flex w-full items-center justify-between gap-3 rounded-lg bg-gold px-4 py-2.5 text-left text-sm font-bold text-house">
          <span>A new version is ready.</span><span className="underline">Update now</span>
        </button>
      )}
      {editing ? (
        <Profiles profiles={profiles} onSave={(p) => store.saveProfiles(p)} onClose={() => setEditing(false)} />
      ) : (
        <>
          {tab === 'queue' && <Queue entries={entries} profiles={profiles} onOpen={setOpen} onRate={() => setTab('rate')} />}
          {tab === 'rate' && <Rate key={active.id} entries={entries} active={active} onRate={rate} />}
          {tab === 'search' && <Browse entries={entries} profiles={profiles} onOpen={setOpen} />}
          {tab === 'mine' && <MyTickets entries={entries} active={active} onOpen={setOpen} onRate={() => setTab('rate')} />}

          <footer className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-aisle pt-4 text-xs text-dim">
            <span>Rating as <span className="font-bold text-cream">{active.name}</span></span>
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 underline"><Settings2 size={12} /> Edit profiles</button>
            {demo && <span>Demo: sample ratings, saved on this device only.</span>}
            {demo && <button type="button" onClick={() => store.reset()} className="underline">Reset demo</button>}
            {demo && hasFirebase && <button type="button" onClick={() => setDemo(false)} className="underline">Exit demo</button>}
            {user && !demo && <button type="button" onClick={signOutUser} className="inline-flex items-center gap-1 underline"><LogOut size={12} /> Sign out</button>}
            <span className="tabular-nums">Version {buildLabel}</span>
          </footer>
        </>
      )}

      {open && (
        <RateSheet key={`${open.id}-${active.id}`} movie={open} entry={entries[open.id]} profiles={profiles} active={active} onSave={rate} onClose={() => setOpen(null)} />
      )}
    </Shell>
  );
}

/** Slim header with the wordmark and profile switcher, a scrolling column, optional bottom nav. */
function Shell({ children, right, nav }) {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-aisle">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <h1 className="truncate font-display text-xl leading-none text-gold">Family Movie Night</h1>
          {right}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-5">{children}</div>
      </main>
      {nav}
    </div>
  );
}

const Centered = ({ children }) => <p className="mx-auto max-w-prose py-16 text-center text-dim">{children}</p>;

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.500-4.800 7.200l7.700 6c4.500-4.200 6.900-10.300 6.900-17.700z" />
    <path fill="#FBBC05" d="M10.500 28.600c-.500-1.400-.800-3-.800-4.600s.300-3.200.800-4.600l-7.900-6.200C.900 16.500 0 20.100 0 24s.900 7.500 2.600 10.800l7.900-6.200z" />
    <path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.700-6c-2.200 1.500-5 2.300-8.200 2.300-6.300 0-11.600-4.100-13.500-9.900l-7.900 6.200C6.500 42.600 14.600 48 24 48z" />
  </svg>
);
