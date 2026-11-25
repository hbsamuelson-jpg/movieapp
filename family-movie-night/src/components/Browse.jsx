import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { hasTmdb } from '../lib/config.js';
import { searchMovies } from '../lib/tmdb.js';
import { FamilyDots, MovieRow } from './ui.jsx';

/** Find one specific movie and rate it. */
export default function Browse({ entries, profiles, onOpen }) {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState([]);
  const [state, setState] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (!q) { setState('idle'); setMovies([]); return undefined; }
    let live = true;
    setState('loading');
    // Debounce typing so we don't hit TMDB on every keystroke.
    const timer = setTimeout(() => {
      searchMovies(q)
        .then((list) => { if (live) { setMovies(list); setState('ready'); } })
        .catch((e) => { if (live) { setError(e.message); setState('error'); } });
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
        <input id="movie-search" type="search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={hasTmdb ? 'Search any movie' : 'Search 150 built-in movies'} aria-label="Search movies" className="w-full rounded-full border border-aisle bg-seat py-3 pl-11 pr-10 text-cream placeholder:text-dim focus:border-gold focus:outline-none" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-dim hover:text-cream"><X size={16} /></button>}
      </div>

      {state === 'idle' && <p className="py-10 text-center text-sm text-dim">Type a title to find a movie and rate it.</p>}
      {state === 'error' && <p className="rounded-lg border border-velvet bg-velvet/15 p-4 text-sm text-cream">{error}</p>}
      {state === 'loading' && <p className="py-10 text-center text-sm text-dim">Searching…</p>}
      {state === 'ready' && movies.length === 0 && (
        <p className="py-10 text-center text-sm text-dim">No movies match “{query}”.{!hasTmdb && ' Demo Mode only searches the built-in list. Add a TMDB key to search everything.'}</p>
      )}
      {state === 'ready' && movies.length > 0 && (
        <ol className="-mx-2 flex flex-col divide-y divide-aisle/60">
          {movies.map((m) => <MovieRow key={m.id} movie={entries[m.id]?.movie || m} onOpen={onOpen} right={<FamilyDots entry={entries[m.id]} profiles={profiles} />} />)}
        </ol>
      )}
    </div>
  );
}
