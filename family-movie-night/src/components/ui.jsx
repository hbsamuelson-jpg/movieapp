import { useState } from 'react';
import {
  Bookmark, Candy, Clapperboard, Drama, Eye, Film, Ghost, Glasses, Meh, Megaphone, Popcorn,
  Projector, Repeat, Rocket, Star, ThumbsDown, Ticket,
} from 'lucide-react';
import { posterUrl } from '../lib/tmdb.js';

/* ---------- Avatars ---------- */

export const AVATARS = {
  director: { icon: Megaphone, label: 'Director', bg: '#B91C1C' },
  popcorn: { icon: Popcorn, label: 'Popcorn', bg: '#D97706' },
  clapper: { icon: Clapperboard, label: 'Clapperboard', bg: '#0E7490' },
  reel: { icon: Film, label: 'Film Reel', bg: '#6D28D9' },
  star: { icon: Star, label: 'Movie Star', bg: '#BE185D' },
  ticket: { icon: Ticket, label: 'Ticket Taker', bg: '#15803D' },
  glasses: { icon: Glasses, label: '3D Glasses', bg: '#1D4ED8' },
  projector: { icon: Projector, label: 'Projectionist', bg: '#475569' },
  drama: { icon: Drama, label: 'Drama Masks', bg: '#9333EA' },
  rocket: { icon: Rocket, label: 'Sci-Fi Hero', bg: '#0F766E' },
  ghost: { icon: Ghost, label: 'Friendly Ghost', bg: '#4338CA' },
  candy: { icon: Candy, label: 'Candy Counter', bg: '#DB2777' },
};

export function Avatar({ avatar, size = 40, ring = false }) {
  const a = AVATARS[avatar] || AVATARS.reel;
  const Icon = a.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-white ${ring ? 'ring-2 ring-gold ring-offset-2 ring-offset-house' : ''}`}
      style={{ width: size, height: size, background: a.bg }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.55)} strokeWidth={2} />
    </span>
  );
}

/* ---------- Posters ---------- */

const PALETTES = [
  ['#7F1D1D', '#1C0A0A'], ['#134E4A', '#06201E'], ['#1E3A8A', '#0B1433'],
  ['#581C87', '#1E0A33'], ['#14532D', '#07200F'], ['#78350F', '#241004'],
];

/** TMDB poster when there is one; otherwise a vintage title card drawn in CSS. */
export function Poster({ movie, className = '' }) {
  const [failed, setFailed] = useState(false);
  const src = posterUrl(movie.poster);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`${movie.title} poster`}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`aspect-[2/3] w-full rounded-md object-cover ${className}`}
      />
    );
  }
  const [a, b] = PALETTES[Math.abs(Number(movie.id) || movie.title.length) % PALETTES.length];
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
            <span
              key={fill ? popKey : 'empty'}
              className={`absolute inset-y-0 left-0 overflow-hidden ${fill ? 'star-pop' : ''}`}
              style={{ width: `${fill}%` }}
            >
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

export function MiniStars({ stars }) {
  return (
    <span className="inline-flex items-center gap-0.5 font-bold tabular-nums text-gold">
      <Star size={12} fill="currentColor" strokeWidth={0} />
      {stars % 1 ? stars.toFixed(1) : stars}
    </span>
  );
}

/* ---------- Status ticket stubs ---------- */

export const STATUS = {
  seen: { label: 'Watched', icon: Eye, cls: 'bg-aisle text-cream', glyph: null },
  again: { label: 'Watch again', icon: Repeat, cls: 'bg-gold text-house', glyph: null },
  unseen: { label: 'Want to', icon: Bookmark, cls: 'bg-cream text-house', glyph: '+' },
  meh: { label: 'Indifferent', icon: Meh, cls: 'bg-aisle text-dim', glyph: '~' },
  pass: { label: 'No thanks', icon: ThumbsDown, cls: 'bg-velvet/30 text-cream', glyph: '\u00d7' },
};
export const WATCHED = ['seen', 'again'];
export const NOT_WATCHED = ['unseen', 'meh', 'pass'];

export function StatusStub({ rating }) {
  if (!rating) return null;
  const s = STATUS[rating.status];
  const Icon = s.icon;
  return (
    <span className={`stub inline-flex items-center text-[11px] font-bold uppercase tracking-wide ${s.cls}`}>
      <span className="inline-flex items-center gap-1 py-1 pl-3 pr-2">
        <Icon size={12} strokeWidth={2.5} />
        {s.label}
      </span>
      {rating.stars ? (
        <span className="perf inline-flex items-center gap-0.5 py-1 pl-2 pr-3 tabular-nums">
          <Star size={11} fill="currentColor" strokeWidth={0} />
          {rating.stars % 1 ? rating.stars.toFixed(1) : rating.stars}
        </span>
      ) : (
        <span className="pr-1" />
      )}
    </span>
  );
}

export function CertBadge({ cert }) {
  if (!cert) return null;
  return <span className="rounded border border-cream/60 px-1.5 py-px text-[10px] font-bold leading-4 tracking-wide text-dim">{cert}</span>;
}

export const formatRuntime = (min) => (min ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m` : null);

/* ---------- Queue rows ---------- */

/** One small avatar per family member who has weighed in, badged with their stars or stance. */
export function FamilyDots({ entry, profiles }) {
  return (
    <span className="flex shrink-0 gap-1.5">
      {profiles.map((p) => {
        const r = entry?.ratings?.[p.id];
        if (!r) return <span key={p.id} className="h-6 w-6 rounded-full border border-dashed border-aisle" title={`${p.name}: no vote yet`} />;
        const s = STATUS[r.status];
        return (
          <span key={p.id} className={`relative ${r.status === 'pass' || r.status === 'meh' ? 'opacity-50' : ''}`} title={`${p.name}: ${s.label}${r.stars ? `, ${r.stars} stars` : ''}`}>
            <Avatar avatar={p.avatar} size={24} />
            <span className={`absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none ${r.status === 'again' ? 'bg-gold text-house' : r.stars ? 'bg-house text-gold ring-1 ring-aisle' : 'bg-cream text-house'}`}>
              {r.stars ? (r.stars % 1 ? r.stars.toFixed(1) : r.stars) : s.glyph}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** A queue row: position, thumbnail, title and facts, then whatever goes on the right. */
export function MovieRow({ movie, index, onOpen, note, right }) {
  const facts = [movie.year, movie.runtime && formatRuntime(movie.runtime), (movie.genres || []).slice(0, 2).join(', ')].filter(Boolean);
  return (
    <li>
      <button type="button" onClick={() => onOpen(movie)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-seat active:bg-seat">
        {index != null && <span className="w-5 shrink-0 text-right text-sm font-bold tabular-nums text-dim">{index}</span>}
        <span className="w-10 shrink-0"><Poster movie={movie} className="rounded-sm" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-bold text-cream">{movie.title}</span>
            <CertBadge cert={movie.cert} />
          </span>
          <span className="block truncate text-xs text-dim">{facts.join(' \u00b7 ')}</span>
          {note && <span className="mt-0.5 block truncate text-xs">{note}</span>}
        </span>
        {right}
      </button>
    </li>
  );
}

export const Chip = ({ on, onClick, children }) => (
  <button type="button" aria-pressed={on} onClick={onClick} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold transition ${on ? 'border-gold bg-gold text-house' : 'border-aisle text-cream hover:border-dim'}`}>
    {children}
  </button>
);
