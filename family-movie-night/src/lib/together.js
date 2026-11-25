// The shared queue's brain. Pure functions: no React, no network.
//
// An entry is { movie, ratings: { parent?, kid1?, kid2? } }
// A rating is { status, stars }
//   watched:      'seen'   (stars required)   'again' (stars required, would rewatch)
//   not watched:  'unseen' (want to)          'meh'   (indifferent)        'pass' (no thanks)

import { PROFILE_IDS } from './config.js';

const wants = (r) => !!r && (r.status === 'unseen' || r.status === 'again');
const rated = (r) => !!r && typeof r.stars === 'number' && r.stars > 0;

/** Ruled out by anyone who said No thanks, or gave it 1–2 stars without marking Watch Again. */
export function vetoers(entry) {
  return PROFILE_IDS.filter((id) => {
    const r = entry.ratings?.[id];
    if (!r) return false;
    return r.status === 'pass' || (rated(r) && r.stars <= 2 && r.status !== 'again');
  });
}

/**
 * 0–100 "potential match" for a movie the family hasn't watched together.
 * Starts from the audience score, blends in the parent's stars on a parent rewatch,
 * and drops 10 points for each person who is indifferent.
 */
export function matchScore(entry) {
  const r = entry.ratings || {};
  let score = entry.movie.vote ? entry.movie.vote * 10 : 70;
  if (r.parent?.status === 'again' && rated(r.parent)) score = score * 0.5 + r.parent.stars * 20 * 0.5;
  score -= 10 * PROFILE_IDS.filter((id) => r[id]?.status === 'meh').length;
  return Math.max(0, Math.round(score));
}

export function averageStars(entry) {
  const stars = PROFILE_IDS.map((id) => entry.ratings?.[id]).filter(rated).map((r) => r.stars);
  return stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : 0;
}

/**
 * Sort every entry into lanes. Each movie lands in at most one, checked in this order:
 *   vetoed     — ruled out (see vetoers)
 *   topPicks   — nobody has watched it (or only the parent, who would rewatch), everyone has
 *                weighed in, and at least one person actively wants it. Indifferent is allowed.
 *   favorites  — all three gave 4+ stars and at least one would watch again
 *   compromise — exactly two want it and the third hasn't weighed in at all
 */
export function buildWatchTogether(entries) {
  const topPicks = [];
  const favorites = [];
  const compromise = [];
  const vetoed = [];

  for (const entry of Object.values(entries)) {
    const r = entry.ratings || {};
    const all = PROFILE_IDS.map((id) => r[id]);
    if (!all.some(Boolean)) continue;

    const blockers = vetoers(entry);
    if (blockers.length) {
      vetoed.push({ ...entry, vetoedBy: blockers });
      continue;
    }

    const open = (x) => x?.status === 'unseen' || x?.status === 'meh';
    const parentOk = open(r.parent) || r.parent?.status === 'again';
    if (parentOk && open(r.kid1) && open(r.kid2) && all.some(wants)) {
      topPicks.push({ ...entry, lane: 'new', match: matchScore(entry) });
      continue;
    }

    if (all.every((x) => rated(x) && x.stars >= 4) && all.some((x) => x.status === 'again')) {
      favorites.push({ ...entry, lane: 'favorite', avg: averageStars(entry) });
      continue;
    }

    const wanting = PROFILE_IDS.filter((id) => wants(r[id]));
    const missing = PROFILE_IDS.filter((id) => !r[id]);
    if (wanting.length === 2 && missing.length === 1) {
      compromise.push({ ...entry, lane: 'vote', waitingOn: missing[0], match: matchScore(entry) });
    }
  }

  topPicks.sort((a, b) => b.match - a.match);
  favorites.sort((a, b) => b.avg - a.avg);
  compromise.sort((a, b) => b.match - a.match);
  return { topPicks, favorites, compromise, vetoed };
}

/** filters: { genre: string | '', certs: string[], maxRuntime: number | 0 } */
export function applyFilters(list, filters) {
  return list.filter(({ movie }) => {
    if (filters.genre && !(movie.genres || []).includes(filters.genre)) return false;
    if (filters.certs?.length && !filters.certs.includes(movie.cert)) return false;
    if (filters.maxRuntime && !(movie.runtime && movie.runtime <= filters.maxRuntime)) return false;
    return true;
  });
}
