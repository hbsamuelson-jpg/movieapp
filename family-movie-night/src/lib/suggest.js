// Taste profiles and "what should we watch" suggestions. Pure functions: no React, no network.
//
// An entry is { movie, ratings: { [memberId]: { status, stars } } }
//   watched:      'seen'   (stars required)   'again' (stars required, would rewatch)
//   not watched:  'unseen' (want to)          'meh'   (don't care)         'pass' (no thanks)
//   from Rank 5:  { status: 'seen', stars: null, like, via: 'rank', place, of }
//                 `like` is a hidden 0–5 taste signal. It is never shown as a star rating.
//   a favourite:  { status: 'seen', stars: null, like: 5, via: 'favorite' }  (counts double)
//
// A movie may carry crew: [{ id, name, role: 'director' | 'writer' }].

/**
 * Stars the person actually gave. Rank 5 results, favourites and "watched, not rated yet" have
 * none. (A rating can carry a leftover `via` mark alongside real stars if it was saved by an
 * older version of the app; real stars win. The one exception is an early Rank 5 save, which
 * stored its hidden signal in `stars` and has no `like`.)
 */
export const shownStars = (r) => {
  if (!r || typeof r.stars !== 'number' || r.stars <= 0) return null;
  return r.via === 'rank' && typeof r.like !== 'number' ? null : r.stars;
};

/** How much the person liked it, 0–5: their stars, or the hidden signal from a ranking. */
export const liking = (r) => {
  if (!r) return null;
  if (shownStars(r)) return r.stars;
  if (typeof r.like === 'number') return r.like;
  return r.via === 'rank' && typeof r.stars === 'number' ? r.stars : null; // rankings saved before `like` existed
};
const rated = (r) => liking(r) != null;

/**
 * What one person likes, learned from what they've watched.
 * Returns { count, mean, genres, people }:
 *   genres  [{ name, n, avg, score }] best first. `score` is the genre average pulled toward the
 *           person's overall mean when there are few ratings.
 *   people  [{ id, name, role, n, avg }] directors and writers behind movies they rated 4 or
 *           higher, at least twice (an all-time favourite counts double, so one is enough).
 */
export function tasteProfile(entries, memberId) {
  const byGenre = {};
  const byPerson = {};
  let sum = 0;
  let count = 0;
  for (const entry of Object.values(entries)) {
    const r = entry.ratings?.[memberId];
    if (!rated(r)) continue;
    const liked = liking(r);
    const weight = r.via === 'favorite' ? 2 : 1;
    sum += liked * weight;
    count += weight;
    for (const g of entry.movie.genres || []) {
      byGenre[g] ||= { name: g, n: 0, sum: 0 };
      byGenre[g].n += weight;
      byGenre[g].sum += liked * weight;
    }
    if (liked >= 4) {
      for (const c of entry.movie.crew || []) {
        byPerson[c.id] ||= { id: c.id, name: c.name, role: c.role, n: 0, sum: 0 };
        byPerson[c.id].n += weight;
        byPerson[c.id].sum += liked * weight;
      }
    }
  }
  const mean = count ? sum / count : 3.5;
  const K = 3; // how many ratings a genre needs before we mostly trust its own average
  const genres = Object.values(byGenre)
    .map((g) => ({ name: g.name, n: g.n, avg: g.sum / g.n, score: (g.sum + K * mean) / (g.n + K) }))
    .sort((a, b) => b.score - a.score);
  const people = Object.values(byPerson)
    .filter((p) => p.n >= 2)
    .map((p) => ({ id: p.id, name: p.name, role: p.role, n: p.n, avg: p.sum / p.n }))
    .sort((a, b) => b.n * b.avg - a.n * a.avg);
  return { count, mean, genres, people };
}

/** The directors or writers of this movie that the person has a track record of liking. */
export const likedCrew = (profile, movie) => (movie.crew || []).filter((c) => (profile.people || []).some((p) => p.id === c.id));

/** Guess how many stars (0.5–5) this person would give a movie they haven't rated. */
export function predictStars(profile, movie) {
  const crowd = movie.vote ? movie.vote / 2 : 3.5;
  if (!profile.count) return crowd;
  const scores = (movie.genres || []).map((g) => profile.genres.find((x) => x.name === g)?.score ?? profile.mean);
  const taste = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : profile.mean;
  // Lean on the crowd until there are enough ratings to trust the person's own taste.
  const trust = Math.min(0.7, profile.count / 30);
  // A director or writer they keep liking is worth half a star.
  const bonus = likedCrew(profile, movie).length ? 0.5 : 0;
  return Math.max(0.5, Math.min(5, taste * trust + crowd * (1 - trust) + bonus));
}

/**
 * The review score to rank by, 0–100: Rotten Tomatoes when known, then Metacritic, then the
 * TMDB audience score.
 */
