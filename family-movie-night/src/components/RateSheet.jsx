import { useEffect, useState } from 'react';
import { Check, Clock, Play, Plus, X } from 'lucide-react';
import { shownStars } from '../lib/suggest.js';
import { enrich, pricesUrl, trailerUrl } from '../lib/tmdb.js';

const SNOOZE = 21 * 24 * 60 * 60 * 1000; // "not tonight" hides a movie for three weeks
const day = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
import { Avatar, CertBadge, directedBy, formatRuntime, ScoreBadge, NOT_WATCHED, Poster, StarRating, STATUS, StatusStub, TitleLink, KeyHint, useStarKeys } from './ui.jsx';

/** Bottom sheet: movie details, your rating, the shortlist toggle, and what everyone else said. */
export default function RateSheet({ movie: initial, entry, members, me, listed, snoozedUntil, onSnooze, onToggleListed, onWatched, onSave, onClose }) {
  const [movie, setMovie] = useState(entry?.movie?.detailed ? entry.movie : initial);
  const mine = entry?.ratings?.[me];
  const [status, setStatus] = useState(mine?.status || null);
  const [stars, setStars] = useState(shownStars(mine) || 0);

  useEffect(() => {
    let live = true;
    enrich(movie).then((full) => live && setMovie(full));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const watched = status === 'seen' || status === 'again';
  const pickStars = (v) => { setStars(v); if (!watched) setStatus('seen'); };
  const pickNotWatched = (s) => { setStatus(s); setStars(0); };
  const canSave = status && (!watched || stars > 0);
  const save = () => { onSave(movie, { status, stars: watched ? stars : null }); onClose(); };
  const clear = () => { onSave(movie, null); onClose(); };
  const others = members.filter((m) => m.id !== me);
  useStarKeys({ stars, onStars: (v) => (v > 0 ? pickStars(v) : setStars(0)), onSave: save });

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Rate ${movie.title}`} className="sheet-in flex max-h-[92%] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-t-2xl bg-seat p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-4">
          <div className="w-24 shrink-0"><Poster movie={movie} /></div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-bold leading-tight text-cream"><TitleLink movie={movie} /></h2>
              <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 rounded-full p-2 text-dim hover:bg-aisle hover:text-cream"><X size={20} /></button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ScoreBadge movie={movie} size="lg" />
              <a href={trailerUrl(movie)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-aisle px-2.5 py-1 text-xs font-bold text-cream hover:border-dim"><Play size={12} fill="currentColor" /> Trailer</a>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-dim">
              {movie.year && <span className="tabular-nums">{movie.year}</span>}
              <CertBadge cert={movie.cert} />
              {movie.runtime && <span className="tabular-nums">{formatRuntime(movie.runtime)}</span>}
              {movie.genres?.length > 0 && <span>{movie.genres.slice(0, 3).join(', ')}</span>}
            </div>
            {directedBy(movie) && <div className="text-xs text-dim">{directedBy(movie)}</div>}
            <p className="line-clamp-4 text-sm leading-snug text-cream/75">{movie.overview || 'No synopsis available.'}</p>
          </div>
        </div>

        {movie.watch && (
          <div className="flex flex-col gap-1.5">
            <div className="text-xs font-bold uppercase tracking-widest text-dim">Where to watch</div>
            {[['Free', movie.watch.free || [], 'border-gold bg-gold/15 text-gold'], ['Included with', movie.watch.on || [], 'border-aisle text-cream']].filter(([, list]) => list.length).map(([label, list, style]) => (
              <div key={label} className="flex flex-wrap items-center gap-1.5">
                <span className="w-24 shrink-0 text-xs text-dim">{label}</span>
                {list.map((s) => <span key={s.name} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${style}`}>{s.name}</span>)}
              </div>
            ))}
            {!(movie.watch.free || []).length && !(movie.watch.on || []).length && (
              <p className="text-sm text-dim">{(movie.watch.rent || []).length ? `Not on any streaming service right now. Rent or buy it on ${movie.watch.rent.slice(0, 3).join(', ')}.` : 'Not available to stream, rent or buy in the US right now.'}</p>
            )}
            <p className="text-[11px] text-dim">From JustWatch, US; can lag a few days. {(movie.watch.rent || []).length > 0 && <a href={pricesUrl(movie)} target="_blank" rel="noopener noreferrer" className="font-bold text-cream underline">Compare rental prices</a>}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => onToggleListed(movie)} aria-pressed={listed} className={`inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-2.5 text-sm font-bold ${listed ? 'border-gold bg-gold text-house' : 'border-aisle text-cream'}`}>
          {listed ? <><Check size={16} /> On the shortlist</> : <><Plus size={16} /> Up for tonight</>}
        </button>
          <button type="button" onClick={() => { onWatched(movie); onClose(); }} className="inline-flex items-center justify-center gap-2 rounded-lg border border-aisle px-2 py-2.5 text-sm font-bold text-cream">We watched this</button>
          {snoozedUntil
            ? <p className="col-span-2 text-sm text-dim">Hidden from your suggestions until {day(snoozedUntil)}. <button type="button" onClick={() => onSnooze(movie, null)} className="font-bold text-cream underline">Bring it back</button></p>
            : <button type="button" onClick={() => { onSnooze(movie, Date.now() + SNOOZE); onClose(); }} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-bold text-dim hover:text-cream"><Clock size={15} /> Not tonight (hide for 3 weeks)</button>}
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold uppercase tracking-widest text-dim">Watched it</div>
          <div className={`flex flex-col items-center gap-3 rounded-xl bg-house p-4 ${watched ? 'ring-1 ring-gold' : ''}`}>
            <StarRating value={stars} onChange={pickStars} size={40} />
            <KeyHint />
            <label className={`flex items-center gap-2 text-sm font-bold ${watched ? 'text-cream' : 'text-dim'}`}>
              <input id="watch-again" type="checkbox" className="h-4 w-4 accent-[#F5C518]" disabled={!watched} checked={status === 'again'} onChange={(e) => setStatus(e.target.checked ? 'again' : 'seen')} />
              Would watch again
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className={`text-xs font-bold uppercase tracking-widest text-dim ${stars > 0 ? 'opacity-40' : ''}`}>Haven't watched it</div>
          <div className="grid grid-cols-3 gap-2">
            {NOT_WATCHED.map((key) => {
              const s = STATUS[key];
              const on = status === key;
              return (
                <button key={key} type="button" aria-pressed={on} onClick={() => pickNotWatched(key)} className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-sm font-bold transition ${on ? 'bg-gold text-house' : stars > 0 ? 'bg-house text-dim opacity-40' : 'bg-house text-cream'}`}>
                  <s.icon size={20} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mine && <button type="button" onClick={clear} className="rounded-lg px-3 py-3 text-sm text-dim underline">Remove my rating</button>}
          <button type="button" disabled={!canSave} onClick={save} className="flex-1 rounded-lg bg-velvet px-4 py-3 font-bold text-cream transition hover:bg-red-600 disabled:bg-aisle disabled:text-dim">Save</button>
        </div>

        {others.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-aisle pt-3">
            {others.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <Avatar member={m} size={22} />
                <span className="w-24 truncate text-cream">{m.name}</span>
                {entry?.ratings?.[m.id] ? <StatusStub rating={entry.ratings[m.id]} /> : <span className="text-xs text-dim">No vote yet</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
