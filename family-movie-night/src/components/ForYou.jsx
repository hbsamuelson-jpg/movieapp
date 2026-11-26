import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, Sparkles, X } from 'lucide-react';
import { discover, interestSeeds, PERSONAL } from '../lib/discover.js';
import { forYou } from '../lib/suggest.js';
import { MovieRow } from './ui.jsx';

const FIRST = 6;
const MORE = 20;

/** "Movies you should like": personal picks you can queue up, mark as seen, or wave off. */
export default function ForYou({ entries, members, me, onOpen, onWant, onPass }) {
  const [found, setFound] = useState([]);
  const [finding, setFinding] = useState(true);
  const [all, setAll] = useState(false);

  const interests = useMemo(() => interestSeeds(entries, members, [me], PERSONAL), [entries, members, me]);
  const key = `${me}|${interests.seeds.map((m) => m.id).join()}|${interests.people.map((p) => p.id).join()}`;
  useEffect(() => {
    let live = true;
    setFinding(true);
    discover(entries, members, [me], PERSONAL)
      .then((list) => { if (live) setFound(list); })
      .catch(() => { if (live) setFound([]); })
      .finally(() => { if (live) setFinding(false); });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const picks = useMemo(() => forYou(entries, me, found, members), [entries, me, found, members]);
  const shown = picks.slice(0, all ? MORE : FIRST);

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-seat p-4">
      <div className="flex items-center gap-2"><Sparkles size={17} className="text-gold" /><h2 className="font-bold text-cream">Movies you should like</h2></div>
      {shown.length === 0 ? (
        <p className="text-sm text-dim">{finding ? 'Finding movies for you…' : 'Rate a few movies you love, or add favourites below, and picks show up here.'}</p>
      ) : (
        <>
          <ol className="-mx-2 flex flex-col divide-y divide-aisle/60">
            {shown.map(({ movie, because, match }) => (
              <li key={movie.id} className="flex flex-col gap-1.5 py-1.5">
                <ul>
                  <MovieRow movie={movie} onOpen={onOpen} note={because && <span className="text-gold">{because}</span>} aside={<span className="shrink-0 text-sm font-bold tabular-nums text-gold">{match}%</span>} />
                </ul>
                <div className="flex gap-2 px-2 pb-1">
                  <button type="button" onClick={() => onWant(movie)} className="flex flex-[1.3] items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-velvet px-2 py-2 text-sm font-bold text-cream"><Plus size={15} />Want to watch</button>
                  <button type="button" onClick={() => onOpen(movie)} className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-house px-2 py-2 text-sm font-bold text-cream ring-1 ring-aisle"><Check size={15} />Seen it</button>
                  <button type="button" onClick={() => onPass(movie)} aria-label={`Not interested in ${movie.title}`} className="flex w-10 shrink-0 items-center justify-center rounded-lg bg-house text-dim ring-1 ring-aisle hover:text-cream"><X size={15} /></button>
                </div>
              </li>
            ))}
          </ol>
          {!all && picks.length > FIRST && <button type="button" onClick={() => setAll(true)} className="self-start text-sm font-bold text-gold">Show more</button>}
        </>
      )}
    </section>
  );
}
