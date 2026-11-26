import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal, Undo2 } from 'lucide-react';
import { hasTmdb, pref } from '../lib/config.js';
import { enrich, ERAS, GENRE_CHOICES, topOfYear, yearsFor } from '../lib/tmdb.js';
import Rank from './Rank.jsx';
import { CertBadge, Chip, directedBy, NOT_WATCHED, Notice, Poster, ScoreBadge, StarRating, STATUS } from './ui.jsx';

const PER_YEAR = [5, 10, 20];
const MODES = [['swipe', 'Quick Swipe'], ['rank', 'Rank 5']];

/** Two ways to teach the app your taste: one poster at a time, or ranking a varied batch of five. */
export default function Rate({ entries, me, onRate }) {
  const [mode, setMode] = useState(() => pref.get('rate-mode', 'swipe'));
  const choose = (m) => { setMode(m); pref.set('rate-mode', m); };
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-seat p-1" role="tablist" aria-label="Rating mode">
        {MODES.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => choose(id)} className={`rounded-full py-2 text-sm font-bold transition ${mode === id ? 'bg-gold text-house' : 'text-dim hover:text-cream'}`}>{label}</button>
        ))}
      </div>
      {mode === 'swipe' ? <QuickSwipe entries={entries} me={me} onRate={onRate} /> : <Rank entries={entries} me={me} onRate={onRate} />}
    </div>
  );
}

/**
 * Quick Swipe. One poster at a time: the top movies of a year, then the year before.
 * The setup bar combines categories AND eras, so you can work through, say, 1990s sci-fi and
 * comedy only. It skips what you've rated and remembers where you stopped.
 */
