// Movie catalog. Uses TMDB when a key is present, otherwise the built-in demo catalog.
import { hasOmdb, hasTmdb, omdbKey, pref, tmdbKey } from './config.js';
import { DEMO_CATALOG } from './demoData.js';

const BASE = 'https://api.themoviedb.org/3';
export const posterUrl = (path, size = 'w342') => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null);

const GENRES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime', 99: 'Documentary',
  18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie', 53: 'Thriller',
  10752: 'War', 37: 'Western',
};
const shortGenre = (name) => (name === 'Science Fiction' ? 'Sci-Fi' : name);

async function get(path, params = {}) {
  const url = new URL(BASE + path);
  const headers = { accept: 'application/json' };
  // A v4 "Read Access Token" is a long JWT; a v3 key is a short hex string.
  if (tmdbKey.startsWith('eyJ')) headers.Authorization = `Bearer ${tmdbKey}`;
  else url.searchParams.set('api_key', tmdbKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers });
  if (res.status === 401) throw new Error('TMDB rejected the API key. Check VITE_TMDB_API_KEY (Vercel → Settings → Environment Variables, then redeploy).');
  if (!res.ok) throw new Error(`TMDB request failed (${res.status}). Try again in a moment.`);
  return res.json();
}

function normalize(raw) {
  return {
    id: raw.id,
    title: raw.title,
    year: raw.release_date ? Number(raw.release_date.slice(0, 4)) : null,
    poster: raw.poster_path || null,
    overview: raw.overview || '',
    vote: raw.vote_average ? Math.round(raw.vote_average * 10) / 10 : null,
    genres: raw.genres ? raw.genres.map((g) => shortGenre(g.name)) : (raw.genre_ids || []).map((id) => GENRES[id]).filter(Boolean),
    cert: null,
    runtime: null,
    detailed: false,
  };
}

/** Categories you can narrow the rating deck to. */
export const GENRE_CHOICES = [
  [28, 'Action'], [12, 'Adventure'], [16, 'Animation'], [35, 'Comedy'], [18, 'Drama'], [10751, 'Family'],
  [14, 'Fantasy'], [878, 'Sci-Fi'], [9648, 'Mystery'], [10749, 'Romance'], [53, 'Thriller'], [27, 'Horror'],
  [10402, 'Music'], [99, 'Documentary'],
].map(([id, name]) => ({ id, name }));

export const THIS_YEAR = new Date().getFullYear();
export const FIRST_YEAR = 1970;
const OLDEST_YEAR = 1940;

/** Eras you can narrow the rating deck to. Each is an inclusive range of release years. */
export const ERAS = [
  { id: 'recent', label: 'Recent', from: THIS_YEAR - 4, to: THIS_YEAR },
  ...[2020, 2010, 2000, 1990, 1980, 1970].map((d) => ({ id: `${d}s`, label: `${d}s`, from: d, to: Math.min(d + 9, THIS_YEAR) })),
  { id: 'older', label: 'Before 1970', from: OLDEST_YEAR, to: 1969 },
];

/** The years to walk through, newest first, for a set of era ids. No eras means every year back to 1970. */
export function yearsFor(eraIds = []) {
  const years = new Set();
  const eras = ERAS.filter((e) => eraIds.includes(e.id));
  if (!eras.length) for (let y = THIS_YEAR; y >= FIRST_YEAR; y -= 1) years.add(y);
  for (const e of eras) for (let y = e.to; y >= e.from; y -= 1) years.add(y);
  return [...years].sort((a, b) => b - a);
}

const genreIds = (names) => GENRE_CHOICES.filter((g) => names.includes(g.name)).map((g) => g.id);
const inAnyGenre = (movie, names) => !names.length || names.some((g) => movie.genres.includes(g));

/**
 * The top movies of one year: the `perYear` most-watched releases, optionally narrowed to
 * categories. `genres` is a list of names from GENRE_CHOICES; a movie in any of them counts.
 * Every MPAA rating is included.
 */
export async function topOfYear({ year, perYear = 10, genres = [] }) {
  if (!hasTmdb) {
    return DEMO_CATALOG.filter((m) => m.year === year && inAnyGenre(m, genres)).sort((a, b) => b.vote - a.vote).slice(0, perYear);
  }
  const params = { include_adult: 'false', language: 'en-US', region: 'US', primary_release_year: String(year), sort_by: 'vote_count.desc', 'vote_count.gte': '150' };
  const ids = genreIds(genres);
  if (ids.length) params.with_genres = ids.join('|');
  const data = await get('/discover/movie', params); // one page = 20 movies
  return data.results.slice(0, perYear).map(normalize);
}

