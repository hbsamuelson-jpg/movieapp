import { useState } from 'react';
import { Chip, MovieRow, StatusStub } from './ui.jsx';

const TABS = [['all', 'All'], ['unseen', 'Want to'], ['seen', 'Watched'], ['again', 'Watch again'], ['meh', 'Indifferent'], ['pass', 'No thanks']];

/** Everything the active profile has rated. */
export default function MyTickets({ entries, active, onOpen, onRate }) {
  const [tab, setTab] = useState('all');
  const mine = Object.values(entries)
    .filter((e) => e.ratings?.[active.id])
    .sort((a, b) => (b.ratings[active.id].stars || 0) - (a.ratings[active.id].stars || 0) || a.movie.title.localeCompare(b.movie.title));
  const count = (key) => (key === 'all' ? mine.length : mine.filter((e) => e.ratings[active.id].status === key).length);
  const shown = tab === 'all' ? mine : mine.filter((e) => e.ratings[active.id].status === tab);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold text-cream">{active.name}'s ratings</h2>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.filter(([key]) => key === 'all' || key === tab || count(key) > 0).map(([key, label]) => (
          <Chip key={key} on={tab === key} onClick={() => setTab(key)}>{label} {count(key)}</Chip>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-aisle p-5 text-sm text-dim">
          <p>Nothing rated here yet.</p>
          <button type="button" onClick={onRate} className="rounded-lg bg-velvet px-4 py-2 font-bold text-cream">Rate some movies</button>
        </div>
      ) : (
        <ol className="-mx-2 flex flex-col divide-y divide-aisle/60">
          {shown.map((e) => <MovieRow key={e.movie.id} movie={e.movie} onOpen={onOpen} right={<StatusStub rating={e.ratings[active.id]} />} />)}
        </ol>
      )}
    </div>
  );
}
