// Taste profiles and "what should we watch" suggestions. Pure functions: no React, no network.
//
// An entry is { movie, ratings: { [memberId]: { status, stars } } }
//   watched:      'seen'   (stars required)   'again' (stars required, would rewatch)
//   not watched:  'unseen' (want to)          'meh'   (don't care)         'pass' (no thanks)

const rated = (r) => !!r && typeof r.stars === 'number' && r.stars > 0;

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
    sum += r.stars;
    count += 1;
    for (const g of entry.movie.genres || []) {
      byGenre[g] ||= { name: g, n: 0, sum: 0 };
      byGenre[g].n += 1;
      byGenre[g].sum += r.stars;
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
  if (rated(rating) && rating.status === 'again') return { kind: 'again', score: rating.stars * 20 };
  if (rated(rating) && rating.stars <= 2) return { kind: 'veto' };
  return { kind: 'seen', score: rating.stars * 20 * 0.5 }; // seen it, didn't ask for a rewatch
}

/**
 * Rank movies for the people who are here tonight.
 * A movie is suggested when nobody present ruled it out and at least one person present
 * wants to watch (or rewatch) it. Everyone else is scored from their rating, or from their
 * taste profile if they haven't rated it. The group score favours picks nobody will hate.
 */
export function suggest(entries, presentIds) {
  if (!presentIds.length) return [];
  const profiles = Object.fromEntries(presentIds.map((id) => [id, tasteProfile(entries, id)]));
  const out = [];
  for (const entry of Object.values(entries)) {
    const parts = presentIds.map((id) => ({ id, ...memberScore(entry.ratings?.[id], profiles[id], entry.movie) }));
    if (parts.some((p) => p.kind === 'veto')) continue;
    const wanting = parts.filter((p) => p.kind === 'want' || p.kind === 'again');
    if (!wanting.length) continue;
    const scores = parts.map((p) => p.score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const score = Math.round(avg * 0.7 + Math.min(...scores) * 0.3);
    out.push({ ...entry, score, parts, wanting: wanting.length, rewatch: parts.some((p) => p.kind === 'again' || p.kind === 'seen') });
  }
  return out.sort((a, b) => b.score - a.score || a.movie.title.localeCompare(b.movie.title));
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
