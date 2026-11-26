// Taste profiles and "what should we watch" suggestions. Pure functions: no React, no network.
//
// An entry is { movie, ratings: { [memberId]: { status, stars } } }
//   watched:      'seen'   (stars required)   'again' (stars required, would rewatch)
//   not watched:  'unseen' (want to)          'meh'   (don't care)         'pass' (no thanks)
//   from Rank 5:  { status: 'seen', stars: null, like, via: 'rank', place, of }
//                 `like` is a hidden 0–5 taste signal. It is never shown as a star rating.

/** Stars the person actually gave. A Rank 5 result has none, whatever it stores internally. */
export const shownStars = (r) => (r && r.via !== 'rank' && typeof r.stars === 'number' && r.stars > 0 ? r.stars : null);

/** How much the person liked it, 0–5: their stars, or the hidden signal from a ranking. */
export const liking = (r) => {
  if (!r) return null;
  if (shownStars(r)) return r.stars;
  if (typeof r.like === 'number') return r.like;
  return r.via === 'rank' && typeof r.stars === 'number' ? r.stars : null; // rankings saved before `like` existed
};
const rated = (r) => liking(r) != null;

/**
 * What one person likes, learned from their star ratings.
 * Returns { count, mean, genres: [{ name, n, avg, score }] } with genres sorted best first.
 * `score` is the genre average pulled toward the person's overall mean when there are few ratings.
 */
export function tasteProfile(entries, memberId) {
  const byGenre = {};
  let sum = 0;
  let count = 0;
  for (const entry of Object.values(entries)) {
    const r = entry.ratings?.[memberId];
    if (!rated(r)) continue;
    sum += liking(r);
    count += 1;
    for (const g of entry.movie.genres || []) {
      byGenre[g] ||= { name: g, n: 0, sum: 0 };
      byGenre[g].n += 1;
      byGenre[g].sum += liking(r);
    }
  }
  const mean = count ? sum / count : 3.5;
  const K = 3; // how many ratings a genre needs before we mostly trust its own average
  const genres = Object.values(byGenre)
    .map((g) => ({ name: g.name, n: g.n, avg: g.sum / g.n, score: (g.sum + K * mean) / (g.n + K) }))
    .sort((a, b) => b.score - a.score);
  return { count, mean, genres };
}

/** Guess how many stars (0.5–5) this person would give a movie they haven't rated. */
export function predictStars(profile, movie) {
  const crowd = movie.vote ? movie.vote / 2 : 3.5;
  if (!profile.count) return crowd;
  const scores = (movie.genres || []).map((g) => profile.genres.find((x) => x.name === g)?.score ?? profile.mean);
  const taste = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : profile.mean;
  // Lean on the crowd until there are enough ratings to trust the person's own taste.
  const trust = Math.min(0.7, profile.count / 30);
  return Math.max(0.5, Math.min(5, taste * trust + crowd * (1 - trust)));
}

/** One person's enthusiasm for one movie, 0–100, or a veto. */
function memberScore(rating, profile, movie) {
  if (!rating) return { kind: 'guess', score: predictStars(profile, movie) * 20 * 0.85 };
  if (rating.status === 'pass') return { kind: 'veto' };
  if (rating.status === 'unseen') return { kind: 'want', score: 92 };
  if (rating.status === 'meh') return { kind: 'meh', score: 55 };
  const liked = liking(rating);
  if (liked == null) return { kind: 'seen', score: 35 }; // watched, no opinion recorded
  if (rating.status === 'again') return { kind: 'again', score: liked * 20 };
  if (liked <= 2) return { kind: 'veto' };
  return { kind: 'seen', score: liked * 20 * 0.5 }; // seen it, didn't ask for a rewatch
}

/**
 * Rank movies for the people who are here tonight.
 *
 * Without seeds: a movie is suggested when nobody present ruled it out and at least one person
 * present wants to watch (or rewatch) it.
 *
 * With `similar` (from "Movies like…"): the list becomes the movies similar to the seeds.
 * Nobody needs to have asked for them, but vetoes still apply, and a movie everyone present
 * has already watched is left out.
 *
 * Everyone is scored from their rating, or from their taste profile if they haven't rated it.
 * The group score favours picks nobody will hate. Then two steers are applied:
 *   priorityGenres — tonight's vibe: +15 for matching one, +5 for each further match (max +25)
 *   similar        — blends 65% group score with 35% similarity to the seeds
 *
 * options: { priorityGenres: string[], similar: [{ movie, sim }] }
 */
