// Marathons: a series or a director's movies laid out over several nights.
// Pure functions; the saved marathon itself is { id, title, kind, perNight, movies: [movie], done: [movieId] }.

const UNKNOWN_RUNTIME = 110; // minutes assumed for a movie whose length isn't known yet

/**
 * Split movies, in the order given, into nights of at most `perNight` minutes. A movie longer
 * than the budget gets a night to itself. Returns [[movie, ...], ...].
 */
export function planNights(movies, perNight) {
  const nights = [];
  let tonight = [];
  let used = 0;
  for (const movie of movies) {
    const length = movie.runtime || UNKNOWN_RUNTIME;
    if (tonight.length && used + length > perNight) { nights.push(tonight); tonight = []; used = 0; }
    tonight.push(movie);
    used += length;
  }
  if (tonight.length) nights.push(tonight);
  return nights;
}

/** Ids of the marathon's movies that count as watched: ticked off by hand, or logged as a movie night. */
export function watchedIds(marathon, history = []) {
  const logged = new Set(history.map((n) => String(n.movie.id)));
  return new Set(marathon.movies.map((m) => String(m.id)).filter((id) => (marathon.done || []).map(String).includes(id) || logged.has(id)));
}

export const minutes = (movies) => movies.reduce((sum, m) => sum + (m.runtime || UNKNOWN_RUNTIME), 0);
export const hoursText = (min) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`);
