import { useEffect, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { browse, DECKS } from '../lib/tmdb.js';
import { CertBadge, Chip, formatRuntime, NOT_WATCHED, Poster, StarRating, STATUS } from './ui.jsx';

/**
 * Rate-through: one movie at a time from a "best of" deck, skipping anything this profile already rated.
 * Watched it? Tap the stars. Haven't? Want to, Indifferent, or No thanks. Keeps loading more as you go.
 */
export default function Rate({ entries, active, onRate }) {
  const [deckId, setDeckId] = useState('best');
  const [movies, setMovies] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [handled, setHandled] = useState(() => new Set()); // rated or skipped this session
  const [history, setHistory] = useState([]); // [{ movie, rated }] for Undo
  const [stars, setStars] = useState(0);
  const request = useRef(0);

  const load = async (deck, nextPage) => {
    const ticket = ++request.current;
    setLoading(true);
    setError('');
    try {
      const res = await browse(deck, nextPage);
      if (ticket !== request.current) return;
      setMovies((prev) => (nextPage === 1 ? res.movies : [...prev, ...res.movies.filter((m) => !prev.some((p) => p.id === m.id))]));
      setPage(nextPage);
      setHasMore(res.hasMore);
    } catch (e) {
      if (ticket === request.current) setError(e.message);
    }
    if (ticket === request.current) setLoading(false);
  };

  useEffect(() => {
    setMovies([]);
    setHandled(new Set());
    setHistory([]);
    setStars(0);
    load(deckId, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  const todo = movies.filter((m) => !handled.has(m.id) && !entries[m.id]?.ratings?.[active.id]);
  const movie = todo[0];

  // Keep the deck topped up so there is always a next card.
  useEffect(() => {
    if (todo.length < 4 && hasMore && !loading && !error && page > 0) load(deckId, page + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todo.length, hasMore, loading, error, page]);

  const advance = (rated) => {
    setHandled((s) => new Set(s).add(movie.id));
    setHistory((h) => [...h, { movie, rated }]);
    setStars(0);
  };
  const commit = (rating) => { onRate(movie, active.id, rating); advance(true); };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    if (last.rated) onRate(last.movie, active.id, null);
    setHandled((s) => { const next = new Set(s); next.delete(last.movie.id); return next; });
    setHistory((h) => h.slice(0, -1));
    setStars(0);
  };
  const ratedCount = history.filter((h) => h.rated).length;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {DECKS.map((d) => <Chip key={d.id} on={deckId === d.id} onClick={() => setDeckId(d.id)}>{d.label}</Chip>)}
      </div>

      <div className="flex items-center justify-between text-sm text-dim">
        <span><span className="font-bold tabular-nums text-cream">{ratedCount}</span> rated as {active.name}{todo.length ? <> · <span className="tabular-nums">{todo.length}{hasMore ? '+' : ''}</span> to go</> : null}</span>
        <button type="button" onClick={undo} disabled={!history.length} className="inline-flex items-center gap-1 font-bold text-cream disabled:text-aisle"><Undo2 size={15} /> Undo</button>
      </div>

      {error && <p className="rounded-lg border border-velvet bg-velvet/15 p-3 text-sm">{error} <button type="button" className="underline" onClick={() => load(deckId, page + 1)}>Try again</button></p>}

      {!movie && loading && <p className="py-16 text-center text-sm text-dim">Loading movies…</p>}
      {!movie && !loading && !error && (
        <div className="flex flex-col items-center gap-2 py-14 text-center">
          <h2 className="text-xl font-bold text-cream">You've been through this whole list</h2>
          <p className="text-sm text-dim">Pick another list above, or search for a specific movie.</p>
        </div>
      )}

      {movie && (
        <div key={movie.id} className="card-in flex flex-col gap-5">
          <div className="flex gap-4">
            <div className="w-28 shrink-0"><Poster movie={movie} /></div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <h2 className="text-xl font-bold leading-tight text-cream">{movie.title}</h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-dim">
                {movie.year && <span className="tabular-nums">{movie.year}</span>}
                <CertBadge cert={movie.cert} />
                {movie.runtime && <span className="tabular-nums">{formatRuntime(movie.runtime)}</span>}
              </div>
              <p className="line-clamp-5 text-sm leading-snug text-cream/75">{movie.overview}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold uppercase tracking-widest text-dim">Watched it</div>
            <div className="flex flex-col items-center gap-3 rounded-xl bg-seat p-4">
              <StarRating value={stars} onChange={setStars} size={44} />
              {stars > 0 ? (
                <div className="grid w-full grid-cols-2 gap-2">
                  <button type="button" onClick={() => commit({ status: 'seen', stars })} className="rounded-lg bg-aisle px-3 py-3 font-bold text-cream">Save {stars}★</button>
                  <button type="button" onClick={() => commit({ status: 'again', stars })} className="rounded-lg bg-gold px-3 py-3 font-bold text-house">Save + watch again</button>
                </div>
              ) : (
                <span className="text-xs text-dim">Tap a star. Left half of a star gives a half.</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold uppercase tracking-widest text-dim">Haven't watched it</div>
            <div className="grid grid-cols-3 gap-2">
              {NOT_WATCHED.map((key) => {
                const s = STATUS[key];
                return (
                  <button key={key} type="button" onClick={() => commit({ status: key, stars: null })} className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3.5 text-sm font-bold ${key === 'unseen' ? 'bg-cream text-house' : 'bg-seat text-cream'}`}>
                    <s.icon size={20} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button type="button" onClick={() => advance(false)} className="self-center px-4 py-1 text-sm text-dim underline">Skip for now</button>
        </div>
      )}
    </div>
  );
}
