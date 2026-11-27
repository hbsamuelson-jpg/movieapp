import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Plus, Search, Trash2 } from 'lucide-react';
import { hasTmdb } from '../lib/config.js';
import { hoursText, minutes, planNights, watchedIds } from '../lib/marathon.js';
import { newId8 } from '../lib/store.js';
import { enrich, filmography, searchPeople, searchSeries, seriesMovies } from '../lib/tmdb.js';
import { Notice, Poster } from './ui.jsx';

const BUDGETS = [[120, '2 hours'], [180, '3 hours'], [240, '4 hours'], [360, '6 hours']];
const keep = (m) => ({ id: m.id, title: m.title, year: m.year || null, poster: m.poster || null, runtime: m.runtime || null, genres: m.genres || [] });

/**
 * Marathons: a movie series or a director's best-known movies, laid out over as many nights as
 * your time per night needs, with progress. A movie counts as watched when it's ticked here or
 * logged as a movie night.
 */
export default function Marathons({ marathons, history, shortlist, onSave, onRemove, onShortlist, onOpen, onBack }) {
  const [making, setMaking] = useState(marathons.length === 0);
  const [kind, setKind] = useState('series');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [perNight, setPerNight] = useState(240);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return undefined; }
    let live = true;
    const timer = setTimeout(() => {
      (kind === 'series' ? searchSeries(q) : searchPeople(q)).then((list) => { if (live) setResults(list); }).catch((e) => { if (live) setError(e.message); });
    }, 350);
    return () => { live = false; clearTimeout(timer); };
  }, [query, kind]);

  const build = async (item) => {
    setBusy(item.name);
    setError('');
    try {
      let movies;
      if (kind === 'series') movies = await seriesMovies(item.id);
      else {
        const { directed } = await filmography(item); // best known first
        movies = await Promise.all(directed.slice(0, 8).map((m) => enrich(m)));
        movies.sort((a, b) => (a.year || 0) - (b.year || 0));
      }
      if (movies.length < 2) throw new Error(`There aren't enough released movies for a ${item.name} marathon.`);
      onSave({ id: newId8(), title: kind === 'series' ? item.name : `${item.name} marathon`, kind, perNight, movies: movies.map(keep), done: [], createdAt: Date.now() });
      setMaking(false);
      setQuery('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-dim hover:text-cream"><ArrowLeft size={16} /> Back to tonight</button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-bold text-cream">Marathons</h2>
        {!making && <button type="button" onClick={() => setMaking(true)} className="inline-flex items-center gap-1.5 rounded-full bg-velvet px-4 py-2 text-sm font-bold text-cream"><Plus size={15} /> New marathon</button>}
      </div>

      {making && (
        <section className="flex flex-col gap-3 rounded-xl bg-seat p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-dim">Build from</span>
            {[['series', 'A series'], ['director', 'A director']].map(([key, label]) => <button key={key} type="button" aria-pressed={kind === key} onClick={() => { setKind(key); setResults([]); }} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${kind === key ? 'border-gold bg-gold text-house' : 'border-aisle text-cream'}`}>{label}</button>)}
            {marathons.length > 0 && <button type="button" onClick={() => setMaking(false)} className="ml-auto text-sm text-dim underline">Cancel</button>}
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Time per night">
            <span className="text-sm text-dim">Time per night</span>
            {BUDGETS.map(([min, label]) => <button key={min} type="button" aria-pressed={perNight === min} onClick={() => setPerNight(min)} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${perNight === min ? 'border-gold bg-gold text-house' : 'border-aisle text-cream'}`}>{label}</button>)}
          </div>
          {!hasTmdb && <Notice>Marathons need the TMDB key.</Notice>}
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
            <input id="marathon-search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" placeholder={kind === 'series' ? 'Series, e.g. Back to the Future' : 'Director, e.g. Hayao Miyazaki'} aria-label={kind === 'series' ? 'Search for a movie series' : 'Search for a director'} className="w-full rounded-full border border-aisle bg-house py-2.5 pl-10 pr-4 text-cream placeholder:text-dim focus:border-gold focus:outline-none" />
          </div>
          {error && <Notice>{error}</Notice>}
          {results.length > 0 && (
            <ul className="flex flex-col gap-1">
              {results.map((item) => (
                <li key={item.id}>
                  <button type="button" disabled={Boolean(busy)} onClick={() => build(item)} className="flex w-full items-center justify-between gap-3 rounded-lg bg-house px-3 py-2.5 text-left font-bold text-cream hover:bg-aisle disabled:opacity-60">
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span className="shrink-0 text-xs font-normal text-gold">{busy === item.name ? 'Building…' : 'Build'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {marathons.length === 0 && !making && <p className="text-sm text-dim">No marathons yet.</p>}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        {[...marathons].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((m) => {
          const seen = watchedIds(m, history);
          const nights = planNights(m.movies, m.perNight || 240);
          const left = nights.filter((night) => night.some((movie) => !seen.has(String(movie.id))));
          const next = left[0];
          const listed = (movie) => shortlist.some((s) => String(s.id) === String(movie.id));
          const toggle = (movie) => { const id = String(movie.id); const done = (m.done || []).map(String); onSave({ ...m, done: done.includes(id) ? done.filter((x) => x !== id) : [...done, id] }); };
          return (
            <section key={m.id} className="flex flex-col gap-3 rounded-xl bg-seat p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-cream">{m.title}</h3>
                  <p className="text-sm text-dim">{seen.size} of {m.movies.length} watched · {left.length ? `${left.length} ${left.length === 1 ? 'night' : 'nights'} to go` : 'finished'} · {hoursText(minutes(m.movies))} in all</p>
                </div>
                {removing === m.id
                  ? <span className="flex shrink-0 items-center gap-2 text-xs text-dim">Delete? <button type="button" onClick={() => { onRemove(m.id); setRemoving(null); }} className="font-bold text-cream underline">Yes</button><button type="button" onClick={() => setRemoving(null)} className="underline">No</button></span>
                  : <button type="button" onClick={() => setRemoving(m.id)} aria-label={`Delete ${m.title}`} className="shrink-0 rounded-full p-2 text-dim hover:text-cream"><Trash2 size={16} /></button>}
              </div>
              <span className="h-1.5 overflow-hidden rounded-full bg-aisle"><span className="block h-full rounded-full bg-gold" style={{ width: `${(seen.size / m.movies.length) * 100}%` }} /></span>
              {nights.map((night, n) => {
                const finished = night.every((movie) => seen.has(String(movie.id)));
                return (
                  <div key={night[0].id} className={`flex flex-col gap-1.5 ${finished ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-dim">Night {n + 1} · {hoursText(minutes(night))}{night === next ? <span className="text-gold"> · up next</span> : ''}</h4>
                      {night === next && <button type="button" onClick={() => onShortlist([...shortlist, ...night.filter((movie) => !seen.has(String(movie.id)) && !listed(movie))])} disabled={night.filter((movie) => !seen.has(String(movie.id))).every(listed)} className="text-xs font-bold text-gold disabled:text-dim">{night.filter((movie) => !seen.has(String(movie.id))).every(listed) ? 'On the shortlist' : 'Add to shortlist'}</button>}
                    </div>
                    <ul className="flex flex-col gap-1">
                      {night.map((movie) => {
                        const watched = seen.has(String(movie.id));
                        return (
                          <li key={movie.id} className="flex items-center gap-2.5">
                            <button type="button" role="checkbox" aria-checked={watched} aria-label={`${movie.title} watched`} onClick={() => toggle(movie)} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${watched ? 'border-gold bg-gold text-house' : 'border-aisle text-transparent'}`}><Check size={15} /></button>
                            <button type="button" onClick={() => onOpen(movie)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                              <span className="w-8 shrink-0"><Poster movie={movie} size="w92" className="rounded-sm" /></span>
                              <span className="min-w-0 flex-1"><span className={`block truncate font-bold ${watched ? 'text-dim line-through' : 'text-cream'}`}>{movie.title}</span><span className="block text-xs text-dim">{movie.year}{movie.runtime ? ` · ${hoursText(movie.runtime)}` : ''}</span></span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
