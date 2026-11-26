import { useCallback, useEffect, useRef, useState } from 'react';
import { Popcorn, Search, Sparkles, Star, Ticket } from 'lucide-react';
import Ask from './components/Ask.jsx';
import Browse from './components/Browse.jsx';
import Group from './components/Group.jsx';
import Mine from './components/Mine.jsx';
import Rate from './components/Rate.jsx';
import RateSheet from './components/RateSheet.jsx';
import Tonight from './components/Tonight.jsx';
import { Avatar, Notice } from './components/ui.jsx';
import { applyUpdate, watchForUpdates } from './lib/autoUpdate.js';
import { hasFirebase, pref } from './lib/config.js';
import { signInWithGoogle, signOutGoogle, watchSession } from './lib/firebase.js';
import { createLocalStore, createSharedStore, newId8, slim } from './lib/store.js';
import { detailsChanged, enrich, needsDetails, triedRecently } from './lib/tmdb.js';
import { unscoredNights } from './lib/stats.js';

const TABS = [
  { id: 'tonight', label: 'Tonight', icon: Popcorn },
  { id: 'rate', label: 'Rate', icon: Star },
  { id: 'ask', label: 'Ask', icon: Sparkles },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'mine', label: 'Mine', icon: Ticket },
];

const store = hasFirebase ? createSharedStore() : createLocalStore();

