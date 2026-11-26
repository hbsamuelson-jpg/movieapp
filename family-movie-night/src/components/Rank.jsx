import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, EyeOff, ThumbsDown } from 'lucide-react';
import { rankToStars } from '../lib/suggest.js';
import { diversePick } from '../lib/tmdb.js';
import { Notice, Poster } from './ui.jsx';

const BATCH = 5;
const starText = (stars) => (stars % 1 ? stars.toFixed(1) : stars);

/**
 * Rank 5. Five well-known movies from very different genres and decades.
 *   1. Kick out any you haven't seen; each is swapped for a fresh one.
 *   2. Order what's left from best to worst with the arrows.
 *   3. Submit. The order becomes star ratings (5 at the top, 2.5 at the bottom).
 * Last place is not a veto. Tap the thumbs-down on a movie to mark it "never again".
 */
export default function Rank({ entries, me, onRate }) {
  const [slots, setSlots] = useState([]); // [{ key, movie, genre, decade, flagged } | { key, loading: true } | { key, empty: true }]
  const [result, setResult] = useState(null); // [{ movie, stars }] after a submit
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
      if (found) shown.current.add(String(found.movie.id));
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
  const flag = (key) => update((list) => list.map((s) => (s.key === key ? { ...s, flagged: !s.flagged } : s)));

  const ranked = slots.filter((s) => s.movie);
  const busy = slots.some((s) => s.loading);
  const stars = rankToStars(ranked.length, ranked.map((s) => s.flagged));
  const submit = () => {
    const saved = ranked.map((s, n) => ({ movie: s.movie, stars: stars[n] }));
    // `via: 'rank'` records where the rating came from; everything else treats it as a normal rating.
    saved.forEach(({ movie, stars: value }) => onRate(movie, { status: 'seen', stars: value, via: 'rank' }));
    setResult(saved);
    setRounds((n) => n + 1);
  };

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-gold"><Check size={20} /><h2 className="text-lg font-bold">Saved to your taste</h2></div>
        <ol className="flex flex-col gap-1 rounded-xl bg-seat p-3">
          {result.map(({ movie, stars: value }, n) => (
            <li key={movie.id} className="flex items-center gap-3 py-1 text-sm">
              <span className="w-4 text-right font-bold tabular-nums text-dim">{n + 1}</span>
              <span className="min-w-0 flex-1 truncate font-bold text-cream">{movie.title}</span>
              <span className="tabular-nums text-gold">{starText(value)}★</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-dim">{rounds} {rounds === 1 ? 'round' : 'rounds'} done. Three or four rounds give the suggestions a solid read on you. You can fine-tune any of these under Mine.</p>
        <button type="button" onClick={deal} className="rounded-lg bg-velvet px-4 py-3.5 text-lg font-bold text-cream">Next batch</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-dim">Kick out anything you haven't seen. Then put the rest in order, best at the top, and submit.</p>
      {error && <Notice>{error}</Notice>}

      <ol className="flex flex-col gap-2">
        {slots.map((slot) => {
          if (slot.loading) return <li key={slot.key} className="flex h-[96px] items-center justify-center rounded-xl bg-seat text-sm text-dim">Finding another…</li>;
          if (slot.empty) return <li key={slot.key} className="flex h-[96px] items-center justify-center rounded-xl border border-dashed border-aisle text-sm text-dim">Nothing left to offer here</li>;
          const place = ranked.indexOf(slot);
          const { movie } = slot;
          return (
            <li key={slot.key} className={`card-in flex items-stretch gap-2 rounded-xl p-2 ${slot.flagged ? 'bg-velvet/20' : 'bg-seat'}`}>
              <div className="flex flex-col justify-between">
                <button type="button" onClick={() => move(slots.indexOf(slot), -1)} disabled={slots.indexOf(slot) === 0} aria-label={`Move ${movie.title} up`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-aisle text-cream disabled:opacity-30"><ArrowUp size={18} /></button>
                <button type="button" onClick={() => move(slots.indexOf(slot), 1)} disabled={slots.indexOf(slot) === slots.length - 1} aria-label={`Move ${movie.title} down`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-aisle text-cream disabled:opacity-30"><ArrowDown size={18} /></button>
              </div>
              <div className="w-[51px] shrink-0 self-center"><Poster movie={movie} size="w92" className="rounded-sm" /></div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-lg leading-none text-gold">{place + 1}</span>
                  <span className="line-clamp-2 font-bold leading-tight text-cream">{movie.title}</span>
                </div>
                <div className="truncate text-xs text-dim">{movie.year} · {(movie.genres || []).slice(0, 2).join(', ')}</div>
                <div className="mt-0.5 text-xs tabular-nums text-dim">{slot.flagged ? 'Never again · 1.5★' : `${starText(stars[place])}★ if it stays here`}</div>
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
