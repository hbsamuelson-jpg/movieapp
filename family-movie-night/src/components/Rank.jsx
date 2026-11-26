import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, EyeOff, GripVertical, ThumbsDown } from 'lucide-react';
import { rankToLiking } from '../lib/suggest.js';
import { diversePick, enrich } from '../lib/tmdb.js';
import { Notice, Poster, ScoreBadge } from './ui.jsx';

const BATCH = 5;

/**
 * Rank 5. Five well-known movies from very different genres and decades.
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
  const shown = useRef(new Set()); // everything offered this session, so nothing comes back
  const live = useRef(0);
  // The ref is the source of truth so a pick made a moment ago is visible to the next one before React re-renders.
  const slotsRef = useRef([]);
  const update = (fn) => { slotsRef.current = fn(slotsRef.current); setSlots(slotsRef.current); };

  const exclude = (m) => shown.current.has(String(m.id)) || Boolean(entries[m.id]?.ratings?.[me]);

  // Fill one slot with a movie unlike the ones already on the table.
  const fill = async (key, batch) => {
    const others = slotsRef.current.filter((s) => s.key !== key && s.movie);
    try {
      const found = await diversePick({ avoidGenres: others.map((s) => s.genre), avoidDecades: others.map((s) => s.decade), exclude });
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
    const fresh = Array.from({ length: BATCH }, (_, n) => ({ key: `${batch}-${n}`, loading: true }));
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

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-dim">Kick out anything you haven't seen (it won't be dealt to you again). Then put the rest in order, best at the top: drag a row by its poster, or use the arrows. Then submit.</p>
      {error && <Notice>{error}</Notice>}

      <ol ref={listRef} className="flex flex-col gap-2">
        {slots.map((slot) => {
          if (slot.loading) return <li key={slot.key} className="flex h-[96px] items-center justify-center rounded-xl bg-seat text-sm text-dim">Finding another…</li>;
          if (slot.empty) return <li key={slot.key} className="flex h-[96px] items-center justify-center rounded-xl border border-dashed border-aisle text-sm text-dim">Nothing left to offer here</li>;
          const place = ranked.indexOf(slot);
          const { movie } = slot;
          return (
            <li key={slot.key} className={`card-in flex items-stretch gap-2 rounded-xl p-2 transition-shadow ${slot.flagged ? 'bg-velvet/20' : 'bg-seat'} ${dragging === slot.key ? 'relative z-10 shadow-xl shadow-black/60 ring-2 ring-gold' : ''}`}>
              <div className="flex flex-col justify-between">
                <button type="button" onClick={() => move(slots.indexOf(slot), -1)} disabled={slots.indexOf(slot) === 0} aria-label={`Move ${movie.title} up`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-aisle text-cream disabled:opacity-30"><ArrowUp size={18} /></button>
                <button type="button" onClick={() => move(slots.indexOf(slot), 1)} disabled={slots.indexOf(slot) === slots.length - 1} aria-label={`Move ${movie.title} down`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-aisle text-cream disabled:opacity-30"><ArrowDown size={18} /></button>
              </div>
              <div role="button" tabIndex={-1} aria-label={`Drag ${movie.title} to reorder`} onPointerDown={(e) => startDrag(e, slot.key)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}
                className={`relative w-[51px] shrink-0 touch-none select-none self-center ${dragging === slot.key ? 'cursor-grabbing' : 'cursor-grab'}`}>
                <Poster movie={movie} size="w92" className="pointer-events-none rounded-sm" />
                <span className="absolute -left-1 top-1/2 -translate-y-1/2 rounded bg-house/80 py-1 text-cream" aria-hidden="true"><GripVertical size={14} /></span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-lg leading-none text-gold">{place + 1}</span>
                  <span className="line-clamp-2 font-bold leading-tight text-cream">{movie.title}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-dim"><ScoreBadge movie={movie} /><span className="truncate">{movie.year} · {(movie.genres || []).slice(0, 2).join(', ')}</span></div>
                {slot.flagged && <div className="mt-0.5 text-xs text-dim">Never again: this one gets ruled out</div>}
              </div>
              <div className="flex flex-col justify-between">
                <button type="button" onClick={() => kick(slot.key)} aria-label={`Haven't seen ${movie.title}`} className="inline-flex h-9 items-center gap-1 rounded-lg border border-aisle px-2 text-xs font-bold text-cream"><EyeOff size={14} /> Haven't seen</button>
                <button type="button" onClick={() => flag(slot.key)} aria-pressed={slot.flagged} aria-label={`Never again: ${movie.title}`} className={`inline-flex h-9 items-center justify-center gap-1 self-end rounded-lg px-2 text-xs font-bold ${slot.flagged ? 'bg-velvet text-cream' : 'text-dim'}`}><ThumbsDown size={14} /> Never again</button>
              </div>
            </li>
          );
        })}
      </ol>

      <button type="button" onClick={submit} disabled={busy || ranked.length < 2} className="rounded-lg bg-velvet px-4 py-3.5 text-lg font-bold text-cream disabled:bg-aisle disabled:text-dim">
        {busy ? 'Dealing…' : `Submit ranking of ${ranked.length}`}
      </button>
      <button type="button" onClick={deal} disabled={busy} className="self-center text-sm text-dim underline disabled:opacity-40">Deal five different movies</button>
    </div>
  );
}
