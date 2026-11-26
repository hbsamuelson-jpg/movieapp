import { useMemo, useState } from 'react';
import { liking, tasteProfile } from '../lib/suggest.js';
import { Chip, MovieRow, StatusStub } from './ui.jsx';

const TABS = [['all', 'All'], ['unseen', 'Want to'], ['seen', 'Watched'], ['again', 'Watch again'], ['meh', "Don't care"], ['pass', 'No thanks']];
const TASTE_MIN = 8; // star ratings needed before the taste summary means anything

/** Everything you have rated, and what the app has learned about your taste. */
export default function Mine({ entries, me, onOpen, onRate }) {
  const [tab, setTab] = useState('all');
  const mine = Object.values(entries)
    .filter((e) => e.ratings?.[me])
    .sort((a, b) => (liking(b.ratings[me]) || 0) - (liking(a.ratings[me]) || 0) || a.movie.title.localeCompare(b.movie.title));
  const count = (key) => (key === 'all' ? mine.length : mine.filter((e) => e.ratings[me].status === key).length);
  const shown = tab === 'all' ? mine : mine.filter((e) => e.ratings[me].status === tab);
  const taste = useMemo(() => tasteProfile(entries, me), [entries, me]);
  const top = taste.genres.filter((g) => g.n >= 2).slice(0, 6);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-xl bg-seat p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold text-cream">Your taste so far</h2>
          <span className="text-xs tabular-nums text-dim">learned from {taste.count} {taste.count === 1 ? 'movie' : 'movies'} you've watched</span>
        </div>
        {taste.count < TASTE_MIN || !top.length ? (
          <p className="text-sm text-dim">Rate {Math.max(1, TASTE_MIN - taste.count)} more movies you've watched and this fills in. The more you rate, the better the suggestions get.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {top.map((g) => (
              <li key={g.name} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate font-bold text-cream">{g.name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-aisle"><span className="block h-full rounded-full bg-gold" style={{ width: `${(g.score / 5) * 100}%` }} /></span>
                <span className="tabular-nums text-dim">{g.n} {g.n === 1 ? 'movie' : 'movies'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold text-cream">My ratings</h2>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {TABS.filter(([key]) => key === 'all' || key === tab || count(key) > 0).map(([key, label]) => (
            <Chip key={key} on={tab === key} onClick={() => setTab(key)}>{label} {count(key)}</Chip>
          ))}
        </div>
        {shown.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-aisle p-5 text-sm text-dim">
            <p>Nothing rated yet.</p>
            <button type="button" onClick={onRate} className="rounded-lg bg-velvet px-4 py-2 font-bold text-cream">Rate some movies</button>
          </div>
        ) : (
          <ol className="-mx-2 flex flex-col divide-y divide-aisle/60">
            {shown.map((e) => <MovieRow key={e.movie.id} movie={e.movie} onOpen={onOpen} aside={<StatusStub rating={e.ratings[me]} />} />)}
          </ol>
        )}
      </section>
    </div>
  );
}