/* ---------- Rank 5: a pool of famous movies from very different corners ---------- */

const RANK_GENRES = ['Animation', 'Action', 'Comedy', 'Drama', 'Sci-Fi', 'Horror', 'Thriller', 'Fantasy', 'Romance', 'Adventure', 'Mystery', 'Family'];
const RANK_DECADES = [1970, 1980, 1990, 2000, 2010, 2020];
const sliceCache = new Map();
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** The most-watched movies of one genre in one decade (cached). */
async function genreDecade(genre, decade, page = 1) {
  const key = `${genre}|${decade}|${page}`;
  if (!sliceCache.has(key)) {
    const load = hasTmdb
      ? get('/discover/movie', {
        include_adult: 'false', language: 'en-US', with_genres: String(genreIds([genre])[0]), sort_by: 'vote_count.desc', page: String(page),
        'primary_release_date.gte': `${decade}-01-01`, 'primary_release_date.lte': `${decade + 9}-12-31`,
      }).then((d) => d.results.map(normalize))
      : Promise.resolve(DEMO_CATALOG.filter((m) => m.genres.includes(genre) && m.year >= decade && m.year <= decade + 9));
    sliceCache.set(key, load.catch((e) => { sliceCache.delete(key); throw e; }));
  }
  return sliceCache.get(key);
}

/**
 * One well-known movie from a random genre and decade, steering away from the genres and
 * decades already on the table so a batch stays varied. `exclude(movie)` filters out anything
 * already rated or shown. Returns { movie, genre, decade } or null if it runs dry.
 */
export async function diversePick({ avoidGenres = [], avoidDecades = [], exclude = () => false }) {
  for (let attempt = 0; attempt < 14; attempt += 1) {
    // Loosen the "different from the others" rule if the first few tries find nothing.
    const genres = attempt < 8 ? RANK_GENRES.filter((g) => !avoidGenres.includes(g)) : RANK_GENRES;
    const decades = attempt < 5 ? RANK_DECADES.filter((d) => !avoidDecades.includes(d)) : RANK_DECADES;
    const genre = pick(genres.length ? genres : RANK_GENRES);
    const decade = pick(decades.length ? decades : RANK_DECADES);
    const list = await genreDecade(genre, decade, attempt < 6 ? 1 : 2);
    const fresh = list.filter((m) => !exclude(m));
    if (fresh.length) return { movie: pick(fresh.slice(0, 12)), genre, decade };
  }
  return null;
}

/* ---------- "Movies like…" ---------- */

const overlap = (a, b) => {
  const shared = a.filter((g) => b.includes(g)).length;
  return shared ? shared / new Set([...a, ...b]).size : 0;
};

/**
 * Movies similar to a seed movie: [{ movie, sim, why }], best first. `sim` is 0–1 and `why` is
 * the strongest reason: 'series' (same franchise), 'director' (same director) or 'like'.
 *
 * Signals, strongest first:
 *   series      other films in the same collection
 *   recommended TMDB's "people who liked this also liked" (discounted for obscure titles)
 *   director    the seed director's other well-known films
 *   themes      well-known films sharing its lead genre AND at least one of its keywords
 *   similar     TMDB's "similar" list (weak, same discount)
 *   genre + era films sharing ALL its genres from the same era. On its own this is just
 *               "another big action movie", so it only supports the other signals: a film
 *               found this way and no other is dropped.
 * A film that shows up under several signals scores higher.
 */
