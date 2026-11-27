import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { familyAwards, familyStats, firstMonth, monthReview } from '../lib/stats.js';
import { Avatar, Poster } from './ui.jsx';

const stars = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.0', '');
const Card = ({ title, children }) => (
  <section className="flex flex-col gap-3 rounded-xl bg-seat p-4">
    <h3 className="text-xs font-bold uppercase tracking-widest text-dim">{title}</h3>
    {children}
  </section>
);
const Score = ({ value }) => <span className="inline-flex items-center gap-1 font-bold tabular-nums text-gold"><Star size={13} fill="currentColor" />{stars(value)}</span>;
const Film = ({ movie, onOpen, children }) => (
  <button type="button" onClick={() => onOpen(movie)} className="flex items-center gap-3 text-left">
    <span className="w-12 shrink-0"><Poster movie={movie} size="w92" className="rounded-sm" /></span>
    <span className="min-w-0 flex-1">
      <span className="block truncate font-bold text-cream">{movie.title}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dim">{children}</span>
    </span>
  </button>
);

/** Family stats: agreement between people, the movies that split or united the room, and how nights have gone. */
export default function Stats({ entries, members, history, me, onBack, onOpen }) {
  const s = useMemo(() => familyStats(entries, members, history), [entries, members, history]);
  const name = (m) => (m.id === me ? 'You' : m.name);
  const awards = useMemo(() => familyAwards(entries, members), [entries, members]);
  // Month in review: starts on the current month; the arrows step back as far as the first movie night.
  const now = new Date();
  const [when, setWhen] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const review = useMemo(() => monthReview(entries, members, history, when.year, when.month), [entries, members, history, when]);
  const first = firstMonth(history);
  const index = (w) => w.year * 12 + w.month;
  const step = (by) => setWhen((w) => { const n = index(w) + by; return { year: Math.floor(n / 12), month: n % 12 }; });
  const canBack = first && index(when) > index(first);
  const canForward = index(when) < now.getFullYear() * 12 + now.getMonth();
  const monthName = new Date(when.year, when.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const hours = (min) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`);
  const reviewHow = [['vote', 'by vote'], ['spin', 'by spin'], ['pick', 'picked']].filter(([k]) => review.how[k]).map(([k, label]) => `${review.how[k]} ${label}`).join(' · ');
  const how = [['vote', 'by vote'], ['spin', 'by spin'], ['pick', 'picked']].filter(([k]) => s.nights.how[k]).map(([k, label]) => `${s.nights.how[k]} ${label}`).join(' · ');
  const empty = !s.pairs.length && !s.split && !s.loved.length && !s.nights.count;

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-dim hover:text-cream"><ArrowLeft size={16} /> Back to tonight</button>
      <h2 className="text-2xl font-bold text-cream">Family stats</h2>
      <section className="flex flex-col gap-3 rounded-xl border border-gold/50 bg-seat p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gold">Month in review</h3>
            <p className="text-xl font-bold text-cream">{monthName}</p>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={() => step(-1)} disabled={!canBack} aria-label="Previous month" className="rounded-full border border-aisle p-2 text-cream disabled:text-aisle"><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => step(1)} disabled={!canForward} aria-label="Next month" className="rounded-full border border-aisle p-2 text-cream disabled:text-aisle"><ChevronRight size={18} /></button>
          </div>
        </div>
        {review.count === 0 ? <p className="text-sm text-dim">No movie nights logged this month. Tap “We're watching this” or “We watched this” on a movie to log one.</p> : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[[review.count, review.count === 1 ? 'movie night' : 'movie nights'], [review.minutes ? hours(review.minutes) : '–', 'watched together'], [review.topGenre || '–', 'most-watched genre']].map(([big, small]) => (
                <div key={small} className="rounded-lg bg-house px-2 py-3"><div className="truncate text-lg font-bold tabular-nums text-cream">{big}</div><div className="text-xs text-dim">{small}</div></div>
              ))}
            </div>
            {reviewHow && <p className="text-sm text-dim">Chosen {reviewHow}.</p>}
            {review.best && <Film movie={review.best.movie} onOpen={onOpen}><span>Movie of the month</span><Score value={review.best.average} /></Film>}
            {review.worst && review.worst.average < 3 && <Film movie={review.worst.movie} onOpen={onOpen}><span>Biggest letdown</span><Score value={review.worst.average} /></Film>}
            {review.split && <Film movie={review.split.movie} onOpen={onOpen}><span>Split the room:</span>{review.split.scores.map((x) => <span key={x.member.id} className="inline-flex items-center gap-1.5">{name(x.member)} <Score value={x.stars} /></span>)}</Film>}
            <div>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-dim">Everything you watched</h4>
              <ul className="flex flex-col gap-1.5 text-sm">
                {review.nights.map((n) => (
                  <li key={n.night.id} className="flex items-baseline justify-between gap-3">
                    <button type="button" onClick={() => onOpen(n.movie)} className="min-w-0 truncate text-left font-bold text-cream hover:underline">{n.movie.title}</button>
                    <span className="shrink-0 text-dim">{new Date(n.night.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {n.average != null ? <Score value={n.average} /> : 'not scored'}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-sm text-dim">{review.people.map((p) => `${name(p.member)} watched ${p.watched}${p.average != null ? ` (average ${stars(p.average)})` : ''}`).join(' · ')}</p>
            {review.unscored > 0 && <p className="text-xs text-dim">{review.unscored} {review.unscored === 1 ? "night hasn't" : "nights haven't"} been scored yet. Score them in History.</p>}
          </>
        )}
      </section>

      <h3 className="mt-2 text-lg font-bold text-cream">All time</h3>
      {empty && <p className="rounded-lg border border-dashed border-aisle p-5 text-sm text-dim">Not enough to go on yet. Stats appear once people have given star ratings to some of the same movies, or you've logged a movie night.</p>}

      {s.nights.count > 0 && (
        <Card title="Movie nights">
          <p className="text-cream"><span className="text-2xl font-bold tabular-nums">{s.nights.count}</span> so far{how ? <span className="text-sm text-dim"> · {how}</span> : null}</p>
          {s.nights.best && <Film movie={s.nights.best.movie} onOpen={onOpen}><span>Best night</span><Score value={s.nights.best.average} /></Film>}
          {s.nights.worst && s.nights.worst.average < 3 && <Film movie={s.nights.worst.movie} onOpen={onOpen}><span>Biggest letdown</span><Score value={s.nights.worst.average} /></Film>}
          {!s.nights.best && <p className="text-sm text-dim">Score a movie night in History and the best and worst show up here.</p>}
        </Card>
      )}

      {members.length > 1 && (
        <Card title="Who agrees with whom">
          {s.pairs.length ? (
            <ul className="flex flex-col gap-3">
              {s.pairs.map((p) => (
                <li key={p.a.id + p.b.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
                  <span className="truncate font-bold text-cream">{name(p.a)} and {name(p.b) === 'You' ? 'you' : name(p.b)}</span>
                  <span className="tabular-nums text-cream">{p.agreement}% <span className="text-dim">on {p.shared} movies</span></span>
                  <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-aisle"><span className="block h-full rounded-full bg-gold" style={{ width: `${p.agreement}%` }} /></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-dim">This needs two people who have both given stars to at least 4 of the same movies.</p>}
        </Card>
      )}

      {s.split && (
        <Card title="Biggest split">
          <Film movie={s.split.movie} onOpen={onOpen}>
            {s.split.scores.map((x) => <span key={x.member.id} className="inline-flex items-center gap-1.5">{name(x.member)} <Score value={x.stars} /></span>)}
          </Film>
        </Card>
      )}

      {s.loved.length > 0 && (
        <Card title="Family favourites">
          {s.loved.map((x) => <Film key={x.movie.id} movie={x.movie} onOpen={onOpen}><Score value={x.average} /><span>from {x.scores.length} of you</span></Film>)}
        </Card>
      )}

      {awards.length > 0 && (
        <Card title="Family awards">
          <ul className="grid gap-3 sm:grid-cols-2">
            {awards.map((a) => (
              <li key={a.key} className="flex items-center gap-3 rounded-lg bg-house p-3">
                {a.winner
                  ? <Avatar member={a.winner} size={38} />
                  : <button type="button" onClick={() => onOpen(a.movie)} aria-label={a.movie.title} className="w-10 shrink-0"><Poster movie={a.movie} size="w92" className="rounded-sm" /></button>}
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold uppercase tracking-widest text-gold">{a.title}</span>
                  <span className="block truncate font-bold text-cream">{a.winner ? name(a.winner) : a.movie.title}</span>
                  <span className="block text-sm text-dim">{a.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Each person">
        <p className="-mt-1 text-xs text-dim">Favourite genres use everything the app knows: star ratings, rankings, all-time favourites and their genre ranking.</p>
        <ul className="flex flex-col gap-3">
          {s.people.map((p) => (
            <li key={p.member.id} className="flex items-center gap-3">
              <Avatar member={p.member} size={34} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-bold text-cream">
                  {name(p.member)}
                  {s.toughest?.member.id === p.member.id && <span className="rounded-full bg-aisle px-2 py-0.5 text-[11px] text-cream">Toughest critic</span>}
                  {s.easiest?.member.id === p.member.id && <span className="rounded-full bg-aisle px-2 py-0.5 text-[11px] text-cream">Easiest to please</span>}
                </span>
                <span className="block text-sm text-dim">
                  {[p.rated ? <span key="r">{p.rated} rated · average <span className="tabular-nums text-cream">{stars(p.average)}</span></span> : null, p.ranked ? <span key="k">{p.ranked} ranked</span> : null].filter(Boolean).reduce((all, x) => (all.length ? [...all, ' · ', x] : [x]), [])}
                  {!p.rated && !p.ranked && 'Nothing rated or ranked yet'}
                </span>
                {p.genres.length > 0 && <span className="mt-0.5 block text-sm text-dim">Favourite {p.genres.length === 1 ? 'genre' : 'genres'}: <span className="font-bold text-cream">{p.genres.join(', ')}</span></span>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
