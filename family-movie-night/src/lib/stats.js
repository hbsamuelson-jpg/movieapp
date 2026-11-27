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
    // Favourite genres come from the taste profile, which counts star ratings, Rank 5 results and
    // all-time favourites alike, so someone who has only ranked movies still gets an answer.
    const mine = list.map((e) => e.ratings?.[m.id]).filter(Boolean);
    const genres = tasteProfile(entries, m.id).genres.filter((g) => g.n >= 2 && g.avg >= 3.5).slice(0, 3).map((g) => g.name);
    return {
      member: m, rated: given.length, average: given.length ? mean(given) : null,
      ranked: mine.filter((r) => r.via === 'rank').length, favourites: (m.favorites || []).length,
      genres, topGenre: genres[0] || null,
    };
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

/**
 * Month in review: what the family watched together in one calendar month, from the movie-night
 * log. `month` is 0–11. Ratings carry no dates, so this covers movie nights only.
 */
export function monthReview(entries, members, history, year, month) {
  const inMonth = history.filter((n) => { const d = new Date(n.at); return d.getFullYear() === year && d.getMonth() === month; }).sort((a, b) => a.at - b.at);
  const nights = inMonth.map((night) => {
    const movie = entries[night.movie.id]?.movie || night.movie;
    const scores = (night.watchers || []).map((id) => ({ member: members.find((m) => m.id === id), stars: shownStars(entries[night.movie.id]?.ratings?.[id]) })).filter((s) => s.member && s.stars);
    const values = scores.map((s) => s.stars);
    return { night, movie, scores, average: values.length ? mean(values) : null, spread: values.length > 1 ? Math.max(...values) - Math.min(...values) : 0 };
  });
  const scored = nights.filter((n) => n.average != null).sort((a, b) => b.average - a.average);
  const split = [...nights].sort((a, b) => b.spread - a.spread)[0];
  const how = { vote: 0, spin: 0, pick: 0 };
  inMonth.forEach((n) => { how[n.via] = (how[n.via] || 0) + 1; });
  const genres = {};
  nights.forEach((n) => (n.movie.genres || []).slice(0, 2).forEach((g) => { genres[g] = (genres[g] || 0) + 1; }));
  const people = members
    .map((m) => {
      const mine = nights.filter((n) => (n.night.watchers || []).includes(m.id));
      const given = mine.map((n) => n.scores.find((s) => s.member.id === m.id)?.stars).filter(Boolean);
      return { member: m, watched: mine.length, average: given.length ? mean(given) : null };
    })
    .filter((p) => p.watched > 0)
    .sort((a, b) => b.watched - a.watched);
  return {
    count: nights.length,
    minutes: nights.reduce((sum, n) => sum + (n.movie.runtime || 0), 0),
    nights,
    how,
    best: scored[0] || null,
    worst: scored.length >= 2 ? scored[scored.length - 1] : null,
    split: split && split.spread >= 1 ? split : null,
    topGenre: Object.entries(genres).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    people,
    unscored: nights.filter((n) => n.average == null).length,
  };
}
/** The first month with a movie night, as { year, month }, or null. */
export const firstMonth = (history) => (history.length ? ((d) => ({ year: d.getFullYear(), month: d.getMonth() }))(new Date(Math.min(...history.map((n) => n.at)))) : null);

/**
 * Family awards: light-hearted superlatives worked out from ratings, Rotten Tomatoes scores and
 * the lists people keep. Each is { key, title, winner (a member) or movie, detail }. An award is
 * only given when there is enough to go on, so the list grows as the family rates more.
 */
export function familyAwards(entries, members) {
  const list = Object.values(entries);
  const awards = [];
  const stars = (e, id) => shownStars(e.ratings?.[id]);
  const count = (id, status) => list.filter((e) => e.ratings?.[id]?.status === status).length;
  const top = (rows) => [...rows].sort((a, b) => b.n - a.n)[0];
  const person = (key, title, rows, least, text) => {
    const best = top(rows.filter((r) => r.n >= least));
    if (best) awards.push({ key, title, winner: best.member, detail: text(best) });
  };

  person('rated', 'Seen it all', members.map((m) => ({ member: m, n: list.filter((e) => stars(e, m.id)).length })), 10, (r) => `${r.n} movies rated`);
  person('wants', 'Longest watchlist', members.map((m) => ({ member: m, n: count(m.id, 'unseen') })), 5, (r) => `${r.n} movies on the Want to list`);
  person('again', 'Rewatcher', members.map((m) => ({ member: m, n: count(m.id, 'again') })), 3, (r) => `would watch ${r.n} movies again`);
  person('never', 'Hardest to please', members.map((m) => ({ member: m, n: count(m.id, 'pass') })), 3, (r) => `${r.n} movies ruled out`);

  // Versus the critics: how far each person's stars sit from the Rotten Tomatoes score (stars x 20).
  const gaps = members.map((m) => {
    const diffs = list.filter((e) => stars(e, m.id) && typeof e.movie.rt === 'number').map((e) => stars(e, m.id) * 20 - e.movie.rt);
    return { member: m, n: diffs.length, lean: diffs.length ? mean(diffs) : 0, apart: diffs.length ? mean(diffs.map(Math.abs)) : 0 };
  }).filter((g) => g.n >= 8);
  if (gaps.length) {
    const rebel = [...gaps].sort((a, b) => b.apart - a.apart)[0];
    awards.push({ key: 'rebel', title: 'Versus the critics', winner: rebel.member, detail: `on average ${Math.round(rebel.apart)} points away from Rotten Tomatoes, usually ${rebel.lean >= 0 ? 'kinder' : 'harsher'}` });
    if (gaps.length > 1) {
      const critic = [...gaps].sort((a, b) => a.apart - b.apart)[0];
      if (critic.member.id !== rebel.member.id) awards.push({ key: 'critic', title: 'Thinks like a critic', winner: critic.member, detail: `only ${Math.round(critic.apart)} points from Rotten Tomatoes on average` });
    }
  }

  // Movies at least two people gave stars to.
  const shared = list.map((e) => {
    const given = members.map((m) => stars(e, m.id)).filter(Boolean);
    return given.length >= 2 ? { movie: e.movie, n: given.length, average: mean(given), spread: Math.max(...given) - Math.min(...given) } : null;
  }).filter(Boolean);
  const pick = (key, title, rows, sort, text) => { const best = [...rows].sort(sort)[0]; if (best) awards.push({ key, title, movie: best.movie, detail: text(best) }); };
  const scored = shared.filter((x) => typeof x.movie.rt === 'number');
  pick('harmony', 'Perfect harmony', shared.filter((x) => x.n >= Math.min(3, members.length) && x.spread <= 0.5), (a, b) => b.n - a.n || b.average - a.average, (x) => `all ${x.n} of you within half a star (average ${x.average.toFixed(1)})`);
  pick('gem', 'Our hidden gem', scored.filter((x) => x.average >= 4 && x.movie.rt < 60), (a, b) => (b.average * 20 - b.movie.rt) - (a.average * 20 - a.movie.rt), (x) => `you gave it ${x.average.toFixed(1)} stars; Rotten Tomatoes says ${x.movie.rt}%`);
  pick('overrated', 'Most overrated', scored.filter((x) => x.average <= 2.5 && x.movie.rt >= 80), (a, b) => (b.movie.rt - b.average * 20) - (a.movie.rt - a.average * 20), (x) => `Rotten Tomatoes says ${x.movie.rt}%; you gave it ${x.average.toFixed(1)} stars`);
  return awards;
}