export function suggest(entries, presentIds, { priorityGenres = [], similar = [] } = {}) {
  if (!presentIds.length) return [];
  const profiles = Object.fromEntries(presentIds.map((id) => [id, tasteProfile(entries, id)]));
  const seeded = similar.length > 0;
  const simById = new Map(similar.map((x) => [String(x.movie.id), x]));

  // Candidates: everything anyone has rated, plus (when seeded) similar movies nobody has touched.
  const candidates = seeded
    ? similar.map((x) => entries[x.movie.id] || { movie: x.movie, ratings: {} })
    : Object.values(entries);

  const out = [];
  for (const entry of candidates) {
    const parts = presentIds.map((id) => ({ id, ...memberScore(entry.ratings?.[id], profiles[id], entry.movie) }));
    if (parts.some((p) => p.kind === 'veto')) continue;
    const wanting = parts.filter((p) => p.kind === 'want' || p.kind === 'again');
    if (!seeded && !wanting.length) continue;
    if (seeded && parts.every((p) => p.kind === 'seen')) continue;

    const scores = parts.map((p) => p.score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    let raw = avg * 0.7 + Math.min(...scores) * 0.3;

    const sim = simById.get(String(entry.movie.id))?.sim || 0;
    if (seeded) raw = raw * 0.65 + sim * 100 * 0.35;

    const vibes = priorityGenres.filter((g) => (entry.movie.genres || []).includes(g));
    if (vibes.length) raw += Math.min(25, 15 + 5 * (vibes.length - 1));

    out.push({
      ...entry,
      rank: raw, // unclamped, so boosted movies still sort among themselves
      score: Math.max(0, Math.min(100, Math.round(raw))),
      parts,
      wanting: wanting.length,
      rewatch: parts.some((p) => p.kind === 'again' || p.kind === 'seen'),
      sim,
      vibes,
    });
  }
  return out.sort((a, b) => b.rank - a.rank || a.movie.title.localeCompare(b.movie.title));
}

/**
 * Combine the similar-lists of several seed movies into one. A movie similar to more than one
 * seed scores higher. Seeds themselves are dropped.
 */
export function mergeSimilar(lists, seedIds = []) {
  const merged = new Map();
  for (const list of lists) {
    for (const { movie, sim } of list) {
      const key = String(movie.id);
      if (seedIds.map(String).includes(key)) continue;
      const prev = merged.get(key);
      merged.set(key, prev ? { movie: prev.movie.detailed ? prev.movie : movie, best: Math.max(prev.best, sim), sum: prev.sum + sim } : { movie, best: sim, sum: sim });
    }
  }
  return [...merged.values()]
    .map((x) => ({ movie: x.movie, sim: Math.min(1, x.best + 0.5 * (x.sum - x.best)) }))
    .sort((a, b) => b.sim - a.sim);
}

const RANK_LIKING = { 1: [4], 2: [4.5, 3], 3: [5, 3.5, 2.5], 4: [5, 4, 3.5, 2.5], 5: [5, 4.5, 3.5, 3, 2.5] };

/**
 * Turn a best-to-worst ranking into hidden taste signals on the same 0–5 scale as stars:
 * 5 at the top, 3.5 in the middle, 2.5 at the bottom. These are never shown as star ratings;
 * they only feed the taste profile. 2.5 is deliberately above the veto line (2), because
 * finishing last in a batch is not the same as never wanting to see it again. A movie flagged
 * "never again" gets 1.5 instead, which does rule it out.
 */
export function rankToLiking(count, flagged = []) {
  const values = RANK_LIKING[Math.min(5, Math.max(1, count))];
  return Array.from({ length: count }, (_, n) => (flagged[n] ? 1.5 : values[Math.min(n, values.length - 1)]));
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
