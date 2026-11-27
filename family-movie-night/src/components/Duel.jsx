import { useEffect, useMemo, useRef, useState } from 'react';
import { duel, duelPoints, isOut } from '../lib/suggest.js';
import { Poster, ScoreBadge } from './ui.jsx';

/**
 * Head-to-head. Two movies from your Want to list: tap the one you'd rather watch. Each pick
 * moves points from the loser to the winner, and Tonight favours the movies you keep picking.
 * Movies with the fewest match-ups come up first, against something close to them in points.
 */
export default function Duel({ entries, me, onRate }) {
  const wants = useMemo(() => Object.values(entries).filter((e) => e.ratings?.[me]?.status === 'unseen' && isOut(e.movie)), [entries, me]);
  const byId = useMemo(() => Object.fromEntries(wants.map((e) => [String(e.movie.id), e])), [wants]);
  const [pair, setPair] = useState(null); // [idA, idB]
  const [done, setDone] = useState(0);
  const last = useRef('');

  const draw = () => {
    if (wants.length < 2) { setPair(null); return; }
    const played = (e) => e.ratings[me].duels || 0;
    const fresh = [...wants].sort((a, b) => played(a) - played(b) + (Math.random() - 0.5));
    const first = fresh[0];
    const rivals = wants
      .filter((e) => e !== first && [first.movie.id, e.movie.id].sort().join() !== last.current)
      .sort((a, b) => Math.abs(duelPoints(a.ratings[me]) - duelPoints(first.ratings[me])) - Math.abs(duelPoints(b.ratings[me]) - duelPoints(first.ratings[me])));
    const second = rivals[Math.floor(Math.random() * Math.min(5, rivals.length))] || wants.find((e) => e !== first);
    last.current = [first.movie.id, second.movie.id].sort().join();
    setPair(Math.random() < 0.5 ? [String(first.movie.id), String(second.movie.id)] : [String(second.movie.id), String(first.movie.id)]);
  };
  useEffect(() => { if (!pair || !byId[pair[0]] || !byId[pair[1]]) draw(); }, [wants.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (winnerId) => {
    if (!pair) return;
    const win = byId[winnerId];
    const lose = byId[pair.find((id) => id !== winnerId)];
    if (!win || !lose) { draw(); return; }
    const [up, down] = duel(duelPoints(win.ratings[me]), duelPoints(lose.ratings[me]));
    onRate(win.movie, { ...win.ratings[me], elo: up, duels: (win.ratings[me].duels || 0) + 1 });
    onRate(lose.movie, { ...lose.ratings[me], elo: down, duels: (lose.ratings[me].duels || 0) + 1 });
    setDone((n) => n + 1);
    draw();
  };
  const keys = useRef({});
  keys.current = { choose, draw, pair };
  useEffect(() => {
    const onKey = (e) => {
      if (/^(input|textarea|select)$/i.test(e.target?.tagName || '') || document.querySelector('[role="dialog"]')) return;
      const now = keys.current;
      if (!now.pair) return;
      if (e.key === 'ArrowLeft') { now.choose(now.pair[0]); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { now.choose(now.pair[1]); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { now.draw(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const top = wants.filter((e) => e.ratings[me].duels).sort((a, b) => duelPoints(b.ratings[me]) - duelPoints(a.ratings[me])).slice(0, 8);

  if (wants.length < 2) {
    return <p className="rounded-lg border border-dashed border-aisle p-6 text-center text-sm text-dim">Head-to-head works on your Want to list, and it needs at least two movies that are already out. Add some in Quick Swipe or Search first.</p>;
  }
  const shown = pair && byId[pair[0]] && byId[pair[1]] ? pair.map((id) => byId[id]) : null;

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
      <div className="flex flex-col items-center gap-3">
        <p className="text-center text-sm text-dim">Which would you rather watch? <span className="hidden md:inline">Arrow keys: ← left, → right, ↓ skip.</span></p>
        {shown && (
          <div className="flex items-start justify-center gap-4 lg:gap-8">
            {shown.map((e, side) => (
              <button key={e.movie.id} type="button" onClick={() => choose(String(e.movie.id))} aria-label={`I'd rather watch ${e.movie.title}`}
                className="card-in group flex w-[min(42vw,calc((100dvh-25rem)*2/3))] min-w-[7rem] max-w-[22rem] flex-col items-center gap-2 rounded-xl p-2 text-center transition hover:bg-seat focus-visible:bg-seat lg:w-[min(22rem,calc((100dvh-21rem)*2/3))]">
                <Poster movie={e.movie} size="w500" className="w-full shadow-xl shadow-black/60 ring-gold transition group-hover:ring-2" />
                <span className="line-clamp-2 font-bold leading-tight text-cream">{e.movie.title}</span>
                <span className="flex flex-wrap items-center justify-center gap-2 text-xs text-dim"><ScoreBadge movie={e.movie} /><span>{e.movie.year}{e.movie.genres?.length ? ` · ${e.movie.genres[0]}` : ''}</span></span>
                <kbd className="hidden rounded border border-aisle px-1.5 text-[11px] font-bold leading-4 text-dim md:block" aria-hidden="true">{side === 0 ? '←' : '→'}</kbd>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 text-sm">
          <button type="button" onClick={draw} className="text-dim underline">Can't decide, skip</button>
          <span className="text-dim"><span className="font-bold tabular-nums text-cream">{done}</span> picked this visit · {wants.length} on your Want to list</span>
        </div>
      </div>

      <section className="flex flex-col gap-2 rounded-xl bg-seat p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-dim">Your most wanted so far</h3>
        {top.length ? (
          <ol className="flex flex-col gap-1.5 text-sm">
            {top.map((e, n) => (
              <li key={e.movie.id} className="flex items-baseline gap-2">
                <span className="w-5 shrink-0 text-right font-bold tabular-nums text-gold">{n + 1}</span>
                <span className="min-w-0 flex-1 truncate font-bold text-cream">{e.movie.title}</span>
                <span className="shrink-0 tabular-nums text-dim">{e.ratings[me].duels} {e.ratings[me].duels === 1 ? 'match' : 'matches'}</span>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-dim">Pick a few and your order builds up here. On Tonight, the movies you keep choosing rank a little higher than your other wants.</p>}
      </section>
    </div>
  );
}
