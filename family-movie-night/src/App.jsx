import { useCallback, useEffect, useState } from 'react';
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
import { connect } from './lib/firebase.js';
import { createLocalStore, createSharedStore } from './lib/store.js';
import { enrich } from './lib/tmdb.js';

const TABS = [
  { id: 'tonight', label: 'Tonight', icon: Popcorn },
  { id: 'rate', label: 'Rate', icon: Star },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'mine', label: 'Mine', icon: Ticket },
];

const store = hasFirebase ? createSharedStore() : createLocalStore();

export default function App() {
  const [ready, setReady] = useState(!hasFirebase); // the shared store needs a connection first
  const [data, setData] = useState(null);
  const [problem, setProblem] = useState('');
  const [me, setMe] = useState(() => pref.get('me', null)); // which name this device is using
  const [tab, setTab] = useState('tonight');
  const [showGroup, setShowGroup] = useState(false);
  const [open, setOpen] = useState(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => watchForUpdates(() => setUpdateReady(true)), []);
  useEffect(() => {
    if (hasFirebase) connect().then(() => setReady(true)).catch((e) => setProblem(explain(e)));
  }, []);
  useEffect(() => (ready ? store.subscribe(setData, (e) => setProblem(explain(e))) : undefined), [ready]);

  const choose = (id) => { setMe(id); pref.set('me', id); setShowGroup(false); };

  const rate = useCallback((movie, rating) => {
    store.setRating(movie, me, rating);
    // List results don't carry runtime or MPAA rating; fetch them once so filters and taste work.
    if (rating && !movie.detailed) enrich(movie).then((full) => full.detailed && store.updateMovie(full));
  }, [me]);

  /* ----- Gate screens ----- */

  if (problem) return <Shell><div className="mx-auto max-w-md py-10"><Notice>{problem}</Notice></div></Shell>;
  if (!data) return <Shell><Centered>Loading…</Centered></Shell>;

  const { members, entries, shortlist } = data;
  const myself = members.find((m) => m.id === me);
  if (!myself) return <Shell><WhoAreYou members={members} onPick={choose} onAdd={(name) => choose(store.addMember(name))} /></Shell>;

  const listed = (movie) => shortlist.some((m) => String(m.id) === String(movie.id));
  const toggleListed = (movie) => store.setShortlist(listed(movie) ? shortlist.filter((m) => String(m.id) !== String(movie.id)) : [...shortlist, movie]);
  const go = (id) => { setTab(id); setShowGroup(false); };

  return (
    <Shell
      right={
        <button type="button" onClick={() => setShowGroup((v) => !v)} aria-label={`You are ${myself.name}. People and settings`} aria-pressed={showGroup} className="flex items-center rounded-full">
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
          members={members} me={me}
          onSwitch={() => choose(null)} onAdd={(name) => store.addMember(name)} onRemove={(id) => store.removeMember(id)}
        />
      ) : (
        <>
          {tab === 'tonight' && <Tonight entries={entries} members={members} me={me} shortlist={shortlist} onShortlist={(list) => store.setShortlist(list)} onOpen={setOpen} onRate={() => go('rate')} />}
          {tab === 'rate' && <Rate key={me} entries={entries} me={me} onRate={rate} />}
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
  if (e?.code === 'permission-denied') return 'The database refused access. Publish the rules from firestore.rules in the Firebase console (README, step 4).';
  if (e?.code === 'auth/operation-not-allowed' || e?.code === 'auth/admin-restricted-operation') return 'Anonymous sign-in is switched off in Firebase. Turn it on under Authentication → Sign-in method → Anonymous (README, step 3).';
  return e?.message || 'Something went wrong talking to the database.';
}

/** The front door: pick your name, or type it if you're new. */
function WhoAreYou({ members, onPick, onAdd }) {
  const [name, setName] = useState('');
  const submit = (e) => { e.preventDefault(); if (name.trim()) onAdd(name); };
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-8">
      <h2 className="text-2xl font-bold text-cream">{members.length ? "Who's this?" : 'Welcome'}</h2>
      {members.length > 0 && (
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m.id)} className="flex w-full items-center gap-3 rounded-xl bg-seat px-3 py-3 text-left text-lg font-bold text-cream transition hover:bg-aisle">
                <Avatar member={m} size={40} />
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="new-name" className="text-sm text-dim">{members.length ? 'Not on the list? Add your name.' : "Type your name to get started. Next time you'll just pick it from a list."}</label>
        <div className="flex gap-2">
          <input id="new-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Your name" autoComplete="off" autoFocus={!members.length} className="min-w-0 flex-1 rounded-lg border border-aisle bg-seat px-3 py-3 text-lg text-cream placeholder:text-dim focus:border-gold focus:outline-none" />
          <button type="submit" disabled={!name.trim()} className="rounded-lg bg-velvet px-5 py-3 font-bold text-cream disabled:bg-aisle disabled:text-dim">Go</button>
        </div>
      </form>
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
