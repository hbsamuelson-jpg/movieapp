// Family stats: who agrees with whom, what split the room, and how movie nights have gone.
// Pure functions over the same data the rest of the app uses. Only star ratings people actually
// gave count here; hidden taste signals from rankings and favourites are left out.
import { shownStars, tasteProfile } from './suggest.js';

const MIN_SHARED = 4; // movies two people must both have rated before their agreement means much
const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;

export function familyStats(entries, members, history = []) {
  const list = Object.values(entries);
  const starsOf = (e, id) => shownStars(e.ratings?.[id]);

  // Each person: how many they've rated, their average, and the genre they rate highest.
  const people = members.map((m) => {
    const given = list.map((e) => starsOf(e, m.id)).filter(Boolean);
    const top = tasteProfile(entries, m.id).genres.filter((g) => g.n >= 3)[0];
    return { member: m, rated: given.length, average: given.length ? mean(given) : null, topGenre: top?.name || null };
  });
  const judged = people.filter((p) => p.rated >= MIN_SHARED).sort((a, b) => a.average - b.average);

  // Every pair: 100% means identical stars on every movie both rated; each star apart costs 25 points.
  const pairs = [];
  members.forEach((a, i) => members.slice(i + 1).forEach((b) => {
    const gaps = list.map((e) => [starsOf(e, a.id), starsOf(e, b.id)]).filter(([x, y]) => x && y).map(([x, y]) => Math.abs(x - y));
    if (gaps.length >= MIN_SHARED) pairs.push({ a, b, shared: gaps.length, agreement: Math.round(Math.max(0, 100 - mean(gaps) * 25)) });
  }));
  pairs.sort((x, y) => y.agreement - x.agreement || y.shared - x.shared);

  // Movies at least two people rated: the biggest disagreement and the best-loved.
  const shared = list.map((e) => {
    const scores = members.map((m) => ({ member: m, stars: starsOf(e, m.id) })).filter((s) => s.stars);
    if (scores.length < 2) return null;
    const values = scores.map((s) => s.stars);
    return { movie: e.movie, scores, spread: Math.max(...values) - Math.min(...values), average: mean(values) };
  }).filter(Boolean);
  const split = [...shared].sort((x, y) => y.spread - x.spread || y.scores.length - x.scores.length)[0];
  const loved = shared.filter((x) => x.average >= 4).sort((x, y) => y.average - x.average || y.scores.length - x.scores.length).slice(0, 3);

  // Movie nights: how many, how they were chosen, and the best and worst by average score.
  const nights = history.map((night) => {
    const e = entries[night.movie.id];
    const values = (night.watchers || []).map((id) => (e ? starsOf(e, id) : null)).filter(Boolean);
    return { night, movie: e?.movie || night.movie, average: values.length ? mean(values) : null };
  });
  const scored = nights.filter((n) => n.average != null).sort((x, y) => y.average - x.average);
  const how = { vote: 0, spin: 0, pick: 0 };
  history.forEach((n) => { how[n.via] = (how[n.via] || 0) + 1; });

  return {
    people,
    toughest: judged.length >= 2 ? judged[0] : null,
    easiest: judged.length >= 2 ? judged[judged.length - 1] : null,
    pairs,
    split: split && split.spread >= 1 ? split : null,
    loved,
    nights: { count: history.length, how, best: scored[0] || null, worst: scored.length >= 2 ? scored[scored.length - 1] : null },
  };
}

/** Movie nights this person watched but hasn't scored, oldest first, once a few hours have passed. */
export function unscoredNights(history, entries, memberId, now = Date.now(), wait = 2 * 60 * 60 * 1000) {
  return history
    .filter((n) => (n.watchers || []).includes(memberId) && now - n.at >= wait && !shownStars(entries[n.movie.id]?.ratings?.[memberId]))
    .sort((a, b) => b.at - a.at);
}
