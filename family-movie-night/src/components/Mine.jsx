import { useMemo, useState } from 'react';
import { ChevronDown, Heart, X } from 'lucide-react';
import { GENRE_CHOICES } from '../lib/tmdb.js';
import { liking, tasteProfile } from '../lib/suggest.js';
import ForYou from './ForYou.jsx';
import MoviePicker from './MoviePicker.jsx';
import { Chip, MovieRow, Poster, StarRating, StatusStub } from './ui.jsx';

const TABS = [['all', 'All'], ['unseen', 'Want to'], ['seen', 'Watched'], ['again', 'Watch again'], ['meh', "Don't care"], ['pass', 'No thanks'], ['notseen', "Haven't seen"]];
const TASTE_MIN = 8; // watched movies needed before the taste summary means anything
const MAX_FAVORITES = 10;

/** Your profile: all-time favourites, what the app has learned about your taste, and everything you've rated. */
export default function Mine({ entries, members, me, genreStars = {}, onGenreStars, onWant, onPass, favorites, onAddFavorite, onRemoveFavorite, onOpen, onRate }) {
  const [tab, setTab] = useState('all');
  const mine = Object.values(entries)
    .filter((e) => e.ratings?.[me])
    .sort((a, b) => (liking(b.ratings[me]) || 0) - (liking(a.ratings[me]) || 0) || a.movie.title.localeCompare(b.movie.title));
  const count = (key) => (key === 'all' ? mine.length : mine.filter((e) => e.ratings[me].status === key).length);
  const shown = tab === 'all' ? mine : mine.filter((e) => e.ratings[me].status === tab);
  const taste = useMemo(() => tasteProfile(entries, me), [entries, me, members]);
  const [showGenres, setShowGenres] = useState(false);
  const ratedGenres = Object.keys(genreStars).length;
  const top = taste.genres.filter((g) => g.n >= 2).slice(0, 6);
  const people = taste.people.slice(0, 6);

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
      <div className="flex min-w-0 flex-col gap-5">
      <ForYou entries={entries} members={members} me={me} onOpen={onOpen} onWant={onWant} onPass={onPass} />

      <section className="flex flex-col gap-3 rounded-xl bg-seat p-4">
        <div className="flex items-center gap-2"><Heart size={17} className="text-gold" fill="currentColor" /><h2 className="font-bold text-cream">My favourites of all time</h2></div>
        {favorites.length > 0 ? (
          <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
            {favorites.map((m) => (
              <li key={m.id} className="relative w-20 shrink-0">
                <button type="button" onClick={() => onOpen(m)} className="block w-full text-left">
                  <Poster movie={m} size="w185" />
                  <span className="mt-1 line-clamp-2 text-xs font-bold leading-tight text-cream">{m.title}</span>
                </button>
                <button type="button" onClick={() => onRemoveFavorite(m)} aria-label={`Remove ${m.title} from favourites`} className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-house text-dim ring-1 ring-aisle hover:text-cream"><X size={13} /></button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-dim">Add the movies you'd put on your all-time list. They count double when the app works out your taste, and it looks for movies like them and by the same directors and writers.</p>
        )}
        {favorites.length < MAX_FAVORITES
          ? <MoviePicker id="favorite-search" chips={false} placeholder="Add a favourite" label="Add a favourite movie" onAdd={onAddFavorite} />
          : <p className="text-xs text-dim">That's the limit of {MAX_FAVORITES}. Remove one to add another.</p>}
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-seat p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold text-cream">Your taste so far</h2>
          <span className="text-xs tabular-nums text-dim">learned from {mine.filter((e) => liking(e.ratings[me]) != null).length} movies you've watched</span>
        </div>
        {taste.count < TASTE_MIN || !top.length ? (
          <p className="text-sm text-dim">Rate a few more movies you've watched, or add favourites above, and this fills in. The more it knows, the better the suggestions get.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {top.map((g) => (
              <li key={g.name} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate font-bold text-cream">{g.name}</span>
                <span className="h-2 overflow-hidden rounded-full bg-aisle"><span className="block h-full rounded-full bg-gold" style={{ width: `${(g.score / 5) * 100}%` }} /></span>
                <span className="tabular-nums text-dim">{g.n}</span>
              </li>
            ))}
          </ul>
        )}
        {people.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-aisle pt-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-dim">Directors and writers you keep liking</h3>
            <p className="text-sm text-cream">{people.map((p) => p.name).join(' · ')}</p>
            <p className="text-xs text-dim">Their other movies get a lift in your suggestions.</p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-seat p-4">
        <button type="button" onClick={() => setShowGenres((v) => !v)} aria-expanded={showGenres} className="flex items-center justify-between gap-3 text-left">
          <span>
            <span className="block font-bold text-cream">Rate genres</span>
            <span className="block text-sm text-dim">{ratedGenres ? `${ratedGenres} rated. ` : ''}Tell the app how much you like each kind of movie. It steers your suggestions straight away.</span>
          </span>
          <ChevronDown size={18} className={`shrink-0 text-dim transition-transform ${showGenres ? 'rotate-180' : ''}`} />
        </button>
        {showGenres && (
          <ul className="flex flex-col divide-y divide-aisle/60">
            {GENRE_CHOICES.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate font-bold text-cream">{g.name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <StarRating value={genreStars[g.name] || 0} onChange={(v) => onGenreStars(g.name, v)} size={26} label={`How much you like ${g.name}`} />
                  <button type="button" onClick={() => onGenreStars(g.name, null)} disabled={!genreStars[g.name]} aria-label={`Clear ${g.name}`} className="rounded-full p-1.5 text-dim hover:text-cream disabled:invisible"><X size={14} /></button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>

      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-xl font-bold text-cream">My ratings</h2>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {TABS.filter(([key]) => key === 'all' || key === tab || count(key) > 0).map(([key, label]) => (
            <Chip key={key} on={tab === key} onClick={() => setTab(key)}>{label} {count(key)}</Chip>
          ))}
        </div>
        {shown.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-aisle p-5 text-sm text-dim">
            <p>Nothing rated yet.</p>
            <button type="button" onClick={onRate} className="rounded-lg bg-velvet px-4 py-2 font-bold text-cream">Rate some movies</button>
          </div>
        ) : (
          <ol className="-mx-2 flex flex-col divide-y divide-aisle/60">
            {shown.map((e) => <MovieRow key={e.movie.id} movie={e.movie} onOpen={onOpen} aside={<StatusStub rating={e.ratings[me]} />} />)}
          </ol>
        )}
      </section>
    </div>
  );
}
