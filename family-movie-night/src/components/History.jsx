import { useState } from 'react';
import { ArrowLeft, Star, X } from 'lucide-react';
import { shownStars } from '../lib/suggest.js';
import { MemberDots, Poster } from './ui.jsx';

const HOW = { vote: 'Chosen by secret vote', spin: 'Chosen by spin', pick: 'Picked' };
const when = (ms) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const names = (ids, members, me) => ids.map((id) => (id === me ? 'you' : members.find((m) => m.id === id)?.name)).filter(Boolean).join(', ');

/** Every movie night so far: what you watched, when, how it was chosen, who was there, and what everyone thought. */
export default function History({ history, entries, members, me, onBack, onOpen, onRemove }) {
  const [removing, setRemoving] = useState(null);
  const nights = [...history].sort((a, b) => b.at - a.at);

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-dim hover:text-cream"><ArrowLeft size={16} /> Back to tonight</button>
      <div>
        <h2 className="text-2xl font-bold text-cream">Movie nights</h2>
        <p className="text-sm text-dim">{nights.length ? `${nights.length} so far. Rate each one after you've watched it.` : 'Nothing here yet.'}</p>
      </div>

      {nights.length === 0 && (
        <p className="rounded-lg border border-dashed border-aisle p-5 text-sm text-dim">When you settle on a movie, tap "We're watching this" on the vote result or the spin, or "We watched this" on any movie's page. It lands here with the date and who was there.</p>
      )}

      <ol className="flex flex-col gap-3">
        {nights.map((night) => {
          const entry = entries[night.movie.id];
          const movie = entry?.movie || night.movie;
          const watchers = members.filter((m) => night.watchers.includes(m.id));
          const scores = night.watchers.map((id) => shownStars(entry?.ratings?.[id])).filter(Boolean);
          const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
          const iWatched = night.watchers.includes(me);
          const myScore = shownStars(entry?.ratings?.[me]);
          return (
            <li key={night.id} className="flex flex-col gap-3 rounded-xl bg-seat p-3">
              <div className="flex gap-3">
                <button type="button" onClick={() => onOpen(movie)} className="w-16 shrink-0" aria-label={`Open ${movie.title}`}><Poster movie={movie} size="w185" /></button>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => onOpen(movie)} className="text-left text-lg font-bold leading-tight text-cream">{movie.title}</button>
                    {removing === night.id
                      ? <span className="flex shrink-0 items-center gap-2 text-xs text-dim">Remove? <button type="button" onClick={() => { onRemove(night.id); setRemoving(null); }} className="font-bold text-cream underline">Yes</button><button type="button" onClick={() => setRemoving(null)} className="underline">No</button></span>
                      : <button type="button" onClick={() => setRemoving(night.id)} aria-label={`Remove ${movie.title} from history`} className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-dim hover:text-cream"><X size={15} /></button>}
                  </div>
                  <div className="text-sm text-cream">{when(night.at)}</div>
                  <div className="text-xs text-dim">
                    {HOW[night.via] || HOW.pick}
                    {night.via === 'vote' && night.voters?.length ? ` · ${night.ranked ? `${night.votes} points` : `${night.votes} of ${night.voters.length} votes`} · voted: ${names(night.voters, members, me)}` : ''}
                  </div>
                  <div className="text-xs text-dim">Watched by {names(night.watchers, members, me) || 'nobody recorded'}</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-aisle pt-3">
                <div className="flex items-center gap-3">
                  <MemberDots entry={entry} members={watchers} />
                  {average != null
                    ? <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums text-gold"><Star size={14} fill="currentColor" strokeWidth={0} />{average.toFixed(1)} <span className="font-normal text-dim">from {scores.length} of {night.watchers.length}</span></span>
                    : <span className="text-xs text-dim">No scores yet</span>}
                </div>
                {iWatched && <button type="button" onClick={() => onOpen(movie)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${myScore ? 'border border-aisle text-cream' : 'bg-velvet text-cream'}`}>{myScore ? 'Change my score' : 'Give it a score'}</button>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
