import { useCallback, useEffect, useMemo, useState } from 'react';
import { Popcorn, Search, Star, Ticket } from 'lucide-react';
import Browse from './components/Browse.jsx';
import Group from './components/Group.jsx';
import Mine from './components/Mine.jsx';
import Rate from './components/Rate.jsx';
import RateSheet from './components/RateSheet.jsx';
import Tonight from './components/Tonight.jsx';
import { Avatar, Notice } from './components/ui.jsx';
import { applyUpdate, watchForUpdates } from './lib/autoUpdate.js';
import { hasFirebase, pref } from './lib/config.js';
import { createGroup, joinGroup, leaveGroup, signInWithGoogle, signOutUser, watchAuth, watchMyGroup } from './lib/firebase.js';
import { createGroupStore, createLocalStore } from './lib/store.js';
import { enrich } from './lib/tmdb.js';

const TABS = [
  { id: 'tonight', label: 'Tonight', icon: Popcorn },
  { id: 'rate', label: 'Rate', icon: Star },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'mine', label: 'Mine', icon: Ticket },
];

// An invite link looks like https://your-site/?join=ABC123. Remember the code across the sign-in step.
const inviteCode = (() => {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('join');
    if (fromUrl) sessionStorage.setItem('fmn-join', fromUrl);
    return fromUrl || sessionStorage.getItem('fmn-join') || '';
  } catch { return ''; }
})();

let localStore; // one shared on-device store

