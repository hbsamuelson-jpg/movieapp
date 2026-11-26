import { useEffect, useRef, useState } from 'react';
import { Bookmark, Eye, Meh, Repeat, Star, ThumbsDown, ExternalLink } from 'lucide-react';
import { quality, shownStars } from '../lib/suggest.js';
import { posterUrl } from '../lib/tmdb.js';

/* ---------- People ---------- */

const AVATAR_COLORS = ['#B91C1C', '#D97706', '#0E7490', '#6D28D9', '#15803D', '#BE185D', '#1D4ED8', '#0F766E'];
const hash = (text) => [...String(text)].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** A person's initial on a colour of their own. */
export function Avatar({ member, size = 32, ring = false, dim = false }) {
  const cls = `inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${ring ? 'ring-2 ring-gold ring-offset-2 ring-offset-house' : ''} ${dim ? 'opacity-40' : ''}`;
  const style = { width: size, height: size, fontSize: Math.round(size * 0.45), background: AVATAR_COLORS[hash(member.id) % AVATAR_COLORS.length] };
  return <span className={cls} style={style} title={member.name}>{(member.name || '?').slice(0, 1).toUpperCase()}</span>;
}

/* ---------- Posters ---------- */

const PALETTES = [
  ['#7F1D1D', '#1C0A0A'], ['#134E4A', '#06201E'], ['#1E3A8A', '#0B1433'],
  ['#581C87', '#1E0A33'], ['#14532D', '#07200F'], ['#78350F', '#241004'],
];

/** TMDB poster when there is one; otherwise a title card drawn in CSS. */
export function Poster({ movie, size = 'w342', className = '' }) {
  const [failed, setFailed] = useState(false);
  const src = posterUrl(movie.poster, size);
  if (src && !failed) {
    return <img src={src} alt={`${movie.title} poster`} loading="lazy" onError={() => setFailed(true)} className={`aspect-[2/3] w-full rounded-md object-cover ${className}`} />;
  }
  const [a, b] = PALETTES[hash(movie.id) % PALETTES.length];
  return (
    <div
      className={`@container relative flex aspect-[2/3] w-full flex-col items-center justify-between overflow-hidden rounded-md p-[8%] text-center ${className}`}
      style={{ background: `radial-gradient(ellipse at 50% 25%, ${a}, ${b})` }}
      role="img"
      aria-label={`${movie.title} title card`}
    >
      <div className="pointer-events-none absolute inset-[4%] rounded-sm border border-gold/50" />
      <span className="text-[7cqw] font-bold uppercase tracking-[0.25em] text-gold/80">Now Showing</span>
      <span className="font-display text-[13cqw] leading-[1.05] text-cream [overflow-wrap:anywhere]">{movie.title}</span>
      <span className="text-[8cqw] font-bold tracking-widest text-gold/80">{movie.year || '★'}</span>
    </div>
  );
}

/* ---------- Stars ---------- */

