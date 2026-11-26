// Finds movies the people watching haven't seen but are likely to enjoy, for the Tonight list.
// Sources, per person present:
//   - their all-time favourites, and their most-loved rated movies  -> movies similar to those
//   - directors and writers they keep liking                        -> other movies by them
// Lookups are cached for the session, so changing who's watching doesn't refetch everything.

import { liking, mergeSimilar, tasteProfile } from './suggest.js';
import { byPerson, enrich, similarTo } from './tmdb.js';

const SEEDS_PER_PERSON = 3;
const MAX_SEEDS = 6;
const MAX_PEOPLE = 4;
const DETAIL_TOP = 25;

const cache = new Map();
const once = (key, load) => {
  if (!cache.has(key)) cache.set(key, load().catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key);
};

/** The movies and people each present member's taste points at. */
export function interestSeeds(entries, members, presentIds) {
  const seeds = new Map(); // movie id -> movie
  const people = new Map(); // person id -> person
  for (const member of members.filter((m) => presentIds.includes(m.id))) {
    const loved = Object.values(entries)
      .filter((e) => (liking(e.ratings?.[member.id]) || 0) >= 4.5)
      .sort((a, b) => liking(b.ratings[member.id]) - liking(a.ratings[member.id]))
      .map((e) => e.movie);
    // Favourites first, then the highest-rated movies, a few per person so nobody dominates.
    const mine = [...(member.favorites || []), ...loved].filter((m, n, all) => all.findIndex((x) => String(x.id) === String(m.id)) === n);
    mine.slice(0, SEEDS_PER_PERSON).forEach((m) => seeds.set(String(m.id), m));
    tasteProfile(entries, member.id).people.slice(0, 2).forEach((p) => people.set(p.id, p));
  }
  return { seeds: [...seeds.values()].slice(0, MAX_SEEDS), people: [...people.values()].slice(0, MAX_PEOPLE) };
}

/**
 * Returns [{ movie, sim, because }]: `sim` is 0–1 (how well it matches the group's interests)
 * and `because` is a short reason to show, e.g. "like Knives Out" or "directed by Rian Johnson".
 */
export async function discover(entries, members, presentIds) {
  const { seeds, people } = interestSeeds(entries, members, presentIds);
  if (!seeds.length && !people.length) return [];

  const [similarLists, crewLists] = await Promise.all([
    Promise.all(seeds.map((seed) => once(`like:${seed.id}`, () => similarTo(seed)).catch(() => []))),
    Promise.all(people.map((person) => once(`by:${person.id}`, () => byPerson(person)).catch(() => []))),
  ]);

  const reason = (why, seed) => (why === 'series' ? `same series as ${seed.title}` : why === 'director' ? `from the director of ${seed.title}` : `like ${seed.title}`);
  const because = new Map();
  similarLists.forEach((list, n) => list.forEach(({ movie, sim, why }) => {
    const prev = because.get(String(movie.id));
    if (!prev || sim > prev.sim) because.set(String(movie.id), { sim, text: reason(why, seeds[n]) });
  }));
  const merged = mergeSimilar(similarLists, seeds.map((s) => s.id));
  const pool = new Map(merged.map((x) => [String(x.movie.id), { ...x, because: because.get(String(x.movie.id))?.text }]));

  // Movies by a liked director or writer are strong matches in their own right.
  crewLists.forEach((list, n) => list.forEach((movie, position) => {
    const key = String(movie.id);
    if (seeds.some((s) => String(s.id) === key)) return;
    const strength = 0.85 - 0.02 * position;
    const prev = pool.get(key);
    const text = `${people[n].role === 'director' ? 'directed' : 'written'} by ${people[n].name}`;
    pool.set(key, prev ? { ...prev, sim: Math.min(1, Math.max(prev.sim, strength) + 0.1), because: text } : { movie, sim: strength, because: text });
  }));

  const ranked = [...pool.values()].sort((a, b) => b.sim - a.sim).slice(0, 45);
  // Fill in rating, runtime and crew for the best matches so filters and predictions work.
  const detailed = await Promise.all(ranked.slice(0, DETAIL_TOP).map((x) => once(`detail:${x.movie.id}`, () => enrich(x.movie)).then((movie) => ({ ...x, movie })).catch(() => x)));
  return [...detailed, ...ranked.slice(DETAIL_TOP)];
}