export const quality = (movie) => {
  if (typeof movie.rt === 'number') return movie.rt;
  if (typeof movie.mc === 'number') return movie.mc;
  return movie.vote ? Math.round(movie.vote * 10) : null;
};

/** A small nudge for well-reviewed movies: at most 4 points either way, centred on a score of 65. */
export const qualityNudge = (movie) => {
  const q = quality(movie);
  return q == null ? 0 : Math.max(-1, Math.min(1, (q - 65) / 35)) * 4;
};

/** Points taken off a movie for each person watching who has seen it and didn't mark Watch again. */
const ALREADY_SEEN_PENALTY = 30;

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

const SERVICE_BOOST = 6;
/**
 * Where this movie can be watched at no extra cost, assuming the family has every subscription:
 * { free: [name] (free with ads), included: [name] (with a subscription) }. Both empty if it's
 * rent-or-buy only, or not looked up yet.
 */
export const streaming = (movie) => ({ free: (movie.watch?.free || []).map((s) => s.name), included: (movie.watch?.on || []).map((s) => s.name) });
const streams = (movie) => { const s = streaming(movie); return s.free.length + s.included.length > 0; };
/** Movie ids that anyone in `memberIds` has snoozed and whose snooze hasn't run out. */
export function activeSnoozes(members, memberIds, now = Date.now()) {
  const ids = new Set();
  for (const m of members) if (memberIds.includes(m.id)) for (const [movieId, until] of Object.entries(m.snoozed || {})) if (until > now) ids.add(String(movieId));
  return ids;
}

/**
 * Rank movies for the people who are here tonight. Two kinds of movie make the list:
 *
 *   wanted — nobody present ruled it out and at least one person present marked it Want to
 *            or Watch again.
 *   new    — a discovery (from `discoveries`): nobody present has watched it, listed it or ruled it out,
 *            and it resembles what they love or comes from a director or writer they like.
 *
 * With `similar` (from "Movies like…") the list is instead the movies similar to the seeds:
 * vetoes still apply, and a movie everyone present has already watched is left out.
 *
 * Everyone is scored from their own answer, or from their taste profile if they haven't given
 * one. The group score favours picks nobody will hate. Then:
 *   new movies     — 75% group score, 25% how closely they match the group's interests
 *   similar        — 65% group score, 35% similarity to the seeds
 *   already seen   — minus 30 for each person watching who has seen it and didn't mark Watch again
 *   reviews        — a nudge of up to 4 points either way for the critic score
 *   priorityGenres — tonight's vibe: +15 for matching one, +5 for each further match (max +25)
 *   streaming      — +6 when it can be streamed without renting it
 *   snoozed        — movie ids someone watching said "not tonight" to: left out
 *
 * options: { priorityGenres: string[], similar: [{ movie, sim }], discoveries: [{ movie, sim, because }], snoozed: Set }
 */
