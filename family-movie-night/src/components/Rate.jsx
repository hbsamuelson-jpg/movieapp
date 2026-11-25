import { useEffect, useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal, Undo2 } from 'lucide-react';
import { hasTmdb, pref } from '../lib/config.js';
import { FIRST_YEAR, GENRE_CHOICES, THIS_YEAR, topOfYear } from '../lib/tmdb.js';
import { CertBadge, Chip, NOT_WATCHED, Notice, Poster, StarRating, STATUS } from './ui.jsx';

const PER_YEAR = [5, 10, 20];
const DECADES = [];
for (let y = Math.floor(THIS_YEAR / 10) * 10; y >= FIRST_YEAR; y -= 10) DECADES.push(y);

/**
 * Rate-through. One poster at a time: the top movies of a year, then the year before, and so on.
 * Watched it? Tap the stars. Haven't? Want to, Don't care, or No thanks.
 * Narrow it to categories you've seen a lot of, change how many per year, or jump to a decade.
 * It remembers where you stopped.
 */
export default function Rate({ entries, me, includeR, onRate }) {
  const [perYear, setPerYear] = useState(() => pref.get('rate-per-year', 10));
  const [genres, setGenres] = useState(() => pref.get('rate-genres', []));
  const [year, setYear] = useState(() => pref.get('rate-year', THIS_YEAR));
  const [movies, setMovies] = useState(null); // null while this year is loading
  const [error, setError] = useState('');
  const [handled, setHandled] = useState(() => new Set()); // rated or skipped this session
  const [history, setHistory] = useState([]); // [{ movie, rated }] for Undo
  const [stars, setStars] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const request = useRef(0);

  useEffect(() => { pref.set('rate-per-year', perYear); }, [perYear]);
  useEffect(() => { pref.set('rate-genres', genres); }, [genres]);
  useEffect(() => { pref.set('rate-year', year); }, [year]);

  const genreKey = genres.join('|');
  const load = () => {
    const ticket = ++request.current;
    setMovies(null);
    setError('');
    topOfYear({ year, perYear, genres, includeR })
      .then((list) => { if (ticket === request.current) setMovies(list); })
      .catch((e) => { if (ticket === request.current) setError(e.message); });
  };
  useEffect(load, [year, perYear, genreKey, includeR]); // eslint-disable-line react-hooks/exhaustive-deps

  const todo = (movies || []).filter((m) => !handled.has(String(m.id)) && !entries[m.id]?.ratings?.[me]);
  const movie = todo[0];
  const finished = year < FIRST_YEAR;

  // This year is done (or had nothing): step back a year.
  useEffect(() => {
    if (movies && !todo.length && !finished && !error) setYear((y) => y - 1);
  }, [movies, todo.length, finished, error]);

  const advance = (rated) => {
    setHandled((s) => new Set(s).add(String(movie.id)));
    setHistory((h) => [...h, { movie, rated }]);
    setStars(0);
  };
  const commit = (rating) => { onRate(movie, rating); advance(true); };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    if (last.rated) onRate(last.movie, null);
    setHandled((s) => { const next = new Set(s); next.delete(String(last.movie.id)); return next; });
    setHistory((h) => h.slice(0, -1));
    setStars(0);
    if (last.movie.year && last.movie.year !== year) setYear(last.movie.year);
  };
  const toggleGenre = (name) => setGenres((g) => (g.includes(name) ? g.filter((x) => x !== name) : [...g, name]));
  const ratedCount = history.filter((h) => h.rated).length;
  const position = movie ? (movies.findIndex((m) => m.id === movie.id) + 1) : 0;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setShowOptions((v) => !v)} aria-expanded={showOptions} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold ${genres.length ? 'border-gold text-gold' : 'border-aisle text-cream'}`}>
          <SlidersHorizontal size={15} />
          Top {perYear} of {finished ? '…' : year}{genres.length ? ` · ${genres.length === 1 ? genres[0] : `${genres.length} categories`}` : ''}
          <ChevronDown size={14} className={`transition-transform ${showOptions ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex items-center gap-3 text-sm text-dim">
          <span><span className="font-bold tabular-nums text-cream">{ratedCount}</span> rated</span>
          <button type="button" onClick={undo} disabled={!history.length} className="inline-flex items-center gap-1 font-bold text-cream disabled:text-aisle"><Undo2 size={15} /> Undo</button>
        </div>
      </div>

      {showOptions && (
        <div className="flex flex-col gap-3 rounded-xl bg-seat p-3">
          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-bold uppercase tracking-widest text-dim">How many from each year</div>
            <div className="flex gap-2">{PER_YEAR.map((n) => <Chip key={n} on={perYear === n} onClick={() => setPerYear(n)}>Top {n}</Chip>)}</div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-bold uppercase tracking-widest text-dim">Only these categories</div>
            <div className="flex flex-wrap gap-2">
              <Chip on={!genres.length} onClick={() => setGenres([])}>Everything</Chip>
              {GENRE_CHOICES.map((g) => <Chip key={g.id} on={genres.includes(g.name)} onClick={() => toggleGenre(g.name)}>{g.name}</Chip>)}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-bold uppercase tracking-widest text-dim">Jump to</div>
            <div className="flex flex-wrap gap-2">
              <Chip on={year === THIS_YEAR} onClick={() => setYear(THIS_YEAR)}>This year</Chip>
              {DECADES.map((d) => <Chip key={d} on={year <= d + 9 && year >= d && year !== THIS_YEAR} onClick={() => setYear(Math.min(d + 9, THIS_YEAR))}>{d}s</Chip>)}
            </div>
            <p className="text-xs text-dim">It works backwards from there, one year at a time, and remembers where you stopped.</p>
          </div>
        </div>
      )}

      {error && <Notice>{error} <button type="button" className="underline" onClick={load}>Try again</button></Notice>}

      {finished && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <h2 className="text-xl font-bold text-cream">You've gone all the way back to {FIRST_YEAR}</h2>
          <p className="text-sm text-dim">{hasTmdb ? 'Raise the number per year or add categories to see more.' : 'That is the whole built-in list. Add a TMDB key to get every year in full.'}</p>
          <button type="button" onClick={() => setYear(THIS_YEAR)} className="rounded-lg bg-velvet px-4 py-2 font-bold text-cream">Start again from {THIS_YEAR}</button>
        </div>
      )}
      {!finished && !movie && !error && <p className="py-16 text-center text-sm text-dim">Loading {year}…</p>}

      {movie && (
        <div key={movie.id} className="card-in flex flex-col items-center gap-4">
          <div className="w-44"><Poster movie={movie} size="w500" className="shadow-xl shadow-black/60" /></div>
          <div className="flex flex-col items-center gap-1 text-center">
            <h2 className="text-xl font-bold leading-tight text-cream">{movie.title}</h2>
            <div className="flex items-center gap-2 text-sm text-dim">
              <span className="tabular-nums">{movie.year}</span>
              <CertBadge cert={movie.cert} />
              <span className="tabular-nums">#{position} of {movies.length} in {year}</span>
            </div>
          </div>

          <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-seat p-4">
            <StarRating value={stars} onChange={setStars} size={44} label="Watched it: your rating" />
            {stars > 0 ? (
              <div className="grid w-full grid-cols-2 gap-2">
                <button type="button" onClick={() => commit({ status: 'seen', stars })} className="rounded-lg bg-aisle px-3 py-3 font-bold text-cream">Save {stars}★</button>
                <button type="button" onClick={() => commit({ status: 'again', stars })} className="rounded-lg bg-gold px-3 py-3 font-bold text-house">Save + watch again</button>
              </div>
            ) : (
              <span className="text-xs text-dim">Watched it? Tap a star. The left half gives a half star.</span>
            )}
          </div>

          <div className="grid w-full grid-cols-3 gap-2">
            {NOT_WATCHED.map((key) => {
              const s = STATUS[key];
              return (
                <button key={key} type="button" onClick={() => commit({ status: key, stars: null })} className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-sm font-bold ${key === 'unseen' ? 'bg-cream text-house' : 'bg-seat text-cream'}`}>
                  <s.icon size={20} />
                  {s.label}
                </button>
              );
            })}
          </div>
          <div className="-mt-2 text-xs text-dim">Haven't watched it? Pick one of these.</div>

          <button type="button" onClick={() => advance(false)} className="px-4 py-1 text-sm text-dim underline">Skip for now</button>
        </div>
      )}
    </div>
  );
}