export async function similarTo(seed) {
  if (!hasTmdb) {
    return DEMO_CATALOG.filter((m) => m.id !== seed.id)
      .map((m) => ({ movie: m, sim: overlap(m.genres, seed.genres || []), why: 'like' }))
      .filter((x) => x.sim >= 0.4)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 30);
  }
  const quiet = (promise, empty = {}) => promise.catch(() => empty);
  const discover = (extra) => quiet(get('/discover/movie', { include_adult: 'false', language: 'en-US', sort_by: 'vote_count.desc', ...extra }), { results: [] });

  // One request brings the seed's details, crew, keywords, recommendations and similar list.
  const raw = await get(`/movie/${seed.id}`, { append_to_response: 'credits,keywords,recommendations,similar', language: 'en-US' });
  const genreIdList = (raw.genres || []).map((g) => g.id);
  const seedGenres = (raw.genres || []).map((g) => shortGenre(g.name));
  const year = raw.release_date ? Number(raw.release_date.slice(0, 4)) : null;
  const director = keyCrew(raw.credits?.crew || []).find((c) => c.role === 'director');
  const keywordIds = (raw.keywords?.keywords || []).slice(0, 12).map((k) => k.id);

  const [series, byDirector, themes, sameGenres] = await Promise.all([
    raw.belongs_to_collection ? quiet(get(`/collection/${raw.belongs_to_collection.id}`, { language: 'en-US' }), { parts: [] }) : { parts: [] },
    director ? quiet(byPerson(director), []) : [],
    // Well-regarded (not just biggest) films sharing a theme, from roughly the same era.
    keywordIds.length && genreIdList.length
      ? discover({ with_keywords: keywordIds.slice(0, 8).join('|'), with_genres: genreIdList.slice(0, 2).join(','), sort_by: 'vote_average.desc', 'vote_count.gte': '800', ...(year ? { 'primary_release_date.gte': `${year - 20}-01-01` } : {}) })
      : { results: [] },
    genreIdList.length >= 2 && year
      ? discover({ with_genres: genreIdList.slice(0, 3).join(','), 'primary_release_date.gte': `${year - 12}-01-01`, 'primary_release_date.lte': `${year + 12}-12-31` })
      : { results: [] },
  ]);

  // Obscure titles are poor movie-night suggestions, however similar TMDB thinks they are.
  const known = (m) => (m.vote_count >= 1000 ? 1 : m.vote_count >= 300 ? 0.8 : 0.5);
  const today = new Date().toISOString().slice(0, 10);
  const found = new Map();
  const add = (list, top, bottom, { why = 'like', discount = false, support = false } = {}) => list.forEach((item, n) => {
    if (item.id === seed.id || (!item.release_date && !item.year) || (item.release_date && item.release_date > today)) return; // skip the seed and unreleased films
    const strength = (top - ((top - bottom) * n) / Math.max(1, list.length - 1)) * (discount ? known(item) : 1);
    const prev = found.get(item.id);
    if (!prev) {
      found.set(item.id, { movie: item.detailed !== undefined ? item : normalize(item), sim: strength, why, solid: !support });
    } else {
      // More than one signal agreeing is stronger than any single one (the generic genre list adds little).
      found.set(item.id, { ...prev, sim: Math.min(1, Math.max(prev.sim, strength) + (support ? 0.04 : 0.12)), why: strength > prev.sim && !support ? why : prev.why, solid: prev.solid || !support });
    }
  });
  add((series.parts || []).filter((m) => m.vote_count >= 50), 0.95, 0.88, { why: 'series' });
  add(raw.recommendations?.results || [], 0.85, 0.5, { discount: true });
  add(byDirector, 0.75, 0.55, { why: 'director' });
  add(themes.results || [], 0.6, 0.4);
  add(raw.similar?.results || [], 0.45, 0.25, { discount: true });
  add(sameGenres.results || [], 0.2, 0.1, { support: true });

  return [...found.values()]
    .filter((x) => x.solid)
    .map((x) => ({ movie: x.movie, why: x.why, sim: Math.min(1, x.sim + 0.1 * overlap(x.movie.genres, seedGenres)) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 40);
}

export async function searchMovies(query) {
  const q = query.trim();
  if (!q) return [];
  if (!hasTmdb) return DEMO_CATALOG.filter((m) => m.title.toLowerCase().includes(q.toLowerCase()));
  const data = await get('/search/movie', { query: q, include_adult: 'false', language: 'en-US' });
  return data.results.map(normalize);
}

/** Fill in runtime, MPAA rating and full genres. Returns the movie unchanged in demo mode or on failure. */
/** True when a movie is missing details the app can still fetch (rating, runtime, crew, critic score). */
export const needsDetails = (movie) => hasTmdb && !(movie.detailed && movie.crew && (!hasOmdb || movie.scored === SCORE_VERSION) && watchFresh(movie));

/* ---------- Where to watch ---------- */
// TMDB relays JustWatch's list of which US services carry each movie. The same service shows up
// under several names ("Paramount Plus Premium", "Paramount+ Amazon Channel"), so each is folded
// into one plain name. The app assumes the family has every subscription service.
const WATCH_TTL = 14 * 24 * 60 * 60 * 1000; // catalogues change; look again after two weeks
const watchFresh = (movie) => Boolean(movie.watch && movie.watch.v === 2 && Date.now() - movie.watch.at < WATCH_TTL);
const SERVICE_NAMES = [
  [/^netflix/i, 'Netflix'], [/prime video/i, 'Prime Video'], [/^disney/i, 'Disney+'], [/^(hbo )?max\b/i, 'HBO Max'],
  [/^hulu/i, 'Hulu'], [/^apple tv/i, 'Apple TV+'], [/^paramount/i, 'Paramount+'], [/^peacock/i, 'Peacock'],
  [/^amc ?(\+|plus)/i, 'AMC+'], [/^mgm ?(\+|plus)/i, 'MGM+'], [/^starz/i, 'Starz'], [/^crunchyroll/i, 'Crunchyroll'],
  [/^criterion/i, 'Criterion Channel'], [/^tubi/i, 'Tubi'], [/^pluto/i, 'Pluto TV'], [/roku channel/i, 'The Roku Channel'],
  [/^kanopy/i, 'Kanopy'], [/^hoopla/i, 'Hoopla'], [/^youtube premium/i, 'YouTube Premium'], [/^fubo/i, 'fuboTV'],
];
export function serviceName(raw) {
  if (/justwatch/i.test(raw)) return null;
  const known = SERVICE_NAMES.find(([pattern]) => pattern.test(raw));
  if (known) return known[1];
  return raw.replace(/ (amazon|apple tv|roku premium) channel$/i, '').replace(/ (standard )?with ads$/i, '').trim();
}
const WATCH_VERSION = 2;
/**
 * { v, at, on: [{ name }], free: [{ name }], rent: [name] }
 *   on   — included with a subscription
 *   free — free to watch, usually with ads (and not also in `on`)
 *   rent — stores that rent or sell it
 * TMDB passes along which services carry a movie but not what they charge, so there are no prices here.
 */
function whereToWatch(results) {
  const us = results?.US || {};
  const names = (list) => [...new Set((list || []).map((p) => serviceName(p.provider_name)).filter(Boolean))];
  const on = names(us.flatrate);
  const free = names([...(us.free || []), ...(us.ads || [])]).filter((name) => !on.includes(name));
  return { v: WATCH_VERSION, at: Date.now(), on: on.slice(0, 8).map((name) => ({ name })), free: free.slice(0, 6).map((name) => ({ name })), rent: names([...(us.rent || []), ...(us.buy || [])]).slice(0, 4) };
}
/** Where prices for every service are listed. */
export const pricesUrl = (movie) => `https://www.justwatch.com/us/search?q=${encodeURIComponent(movie.title || '')}`;
/** The official YouTube trailer's id, or null. */
function trailerKey(videos) {
  const list = (videos || []).filter((v) => v.site === 'YouTube' && v.type === 'Trailer');
  return (list.find((v) => v.official && /official trailer/i.test(v.name)) || list.find((v) => v.official) || list[0])?.key || null;
}
/** A link to the trailer: the exact video when known, otherwise a YouTube search for it. */
export const trailerUrl = (movie) => (movie.trailer
  ? `https://www.youtube.com/watch?v=${movie.trailer}`
  : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${movie.title} ${movie.year || ''} official trailer`)}`);

export async function enrich(movie) {
  if (!needsDetails(movie)) return movie;
  try {
    const raw = await get(`/movie/${movie.id}`, { append_to_response: 'release_dates,credits,watch/providers,videos', language: 'en-US' });
    const us = raw.release_dates?.results?.find((r) => r.iso_3166_1 === 'US');
    const cert = us?.release_dates?.map((d) => d.certification).find(Boolean) || null;
    // A score already saved with the movie is kept, so refreshing where-to-watch costs no lookups.
    const critics = movie.scored === SCORE_VERSION ? { rt: movie.rt ?? null, mc: movie.mc ?? null, checked: true } : await criticScores(raw.imdb_id);
    return {
      ...normalize(raw), cert, runtime: raw.runtime || null, crew: keyCrew(raw.credits?.crew || []),
      imdb: raw.imdb_id || null, rt: critics.rt, mc: critics.mc, scored: critics.checked ? SCORE_VERSION : false, detailed: true,
      watch: whereToWatch(raw['watch/providers']?.results), trailer: trailerKey(raw.videos?.results),
    };
  } catch {
    return movie;
  }
}

/* ---------- Critic scores, via OMDb ---------- */
// OMDb (omdbapi.com) relays critic scores for a movie's IMDb id. In practice it returns the
// Metacritic score for most movies and a Rotten Tomatoes score only for some, so the app keeps
// both and shows Rotten Tomatoes when it exists. Its free key allows a limited number of
// lookups a day, so every answer is cached on the device and saved with the movie once rated.

const SCORE_VERSION = 2; // bump to make every device look scores up again
const SCORE_CACHE = 'score-cache-v2';
let scoreCache = null;
const scoreStore = () => (scoreCache ||= pref.get(SCORE_CACHE, {}));
const remember = (imdbId, scores) => {
  const cache = scoreStore();
  cache[imdbId] = scores;
  const keys = Object.keys(cache);
  if (keys.length > 3000) keys.slice(0, 500).forEach((k) => delete cache[k]); // keep it bounded
  pref.set(SCORE_CACHE, cache);
};
const percent = (value) => { const n = parseInt(value, 10); return Number.isFinite(n) ? n : null; };

/** Returns { rt, mc, checked }: each score is 0–100 or null. `checked` is false when the lookup could not be made at all. */
async function criticScores(imdbId) {
  const none = { rt: null, mc: null };
  if (!hasOmdb || !imdbId) return { ...none, checked: false };
  const cache = scoreStore();
  if (cache[imdbId]) return { ...cache[imdbId], checked: true };
  try {
    const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${omdbKey}`);
    const data = await res.json();
    if (data.Response === 'False') {
      // "Movie not found" is a real answer; a bad key or a used-up daily limit is not.
      const settled = /not found|incorrect imdb/i.test(data.Error || '');
      if (settled) remember(imdbId, none);
      return { ...none, checked: settled };
    }
    const from = (source) => (data.Ratings || []).find((r) => r.Source === source)?.Value;
    const scores = { rt: percent(from('Rotten Tomatoes')), mc: percent(from('Metacritic')) ?? percent(data.Metascore) };
    remember(imdbId, scores);
    return { ...scores, checked: true };
  } catch {
    return { ...none, checked: false };
  }
}

const WRITING_JOBS = ['Screenplay', 'Writer', 'Story'];
/** The director(s) and up to two writers: [{ id, name, role: 'director' | 'writer' }]. */
function keyCrew(crew) {
  const directors = crew.filter((c) => c.job === 'Director').slice(0, 2).map((c) => ({ id: c.id, name: c.name, role: 'director' }));
  const writers = crew.filter((c) => WRITING_JOBS.includes(c.job) && !directors.some((d) => d.id === c.id))
    .filter((c, n, all) => all.findIndex((x) => x.id === c.id) === n)
    .slice(0, 2).map((c) => ({ id: c.id, name: c.name, role: 'writer' }));
  return [...directors, ...writers];
}

/* ---------- Directors and writers ---------- */

/** Search for a person. Directors and writers come first; each has a few titles they're known for. */
export async function searchPeople(query) {
  const q = query.trim();
  if (!q || !hasTmdb) return [];
  const data = await get('/search/person', { query: q, include_adult: 'false', language: 'en-US' });
  const order = { Directing: 0, Writing: 1 };
  return data.results
    .filter((p) => p.popularity > 0.5 || p.known_for_department === 'Directing')
    .sort((a, b) => (order[a.known_for_department] ?? 2) - (order[b.known_for_department] ?? 2) || b.popularity - a.popularity)
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      name: p.name,
      department: p.known_for_department || '',
      knownFor: (p.known_for || []).filter((k) => k.media_type === 'movie').map((k) => k.title).slice(0, 3),
    }));
}

/** Everything a person directed and wrote, most-watched first: { directed: [movie], written: [movie] }. */
export async function filmography(person) {
  const data = await get(`/person/${person.id}/movie_credits`, { language: 'en-US' });
  const pickJobs = (jobs, skip = new Set()) => {
    const seen = new Set();
    return (data.crew || [])
      .filter((raw) => jobs.includes(raw.job) && raw.vote_count >= 20 && !skip.has(raw.id) && !seen.has(raw.id) && seen.add(raw.id))
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, 40)
      .map(normalize);
  };
  const directed = pickJobs(['Director']);
  return { directed, written: pickJobs(WRITING_JOBS, new Set(directed.map((m) => m.id))) };
}

/** Well-known movies a person actually directed (or wrote, for a writer), most-watched first. */
export async function byPerson(person) {
  if (!hasTmdb) return [];
  const data = await get(`/person/${person.id}/movie_credits`, { language: 'en-US' });
  const jobs = person.role === 'director' ? ['Director'] : WRITING_JOBS;
  const seen = new Set();
  return (data.crew || [])
    .filter((raw) => jobs.includes(raw.job) && raw.vote_count >= 200 && !seen.has(raw.id) && seen.add(raw.id))
    .sort((a, b) => b.vote_count - a.vote_count)
    .slice(0, 12)
    .map(normalize);
}
