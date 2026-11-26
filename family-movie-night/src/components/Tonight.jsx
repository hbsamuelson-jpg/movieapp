import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Dices, Plus, SlidersHorizontal, X } from 'lucide-react';
import { CERTS } from '../lib/config.js';
import { applyFilters, mergeSimilar, suggest } from '../lib/suggest.js';
import { discover, interestSeeds } from '../lib/discover.js';
import { enrich, GENRE_CHOICES, similarTo } from '../lib/tmdb.js';
import MoviePicker from './MoviePicker.jsx';
import { Avatar, CertBadge, Chip, formatRuntime, MemberDots, MovieRow, Notice, Poster } from './ui.jsx';

const RUNTIMES = [[0, 'Any length'], [90, '90 min or less'], [105, '1h 45m or less'], [120, '2 hours or less']];

/** Who's here, what the app suggests for them, and the shortlist you put up for a choice or a spin. */
export default function Tonight({ entries, members, me, away, onToggleAway, shortlist, onShortlist, onOpen, onRate }) {
  const [filters, setFilters] = useState({ genre: '', certs: [], maxRuntime: 0 });
  const [showFilters, setShowFilters] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [vibes, setVibes] = useState([]); // tonight's priority genres: boosted, never a hard filter
  const [seeds, setSeeds] = useState([]); // "movies like…" reference movies
  const [simLists, setSimLists] = useState({}); // seed id -> [{ movie, sim }]
  const [simError, setSimError] = useState('');

  // Look up similar movies for each new seed, and fill in rating and runtime for the best matches.
  useEffect(() => {
    seeds.filter((seed) => !simLists[seed.id]).forEach(async (seed) => {
      try {
        setSimError('');
        const list = await similarTo(seed);
        const detailed = await Promise.all(list.slice(0, 24).map((x) => enrich(x.movie).then((movie) => ({ ...x, movie }))));
        setSimLists((all) => ({ ...all, [seed.id]: [...detailed, ...list.slice(24)] }));
      } catch (e) {
        setSimError(e.message);
        setSeeds((list) => list.filter((x) => x.id !== seed.id));
      }
    });
  }, [seeds]); // eslint-disable-line react-hooks/exhaustive-deps
  const seeking = seeds.some((seed) => !simLists[seed.id]);
  const [lane, setLane] = useState('all');
  const [found, setFound] = useState({ key: '', list: [] }); // unwatched movies that fit the group's interests
  const [finding, setFinding] = useState(false);
  const similar = useMemo(() => mergeSimilar(seeds.map((seed) => simLists[seed.id] || []), seeds.map((seed) => seed.id)), [seeds, simLists]);

  const present = members.filter((m) => !away.includes(m.id));
  const presentIds = present.map((m) => m.id);
  const toggle = onToggleAway;

  // Refresh the discoveries when the people watching, or what their taste points at, changes.
  const interests = useMemo(() => interestSeeds(entries, members, presentIds), [entries, members, presentIds.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const interestKey = `${presentIds.join()}|${interests.seeds.map((m) => m.id).join()}|${interests.people.map((p) => p.id).join()}`;
  useEffect(() => {
    let live = true;
    setFinding(true);
    discover(entries, members, presentIds)
      .then((list) => { if (live) setFound({ key: interestKey, list }); })
      .catch(() => { if (live) setFound({ key: interestKey, list: [] }); })
      .finally(() => { if (live) setFinding(false); });
    return () => { live = false; };
  }, [interestKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const ranked = useMemo(() => (seeking ? [] : suggest(entries, presentIds, { priorityGenres: vibes, similar, discoveries: found.list })), [entries, presentIds.join(), vibes, similar, seeking, found]); // eslint-disable-line react-hooks/exhaustive-deps
  const genres = useMemo(() => [...new Set(ranked.flatMap((e) => e.movie.genres || []))].sort(), [ranked]);
  const filtered = applyFilters(ranked, filters);
  // Wanted movies always come first; new discoveries fill in underneath.
  const shown = seeds.length ? filtered
    : lane === 'all' ? [...filtered.filter((e) => e.lane === 'wanted'), ...filtered.filter((e) => e.lane === 'new')]
      : filtered.filter((e) => e.lane === lane);
  const laneCount = (key) => filtered.filter((e) => e.lane === key).length;
  const activeFilters = (filters.genre ? 1 : 0) + filters.certs.length + (filters.maxRuntime ? 1 : 0);
  const toggleCert = (c) => setFilters((f) => ({ ...f, certs: f.certs.includes(c) ? f.certs.filter((x) => x !== c) : [...f.certs, c] }));

  const listed = (movie) => shortlist.some((m) => String(m.id) === String(movie.id));
  const toggleListed = (movie) => onShortlist(listed(movie) ? shortlist.filter((m) => String(m.id) !== String(movie.id)) : [...shortlist, movie]);

  const names = present.length === members.length && members.length > 1 ? 'everyone' : present.map((m) => (m.id === me ? 'you' : m.name)).join(', ');
  const seeded = seeds.length > 0;
  const seedNames = seeds.map((m) => m.title).join(' and ');
  const toggleVibe = (g) => setVibes((v) => (v.includes(g) ? v.filter((x) => x !== g) : [...v, g]));
  const wantText = (e) => (e.wanting === 0 ? (e.ratings && Object.keys(e.ratings).length ? 'nobody has asked for it yet' : present.length > 1 ? 'new to everyone' : 'new to you')
    : e.wanting === present.length ? (present.length > 1 ? 'all want it' : 'on your list') : `${e.wanting} of ${present.length} want it`);
  const note = (e) => (
    <>
      <span className="font-bold text-gold">{e.score}% match</span>
      <span className="text-dim"> · {e.lane === 'new' && !seeded ? `new to ${present.length > 1 ? 'everyone' : 'you'}${e.because ? ` · ${e.because}` : ''}` : `${wantText(e)}${e.rewatch ? ' · rewatch for some' : ''}`}{e.vibes.length ? ` · ${e.vibes.join(', ')} boost` : ''}</span>
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

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-dim">In the mood for</h2>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {GENRE_CHOICES.map((g) => <Chip key={g.id} on={vibes.includes(g.name)} onClick={() => toggleVibe(g.name)}>{g.name}</Chip>)}
          </div>
          {vibes.length > 0 && <p className="text-xs text-dim">{vibes.join(', ')} movies get a big boost. Great picks from other genres still show.</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-dim">Movies like…</h2>
          <MoviePicker id="seed-search" chosen={seeds} placeholder={seeds.length ? 'Add another movie' : 'Type a movie, e.g. Knives Out'} label="Find movies similar to" onAdd={(m) => setSeeds((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]))} onRemove={(id) => setSeeds((list) => list.filter((x) => x.id !== id))} />
          {simError && <Notice>{simError}</Notice>}
        </div>
      </section>

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
            <h2 className="text-xl font-bold text-cream">{seeded ? `Like ${seedNames}` : `Tonight for ${names}`}</h2>
            <p className="text-sm text-dim">{seeded ? `Similar movies, ranked for ${names}. Anything someone here ruled out is left off.` : `Movies someone here wants to watch, plus ones nobody here has seen that fit what ${present.length > 1 ? 'you all' : 'you'} like.`}</p>
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

        {!seeded && (
          <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4">
            <Chip on={lane === 'all'} onClick={() => setLane('all')}>All {filtered.length}</Chip>
            <Chip on={lane === 'wanted'} onClick={() => setLane('wanted')}>Wanted {laneCount('wanted')}</Chip>
            <Chip on={lane === 'new'} onClick={() => setLane('new')}>New to {present.length > 1 ? 'us' : 'me'} {laneCount('new')}</Chip>
            {finding && <span className="shrink-0 text-xs text-dim">Finding more…</span>}
          </div>
        )}

        {shown.length ? (
          <ol className="-mx-2 flex flex-col divide-y divide-aisle/60">
            {shown.slice(0, 60).map((e, n) => (
              <MovieRow key={e.movie.id} movie={e.movie} index={n + 1} onOpen={onOpen} note={note(e)} aside={<MemberDots entry={e} members={present} />} action={<AddButton movie={e.movie} />} />
            ))}
          </ol>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-aisle p-5 text-sm text-dim">
            <p>{seeking ? `Finding movies like ${seedNames}…` : ranked.length ? 'Nothing matches these filters.' : seeded ? `Nothing similar to ${seedNames} is left after everyone's vetoes. Try a different movie.` : finding ? 'Looking for movies you might like…' : 'Nothing here yet. Mark a few movies Want to, add your all-time favourites under Mine, or rate what you have watched, and this fills up with wanted movies and new ones that fit your taste.'}</p>
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