export function suggest(entries, presentIds, { priorityGenres = [], similar = [], discoveries = [], snoozed = new Set() } = {}) {
  if (!presentIds.length) return [];
  const profiles = Object.fromEntries(presentIds.map((id) => [id, tasteProfile(entries, id)]));
  const seeded = similar.length > 0;
  const simById = new Map(similar.map((x) => [String(x.movie.id), x]));

  const candidates = seeded
    ? similar.map((x) => ({ entry: entries[x.movie.id] || { movie: x.movie, ratings: {} }, sim: x.sim }))
    : [
      ...Object.values(entries).map((entry) => ({ entry })),
      // Discoveries: only movies none of the people present have watched (or already listed, or ruled out).
      ...discoveries
        .filter((d) => !presentIds.some((id) => ['seen', 'again', 'unseen', 'pass'].includes(entries[d.movie.id]?.ratings?.[id]?.status)))
        .map((d) => ({ entry: { movie: entries[d.movie.id]?.movie || d.movie, ratings: entries[d.movie.id]?.ratings || {} }, sim: d.sim, because: d.because, fresh: true })),
    ];

  const out = [];
  for (const { entry, sim = simById.get(String(entry.movie.id))?.sim || 0, because, fresh } of candidates) {
    if (snoozed.has(String(entry.movie.id))) continue;
    const parts = presentIds.map((id) => ({ id, ...memberScore(entry.ratings?.[id], profiles[id], entry.movie) }));
    if (parts.some((p) => p.kind === 'veto')) continue;
    const wanting = parts.filter((p) => p.kind === 'want' || p.kind === 'again');
    if (!seeded && !fresh && !wanting.length) continue;
    if (seeded && parts.every((p) => p.kind === 'seen')) continue;

    const scores = parts.map((p) => p.score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    let raw = avg * 0.7 + Math.min(...scores) * 0.3;
    if (seeded) raw = raw * 0.65 + sim * 100 * 0.35;
    else if (fresh) raw = raw * 0.75 + sim * 100 * 0.25;

    // Someone here has already watched it and didn't ask to see it again: push it well down.
    const alreadySeen = parts.filter((p) => p.kind === 'seen').length;
    raw -= ALREADY_SEEN_PENALTY * alreadySeen;

    raw += qualityNudge(entry.movie); // better-reviewed movies edge ahead, only a little

    const where = streaming(entry.movie);
    if (streams(entry.movie)) raw += SERVICE_BOOST;

    const vibes = priorityGenres.filter((g) => (entry.movie.genres || []).includes(g));
    if (vibes.length) raw += Math.min(25, 15 + 5 * (vibes.length - 1));

    out.push({
      ...entry,
      lane: fresh ? 'new' : 'wanted',
      because: because || null,
      rank: raw, // unclamped, so boosted movies still sort among themselves
      score: Math.max(0, Math.min(100, Math.round(raw))),
      parts,
      wanting: wanting.length,
      rewatch: parts.some((p) => p.kind === 'again' || p.kind === 'seen'),
      alreadySeen,
      where,
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

/**
 * Read a vote: counts per option (most votes first), how many have voted, and the winner(s).
 * `winners` has more than one movie when there's a tie, and none if nobody voted.
 */
export function voteResult(vote) {
  // In a ranked vote "votes" are points: 3 for a first choice, 2 for a second, 1 for a third.
  const rows = vote.options.map((movie) => ({ movie, votes: Math.max(0, vote.tally?.[movie.id] || 0) })).sort((a, b) => b.votes - a.votes);
  const top = rows[0]?.votes || 0;
  const cast = (vote.voted || []).length;
  const expected = (vote.voters || []).length;
  return { rows, cast, expected, everyoneIn: expected > 0 && (vote.voters || []).every((id) => (vote.voted || []).includes(id)), winners: top > 0 ? rows.filter((r) => r.votes === top).map((r) => r.movie) : [] };
}

/** filters: { genre: string | '', certs: string[], maxRuntime: number | 0, streamable: boolean (hide rent-or-buy-only movies), freeOnly: boolean } */
export function applyFilters(list, filters) {
  return list.filter(({ movie }) => {
    if (filters.genre && !(movie.genres || []).includes(filters.genre)) return false;
    if (filters.certs?.length && !filters.certs.includes(movie.cert)) return false;
    if (filters.maxRuntime && !(movie.runtime && movie.runtime <= filters.maxRuntime)) return false;
    if (filters.streamable && !streams(movie)) return false;
    if (filters.freeOnly && !streaming(movie).free.length) return false;
    return true;
  });
}

/**
 * "Movies you should like": one person's own picks, best first. Only movies they have given no
 * answer for. Two sources: discoveries built from their favourites and liked crew, and movies
 * someone else in the family rated 4 or higher. Returns [{ movie, match (0–100), because }].
 */
export function forYou(entries, memberId, discoveries = [], members = []) {
  const profile = tasteProfile(entries, memberId);
  const pool = new Map();
  for (const d of discoveries) pool.set(String(d.movie.id), { movie: d.movie, sim: d.sim, because: d.because });
  for (const e of Object.values(entries)) {
    const fans = members
      .filter((m) => m.id !== memberId && (liking(e.ratings?.[m.id]) || 0) >= 4)
      .sort((a, b) => liking(e.ratings[b.id]) - liking(e.ratings[a.id]));
    if (!fans.length) continue;
    const key = String(e.movie.id);
    const prev = pool.get(key);
    const text = `${fans.slice(0, 2).map((m) => m.name).join(' and ')} loved it`;
    pool.set(key, prev ? { ...prev, movie: e.movie, sim: Math.min(1, prev.sim + 0.15) } : { movie: e.movie, sim: 0.6, because: text });
  }
  const ranked = [...pool.values()]
    .filter((x) => !entries[x.movie.id]?.ratings?.[memberId])
    .map((x) => ({
      movie: x.movie,
      because: x.because,
      match: Math.round(Math.max(0, Math.min(100, predictStars(profile, x.movie) * 20 * 0.6 + x.sim * 100 * 0.4 + qualityNudge(x.movie)))),
    }))
    .sort((a, b) => b.match - a.match || a.movie.title.localeCompare(b.movie.title));
  // Mix it up: each repeat of the same reason ("directed by X") costs 8 points of position,
  // so one director or one favourite can't fill the whole list.
  const used = new Map();
  const mixed = [];
  while (ranked.length) {
    let best = 0;
    ranked.forEach((x, n) => {
      const cost = (y) => y.match - 8 * (used.get(y.because) || 0);
      if (cost(x) > cost(ranked[best])) best = n;
    });
    const [pick] = ranked.splice(best, 1);
    used.set(pick.because, (used.get(pick.because) || 0) + 1);
    mixed.push(pick);
  }
  return mixed;
}