function QuickSwipe({ entries, me, onRate }) {
  const [perYear, setPerYear] = useState(() => pref.get('rate-per-year', 10));
  const [genres, setGenres] = useState(() => pref.get('rate-genres', []));
  const [eras, setEras] = useState(() => pref.get('rate-eras', []));
  const years = useMemo(() => yearsFor(eras), [eras]);
  const [year, setYear] = useState(() => pref.get('rate-year', null) ?? years[0]);
  const [movies, setMovies] = useState(null); // null while this year is loading
  const [error, setError] = useState('');
  const [handled, setHandled] = useState(() => new Set()); // rated or skipped this session
  const [history, setHistory] = useState([]); // [{ movie, rated }] for Undo
  const [stars, setStars] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const request = useRef(0);

  useEffect(() => { pref.set('rate-per-year', perYear); }, [perYear]);
  useEffect(() => { pref.set('rate-genres', genres); }, [genres]);
  useEffect(() => { pref.set('rate-eras', eras); }, [eras]);
  useEffect(() => { pref.set('rate-year', year); }, [year]);

  // If the eras change and the current year falls outside them, restart from the newest allowed year.
  const finished = year === null;
  const genreKey = genres.join('|');
  useEffect(() => { if (finished || !years.includes(year)) setYear(years[0]); }, [years, genreKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const inRange = years.includes(year);

  const load = () => {
    if (finished || !inRange) return;
    const ticket = ++request.current;
    setMovies(null);
    setError('');
    topOfYear({ year, perYear, genres })
      .then((list) => { if (ticket === request.current) setMovies(list); })
      .catch((e) => { if (ticket === request.current) setError(e.message); });
  };
  useEffect(load, [year, perYear, genreKey, inRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const todo = (movies || []).filter((m) => !handled.has(String(m.id)) && !entries[m.id]?.ratings?.[me]);
  const next = finished ? null : todo[0];

  // Fetch the review score, rating and director for the card in front of you (and the one after).
  const [details, setDetails] = useState({});
  useEffect(() => {
    todo.slice(0, 2).filter((m) => !details[m.id]).forEach((m) => {
      enrich(m).then((full) => setDetails((all) => ({ ...all, [m.id]: full })));
    });
  }, [next?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const movie = next ? details[next.id] || next : null;

  // This year is done (or had nothing): step to the next year in the list.
  useEffect(() => {
    if (movies && !todo.length && !finished && inRange && !error) {
      const next = years[years.indexOf(year) + 1];
      setYear(next === undefined ? null : next);
    }
  }, [movies, todo.length, finished, inRange, error]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (last.movie.year && last.movie.year !== year && years.includes(last.movie.year)) setYear(last.movie.year);
  };
  const toggle = (list, set) => (value) => set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const toggleGenre = toggle(genres, setGenres);
  const toggleEra = toggle(eras, setEras);
  const ratedCount = history.filter((h) => h.rated).length;
  const position = movie ? movies.findIndex((m) => m.id === movie.id) + 1 : 0;

  const eraLabels = ERAS.filter((e) => eras.includes(e.id)).map((e) => e.label);
  const summary = [genres.length ? (genres.length <= 2 ? genres.join(' + ') : `${genres.length} categories`) : 'All categories', eraLabels.length ? (eraLabels.length <= 2 ? eraLabels.join(' + ') : `${eraLabels.length} eras`) : 'all years'].join(' · ');

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setShowSetup((v) => !v)} aria-expanded={showSetup} className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold ${genres.length || eras.length ? 'border-gold text-gold' : 'border-aisle text-cream'}`}>
          <SlidersHorizontal size={15} className="shrink-0" />
          <span className="truncate">{summary}</span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${showSetup ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex shrink-0 items-center gap-3 text-sm text-dim">
          <span><span className="font-bold tabular-nums text-cream">{ratedCount}</span> rated</span>
          <button type="button" onClick={undo} disabled={!history.length} className="inline-flex items-center gap-1 font-bold text-cream disabled:text-aisle"><Undo2 size={15} /> Undo</button>
        </div>
      </div>

      {showSetup && (
        <div className="flex flex-col gap-3 rounded-xl bg-seat p-3">
          <Group title="Categories" hint="Pick the ones you've watched a lot of. Any of them counts.">
            <Chip on={!genres.length} onClick={() => setGenres([])}>All</Chip>
            {GENRE_CHOICES.map((g) => <Chip key={g.id} on={genres.includes(g.name)} onClick={() => toggleGenre(g.name)}>{g.name}</Chip>)}
          </Group>
          <Group title="Eras" hint="Combined with the categories above.">
            <Chip on={!eras.length} onClick={() => setEras([])}>All years</Chip>
            {ERAS.map((e) => <Chip key={e.id} on={eras.includes(e.id)} onClick={() => toggleEra(e.id)}>{e.label}</Chip>)}
          </Group>
          <Group title="How many from each year">
            {PER_YEAR.map((n) => <Chip key={n} on={perYear === n} onClick={() => setPerYear(n)}>Top {n}</Chip>)}
          </Group>
          <button type="button" onClick={() => { setYear(years[0]); setShowSetup(false); }} className="self-start text-sm text-dim underline">Start over from {years[0]}</button>
        </div>
      )}

      {error && <Notice>{error} <button type="button" className="underline" onClick={load}>Try again</button></Notice>}

      {finished && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <h2 className="text-xl font-bold text-cream">That's everything in this slice</h2>
          <p className="text-sm text-dim">{hasTmdb ? 'Add categories or eras, or raise the number per year, to see more.' : 'That is the whole built-in list for these choices.'}</p>
          <button type="button" onClick={() => setYear(years[0])} className="rounded-lg bg-velvet px-4 py-2 font-bold text-cream">Go through it again</button>
        </div>
      )}
      {!finished && !movie && !error && <p className="py-16 text-center text-sm text-dim">Loading {year}…</p>}

      {movie && (
        <div key={movie.id} className="card-in flex flex-col items-center gap-4">
          <div className="w-44"><Poster movie={movie} size="w500" className="shadow-xl shadow-black/60" /></div>
          <div className="flex flex-col items-center gap-1 text-center">
            <h2 className="text-xl font-bold leading-tight text-cream">{movie.title}</h2>
            <div className="flex items-center gap-2 text-sm text-dim">
              <ScoreBadge movie={movie} />
              <span className="tabular-nums">{movie.year}</span>
              <CertBadge cert={movie.cert} />
              <span className="tabular-nums">#{position} of {movies.length}</span>
            </div>
            <div className="text-xs text-dim">{[movie.genres?.slice(0, 3).join(' · '), directedBy(movie)].filter(Boolean).join(' · ')}</div>
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
    </>
  );
}

function Group({ title, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs font-bold uppercase tracking-widest text-dim">{title}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
      {hint && <p className="text-xs text-dim">{hint}</p>}
    </div>
  );
}
