// Movie catalog. Uses TMDB when a key is present, otherwise the built-in demo catalog.
import { hasTmdb, tmdbKey } from './config.js';
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
 * Movies similar to a seed movie, each with a similarity from 0 to 1.
 * Blends four TMDB signals, favouring titles people have actually heard of:
 *   - its recommendations (strongest, but discounted when hardly anyone has rated the movie)
 *   - well-known movies sharing ALL of its genres
 *   - well-known movies sharing its lead genre and any of its keywords
 *   - its "similar" list (weakest, same discount)
 * A movie that shows up in more than one list scores higher.
 */
export async function similarTo(seed) {
  if (!hasTmdb) {
    return DEMO_CATALOG.filter((m) => m.id !== seed.id)
      .map((m) => ({ movie: m, sim: overlap(m.genres, seed.genres || []) }))
      .filter((x) => x.sim >= 0.4)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 30);
  }
  const quiet = (promise) => promise.catch(() => ({ results: [], keywords: [] }));
  const ids = Object.entries(GENRES).filter(([, name]) => (seed.genres || []).includes(name)).map(([id]) => id);
  const discover = (extra) => quiet(get('/discover/movie', { include_adult: 'false', language: 'en-US', sort_by: 'vote_count.desc', ...extra }));

  const [recs, sims, words, sameGenres] = await Promise.all([
    quiet(get(`/movie/${seed.id}/recommendations`, { language: 'en-US' })),
    quiet(get(`/movie/${seed.id}/similar`, { language: 'en-US' })),
    quiet(get(`/movie/${seed.id}/keywords`)),
    ids.length ? discover({ with_genres: ids.slice(0, 3).join(',') }) : { results: [] },
  ]);
  const keywordIds = (words.keywords || []).slice(0, 10).map((k) => k.id);
  const sameKeywords = keywordIds.length
    ? await discover({ with_keywords: keywordIds.join('|'), ...(ids.length ? { with_genres: ids[0] } : {}) })
    : { results: [] };

  // Obscure titles are poor movie-night suggestions, however similar TMDB thinks they are.
  const known = (raw) => (raw.vote_count >= 1000 ? 1 : raw.vote_count >= 300 ? 0.8 : 0.5);
  const found = new Map();
  const add = (results, top, bottom, discount = false) => results.forEach((raw, n) => {
    if (raw.id === seed.id) return;
    const strength = (top - ((top - bottom) * n) / Math.max(1, results.length - 1)) * (discount ? known(raw) : 1);
    const prev = found.get(raw.id);
    found.set(raw.id, { movie: prev?.movie || normalize(raw), sim: prev ? Math.min(1, Math.max(prev.sim, strength) + 0.15) : strength });
  });
  add(recs.results || [], 0.9, 0.55, true);
  add(sameGenres.results || [], 0.75, 0.5);
  add(sameKeywords.results || [], 0.7, 0.45);
  add(sims.results || [], 0.5, 0.3, true);
  return [...found.values()]
    .map((x) => ({ movie: x.movie, sim: Math.min(1, x.sim + 0.15 * overlap(x.movie.genres, seed.genres || [])) }))
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
export async function enrich(movie) {
  if (!hasTmdb || movie.detailed) return movie;
  try {
    const raw = await get(`/movie/${movie.id}`, { append_to_response: 'release_dates', language: 'en-US' });
    const us = raw.release_dates?.results?.find((r) => r.iso_3166_1 === 'US');
    const cert = us?.release_dates?.map((d) => d.certification).find(Boolean) || null;
    return { ...normalize(raw), cert, runtime: raw.runtime || null, detailed: true };
  } catch {
    return movie;
  }
}
