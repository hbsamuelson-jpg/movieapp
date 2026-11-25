import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Dices, Plus, SlidersHorizontal, X } from 'lucide-react';
import { CERTS } from '../lib/config.js';
import { applyFilters, suggest } from '../lib/suggest.js';
import { Avatar, CertBadge, Chip, formatRuntime, MemberDots, MovieRow, Poster } from './ui.jsx';

const RUNTIMES = [[0, 'Any length'], [90, '90 min or less'], [105, '1h 45m or less'], [120, '2 hours or less']];

/** Who's here, what the app suggests for them, and the shortlist you put up for a choice or a spin. */
export default function Tonight({ entries, members, me, shortlist, onShortlist, onOpen, onRate }) {
  const [away, setAway] = useState([]); // ids of people not watching tonight
  const [filters, setFilters] = useState({ genre: '', certs: [], maxRuntime: 0 });
  const [showFilters, setShowFilters] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const present = members.filter((m) => !away.includes(m.id));
  const presentIds = present.map((m) => m.id);
  const toggle = (id) => setAway((a) => (a.includes(id) ? a.filter((x) => x !== id) : present.length > 1 ? [...a, id] : a));

  const ranked = useMemo(() => suggest(entries, presentIds), [entries, presentIds.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const genres = useMemo(() => [...new Set(ranked.flatMap((e) => e.movie.genres || []))].sort(), [ranked]);
  const shown = applyFilters(ranked, filters);
  const activeFilters = (filters.genre ? 1 : 0) + filters.certs.length + (filters.maxRuntime ? 1 : 0);
  const toggleCert = (c) => setFilters((f) => ({ ...f, certs: f.certs.includes(c) ? f.certs.filter((x) => x !== c) : [...f.certs, c] }));

  const listed = (movie) => shortlist.some((m) => String(m.id) === String(movie.id));
  const toggleListed = (movie) => onShortlist(listed(movie) ? shortlist.filter((m) => String(m.id) !== String(movie.id)) : [...shortlist, movie]);

  const names = present.length === members.length && members.length > 1 ? 'everyone' : present.map((m) => (m.id === me ? 'you' : m.name)).join(', ');
  const note = (e) => (
    <>
      <span className="font-bold text-gold">{e.score}% match</span>
      <span className="text-dim"> · {e.wanting === present.length ? (present.length > 1 ? 'all want it' : 'on your list') : `${e.wanting} of ${present.length} want it`}{e.rewatch ? ' · rewatch for some' : ''}</span>
    </>
  );
  const AddButton = ({ movie }) => {
    const on = listed(movie);
    return (
      <button type="button" onClick={() => toggleListed(movie)} aria-pressed={on} aria-label={on ? `Remove ${movie.title} from the shortlist` : `Add ${movie.title} to the shortlist`} className={`mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${on ? 'border-gold bg-gold text-house' : 'border-aisle text-cream hover:border-dim'}`}>
        {on ? <Check size={17} /> : <Plus size={17} />}
      </button>
    );
  };

  const spinPool = shortlist.length >= 2 ? shortlist : shown.slice(0, 8).map((e) => e.movie);

  return (
    <div className="flex flex-col gap-6">
      {members.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-dim">Who's watching tonight</h2>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const here = !away.includes(m.id);
              return (
                <button key={m.id} type="button" aria-pressed={here} onClick={() => toggle(m.id)} className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-sm font-bold transition ${here ? 'border-gold text-cream' : 'border-aisle text-dim'}`}>
                  <Avatar member={m} size={28} dim={!here} />
                  {m.id === me ? 'Me' : m.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-xl bg-seat p-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-cream">Tonight's shortlist <span className="font-normal tabular-nums text-dim">{shortlist.length || ''}</span></h2>
          {shortlist.length > 0 && <button type="button" onClick={() => onShortlist([])} className="text-sm text-dim underline">Clear</button>}
        </div>
        {shortlist.length === 0 ? (
          <p className="text-sm text-dim">Tap + on any movie to put it up for tonight. Then choose together, or spin.</p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {shortlist.map((m) => (
              <MovieRow key={m.id} movie={entries[m.id]?.movie || m} onOpen={onOpen} aside={<MemberDots entry={entries[m.id]} members={present} />}
                action={<button type="button" onClick={() => toggleListed(m)} aria-label={`Remove ${m.title}`} className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-dim hover:text-cream"><X size={17} /></button>} />
            ))}
          </ul>
        )}
        <button type="button" disabled={spinPool.length < 2} onClick={() => setSpinning(true)} className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 font-bold text-house transition hover:brightness-110 disabled:bg-aisle disabled:text-dim">
          <Dices size={19} /> {shortlist.length >= 2 ? `Spin the shortlist` : 'Spin the top suggestions'}
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-cream">Suggested for {names}</h2>
            <p className="text-sm text-dim">Ranked from everyone's ratings and what each person tends to like.</p>
          </div>
          <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold ${activeFilters ? 'border-gold text-gold' : 'border-aisle text-cream'}`}>
            <SlidersHorizontal size={15} /> Filters{activeFilters ? ` (${activeFilters})` : ''}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-seat p-3">
            <div className="flex gap-1.5" role="group" aria-label="MPAA rating">
              {CERTS.map((c) => <Chip key={c} on={filters.certs.includes(c)} onClick={() => toggleCert(c)}>{c}</Chip>)}
            </div>
            <Select id="filter-genre" label="Genre" value={filters.genre} onChange={(v) => setFilters((f) => ({ ...f, genre: v }))} options={[['', 'Any genre'], ...genres.map((g) => [g, g])]} />
            <Select id="filter-runtime" label="Runtime" value={filters.maxRuntime} onChange={(v) => setFilters((f) => ({ ...f, maxRuntime: Number(v) }))} options={RUNTIMES} />
            {activeFilters > 0 && <button type="button" onClick={() => setFilters({ genre: '', certs: [], maxRuntime: 0 })} className="text-sm text-dim underline">Clear</button>}
          </div>
        )}

        {shown.length ? (
          <ol className="-mx-2 flex flex-col divide-y divide-aisle/60">
            {shown.slice(0, 40).map((e, n) => (
              <MovieRow key={e.movie.id} movie={e.movie} index={n + 1} onOpen={onOpen} note={note(e)} aside={<MemberDots entry={e} members={present} />} action={<AddButton movie={e.movie} />} />
            ))}
          </ol>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-aisle p-5 text-sm text-dim">
            <p>{ranked.length ? 'Nothing matches these filters.' : 'No suggestions yet. They appear once someone here marks a movie Want to or Watch again, and get sharper the more each person rates.'}</p>
            <button type="button" onClick={onRate} className="rounded-lg bg-velvet px-4 py-2 font-bold text-cream">Rate some movies</button>
          </div>
        )}
      </section>

      {spinning && <SpinReel pool={spinPool} onClose={() => setSpinning(false)} onOpen={(m) => { setSpinning(false); onOpen(m); }} />}
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

const ROW = 60; // px height of one title on the reel
const FRAMES = 26;

/** Spins through the pool and lands on one movie. */
function SpinReel({ pool, onClose, onOpen }) {
  const [round, setRound] = useState(0);
  const [landed, setLanded] = useState(false);
  const [offset, setOffset] = useState(0);

  const strip = useMemo(() => {
    // Cycle the pool in a shuffled order so every title flashes by, then pick the winner at random.
    const order = [...pool].sort(() => Math.random() - 0.5);
    const frames = Array.from({ length: FRAMES }, (_, n) => order[n % order.length]);
    frames[FRAMES - 2] = pool[Math.floor(Math.random() * pool.length)];
    return frames;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);
  const winner = strip[FRAMES - 2];

  useEffect(() => {
    setLanded(false);
    setOffset(0);
    // Start the transition on the next frame so the browser sees the reset first.
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOffset((FRAMES - 3) * ROW)));
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const done = setTimeout(() => setLanded(true), reduced ? 50 : 3100);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, [round]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Spin" className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-seat p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-cream">{landed ? "Tonight's movie" : 'Spinning…'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-dim hover:bg-aisle hover:text-cream"><X size={20} /></button>
        </div>

        <div className="relative overflow-hidden rounded-lg bg-house" style={{ height: ROW * 3 }}>
          <div style={{ transform: `translateY(-${offset}px)`, transition: offset ? 'transform 3s cubic-bezier(0.12, 0.8, 0.2, 1)' : 'none' }}>
            {strip.map((m, n) => (
              <div key={n} className="flex items-center justify-center px-4 text-center text-lg font-bold leading-tight text-cream" style={{ height: ROW }}>
                <span className="line-clamp-2">{m.title}</span>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 border-y-2 border-gold" style={{ top: ROW, height: ROW }} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-house via-transparent to-house" />
        </div>

        {landed && (
          <div className="sheet-in flex gap-3" aria-live="polite">
            <div className="w-20 shrink-0"><Poster movie={winner} /></div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="text-lg font-bold leading-tight text-cream">{winner.title}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-dim">
                {winner.year && <span className="tabular-nums">{winner.year}</span>}
                <CertBadge cert={winner.cert} />
                {winner.runtime && <span className="tabular-nums">{formatRuntime(winner.runtime)}</span>}
              </div>
              <p className="line-clamp-3 text-xs text-cream/75">{winner.overview}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!landed} onClick={() => setRound((r) => r + 1)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-aisle px-3 py-3 font-bold text-cream disabled:text-dim"><Dices size={18} /> Spin again</button>
          <button type="button" disabled={!landed} onClick={() => onOpen(winner)} className="rounded-lg bg-velvet px-3 py-3 font-bold text-cream disabled:bg-aisle disabled:text-dim">Details</button>
        </div>
      </div>
    </div>
  );
}