export default function App() {
  const [session, setSession] = useState(null); // the Firebase user; null until connected (or always, on-device)
  const [data, setData] = useState(null);
  const [problem, setProblem] = useState('');
  const [picked, setPicked] = useState(() => pref.get('me', null)); // the name chosen on this device
  const [tab, setTab] = useState('tonight');
  const [showGroup, setShowGroup] = useState(false);
  const [open, setOpen] = useState(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [away, setAway] = useState([]); // ids of people not watching tonight; shared by Tonight and Ask
  const linkAfterSignIn = useRef(null); // a name to link once the Google popup finishes

  const ready = !hasFirebase || Boolean(session);
  useEffect(() => watchForUpdates(() => setUpdateReady(true)), []);
  useEffect(() => (hasFirebase ? watchSession(setSession, (e) => setProblem(explain(e))) : undefined), []);
  useEffect(() => (ready ? store.subscribe(setData, (e) => setProblem(explain(e))) : undefined), [ready]);

  // Movies with missing or out-of-date details (credits, review score, where to watch): fill those
  // in quietly, a few at a time. This is the one background job that writes to the shared
  // database, and every write is re-read by every open phone, so it is careful: each movie is
  // tried once per session and at most once every 20 hours per device, and it only writes when
  // the lookup found something new.
  const backfilled = useRef(new Set());
  const [backfillTick, setBackfillTick] = useState(0);
  useEffect(() => {
    if (!data) return undefined;
    const missing = Object.values(data.entries)
      .filter((e) => needsDetails(e.movie) && !triedRecently(e.movie) && !backfilled.current.has(String(e.movie.id)))
      .slice(0, 8);
    if (!missing.length) return undefined;
    missing.forEach((e) => backfilled.current.add(String(e.movie.id)));
    let live = true;
    Promise.all(missing.map((e) => enrich(e.movie).then((full) => full !== e.movie && full.detailed && detailsChanged(e.movie, full) && store.updateMovie(full))))
      .finally(() => setTimeout(() => live && setBackfillTick((t) => t + 1), 2500)); // then the next few
    return () => { live = false; };
  }, [data ? Object.keys(data.entries).length : -1, backfillTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (id) => { setPicked(id); pref.set('me', id); setShowGroup(false); };
  const googleUid = session && !session.isAnonymous ? session.uid : null;
  const members = data?.members || [];
  const linked = googleUid ? members.find((m) => m.uid === googleUid) : null;
  // Signed in with Google: you are the name linked to that account. Otherwise: the name picked
  // on this device, unless someone has since linked it to a Google account.
  const me = googleUid ? linked?.id || null : members.find((m) => m.id === picked && !m.uid)?.id || null;

  // "Link my Google account" was tapped from inside a name: finish the link once signed in.
  useEffect(() => {
    if (!googleUid || !data || !linkAfterSignIn.current) return;
    const target = members.find((m) => m.id === linkAfterSignIn.current);
    linkAfterSignIn.current = null;
    if (!linked && target && !target.uid) store.linkMember(target.id, googleUid);
  }, [googleUid, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const google = async (linkId = null) => {
    setSignInError('');
    linkAfterSignIn.current = linkId;
    try { await signInWithGoogle(); } catch (e) {
      linkAfterSignIn.current = null;
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      setSignInError(explain(e));
    }
  };
  const signOut = () => { setShowGroup(false); signOutGoogle(); };

  const rate = useCallback((movie, rating) => {
    store.setRating(movie, me, rating);
    // List results don't carry runtime or MPAA rating; fetch them once so filters and taste work.
    if (rating && needsDetails(movie)) enrich(movie).then((full) => full.detailed && store.updateMovie(full));
  }, [me]);

  /* ----- Gate screens ----- */

  if (problem) return <Shell><div className="mx-auto max-w-md py-10"><Notice>{problem}</Notice></div></Shell>;
  if (!data) return <Shell><Centered>Loading…</Centered></Shell>;

  const { entries, shortlist, vote, history } = data;
  const myself = members.find((m) => m.id === me);
  if (!myself) {
    return (
      <Shell>
        <WhoAreYou
          members={members} googleUid={googleUid} canGoogle={hasFirebase} error={signInError}
          onGoogle={() => google()} onSignOut={signOut}
          onPick={(id) => (googleUid ? store.linkMember(id, googleUid) : choose(id))}
          onAdd={(name) => { const id = store.addMember(name, googleUid); if (!googleUid) choose(id); }}
        />
      </Shell>
    );
  }

  const present = members.filter((m) => !away.includes(m.id));
  // At least one person always stays in.
  const toggleAway = (id) => setAway((a) => (a.includes(id) ? a.filter((x) => x !== id) : present.length > 1 ? [...a, id] : a));
  // All-time favourites: stored on the person, and recorded as watched-and-loved so the taste
  // profile and suggestions pick them up. Adding one never overwrites a rating you gave yourself.
  const favorites = myself.favorites || [];
  const addFavorite = async (picked) => {
    if (favorites.some((m) => String(m.id) === String(picked.id))) return;
    const movie = await enrich(entries[picked.id]?.movie || picked);
    store.setFavorites(me, [...favorites, movie]);
    const mine = entries[movie.id]?.ratings?.[me];
    if (!mine || mine.status === 'unseen' || mine.status === 'meh' || mine.status === 'notseen') store.setRating(movie, me, { status: 'seen', stars: null, like: 5, via: 'favorite' });
    else if (entries[movie.id] && needsDetails(entries[movie.id].movie)) store.updateMovie(movie);
  };
  const removeFavorite = (movie) => {
    store.setFavorites(me, favorites.filter((m) => String(m.id) !== String(movie.id)));
    if (entries[movie.id]?.ratings?.[me]?.via === 'favorite') store.setRating(movie, me, null);
  };
  // Log a movie night: what, when, how it was chosen and who was there. Anyone who hadn't
  // already watched it is marked as having watched it (not yet rated), so it stops being suggested.
  const logWatched = async (picked, via, watcherIds, extra = {}) => {
    const movie = await enrich(entries[picked.id]?.movie || picked);
    store.addHistory({ id: newId8(), movie: { ...slim(movie), genres: movie.genres || [] }, at: Date.now(), via, watchers: watcherIds, ...extra });
    watcherIds.forEach((id) => {
      const mine = entries[movie.id]?.ratings?.[id];
      if (!mine || !['seen', 'again'].includes(mine.status)) store.setRating(movie, id, { status: 'seen', stars: null, via: 'watched' });
    });
    if (shortlist.some((m) => String(m.id) === String(movie.id))) store.setShortlist(shortlist.filter((m) => String(m.id) !== String(movie.id)));
    if (vote) store.clearVote();
  };
  const voting = {
    start: (movies, voters) => store.startVote(movies, voters),
    cast: (picks, previous) => store.castVote(me, picks, previous),
    end: () => store.endVote(),
    clear: () => store.clearVote(),
  };
  // A dot on the Tonight tab when there's an open vote you haven't cast yet.
  const voteWaiting = Boolean(vote?.open && vote.voters.includes(me) && !vote.voted.includes(me));
  const scoreWaiting = unscoredNights(history, entries, me).length > 0;
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
          <div className="mx-auto grid max-w-2xl grid-cols-5">
            {TABS.map((t) => {
              const on = tab === t.id && !showGroup;
              return (
                <button key={t.id} type="button" aria-current={on ? 'page' : undefined} onClick={() => go(t.id)} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition ${on ? 'text-gold' : 'text-dim hover:text-cream'}`}>
                  <span className="relative">
                    <t.icon size={21} />
                    {t.id === 'tonight' && (voteWaiting || scoreWaiting) && <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-velvet ring-2 ring-house" aria-label={voteWaiting ? 'A vote is waiting for you' : 'A movie night is waiting for your score'} />}
                  </span>
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
          canGoogle={hasFirebase} googleUid={googleUid} error={signInError}
          onSwitch={() => choose(null)} onAdd={(name) => store.addMember(name)} onRemove={(id) => store.removeMember(id)}
          onLink={() => google(me)} onUnlink={() => { store.linkMember(me, null); choose(me); signOutGoogle(); }} onSignOut={signOut}
        />
      ) : (
        <>
          {tab === 'tonight' && <Tonight entries={entries} members={members} me={me} away={away} onToggleAway={toggleAway} shortlist={shortlist} onShortlist={(list) => store.setShortlist(list)} vote={vote} voting={voting} history={history} onSnooze={(memberId, movie, until) => store.snooze(memberId, String(movie.id), until)} onWatch={logWatched} onRemoveHistory={(id) => store.removeHistory(id)} onOpen={setOpen} onRate={() => go('rate')} />}
          {tab === 'rate' && <Rate key={me} entries={entries} me={me} onRate={rate} />}
          {tab === 'ask' && <Ask entries={entries} members={members} me={me} present={present} onTogglePresent={toggleAway} shortlist={shortlist} onShortlist={(list) => store.setShortlist(list)} onOpen={setOpen} />}
          {tab === 'search' && <Browse entries={entries} members={members} me={me} onWant={(m, on) => rate(m, on ? { status: 'unseen', stars: null } : null)} onOpen={setOpen} />}
          {tab === 'mine' && <Mine entries={entries} members={members} me={me} onWant={(m) => rate(m, { status: 'unseen', stars: null })} onPass={(m) => rate(m, { status: 'pass', stars: null })} favorites={favorites} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} onOpen={setOpen} onRate={() => go('rate')} />}
        </>
      )}

      {open && (
        <RateSheet key={open.id} movie={open} entry={entries[open.id]} members={members} me={me} listed={listed(open)} snoozedUntil={(myself.snoozed?.[open.id] || 0) > Date.now() ? myself.snoozed[open.id] : null} onSnooze={(movie, until) => store.snooze(me, String(movie.id), until)} onToggleListed={toggleListed} onWatched={(movie) => logWatched(movie, 'pick', present.map((m) => m.id))} onSave={rate} onClose={() => setOpen(null)} />
      )}
    </Shell>
  );
}

function explain(e) {
  if (e?.code === 'resource-exhausted') return "The shared database has hit its free daily limit, so names and ratings can't load right now. It resets by itself around midnight Pacific time. To lift the limit, switch the Firebase project to the Blaze (pay-as-you-go) plan in the Firebase console.";
  if (e?.code === 'permission-denied') return 'The database refused access. Publish the rules from firestore.rules in the Firebase console (README, step 4).';
  if (e?.code === 'auth/admin-restricted-operation') return 'Anonymous sign-in is switched off in Firebase. Turn it on under Authentication → Sign-in method → Anonymous (README, step 3).';
  if (e?.code === 'auth/operation-not-allowed') return 'That sign-in method is switched off in Firebase. Turn it on under Authentication → Sign-in method.';
  if (e?.code === 'auth/unauthorized-domain') return `Google sign-in isn't allowed from this address yet. In Firebase, go to Authentication → Settings → Authorized domains and add ${window.location.hostname}.`;
  if (e?.code === 'auth/popup-blocked') return 'The sign-in window was blocked. Allow pop-ups for this site, or open it in Safari or Chrome instead of from the home screen.';
  return e?.message || 'Something went wrong talking to the database.';
}

/**
 * The front door.
 *   Not signed in with Google: pick your name, type a new one, or sign in with Google.
 *   Signed in with Google but not linked to a name yet: say which existing name is yours
 *   (your ratings come with it), or start fresh.
 */
function WhoAreYou({ members, googleUid, canGoogle, error, onGoogle, onSignOut, onPick, onAdd }) {
  const [name, setName] = useState('');
  const submit = (e) => { e.preventDefault(); if (name.trim()) onAdd(name); };
  const free = members.filter((m) => !m.uid);
  const taken = members.filter((m) => m.uid);
  const claiming = Boolean(googleUid);

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-cream">{claiming ? 'Which one is you?' : members.length ? "Who's this?" : 'Welcome'}</h2>
        {claiming && <p className="text-sm text-dim">You're signed in with Google. Pick your existing name and everything you've rated comes with it. From then on, signing in with Google opens straight into it on any device.</p>}
      </div>
      {error && <Notice>{error}</Notice>}

      {free.length > 0 && (
        <ul className="flex flex-col gap-2">
          {free.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m.id)} className="flex w-full items-center gap-3 rounded-xl bg-seat px-3 py-3 text-left text-lg font-bold text-cream transition hover:bg-aisle">
                <Avatar member={m} size={40} />
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                {claiming && <span className="text-xs font-normal text-gold">That's me</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!claiming && taken.length > 0 && (
        <ul className="flex flex-col gap-2">
          {taken.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={onGoogle} className="flex w-full items-center gap-3 rounded-xl border border-aisle px-3 py-3 text-left text-lg font-bold text-cream transition hover:bg-seat">
                <Avatar member={m} size={40} />
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-normal text-dim"><GoogleG /> Sign in</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="new-name" className="text-sm text-dim">{claiming ? 'New here? Add your name.' : members.length ? 'Not on the list? Add your name.' : "Type your name to get started. Next time you'll just pick it from a list."}</label>
        <div className="flex gap-2">
          <input id="new-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Your name" autoComplete="off" autoFocus={!members.length} className="min-w-0 flex-1 rounded-lg border border-aisle bg-seat px-3 py-3 text-lg text-cream placeholder:text-dim focus:border-gold focus:outline-none" />
          <button type="submit" disabled={!name.trim()} className="rounded-lg bg-velvet px-5 py-3 font-bold text-cream disabled:bg-aisle disabled:text-dim">Go</button>
        </div>
      </form>

      {canGoogle && (claiming
        ? <button type="button" onClick={onSignOut} className="self-start text-sm text-dim underline">Sign out of Google</button>
        : (
          <div className="flex flex-col gap-2 border-t border-aisle pt-5">
            <button type="button" onClick={onGoogle} className="flex w-full items-center justify-center gap-3 rounded-lg bg-cream px-4 py-3 font-bold text-house hover:brightness-95"><GoogleG /> Sign in with Google</button>
            <p className="text-xs text-dim">Optional. It ties your name to your Google account, so nobody else can pick it and it follows you to any device.</p>
          </div>
        ))}
    </div>
  );
}

export const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
    <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

/** Slim header with the wordmark, a scrolling column, optional bottom nav. */
function Shell({ children, right, nav }) {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-aisle">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 lg:max-w-6xl lg:px-8">
          <h1 className="truncate font-display text-xl leading-none text-gold">Family Movie Night</h1>
          {right}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-5 lg:max-w-6xl lg:px-8">{children}</div>
      </main>
      {nav}
    </div>
  );
}

const Centered = ({ children }) => <p className="mx-auto max-w-prose py-16 text-center text-dim">{children}</p>;
