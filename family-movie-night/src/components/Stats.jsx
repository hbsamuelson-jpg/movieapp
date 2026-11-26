import { useMemo } from 'react';
import { ArrowLeft, Star } from 'lucide-react';
import { familyStats } from '../lib/stats.js';
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
  const how = [['vote', 'by vote'], ['spin', 'by spin'], ['pick', 'picked']].filter(([k]) => s.nights.how[k]).map(([k, label]) => `${s.nights.how[k]} ${label}`).join(' · ');
  const empty = !s.pairs.length && !s.split && !s.loved.length && !s.nights.count;

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-dim hover:text-cream"><ArrowLeft size={16} /> Back to tonight</button>
      <h2 className="text-2xl font-bold text-cream">Family stats</h2>
      {empty && <p className="rounded-lg border border-dashed border-aisle p-5 text-sm text-dim">Not enough to go on yet. Stats appear once people have given star ratings to some of the same movies, or you've logged a movie night.</p>}

      {s.nights.count > 0 && (
        <Card title="Movie nights">
          <p className="text-cream"><span className="text-2xl font-bold tabular-nums">{s.nights.count}</span> so far{how ? <span className="text-sm text-dim"> · {how}</span> : null}</p>
          {s.nights.best && <Film movie={s.nights.best.movie} onOpen={onOpen}><span>Best night</span><Score value={s.nights.best.average} /></Film>}
          {s.nights.worst && <Film movie={s.nights.worst.movie} onOpen={onOpen}><span>Biggest letdown</span><Score value={s.nights.worst.average} /></Film>}
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

      <Card title="Each person">
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
                <span className="block text-sm text-dim">{p.rated ? <>{p.rated} rated · average <span className="tabular-nums text-cream">{stars(p.average)}</span>{p.topGenre ? ` · loves ${p.topGenre}` : ''}</> : 'No star ratings yet'}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
