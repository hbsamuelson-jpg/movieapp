import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, EyeOff, GripVertical, Sparkles, ThumbsDown, X } from 'lucide-react';
import { askForDeck } from '../lib/assistant.js';
import { pref } from '../lib/config.js';
import { rankToLiking } from '../lib/suggest.js';
import { diversePick, enrich } from '../lib/tmdb.js';
import { Notice, Poster, ScoreBadge } from './ui.jsx';

const COUNTS = [3, 5, 8, 10]; // how many to rank at once

/**
 * Rank. A handful of well-known movies (3, 5, 8 or 10; five by default) from very different
 * genres and decades.
 *   1. Kick out any you haven't seen; each is swapped for a fresh one, and remembered as
 *      "haven't seen" so it is never dealt to you again.
 *   2. Order what's left from best to worst: drag a row by its poster, or use the arrows.
 *   3. Submit. The order teaches the app what you like. No star ratings are given: each movie
 *      is saved as "watched" with a hidden taste signal, stronger the higher you ranked it.
 * Last place is not a veto. Tap "Never again" on a movie to rule it out.
 */
export default function Rank({ entries, me, onRate }) {
  const [slots, setSlots] = useState([]); // [{ key, movie, genre, decade, flagged } | { key, loading: true } | { key, empty: true }]
  const [result, setResult] = useState(null); // the movies, in the order submitted
  const [rounds, setRounds] = useState(0);
  const [error, setError] = useState('');
  const [count, setCount] = useState(() => (COUNTS.includes(pref.get('rank-count', 5)) ? pref.get('rank-count', 5) : 5));
  const countRef = useRef(count);
  const chooseCount = (n) => { if (n === count) return; countRef.current = n; setCount(n); pref.set('rank-count', n); deal(); };
  const shown = useRef(new Set()); // everything offered this session, so nothing comes back
  const live = useRef(0);
  // The ref is the source of truth so a pick made a moment ago is visible to the next one before React re-renders.
  const slotsRef = useRef([]);
  const update = (fn) => { slotsRef.current = fn(slotsRef.current); setSlots(slotsRef.current); };

  const exclude = (m) => shown.current.has(String(m.id)) || Boolean(entries[m.id]?.ratings?.[me]);

  // A list asked for in words ("Pixar movies", "90s action"). While one is open, movies are dealt
  // from it, in the order the AI gave them, instead of from the usual mixed pool.
  const custom = useRef(null); // the movies still to deal
  const [list, setList] = useState(null); // { request, note, total }
  const [ask, setAsk] = useState('');
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState('');
  const fromList = () => {
    const movie = custom.current.find((m) => !exclude(m));
    return movie ? { movie, genre: movie.genres?.[0] || null, decade: movie.year ? Math.floor(movie.year / 10) * 10 : null } : null;
  };
  const askList = async (e) => {
    e.preventDefault();
    const wanted = ask.trim();
    if (!wanted || asking) return;
    setAsking(true);
    setAskError('');
    try {
      const got = await askForDeck({ request: wanted, entries, memberId: me, spares: true });
      const fresh = got.movies.filter((m) => !exclude(m));
      if (!fresh.length) setAskError(got.asked ? "You've already rated or ranked everything on that list. Try a different one." : 'Nothing came back for that. Try wording it differently.');
      else { custom.current = fresh; setList({ request: wanted, note: got.note, total: fresh.length }); setAsk(''); deal(); }
    } catch (err) {
      setAskError(err.message);
    } finally {
      setAsking(false);
    }
  };
  const closeList = () => { custom.current = null; setList(null); deal(); };

  // Fill one slot with a movie unlike the ones already on the table.
  const fill = async (key, batch) => {
    const others = slotsRef.current.filter((s) => s.key !== key && s.movie);
    try {
      const found = custom.current ? fromList() : await diversePick({ avoidGenres: others.map((s) => s.genre), avoidDecades: others.map((s) => s.decade), exclude });
      if (batch !== live.current) return;
      if (found) {
        shown.current.add(String(found.movie.id));
        found.movie = await enrich(found.movie); // review score and director for the row
        if (batch !== live.current) return;
      }
      update((list) => list.map((s) => (s.key === key ? (found ? { key, ...found, flagged: false } : { key, empty: true }) : s)));
    } catch (e) {
      if (batch !== live.current) return;
      setError(e.message);
      update((list) => list.map((s) => (s.key === key ? { key, empty: true } : s)));
    }
  };

  const deal = async () => {
    const batch = ++live.current;
    setResult(null);
    setError('');
    const fresh = Array.from({ length: countRef.current }, (_, n) => ({ key: `${batch}-${n}`, loading: true }));
    update(() => fresh);
    // One at a time, so each pick can steer away from the genres and decades already dealt.
    for (const slot of fresh) {
      if (batch !== live.current) return;
      await fill(slot.key, batch); // eslint-disable-line no-await-in-loop
    }
  };
  useEffect(() => { deal(); return () => { live.current += 1; }; }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  const kick = (key) => {
    const gone = slotsRef.current.find((s) => s.key === key)?.movie;
    // Remembered for good, unless they've already said something about it (e.g. "want to").
    if (gone && !entries[gone.id]?.ratings?.[me]) onRate(gone, { status: 'notseen', stars: null });
    update((list) => list.map((s) => (s.key === key ? { key, loading: true } : s)));
    fill(key, live.current);
  };
  const move = (index, by) => update((list) => {
    const to = index + by;
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    [next[index], next[to]] = [next[to], next[index]];
    return next;
  });
  // Dragging: grab a row by its poster and move it; the row follows the pointer one place at a time.
  const listRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const startDrag = (e, key) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); setDragging(key); };
  const drag = (e) => {
    if (!dragging || !listRef.current) return;
    const rows = [...listRef.current.children];
    const over = rows.findIndex((row) => { const r = row.getBoundingClientRect(); return e.clientY >= r.top && e.clientY <= r.bottom; });
    const from = slotsRef.current.findIndex((s) => s.key === dragging);
    if (over < 0 || from < 0 || over === from) return;
    update((list) => { const next = [...list]; const [item] = next.splice(from, 1); next.splice(over, 0, item); return next; });
  };
  const endDrag = () => setDragging(null);
  const flag = (key) => update((list) => list.map((s) => (s.key === key ? { ...s, flagged: !s.flagged } : s)));

  const ranked = slots.filter((s) => s.movie);
  const busy = slots.some((s) => s.loading);
  const submit = () => {
    const like = rankToLiking(ranked.length, ranked.map((s) => s.flagged));
    // Saved as watched with no stars. `like` is the hidden taste signal; `place`/`of` record the ranking.
    ranked.forEach((s, n) => onRate(s.movie, { status: 'seen', stars: null, like: like[n], via: 'rank', place: n + 1, of: ranked.length }));
    setResult(ranked.map((s) => ({ movie: s.movie, flagged: s.flagged })));
    setRounds((n) => n + 1);
  };

  const actions = (
    <>
      <button type="button" onClick={submit} disabled={busy || ranked.length < 2} className="rounded-lg bg-velvet px-4 py-3 text-lg font-bold text-cream disabled:bg-aisle disabled:text-dim">
        {busy ? 'Dealing…' : `Submit ranking of ${ranked.length}`}
      </button>
      <button type="button" onClick={deal} disabled={busy} className="self-center text-sm text-dim underline disabled:opacity-40">Deal {count} different movies</button>
    </>
  );

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-gold"><Check size={20} /><h2 className="text-lg font-bold">Saved to your taste</h2></div>
        <ol className="flex flex-col gap-1 rounded-xl bg-seat p-3">
          {result.map(({ movie, flagged }, n) => (
            <li key={movie.id} className="flex items-center gap-3 py-1 text-sm">
              <span className="w-4 text-right font-bold tabular-nums text-dim">{n + 1}</span>
              <span className="min-w-0 flex-1 truncate font-bold text-cream">{movie.title}</span>
              {flagged && <span className="text-xs text-dim">never again</span>}
            </li>
          ))}
        </ol>
        <p className="text-xs text-dim">{rounds} {rounds === 1 ? 'round' : 'rounds'} done. No star ratings were given; this only sharpens what the app knows about your taste. Three or four rounds give it a solid read.</p>
        <button type="button" onClick={deal} className="rounded-lg bg-velvet px-4 py-3.5 text-lg font-bold text-cream">Next batch</button>
      </div>
    );
  }

  // Sized to the window: the list gets whatever height is left and the rows share it, so nothing
  // scrolls. Rows show less (no details line, one-line titles) as the count goes up.
  const roomy = count <= 3;
  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-3">
        <form onSubmit={askList} className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Sparkles size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gold" />
            <input id="rank-ask" value={ask} onChange={(e) => setAsk(e.target.value)} maxLength={200} autoComplete="off" placeholder="Ask for anything to rank, e.g. Pixar movies" aria-label="Ask for a list of movies to rank" className="w-full rounded-full border border-aisle bg-house py-2.5 pl-10 pr-4 text-cream placeholder:text-dim focus:border-gold focus:outline-none" />
          </div>
          <button type="submit" disabled={!ask.trim() || asking} className="shrink-0 rounded-full bg-velvet px-4 py-2 text-sm font-bold text-cream disabled:bg-aisle disabled:text-dim">{asking ? 'Finding…' : 'Get list'}</button>
        </form>
        {askError && <Notice>{askError}</Notice>}
        {list && (
          <div className="flex items-start gap-3 rounded-xl border border-gold/50 bg-seat p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-cream">“{list.request}” <span className="font-normal text-dim">· ranking from {list.total} movies</span></p>
              {list.note && <p className="mt-0.5 hidden text-xs text-dim lg:block">{list.note}</p>}
              <p className="mt-0.5 hidden text-xs text-dim lg:block">The list comes from the AI's own knowledge, not a live lookup. Movies you've already rated are left out.</p>
            </div>
            <button type="button" onClick={closeList} aria-label="Close this list and go back to the usual mix" className="shrink-0 rounded-full p-1.5 text-dim hover:text-cream"><X size={16} /></button>
          </div>
        )}
        <div className="flex items-center gap-2" role="group" aria-label="How many to rank at once">
          <span className="text-sm text-dim">Rank</span>
          {COUNTS.map((n) => <button key={n} type="button" aria-pressed={count === n} onClick={() => chooseCount(n)} className={`h-9 min-w-9 rounded-full border px-2.5 text-sm font-bold tabular-nums ${count === n ? 'border-gold bg-gold text-house' : 'border-aisle text-cream'}`}>{n}</button>)}
          <span className="text-sm text-dim">at a time</span>
        </div>
        <p className="hidden text-sm text-dim lg:block">Kick out anything you haven't seen (it won't be dealt to you again). Then put the rest in order, best at the top: drag a row by its poster, or use the arrows. Then submit.</p>
        <p className="text-xs text-dim lg:hidden">Drag by the poster, best at the top. <EyeOff size={12} className="inline" /> = haven't seen, <ThumbsDown size={12} className="inline" /> = never again.</p>
        {error && <Notice>{error}</Notice>}
        <div className="hidden flex-col gap-3 lg:flex">{actions}</div>
      </div>

      <div className="flex flex-col gap-3">
        <ol ref={listRef} className="flex h-[calc(100dvh-29rem)] flex-col gap-1.5 lg:h-[calc(100dvh-13.75rem)]" style={{ minHeight: `${count * 3.1}rem` }}>
          {slots.map((slot) => {
            const box = 'flex min-h-[2.75rem] max-h-[6.5rem] flex-1 items-center rounded-xl';
            if (slot.loading) return <li key={slot.key} className={`${box} justify-center bg-seat text-sm text-dim`}>Finding another…</li>;
            if (slot.empty) return <li key={slot.key} className={`${box} justify-center border border-dashed border-aisle text-sm text-dim`}>{list ? 'That list has no more movies' : 'Nothing left to offer here'}</li>;
            const place = ranked.indexOf(slot);
            const index = slots.indexOf(slot);
            const { movie } = slot;
            return (
              <li key={slot.key} className={`card-in ${box} gap-2 px-2 py-1 transition-shadow ${slot.flagged ? 'bg-velvet/20' : 'bg-seat'} ${dragging === slot.key ? 'relative z-10 shadow-xl shadow-black/60 ring-2 ring-gold' : ''}`}>
                <span className="w-5 shrink-0 text-center font-display text-lg leading-none text-gold">{place + 1}</span>
                <div role="button" tabIndex={-1} aria-label={`Drag ${movie.title} to reorder`} onPointerDown={(e) => startDrag(e, slot.key)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}
                  className={`relative aspect-[2/3] h-full max-h-[5.5rem] shrink-0 touch-none select-none ${dragging === slot.key ? 'cursor-grabbing' : 'cursor-grab'}`}>
                  <Poster movie={movie} size="w92" className="pointer-events-none h-full rounded-sm" />
                  <span className="absolute -left-1 top-1/2 -translate-y-1/2 rounded bg-house/80 py-0.5 text-cream" aria-hidden="true"><GripVertical size={13} /></span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <span className={`${count > 5 ? 'line-clamp-1' : 'line-clamp-2'} font-bold leading-tight text-cream`}>{movie.title}</span>
                  <div className={`mt-0.5 items-center gap-2 text-xs text-dim ${roomy ? 'flex' : count <= 5 ? 'hidden lg:flex' : 'hidden'}`}><ScoreBadge movie={movie} /><span className="truncate">{movie.year} · {(movie.genres || []).slice(0, 2).join(', ')}</span></div>
                  {slot.flagged && <div className="truncate text-xs text-dim">Never again: ruled out</div>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${movie.title} up`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-aisle text-cream disabled:opacity-30"><ArrowUp size={16} /></button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === slots.length - 1} aria-label={`Move ${movie.title} down`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-aisle text-cream disabled:opacity-30"><ArrowDown size={16} /></button>
                  <button type="button" onClick={() => kick(slot.key)} aria-label={`Haven't seen ${movie.title}`} title="Haven't seen it" className="inline-flex h-8 items-center gap-1 rounded-lg border border-aisle px-2 text-xs font-bold text-cream"><EyeOff size={14} /><span className="hidden sm:inline">Haven't seen</span></button>
                  <button type="button" onClick={() => flag(slot.key)} aria-pressed={slot.flagged} aria-label={`Never again: ${movie.title}`} title="Never again" className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-bold ${slot.flagged ? 'bg-velvet text-cream' : 'text-dim'}`}><ThumbsDown size={14} /><span className="hidden xl:inline">Never again</span></button>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-col gap-2 lg:hidden">{actions}</div>
      </div>
    </div>
  );
}
