import { useMemo, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { CERTS } from '../lib/config.js';
import { applyFilters, buildWatchTogether } from '../lib/together.js';
import { Chip, FamilyDots, MovieRow } from './ui.jsx';

const RUNTIMES = [[0, 'Any length'], [90, '90 min or less'], [105, '1h 45m or less'], [120, '2 hours or less']];
const LANES = {
  new: { label: 'New to us', cls: 'text-gold' },
  favorite: { label: 'Family favorite', cls: 'text-cream' },
  vote: { label: 'Needs a vote', cls: 'text-dim' },
};

/** The shared queue: one ranked list of what all three of you can watch together. */
export default function Queue({ entries, profiles, onOpen, onRate }) {
  const [lane, setLane] = useState('all');
  const [filters, setFilters] = useState({ genre: '', certs: [], maxRuntime: 0 });
  const [showFilters, setShowFilters] = useState(false);
  const [showVetoed, setShowVetoed] = useState(false);

  const lists = useMemo(() => buildWatchTogether(entries), [entries]);
  const all = useMemo(() => [...lists.topPicks, ...lists.favorites, ...lists.compromise], [lists]);
  const genres = useMemo(() => [...new Set(all.flatMap((e) => e.movie.genres || []))].sort(), [all]);

  const filtered = applyFilters(all, filters);
  const shown = lane === 'all' ? filtered : filtered.filter((e) => e.lane === lane);
  const count = (key) => (key === 'all' ? filtered.length : filtered.filter((e) => e.lane === key).length);
  const active = (filters.genre ? 1 : 0) + filters.certs.length + (filters.maxRuntime ? 1 : 0);
  const name = (id) => profiles.find((p) => p.id === id)?.name || id;
  const toggleCert = (c) => setFilters((f) => ({ ...f, certs: f.certs.includes(c) ? f.certs.filter((x) => x !== c) : [...f.certs, c] }));

  const note = (e) => {
    const detail = e.lane === 'new' ? `${e.match}% match` : e.lane === 'favorite' ? `${e.avg.toFixed(1)} family average` : `waiting on ${name(e.waitingOn)}`;
    return <><span className={`font-bold ${LANES[e.lane].cls}`}>{LANES[e.lane].label}</span><span className="text-dim"> · {detail}</span></>;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-cream">Our queue</h2>
          <p className="text-sm text-dim">What all three of you can watch together, best bet first.</p>
        </div>
        <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold ${active ? 'border-gold text-gold' : 'border-aisle text-cream'}`}>
          <SlidersHorizontal size={15} /> Filters{active ? ` (${active})` : ''}
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-seat p-3">
          <div className="flex gap-1.5" role="group" aria-label="MPAA rating">
            {CERTS.map((c) => <Chip key={c} on={filters.certs.includes(c)} onClick={() => toggleCert(c)}>{c}</Chip>)}
          </div>
          <Select id="filter-genre" label="Genre" value={filters.genre} onChange={(v) => setFilters((f) => ({ ...f, genre: v }))} options={[['', 'Any genre'], ...genres.map((g) => [g, g])]} />
          <Select id="filter-runtime" label="Runtime" value={filters.maxRuntime} onChange={(v) => setFilters((f) => ({ ...f, maxRuntime: Number(v) }))} options={RUNTIMES} />
          {active > 0 && <button type="button" onClick={() => setFilters({ genre: '', certs: [], maxRuntime: 0 })} className="text-sm text-dim underline">Clear</button>}
        </div>
      )}

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Chip on={lane === 'all'} onClick={() => setLane('all')}>All {count('all')}</Chip>
        {Object.entries(LANES).map(([key, l]) => <Chip key={key} on={lane === key} onClick={() => setLane(key)}>{l.label} {count(key)}</Chip>)}
      </div>

      {shown.length ? (
        <ol className="-mx-2 flex flex-col divide-y divide-aisle/60">
          {shown.map((e, n) => (
            <MovieRow key={e.movie.id} movie={e.movie} index={n + 1} onOpen={onOpen} note={note(e)} right={<FamilyDots entry={e} profiles={profiles} />} />
          ))}
        </ol>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-aisle p-5 text-sm text-dim">
          <p>{all.length ? 'Nothing in the queue matches these filters.' : 'The queue fills up as each of you rates movies. A movie lands here once all three of you are open to it.'}</p>
          <button type="button" onClick={onRate} className="rounded-lg bg-velvet px-4 py-2 font-bold text-cream">Rate some movies</button>
        </div>
      )}

      {lists.vetoed.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-aisle pt-3">
          <button type="button" onClick={() => setShowVetoed((v) => !v)} aria-expanded={showVetoed} className="inline-flex items-center gap-1.5 self-start text-sm text-dim hover:text-cream">
            {lists.vetoed.length} ruled out
            <ChevronDown size={15} className={`transition-transform ${showVetoed ? 'rotate-180' : ''}`} />
          </button>
          {showVetoed && (
            <>
              <p className="max-w-prose text-xs text-dim">A No thanks, or 1–2 stars without Watch again, keeps a movie out of the queue.</p>
              <ol className="-mx-2 flex flex-col divide-y divide-aisle/60 opacity-70">
                {lists.vetoed.map((e) => (
                  <MovieRow key={e.movie.id} movie={e.movie} onOpen={onOpen} note={<span className="text-dim">Ruled out by {e.vetoedBy.map(name).join(' and ')}</span>} right={<FamilyDots entry={e} profiles={profiles} />} />
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Select({ id, label, value, onChange, options }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none rounded-full border border-aisle bg-house py-1.5 pl-3.5 pr-8 text-sm font-bold text-cream">
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-dim" />
    </label>
  );
}
