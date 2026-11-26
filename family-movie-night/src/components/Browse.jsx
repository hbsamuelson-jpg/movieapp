import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Plus, Search, X } from 'lucide-react';
import { hasTmdb } from '../lib/config.js';
import { comingSoon, filmography, searchMovies, searchPeople } from '../lib/tmdb.js';
import { predictStars, tasteProfile } from '../lib/suggest.js';
import { MemberDots, MovieRow, Notice } from './ui.jsx';

const MODES = [['movies', 'Movies'], ['people', 'Directors'], ['soon', 'Coming soon']];
const opens = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Find one specific movie, or look up a director (or writer) and browse what they made. */
export default function Browse({ entries, members, me, onWant, onOpen }) {
  const [mode, setMode] = useState('movies');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [state, setState] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState('');
  const [soon, setSoon] = useState({ state: 'idle', list: [] }); // movies opening in theatres soon
  const [soonSort, setSoonSort] = useState('fit'); // fit | date
  const [person, setPerson] = useState(null); // the chosen director, with { directed, written } once loaded

  useEffect(() => {
    if (mode !== 'soon' || soon.state !== 'idle') return;
    setSoon({ state: 'loading', list: [] });
    comingSoon().then((list) => setSoon({ state: 'ready', list })).catch((e) => setSoon({ state: 'error', list: [], error: e.message }));
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const taste = useMemo(() => tasteProfile(entries, me), [entries, me]);
  const upcoming = useMemo(() => soon.list
    .map((movie) => ({ movie, fit: Math.round(predictStars(taste, movie) * 20) }))
    .sort((a, b) => (soonSort === 'date' ? a.movie.release.localeCompare(b.movie.release) : b.fit - a.fit))) // ties keep TMDB's order: most anticipated first, [soon.list, taste, soonSort]);

  useEffect(() => {
    if (mode === 'soon') return undefined;
    const q = query.trim();
    if (!q) { setState('idle'); setResults([]); return undefined; }
    let live = true;
    setState('loading');
    // Debounce typing so we don't hit TMDB on every keystroke.
    const timer = setTimeout(() => {
      (mode === 'movies' ? searchMovies(q) : searchPeople(q))
        .then((list) => { if (live) { setResults(list); setState('ready'); } })
        .catch((e) => { if (live) { setError(e.message); setState('error'); } });
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [query, mode]);

  const choosePerson = async (p) => {
    setPerson({ ...p, loading: true });
    try {
      setPerson({ ...p, ...(await filmography(p)) });
    } catch (e) {
      setPerson(null);
      setError(e.message);
      setState('error');
    }
  };
  const switchMode = (m) => { setMode(m); setResults([]); setPerson(null); setState(query.trim() ? 'loading' : 'idle'); };
  const rows = (list) => (
    <ol className="-mx-2 flex flex-col divide-y divide-aisle/60 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:divide-y-0">
      {list.map((m) => <MovieRow key={m.id} movie={entries[m.id]?.movie || m} onOpen={onOpen} aside={<MemberDots entry={entries[m.id]} members={members} />} />)}
    </ol>
  );

  if (person) {
    return (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={() => setPerson(null)} className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-dim hover:text-cream"><ArrowLeft size={16} /> Back to results</button>
        <h2 className="text-2xl font-bold text-cream">{person.name}</h2>
        {person.loading && <p className="py-8 text-center text-sm text-dim">Loading their movies…</p>}
        {!person.loading && !person.directed.length && !person.written.length && <p className="text-sm text-dim">No directing or writing credits found for {person.name}.</p>}
        {person.directed?.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-dim">Directed · {person.directed.length}</h3>
            {rows(person.directed)}
          </section>
        )}
        {person.written?.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-dim">Wrote · {person.written.length}</h3>
            {rows(person.written)}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-1 rounded-full bg-seat p-1" role="tablist" aria-label="Search for">
        {MODES.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => switchMode(id)} className={`rounded-full py-2 text-sm font-bold transition ${mode === id ? 'bg-gold text-house' : 'text-dim hover:text-cream'}`}>{label}</button>
        ))}
      </div>

      {mode === 'soon' && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm text-dim">Opening in US theatres over the next five months. Tap <span className="font-bold text-cream">Want to see</span> and it joins your Want to list, then shows up on Tonight once it's out.</p>
            <div className="flex gap-2" role="group" aria-label="Sort by">
              {[['fit', 'Best fit for me'], ['date', 'Soonest']].map(([key, label]) => <button key={key} type="button" aria-pressed={soonSort === key} onClick={() => setSoonSort(key)} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${soonSort === key ? 'border-gold bg-gold text-house' : 'border-aisle text-cream'}`}>{label}</button>)}
            </div>
          </div>
          {!hasTmdb && <Notice>Coming soon needs the TMDB key.</Notice>}
          {soon.state === 'loading' && <p className="py-10 text-center text-sm text-dim">Finding what's coming…</p>}
          {soon.state === 'error' && <Notice>{soon.error}</Notice>}
          {soon.state === 'ready' && hasTmdb && upcoming.length === 0 && <p className="py-10 text-center text-sm text-dim">Nothing announced yet.</p>}
          <ol className="-mx-2 flex flex-col divide-y divide-aisle/60 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:divide-y-0">
            {upcoming.map(({ movie, fit }) => {
              const mine = entries[movie.id]?.ratings?.[me];
              const wanted = mine?.status === 'unseen';
              return (
                <MovieRow key={movie.id} movie={entries[movie.id]?.movie || movie} onOpen={onOpen}
                  note={<span><span className="font-bold text-gold">Opens {opens(movie.release)}</span>{taste.genres.length ? ` · ${fit}% your kind of movie` : ''}</span>}
                  action={<button type="button" onClick={() => onWant(movie, !wanted)} aria-pressed={wanted} className={`mr-1 inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold ${wanted ? 'border-gold bg-gold text-house' : 'border-aisle text-cream'}`}>{wanted ? <><Check size={13} /> Wanted</> : <><Plus size={13} /> Want to see</>}</button>} />
              );
            })}
          </ol>
        </section>
      )}

      {mode !== 'soon' && <>
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
        <input id="movie-search" type="search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={mode === 'people' ? 'Search a director or writer' : hasTmdb ? 'Search any movie' : 'Search 150 built-in movies'} aria-label={mode === 'people' ? 'Search directors and writers' : 'Search movies'} className="w-full rounded-full border border-aisle bg-seat py-3 pl-11 pr-10 text-cream placeholder:text-dim focus:border-gold focus:outline-none" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-dim hover:text-cream"><X size={16} /></button>}
      </div>

      {mode === 'people' && !hasTmdb && <Notice>Director search needs the TMDB key.</Notice>}
      {state === 'idle' && <p className="py-10 text-center text-sm text-dim">{mode === 'people' ? 'Type a name to see everything they directed or wrote.' : 'Type a title to find a movie and rate it.'}</p>}
      {state === 'error' && <Notice>{error}</Notice>}
      {state === 'loading' && <p className="py-10 text-center text-sm text-dim">Searching…</p>}
      {state === 'ready' && results.length === 0 && (
        <p className="py-10 text-center text-sm text-dim">Nothing matches “{query}”.{!hasTmdb && mode === 'movies' && ' Without a TMDB key, search only covers the built-in list.'}</p>
      )}
      {state === 'ready' && results.length > 0 && mode === 'movies' && rows(results)}
      {state === 'ready' && results.length > 0 && mode === 'people' && (
        <ul className="flex flex-col gap-2">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => choosePerson(p)} className="flex w-full flex-col gap-0.5 rounded-xl bg-seat px-4 py-3 text-left transition hover:bg-aisle">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-bold text-cream">{p.name}</span>
                  <span className="shrink-0 text-xs text-dim">{p.department}</span>
                </span>
                {p.knownFor.length > 0 && <span className="truncate text-xs text-dim">{p.knownFor.join(' · ')}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      </>}
    </div>
  );
}