export default function App() {
  // user: undefined = still checking, null = signed out
  const [user, setUser] = useState(hasFirebase ? undefined : null);
  const [local, setLocal] = useState(!hasFirebase);
  // groupId: undefined = still checking, null = signed in but not in a group yet
  const [groupId, setGroupId] = useState(undefined);
  const [data, setData] = useState(null);
  const [problem, setProblem] = useState('');
  const [tab, setTab] = useState('tonight');
  const [showGroup, setShowGroup] = useState(false);
  const [open, setOpen] = useState(null);
  const [includeR, setIncludeR] = useState(() => pref.get('include-r', false));
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => watchForUpdates(() => setUpdateReady(true)), []);
  useEffect(() => watchAuth((u) => { setUser(u || null); if (u) setLocal(false); }), []);

  useEffect(() => {
    setGroupId(undefined);
    if (!user) return undefined;
    return watchMyGroup(user.uid, setGroupId, (e) => setProblem(explain(e)));
  }, [user]);

  const store = useMemo(() => {
    if (local) return (localStore ||= createLocalStore());
    return user && groupId ? createGroupStore(groupId, user.uid) : null;
  }, [local, user, groupId]);

  useEffect(() => {
    setData(null);
    setProblem('');
    if (!store) return undefined;
    return store.subscribe(setData, (e) => setProblem(explain(e)));
  }, [store]);

  const rate = useCallback((movie, rating) => {
    store.setRating(movie, rating);
    // List results don't carry runtime or MPAA rating; fetch them once so filters and taste work.
    if (rating && !movie.detailed) enrich(movie).then((full) => full.detailed && store.updateMovie(full));
  }, [store]);

  /* ----- Gate screens ----- */

  if (user === undefined) return <Shell><Centered>Loading…</Centered></Shell>;
  if (!user && !local) return <Shell><SignIn onLocal={() => setLocal(true)} /></Shell>;
  if (user && !local && groupId === undefined && !problem) return <Shell><Centered>Loading…</Centered></Shell>;
  if (user && !local && groupId === null) return <Shell><Onboard user={user} /></Shell>;
  if (problem) return <Shell><div className="mx-auto flex max-w-md flex-col gap-3 py-10"><Notice>{problem}</Notice>{user && <button type="button" onClick={signOutUser} className="self-start text-sm text-dim underline">Sign out</button>}</div></Shell>;
  if (!data) return <Shell><Centered>Loading your ratings…</Centered></Shell>;

  const { members, entries, shortlist, group } = data;
  const me = store.me;
  const myself = members.find((m) => m.id === me) || { id: me, name: 'Me', photo: null };
  const listed = (movie) => shortlist.some((m) => String(m.id) === String(movie.id));
  const toggleListed = (movie) => store.setShortlist(listed(movie) ? shortlist.filter((m) => String(m.id) !== String(movie.id)) : [...shortlist, movie]);
  const go = (id) => { setTab(id); setShowGroup(false); };

  return (
    <Shell
      right={
        <button type="button" onClick={() => setShowGroup((v) => !v)} aria-label="Group and settings" aria-pressed={showGroup} className="flex items-center rounded-full">
          <span className="flex -space-x-2">
            {members.filter((m) => m.id !== me).slice(0, 3).map((m) => <Avatar key={m.id} member={m} size={30} dim />)}
            <Avatar member={myself} size={30} ring={showGroup} />
          </span>
        </button>
      }
      nav={
        <nav className="shrink-0 border-t border-aisle bg-house" aria-label="Sections">
          <div className="mx-auto grid max-w-2xl grid-cols-4">
            {TABS.map((t) => {
              const on = tab === t.id && !showGroup;
              return (
                <button key={t.id} type="button" aria-current={on ? 'page' : undefined} onClick={() => go(t.id)} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition ${on ? 'text-gold' : 'text-dim hover:text-cream'}`}>
                  <t.icon size={21} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>
      }
    >
      {updateReady && (
        <button type="button" onClick={applyUpdate} className="mb-4 flex w-full items-center justify-between gap-3 rounded-lg bg-gold px-4 py-2.5 text-left text-sm font-bold text-house">
          <span>A new version is ready.</span><span className="underline">Update now</span>
        </button>
      )}

      {showGroup ? (
        <Group
          group={group} members={members} me={me} signedIn={Boolean(user) && !local}
          includeR={includeR} onIncludeR={(v) => { setIncludeR(v); pref.set('include-r', v); }}
          onLeave={() => leaveGroup(user, group.id)} onSignOut={signOutUser}
          onSignIn={() => { setLocal(false); setShowGroup(false); }}
          onClearLocal={() => store.clearAll?.()}
        />
      ) : (
        <>
          {tab === 'tonight' && <Tonight entries={entries} members={members} me={me} shortlist={shortlist} onShortlist={(list) => store.setShortlist(list)} onOpen={setOpen} onRate={() => go('rate')} />}
          {tab === 'rate' && <Rate entries={entries} me={me} includeR={includeR} onRate={rate} />}
          {tab === 'search' && <Browse entries={entries} members={members} onOpen={setOpen} />}
          {tab === 'mine' && <Mine entries={entries} me={me} onOpen={setOpen} onRate={() => go('rate')} />}
        </>
      )}

      {open && (
        <RateSheet key={open.id} movie={open} entry={entries[open.id]} members={members} me={me} listed={listed(open)} onToggleListed={toggleListed} onSave={rate} onClose={() => setOpen(null)} />
      )}
    </Shell>
  );
}

function explain(e) {
  if (e?.code === 'group-missing') return 'This group no longer exists. Sign out and back in to start or join another.';
  if (e?.code === 'permission-denied') return 'The database refused access. Publish the rules from firestore.rules in the Firebase console (README, step 4).';
  return e?.message || 'Something went wrong talking to the database.';
}

function SignIn({ onLocal }) {
  const [error, setError] = useState('');
  const signIn = async () => {
    setError('');
    try { await signInWithGoogle(); } catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      setError(e.code === 'auth/unauthorized-domain' ? 'This site is not authorized for sign-in yet. Add its domain under Firebase Authentication → Settings → Authorized domains.' : e.message);
    }
  };
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-5 py-12 text-center">
      <p className="text-cream/90">Everyone rates what they've watched. The app learns what each of you likes and suggests what to watch together.</p>
      {inviteCode && <p className="text-sm text-gold">You've been invited to a group. Sign in to join it.</p>}
      <button type="button" onClick={signIn} className="flex w-full items-center justify-center gap-3 rounded-lg bg-cream px-4 py-3 font-bold text-house hover:brightness-95">
        <GoogleG /> Sign in with Google
      </button>
      {error && <Notice>{error}</Notice>}
      <button type="button" onClick={onLocal} className="text-sm text-dim underline hover:text-cream">Use it on this device without signing in</button>
    </div>
  );
}

/** First sign-in: start a group, or join one with an invite code. */
function Onboard({ user }) {
  const first = (user.displayName || '').split(' ')[0];
  const [name, setName] = useState(first ? `${first}'s movie night` : 'Movie night');
  const [code, setCode] = useState(inviteCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); try { sessionStorage.removeItem('fmn-join'); } catch { /* fine */ } } catch (e) { setError(explain(e)); setBusy(false); }
  };

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-8">
      <h2 className="text-2xl font-bold text-cream">Welcome{first ? `, ${first}` : ''}</h2>
      {error && <Notice>{error}</Notice>}

      <form className="flex flex-col gap-3 rounded-xl bg-seat p-4" onSubmit={(e) => { e.preventDefault(); run(() => joinGroup(user, code)); }}>
        <label htmlFor="join-code" className="font-bold text-cream">Join a group</label>
        <p className="text-sm text-dim">Got an invite code from someone? Enter it here.</p>
        <input id="join-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} autoCapitalize="characters" autoComplete="off" placeholder="ABC123" className="rounded-lg border border-aisle bg-house px-3 py-2.5 font-display text-xl tracking-[0.2em] text-gold placeholder:text-aisle focus:border-gold focus:outline-none" />
        <button type="submit" disabled={busy || !code.trim()} className="rounded-lg bg-velvet px-4 py-2.5 font-bold text-cream disabled:bg-aisle disabled:text-dim">Join</button>
      </form>

      <form className="flex flex-col gap-3 rounded-xl bg-seat p-4" onSubmit={(e) => { e.preventDefault(); run(() => createGroup(user, name)); }}>
        <label htmlFor="group-name" className="font-bold text-cream">Start a new group</label>
        <p className="text-sm text-dim">You'll get a code to share with the people you watch with.</p>
        <input id="group-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="rounded-lg border border-aisle bg-house px-3 py-2.5 font-bold text-cream focus:border-gold focus:outline-none" />
        <button type="submit" disabled={busy} className="rounded-lg border border-aisle px-4 py-2.5 font-bold text-cream disabled:text-dim">Start group</button>
      </form>

      <button type="button" onClick={signOutUser} className="self-start text-sm text-dim underline">Sign out</button>
    </div>
  );
}

/** Slim header with the wordmark, a scrolling column, optional bottom nav. */
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
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
    <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
  </svg>
);
