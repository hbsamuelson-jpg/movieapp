import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal, Sparkles, Trophy, Undo2, X } from 'lucide-react';
import { askForDeck } from '../lib/assistant.js';
import { hasTmdb, pref } from '../lib/config.js';
import { allTimeBest, enrich, ERAS, GENRE_CHOICES, topOfYear, trailerUrl, yearsFor } from '../lib/tmdb.js';
import Rank from './Rank.jsx';
import { CertBadge, Chip, directedBy, NOT_WATCHED, Notice, Poster, ScoreBadge, StarRating, STATUS, TitleLink, KeyHint, MovieLinks, useStarKeys } from './ui.jsx';

const PER_YEAR = [5, 10, 20];
// Arrow keys for the three "haven't watched it" answers, laid out like the buttons: left, middle, right.
const ARROWS = { ArrowLeft: 'unseen', ArrowDown: 'meh', ArrowRight: 'pass' };
const ARROW_GLYPH = { unseen: '←', meh: '↓', pass: '→' };
const MODES = [['swipe', 'Quick Swipe'], ['rank', 'Rank']];

/** Two ways to teach the app your taste: one poster at a time, or ranking a varied batch of five. */
export default function Rate({ entries, me, onRate }) {
  const [mode, setMode] = useState(() => pref.get('rate-mode', 'swipe'));
  const choose = (m) => { setMode(m); pref.set('rate-mode', m); };
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 lg:max-w-6xl">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-seat p-1 lg:w-[26rem] lg:self-center" role="tablist" aria-label="Rating mode">
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
  // A custom list asked for in words ("5 good R comedies"). While one is open it replaces the year-by-year deck.
  const [deck, setDeck] = useState(null); // { request, note, movies }
  const [ask, setAsk] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  // "Best of all time": the top-rated movies overall or in one category, as a list to work through.
  const [showBest, setShowBest] = useState(false);
  const [showLists, setShowLists] = useState(false); // phones: the two list options stay tucked away until asked for
  const [loadingBest, setLoadingBest] = useState(null);
  const openBest = async (genre) => {
    if (loadingBest !== null) return;
    setLoadingBest(genre || 'all');
    setAskError('');
    try {
      const list = (await allTimeBest(genre)).filter((m) => { const r = entries[m.id]?.ratings?.[me]; return !r || r.status === 'notseen'; });
      if (!list.length) setAskError(`You've already rated all of the best ${genre ? `${genre} ` : ''}movies on this list.`);
      else { setDeck({ request: genre ? `Best ${genre} movies of all time` : 'Best movies of all time', movies: list, best: true }); setStars(0); setShowBest(false); }
    } catch (err) {
      setAskError(err.message);
    } finally {
      setLoadingBest(null);
    }
  };
  const askDeck = async (e) => {
    e.preventDefault();
    const wanted = ask.trim();
    if (!wanted || asking) return;
    setAsking(true);
    setAskError('');
    try {
      const got = await askForDeck({ request: wanted, entries, memberId: me });
      if (!got.movies.length) setAskError(got.asked ? "You've already rated everything on that list. Try a different one." : 'Nothing came back for that. Try wording it differently.');
      else { setDeck({ request: wanted, ...got }); setAsk(''); setStars(0); }
    } catch (err) {
      setAskError(err.message);
    } finally {
      setAsking(false);
    }
  };

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

  const todo = ((deck ? deck.movies : movies) || []).filter((m) => !handled.has(String(m.id)) && (!entries[m.id]?.ratings?.[me] || entries[m.id].ratings[me].status === 'notseen')); // "haven't seen" still gets the want-to question
  const next = deck ? todo[0] : finished ? null : todo[0];

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
    if (!deck && movies && !todo.length && !finished && inRange && !error) {
      const next = years[years.indexOf(year) + 1];
      setYear(next === undefined ? null : next);
    }
  }, [movies, todo.length, finished, inRange, error, deck]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Number keys rate the movie on screen (not while a movie's detail sheet is open on top).
  useStarKeys({ stars, onStars: setStars, onUndo: undo, onPlain: () => movie && stars > 0 && commit({ status: 'seen', stars }), onArrow: (key) => movie && commit({ status: ARROWS[key], stars: null }), // Enter moves on: 3 stars or more is saved as "would watch again", fewer as plain watched, none skips.
    onSave: () => { if (!movie) return; if (stars > 0) commit({ status: stars > 2.5 ? 'again' : 'seen', stars }); else advance(false); }, enabled: !document.querySelector('[role="dialog"]') });
  const toggle = (list, set) => (value) => set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const toggleGenre = toggle(genres, setGenres);
  const toggleEra = toggle(eras, setEras);
  const ratedCount = history.filter((h) => h.rated).length;
  const position = movie ? (movies || []).findIndex((m) => m.id === movie.id) + 1 : 0;

  const eraLabels = ERAS.filter((e) => eras.includes(e.id)).map((e) => e.label);
  const summary = [genres.length ? (genres.length <= 2 ? genres.join(' + ') : `${genres.length} categories`) : 'All categories', eraLabels.length ? (eraLabels.length <= 2 ? eraLabels.join(' + ') : `${eraLabels.length} eras`) : 'all years'].join(' · ');

  return (
    <>
      {/* On a computer these four controls share one row, so the movie fits on screen without scrolling. */}
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-3">
      <div className="flex items-center justify-between gap-3 lg:contents">
        <button type="button" onClick={() => setShowSetup((v) => !v)} aria-expanded={showSetup} className={`inline-flex min-w-0 items-center lg:order-1 gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold ${genres.length || eras.length ? 'border-gold text-gold' : 'border-aisle text-cream'}`}>
          <SlidersHorizontal size={15} className="shrink-0" />
          <span className="truncate">{summary}</span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${showSetup ? 'rotate-180' : ''}`} />
        </button>
        <button type="button" onClick={() => setShowLists((v) => !v)} aria-expanded={showLists} className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-bold lg:hidden ${showLists ? 'border-gold text-gold' : 'border-aisle text-cream'}`}><Sparkles size={14} /> Lists</button>
        <div className="flex shrink-0 items-center gap-3 text-sm text-dim lg:order-4">
          <span><span className="font-bold tabular-nums text-cream">{ratedCount}</span> rated</span>
          <button type="button" onClick={undo} disabled={!history.length} className="inline-flex items-center gap-1 font-bold text-cream disabled:text-aisle"><Undo2 size={15} /> Undo</button>
        </div>
      </div>

      <form onSubmit={askDeck} className={`gap-2 lg:order-2 lg:flex lg:min-w-0 lg:flex-1 ${showLists ? 'flex' : 'hidden'}`}>
        <div className="relative min-w-0 flex-1">
          <Sparkles size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gold" />
          <input id="deck-ask" value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={200} autoComplete="off" placeholder="Ask for a list, e.g. 5 good R comedies" aria-label="Ask for a list of movies to rate" className="w-full rounded-full border border-aisle bg-house py-2.5 pl-10 pr-4 text-cream placeholder:text-dim focus:border-gold focus:outline-none" />
        </div>
        <button type="submit" disabled={!ask.trim() || asking} className="shrink-0 rounded-full bg-velvet px-4 py-2 text-sm font-bold text-cream disabled:bg-aisle disabled:text-dim">{asking ? 'Finding…' : 'Get list'}</button>
      </form>
      <div className={`flex-col gap-2 lg:order-3 lg:flex lg:shrink-0 ${showLists ? 'flex' : 'hidden'}`}>
        <button type="button" onClick={() => setShowBest((v) => !v)} aria-expanded={showBest} className="inline-flex items-center gap-1.5 self-start whitespace-nowrap text-sm font-bold text-gold">
          <Trophy size={15} /> <span className="lg:hidden">Rate the best of all time</span><span className="hidden lg:inline">Best of all time</span> <ChevronDown size={14} className={`transition-transform ${showBest ? 'rotate-180' : ''}`} />
        </button>
        {showBest && (
          <div className="flex flex-wrap gap-1.5 rounded-xl bg-seat p-3 lg:absolute lg:right-0 lg:top-full lg:z-20 lg:mt-2 lg:w-[32rem] lg:shadow-xl lg:shadow-black/60 lg:ring-1 lg:ring-aisle" role="group" aria-label="Best of all time, by category">
            <Chip on={false} onClick={() => openBest(null)}>{loadingBest === 'all' ? 'Loading…' : 'All movies'}</Chip>
            {GENRE_CHOICES.map((g) => <Chip key={g.id} on={false} onClick={() => openBest(g.name)}>{loadingBest === g.name ? 'Loading…' : g.name}</Chip>)}
          </div>
        )}
      </div>
      </div>
      {askError && <Notice>{askError}</Notice>}
      {deck && (
        <div className="flex items-start gap-3 rounded-xl border border-gold/50 bg-seat p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-cream">{deck.best ? deck.request : `“${deck.request}”`} <span className="font-normal text-dim">· {todo.length} of {deck.movies.length} left</span></p>
            {deck.note && <p className="mt-0.5 text-xs text-dim">{deck.note}</p>}
            {deck.best
              ? <p className="mt-0.5 text-xs text-dim">Highest audience scores on TMDB among widely seen movies, best first. Ones you've rated are left out.</p>
              : <p className="mt-0.5 text-xs text-dim">The list comes from the AI's own knowledge, not a live lookup, so a “top 10” may differ from the site's current one.</p>}
          </div>
          <button type="button" onClick={() => { setDeck(null); setStars(0); }} aria-label="Close this list and go back to all movies" className="shrink-0 rounded-full p-1.5 text-dim hover:text-cream"><X size={16} /></button>
        </div>
      )}
      {deck && !todo.length && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <h2 className="text-xl font-bold text-cream">That's the whole list</h2>
          <button type="button" onClick={() => setDeck(null)} className="rounded-lg bg-velvet px-4 py-2 font-bold text-cream">Back to all movies</button>
        </div>
      )}

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

      {!deck && error && <Notice>{error} <button type="button" className="underline" onClick={load}>Try again</button></Notice>}

      {!deck && finished && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <h2 className="text-xl font-bold text-cream">That's everything in this slice</h2>
          <p className="text-sm text-dim">{hasTmdb ? 'Add categories or eras, or raise the number per year, to see more.' : 'That is the whole built-in list for these choices.'}</p>
          <button type="button" onClick={() => setYear(years[0])} className="rounded-lg bg-velvet px-4 py-2 font-bold text-cream">Go through it again</button>
        </div>
      )}
      {!deck && !finished && !movie && !error && <p className="py-16 text-center text-sm text-dim">Loading {year}…</p>}

      {movie && (
        <div key={movie.id} className="card-in flex flex-col items-center gap-3 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-10">
          <div className="w-[clamp(5rem,calc((100dvh-41rem)*2/3),11rem)] lg:w-[clamp(11rem,calc((100dvh-19rem)*2/3),27rem)]"><Poster movie={movie} size="w500" className="shadow-xl shadow-black/60" /></div>
          <div className="flex w-full flex-col items-center gap-3 lg:mx-auto lg:max-w-2xl">
          <div className="flex flex-col items-center gap-1 text-center">
            <h2 className="text-xl font-bold leading-tight text-cream"><TitleLink movie={movie} /></h2>
            <ScoreBadge movie={movie} size="lg" className="my-1" />
            <div className="flex items-center gap-2 text-sm text-dim">
              <span className="tabular-nums">{movie.year}</span>
              <CertBadge cert={movie.cert} />
              {!deck && <span className="tabular-nums">#{position} of {movies.length}</span>}
            </div>
            <div className="text-xs text-dim">{[movie.genres?.slice(0, 3).join(' · '), directedBy(movie)].filter(Boolean).join(' · ')}</div>
            <MovieLinks movie={movie} trailer={trailerUrl(movie)} className="mt-1.5 justify-center" />
          </div>

          <div className="flex w-full flex-col items-center gap-2 rounded-xl bg-seat p-3">
            <StarRating value={stars} onChange={setStars} size={44} label="Watched it: your rating" />
            {stars > 0 ? (
              <div className="grid w-full grid-cols-2 gap-2">
                <button type="button" onClick={() => commit({ status: 'seen', stars })} className="rounded-lg bg-aisle px-3 py-2.5 font-bold text-cream">Save {stars}★</button>
                <button type="button" onClick={() => commit({ status: 'again', stars })} className="rounded-lg bg-gold px-3 py-2.5 font-bold text-house">Save + watch again</button>
                <span className="col-span-2 text-center"><KeyHint>{stars > 2.5 ? 'Enter saves it as "watch again". Shift saves the score without "watch again". Both go to the next movie.' : 'Enter or Shift saves it as watched and goes to the next movie.'}</KeyHint></span>
              </div>
            ) : (
              <><span className="text-xs text-dim lg:hidden">Watched it? Tap a star (left half = half star).</span><KeyHint>Keys: 1–5 stars (same key again = ½ less) · Enter next · Shift no rewatch · Delete undo</KeyHint></>
            )}
          </div>

          {/* On a phone the three greyed-out buttons step aside once stars are set, so the Save buttons fit. */}
          <div className={`w-full grid-cols-3 gap-2 lg:grid ${stars > 0 ? 'hidden' : 'grid'}`}>
            {NOT_WATCHED.map((key) => {
              const s = STATUS[key];
              return (
                <button key={key} type="button" disabled={stars > 0} onClick={() => commit({ status: key, stars: null })} className={`flex items-center justify-center gap-1.5 rounded-xl px-1 py-3 text-sm font-bold transition lg:gap-2 lg:py-2.5 ${stars > 0 ? 'bg-seat text-dim opacity-40' : key === 'unseen' ? 'bg-cream text-house' : 'bg-seat text-cream'}`}>
                  <s.icon size={18} className="shrink-0" />
                  {s.label}
                  <kbd className="hidden rounded border border-current px-1.5 text-[11px] font-bold leading-4 opacity-60 md:block" aria-hidden="true">{ARROW_GLYPH[key]}</kbd>
                </button>
              );
            })}
          </div>
          <div className="flex w-full items-center justify-between gap-2">
            <div className="text-xs text-dim">{stars > 0 ? <>You've given it stars. <button type="button" onClick={() => setStars(0)} className="font-bold text-cream underline">Clear stars</button> to pick one of these instead.</> : "Haven't watched it? Pick one of these."}</div>
            <button type="button" onClick={() => advance(false)} className="px-4 py-1 text-sm text-dim underline">Skip for now</button>
          </div>
          </div>
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