/** 1–5 stars with half-star steps. Tap the left half of a star for a half, the right half for a whole. */
export function StarRating({ value = 0, onChange, size = 36, label = 'Star rating' }) {
  const [popKey, setPopKey] = useState(0);
  const set = (v) => {
    setPopKey((k) => k + 1);
    onChange?.(v);
  };
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = value >= n ? 100 : value >= n - 0.5 ? 50 : 0;
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-aisle" fill="currentColor" strokeWidth={0} />
            <span key={fill ? popKey : 'empty'} className={`absolute inset-y-0 left-0 overflow-hidden ${fill ? 'star-pop' : ''}`} style={{ width: `${fill}%` }}>
              <Star size={size} className="text-gold drop-shadow-[0_0_6px_rgba(245,197,24,0.55)]" fill="currentColor" strokeWidth={0} />
            </span>
            {onChange && (
              <>
                <button type="button" className="absolute inset-y-0 left-0 w-1/2" aria-label={`${n - 0.5} stars`} onClick={() => set(n - 0.5)} />
                <button type="button" className="absolute inset-y-0 right-0 w-1/2" aria-label={`${n} stars`} onClick={() => set(n)} />
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}

/* ---------- Status ---------- */

export const STATUS = {
  seen: { label: 'Watched', icon: Eye, cls: 'bg-aisle text-cream', glyph: '\u2713' },
  again: { label: 'Watch again', icon: Repeat, cls: 'bg-gold text-house', glyph: null },
  unseen: { label: 'Want to', icon: Bookmark, cls: 'bg-cream text-house', glyph: '+' },
  meh: { label: "Don't care", icon: Meh, cls: 'bg-aisle text-dim', glyph: '~' },
  pass: { label: 'No thanks', icon: ThumbsDown, cls: 'bg-velvet/30 text-cream', glyph: '×' },
};
export const NOT_WATCHED = ['unseen', 'meh', 'pass'];
const starText = (stars) => (stars % 1 ? stars.toFixed(1) : stars);

export function StatusStub({ rating }) {
  if (!rating) return null;
  const s = STATUS[rating.status];
  const Icon = s.icon;
  return (
    <span className={`stub inline-flex shrink-0 items-center text-[11px] font-bold uppercase tracking-wide ${s.cls}`}>
      <span className="inline-flex items-center gap-1 py-1 pl-3 pr-2">
        <Icon size={12} strokeWidth={2.5} />
        {s.label}
      </span>
      {shownStars(rating) ? (
        <span className="perf inline-flex items-center gap-0.5 py-1 pl-2 pr-3 tabular-nums">
          <Star size={11} fill="currentColor" strokeWidth={0} />
          {starText(rating.stars)}
        </span>
      ) : rating.via ? (
        <span className="perf py-1 pl-2 pr-3 normal-case tracking-normal">{{ favorite: 'favourite', rank: 'ranked', watched: 'not rated yet' }[rating.via] || ''}</span>
      ) : (
        <span className="pr-1" />
      )}
    </span>
  );
}

export function CertBadge({ cert }) {
  if (!cert) return null;
  return <span className="shrink-0 rounded border border-dim/70 px-1.5 py-px text-[10px] font-bold leading-4 tracking-wide text-dim">{cert}</span>;
}

/** "Directed by X" when the movie's details include its crew. */
export const directedBy = (movie) => {
  const names = (movie.crew || []).filter((c) => c.role === 'director').map((c) => c.name);
  return names.length ? `Directed by ${names.join(' & ')}` : null;
};

/**
 * The review score as a badge. Shows the best source the app has for the movie:
 *   Rotten Tomatoes (red at 60%+), else Metacritic (gold at 61+), else the TMDB audience score.
 * size: 'sm' for list rows, 'lg' for the card or sheet you're rating from.
 */
export function ScoreBadge({ movie, size = 'sm', className = '' }) {
  const score = quality(movie);
  if (score == null) return null;
  const source = typeof movie.rt === 'number' ? 'rt' : typeof movie.mc === 'number' ? 'mc' : 'tmdb';
  const look = {
    rt: { long: 'Rotten Tomatoes', short: 'RT', unit: '%', tone: score >= 60 ? 'bg-velvet text-white' : 'bg-aisle text-cream', title: 'Rotten Tomatoes critics score' },
    mc: { long: 'Metacritic', short: 'MC', unit: '', tone: score >= 61 ? 'bg-gold text-house' : 'bg-aisle text-cream', title: 'Metacritic critics score, out of 100' },
    tmdb: { long: 'TMDB', short: 'TMDB', unit: '%', tone: 'border border-aisle text-dim', title: 'TMDB audience score (no critics score available)' },
  }[source];
  const shape = size === 'lg' ? 'gap-2 rounded-lg px-3 py-1.5' : 'gap-1 rounded px-1.5 py-0.5';
  return (
    <span className={`inline-flex shrink-0 items-baseline whitespace-nowrap ${shape} ${look.tone} ${className}`} title={look.title}>
      <span className={`font-bold uppercase tracking-wide opacity-80 ${size === 'lg' ? 'text-xs' : 'text-[9px]'}`}>{size === 'lg' ? look.long : look.short}</span>
      <span className={`font-bold tabular-nums leading-none ${size === 'lg' ? 'text-2xl' : 'text-sm'}`}>{score}{look.unit}</span>
    </span>
  );
}

export const formatRuntime = (min) => (min ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m` : null);

/**
 * Number keys for star ratings: 1–5 sets that many stars, the same key again takes half a star
 * off (4, 4 → 3½), 0 clears, Delete undoes, Enter calls onSave (each screen decides what that
 * means). Ignored while typing in a field, and
 * `enabled` lets a screen stand down (e.g. while a sheet is open on top of it).
 */
export function useStarKeys({ stars, onStars, onSave, onUndo, onArrow, enabled = true }) {
  const latest = useRef({});
  latest.current = { stars, onStars, onSave, onUndo, onArrow, enabled };
  useEffect(() => {
    const onKey = (e) => {
      const now = latest.current;
      if (!now.enabled || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(input|textarea|select)$/i.test(e.target?.tagName || '') || e.target?.isContentEditable) return;
      if (/^[1-5]$/.test(e.key)) { const n = Number(e.key); now.onStars(now.stars === n ? n - 0.5 : n); e.preventDefault(); }
      // Arrow keys answer "haven't watched it" (the screen says which arrow means what). Off once stars are set.
      else if (/^Arrow(Left|Down|Right)$/.test(e.key) && now.onArrow) { if (!now.stars) { now.onArrow(e.key); e.preventDefault(); } }
      else if (e.key === '0') { if (now.stars) { now.onStars(0); e.preventDefault(); } }
      // Delete (Backspace on a Mac keyboard) is undo: it takes back the stars just tapped, or, with none, the last movie.
      else if (e.key === 'Backspace' || e.key === 'Delete') { if (now.stars) now.onStars(0); else if (now.onUndo) now.onUndo(); e.preventDefault(); }
      // Enter is taken even when a button has focus (you've usually just clicked a star or a tab); Space still presses buttons.
      else if (e.key === 'Enter' && now.onSave && !/^a$/i.test(e.target?.tagName || '')) { now.onSave(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
export const KeyHint = ({ children = 'Keyboard: 1–5 for stars, the same key again for half a star less, Enter to save.' }) => <span className="hidden text-xs text-dim md:block">{children}</span>;

/* ---------- Rows ---------- */

/** One small avatar per person, badged with their stars or stance. A dashed ring means no vote yet. */
export function MemberDots({ entry, members }) {
  return (
    <span className="flex shrink-0 gap-1.5">
      {members.map((m) => {
        const r = entry?.ratings?.[m.id];
        if (!r) return <span key={m.id} className="h-6 w-6 rounded-full border border-dashed border-aisle" title={`${m.name}: no vote yet`} />;
        const s = STATUS[r.status];
        const stars = shownStars(r);
        return (
          <span key={m.id} className="relative" title={`${m.name}: ${s.label}${stars ? `, ${stars} stars` : ''}`}>
            <Avatar member={m} size={24} dim={r.status === 'pass' || r.status === 'meh'} />
            <span className={`absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none ${r.status === 'again' ? 'bg-gold text-house' : stars ? 'bg-house text-gold ring-1 ring-aisle' : 'bg-cream text-house'}`}>
              {stars ? starText(stars) : s.glyph}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** A list row: position, thumbnail, title and facts. `aside` sits inside the tap target, `action` is its own control. */
export function MovieRow({ movie, index, onOpen, note, aside, action }) {
  const facts = [movie.year, movie.runtime && formatRuntime(movie.runtime), (movie.genres || []).slice(0, 2).join(', ')].filter(Boolean);
  return (
    <li className="flex items-center gap-1">
      <button type="button" onClick={() => onOpen(movie)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-seat active:bg-seat">
        {index != null && <span className="w-5 shrink-0 text-right text-sm font-bold tabular-nums text-dim">{index}</span>}
        <span className="w-10 shrink-0"><Poster movie={movie} size="w92" className="rounded-sm" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-bold text-cream">{movie.title}</span>
            <CertBadge cert={movie.cert} />
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-dim">
            <ScoreBadge movie={movie} />
            <span className="truncate">{facts.join(' · ')}</span>
          </span>
          {note && <span className="mt-0.5 block truncate text-xs">{note}</span>}
        </span>
        {aside}
      </button>
      {action}
    </li>
  );
}

export const Chip = ({ on, onClick, children, ...rest }) => (
  <button type="button" aria-pressed={on} onClick={onClick} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold transition ${on ? 'border-gold bg-gold text-house' : 'border-aisle text-cream hover:border-dim'}`} {...rest}>
    {children}
  </button>
);

export const Notice = ({ children }) => <p className="rounded-lg border border-velvet bg-velvet/15 p-3 text-sm text-cream">{children}</p>;

/**
 * The movie's title as a link to Rotten Tomatoes. There is no reliable way to know a movie's
 * exact Rotten Tomatoes address, so this opens their search for the title, which lists it first.
 */
export const rtUrl = (movie) => `https://www.rottentomatoes.com/search?search=${encodeURIComponent(movie.title || '')}`;
export const TitleLink = ({ movie }) => (
  <a href={rtUrl(movie)} target="_blank" rel="noopener noreferrer" title="Open on Rotten Tomatoes" className="underline decoration-aisle decoration-2 underline-offset-4 hover:decoration-gold">
    {movie.title}<ExternalLink size={13} className="ml-1.5 inline align-baseline text-dim" aria-hidden="true" />
  </a>
);
