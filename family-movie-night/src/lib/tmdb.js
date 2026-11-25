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

// Family-safe defaults for every deck: US certification PG-13 or below.
const SAFE = { include_adult: 'false', certification_country: 'US', 'certification.lte': 'PG-13', language: 'en-US' };

// Decks to rate through and browse. `demo` filters the built-in catalog when there is no TMDB key.
export const DECKS = [
  { id: 'best', label: 'All-time best', params: { sort_by: 'vote_average.desc', 'vote_count.gte': '3000' }, demo: () => true },
  { id: 'family', label: 'Family', params: { with_genres: '10751', sort_by: 'vote_average.desc', 'vote_count.gte': '1000' }, demo: (m) => m.genres.includes('Family') },
  { id: 'animation', label: 'Animation', params: { with_genres: '16', sort_by: 'vote_average.desc', 'vote_count.gte': '1000' }, demo: (m) => m.genres.includes('Animation') },
  { id: 'adventure', label: 'Adventure', params: { with_genres: '12', sort_by: 'vote_average.desc', 'vote_count.gte': '2000' }, demo: (m) => m.genres.includes('Adventure') },
  { id: 'classics', label: 'Before 2000', params: { sort_by: 'vote_average.desc', 'vote_count.gte': '1500', 'primary_release_date.lte': '1999-12-31' }, demo: (m) => m.year < 2000 },
  { id: 'recent', label: 'Popular now', params: { with_genres: '10751', sort_by: 'popularity.desc' }, demo: (m) => m.year >= 2018 },
];

/** One page of a deck, best first. Returns { movies, hasMore }. With TMDB this pages on for hundreds of movies. */
export async function browse(deckId, page = 1) {
  const deck = DECKS.find((d) => d.id === deckId) || DECKS[0];
  if (!hasTmdb) {
    const movies = DEMO_CATALOG.filter(deck.demo).sort((a, b) => b.vote - a.vote);
    return { movies, hasMore: false };
  }
  const data = await get('/discover/movie', { ...SAFE, ...deck.params, page });
  return { movies: data.results.map(normalize), hasMore: page < Math.min(data.total_pages, 500) };
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
