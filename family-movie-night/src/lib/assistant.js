// The browser side of the assistant: summarise the group for the AI, send the question to the
// private server function, then turn its suggested titles into real movies and re-check vetoes.

import { hasFirebase } from './config.js';
import { idToken } from './firebase.js';
import { liking, tasteProfile } from './suggest.js';
import { enrich, searchMovies } from './tmdb.js';

const label = (m) => `${m.title}${m.year ? ` (${m.year})` : ''}`;
const isVeto = (r) => !!r && (r.status === 'pass' || (r.status !== 'again' && liking(r) != null && liking(r) <= 2));

/** True if anyone watching has ruled this movie out. */
export const ruledOut = (entry, presentIds) => presentIds.some((id) => isVeto(entry?.ratings?.[id]));

/** A compact summary of the people watching: who they are, what they love, want, and have vetoed. */
export function buildContext(entries, members, presentIds, shortlist) {
  const list = Object.values(entries);
  const people = members.filter((m) => presentIds.includes(m.id)).map((m) => {
    const mine = list.filter((e) => e.ratings?.[m.id]);
    const liked = mine.filter((e) => (liking(e.ratings[m.id]) || 0) >= 4).sort((a, b) => liking(b.ratings[m.id]) - liking(a.ratings[m.id]));
    const taste = tasteProfile(entries, m.id);
    return {
      name: m.name,
      allTimeFavourites: (m.favorites || []).map(label),
      likedDirectorsAndWriters: taste.people.slice(0, 5).map((p) => p.name),
      favouriteGenres: taste.genres.filter((g) => g.n >= 2).slice(0, 5).map((g) => g.name),
      loves: liked.slice(0, 25).map((e) => label(e.movie)),
      wouldRewatch: mine.filter((e) => e.ratings[m.id].status === 'again').slice(0, 15).map((e) => label(e.movie)),
      wants: mine.filter((e) => e.ratings[m.id].status === 'unseen').slice(0, 30).map((e) => label(e.movie)),
      notFussed: mine.filter((e) => e.ratings[m.id].status === 'meh').slice(0, 15).map((e) => label(e.movie)),
    };
  });
  return {
    watching: people,
    ruledOut: list.filter((e) => ruledOut(e, presentIds)).slice(0, 80).map((e) => label(e.movie)),
    seenByAll: list.filter((e) => presentIds.every((id) => liking(e.ratings?.[id]) != null)).slice(0, 80).map((e) => label(e.movie)),
    alreadyOnShortlist: shortlist.map(label),
  };
}

/** Send the conversation to the assistant. Returns { reply, picks, remaining } or throws with a readable message. */
export async function askAssistant({ messages, context, memberId }) {
  if (!hasFirebase) throw new Error('The assistant only works on the live site, where it can check who is asking.');
  let res;
  try {
    res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await idToken()}` },
      body: JSON.stringify({ messages, context, memberId }),
    });
  } catch {
    throw new Error('Could not reach the assistant. Check your connection and try again.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.message || 'The assistant is not available right now.');
  return data;
}

/**
 * Turn the assistant's titles into real movies. Each is looked up on TMDB (so a made-up title
 * simply drops out) and anything someone watching has ruled out is removed, whatever the AI said.
 */
export async function resolvePicks(picks, entries, presentIds) {
  const found = await Promise.all(picks.map(async (pick) => {
    const results = await searchMovies(pick.title).catch(() => []);
    const wanted = pick.title.trim().toLowerCase();
    const match = results.find((m) => m.title.toLowerCase() === wanted && (!pick.year || !m.year || Math.abs(m.year - pick.year) <= 1))
      || results.find((m) => pick.year && m.year && Math.abs(m.year - pick.year) <= 1)
      || (pick.year ? null : results[0]);
    if (!match) return null;
    const known = entries[match.id];
    if (ruledOut(known, presentIds)) return null;
    return { movie: known?.movie || await enrich(match), reason: pick.reason };
  }));
  const seen = new Set();
  return found.filter((x) => x && !seen.has(x.movie.id) && seen.add(x.movie.id));
}

/**
 * Ask for a list of movies to rate ("5 good R comedies", "top 10 action on Rotten Tomatoes").
 * Returns { note, movies }: the AI names titles, each is looked up on TMDB (made-up ones drop
 * out), and anything this person has already rated is left off.
 */
export async function askForDeck({ request, entries, memberId }) {
  if (!hasFirebase) throw new Error('Custom lists only work on the live site, where the assistant can check who is asking.');
  const mine = Object.values(entries).filter((e) => e.ratings?.[memberId] && e.ratings[memberId].status !== 'notseen');
  let res;
  try {
    res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await idToken()}` },
      body: JSON.stringify({ kind: 'deck', request, memberId, alreadyRated: mine.slice(0, 400).map((e) => label(e.movie)) }),
    });
  } catch {
    throw new Error('Could not reach the assistant. Check your connection and try again.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.message || 'The assistant is not available right now.');
  const found = await resolvePicks(data.picks || [], {}, []);
  const rated = new Set(mine.map((e) => String(e.movie.id)));
  return { note: data.reply || '', asked: (data.picks || []).length, movies: found.map((x) => x.movie).filter((m) => !rated.has(String(m.id))) };
}
