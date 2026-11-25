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
  if (res.status === 401) throw new Error('TMDB rejected the API key. Check VITE_TMDB_API_KEY in .env.local.');
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

/**
 * The top movies of one year: the `perYear` most-watched releases, optionally narrowed to
 * categories. `genres` is a list of names from GENRE_CHOICES; a movie in any of them counts.
 * R-rated titles are left out unless `includeR` is set.
 */
export async function topOfYear({ year, perYear = 10, genres = [], includeR = false }) {
  if (!hasTmdb) {
    return DEMO_CATALOG
      .filter((m) => m.year === year && (!genres.length || genres.some((g) => m.genres.includes(g))))
      .sort((a, b) => b.vote - a.vote)
      .slice(0, perYear);
  }
  const ids = GENRE_CHOICES.filter((g) => genres.includes(g.name)).map((g) => g.id);
  const params = {
    include_adult: 'false',
    language: 'en-US',
    region: 'US',
    certification_country: 'US',
    'certification.lte': includeR ? 'R' : 'PG-13',
    primary_release_year: String(year),
    sort_by: 'vote_count.desc',
    'vote_count.gte': '150',
  };
  if (ids.length) params.with_genres = ids.join('|');
  const data = await get('/discover/movie', params); // one page = 20 movies
  return data.results.slice(0, perYear).map(normalize);
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
