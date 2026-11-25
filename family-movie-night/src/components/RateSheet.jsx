import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { enrich } from '../lib/tmdb.js';
import { Avatar, CertBadge, formatRuntime, NOT_WATCHED, Poster, StarRating, STATUS, StatusStub } from './ui.jsx';

/** Bottom sheet: movie details plus the active profile's rating. */
export default function RateSheet({ movie: initial, entry, profiles, active, onSave, onClose }) {
  const [movie, setMovie] = useState(entry?.movie?.detailed ? entry.movie : initial);
  const mine = entry?.ratings?.[active.id];
  const [status, setStatus] = useState(mine?.status || null);
  const [stars, setStars] = useState(mine?.stars || 0);

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
  const save = () => { onSave(movie, active.id, { status, stars: watched ? stars : null }); onClose(); };
  const clear = () => { onSave(movie, active.id, null); onClose(); };

  const others = profiles.filter((p) => p.id !== active.id);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Rate ${movie.title}`} className="sheet-in flex max-h-[92%] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-t-2xl bg-seat p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-4">
          <div className="w-24 shrink-0"><Poster movie={movie} /></div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-bold leading-tight text-cream">{movie.title}</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 rounded-full p-2 text-dim hover:bg-aisle hover:text-cream"><X size={20} /></button>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-dim">
              {movie.year && <span className="tabular-nums">{movie.year}</span>}
              <CertBadge cert={movie.cert} />
              {movie.runtime && <span className="tabular-nums">{formatRuntime(movie.runtime)}</span>}
              {movie.genres?.length > 0 && <span>{movie.genres.slice(0, 3).join(', ')}</span>}
            </div>
            <p className="line-clamp-4 text-sm leading-snug text-cream/75">{movie.overview || 'No synopsis available.'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Avatar avatar={active.avatar} size={26} />
          <span className="font-bold text-cream">{active.name}'s take</span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold uppercase tracking-widest text-dim">Watched it</div>
          <div className={`flex flex-col items-center gap-3 rounded-xl bg-house p-4 ${watched ? 'ring-1 ring-gold' : ''}`}>
            <StarRating value={stars} onChange={pickStars} size={40} />
            <label className={`flex items-center gap-2 text-sm font-bold ${watched ? 'text-cream' : 'text-dim'}`}>
              <input id="watch-again" type="checkbox" className="h-4 w-4 accent-[#F5C518]" disabled={!watched} checked={status === 'again'} onChange={(e) => setStatus(e.target.checked ? 'again' : 'seen')} />
              Would watch again
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold uppercase tracking-widest text-dim">Haven't watched it</div>
          <div className="grid grid-cols-3 gap-2">
            {NOT_WATCHED.map((key) => {
              const s = STATUS[key];
              const on = status === key;
              return (
                <button key={key} type="button" aria-pressed={on} onClick={() => pickNotWatched(key)} className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-sm font-bold transition ${on ? 'bg-gold text-house' : 'bg-house text-cream'}`}>
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

        <div className="flex flex-col gap-2 border-t border-aisle pt-3">
          {others.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-sm">
              <Avatar avatar={p.avatar} size={22} />
              <span className="w-20 truncate text-cream">{p.name}</span>
              {entry?.ratings?.[p.id] ? <StatusStub rating={entry.ratings[p.id]} /> : <span className="text-xs text-dim">No vote yet</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
