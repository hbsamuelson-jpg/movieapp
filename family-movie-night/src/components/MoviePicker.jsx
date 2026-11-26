import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { searchMovies } from '../lib/tmdb.js';
import { Poster } from './ui.jsx';

/** Type a title, pick it from the results. `chosen` movies show as removable chips above the box. */
export default function MoviePicker({ id, chosen = [], placeholder, label, onAdd, onRemove, chips = true }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return undefined; }
    let live = true;
    const timer = setTimeout(() => {
      searchMovies(q).then((list) => live && setResults(list.slice(0, 6))).catch(() => live && setResults([]));
    }, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [query]);

  return (
    <div className="flex flex-col gap-2">
      {chips && chosen.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chosen.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-gold py-1 pl-3 pr-1 text-sm font-bold text-house">
              {m.title}
              <button type="button" onClick={() => onRemove(m.id)} aria-label={`Remove ${m.title}`} className="rounded-full p-1 hover:bg-black/10"><X size={14} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
        <input id={id} type="search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} aria-label={label} className="w-full rounded-full border border-aisle bg-house py-2.5 pl-9 pr-3 text-sm text-cream placeholder:text-dim focus:border-gold focus:outline-none" />
      </div>
      {results.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-xl border border-aisle bg-seat">
          {results.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => { onAdd(m); setQuery(''); setResults([]); }} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-aisle">
                <span className="w-7 shrink-0"><Poster movie={m} size="w92" className="rounded-sm" /></span>
                <span className="min-w-0 flex-1 truncate font-bold text-cream">{m.title}</span>
                <span className="tabular-nums text-dim">{m.year || ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
