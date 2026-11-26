// Checks for the taste and suggestion rules. Run with: npm test
import assert from 'node:assert/strict';
import { familyStats, monthReview, unscoredNights } from '../src/lib/stats.js';
import { voteResult, liking, quality, qualityNudge, shownStars, forYou, activeSnoozes, applyFilters, streaming, mergeSimilar, predictStars, rankToLiking, suggest, tasteProfile } from '../src/lib/suggest.js';

const movie = (id, title, genres, vote = 7.5) => ({ id, title, genres, vote });
const seen = (stars) => ({ status: 'seen', stars });
const again = (stars) => ({ status: 'again', stars });
const want = { status: 'unseen', stars: null };
const meh = { status: 'meh', stars: null };
const pass = { status: 'pass', stars: null };

const entries = {
  1: { movie: movie(1, 'Space One', ['Sci-Fi']), ratings: { a: seen(5), b: seen(2) } },
  2: { movie: movie(2, 'Space Two', ['Sci-Fi']), ratings: { a: seen(5), b: seen(1) } },
  3: { movie: movie(3, 'Space Three', ['Sci-Fi']), ratings: { a: again(4.5) } },
  4: { movie: movie(4, 'Laughs', ['Comedy']), ratings: { a: seen(2), b: seen(5) } },
  5: { movie: movie(5, 'More Laughs', ['Comedy']), ratings: { a: seen(2.5), b: again(5) } },
  6: { movie: movie(6, 'Everyone Wants', ['Adventure'], 8), ratings: { a: want, b: want, c: want } },
  7: { movie: movie(7, 'One Shrug', ['Adventure'], 8), ratings: { a: want, b: want, c: meh } },
  8: { movie: movie(8, 'Vetoed', ['Adventure'], 9), ratings: { a: want, b: want, c: pass } },
  9: { movie: movie(9, 'Nobody Asked', ['Drama'], 9), ratings: { a: seen(4), b: meh } },
};

// Taste: a loves Sci-Fi and is cool on Comedy; b is the reverse.
const a = tasteProfile(entries, 'a');
const b = tasteProfile(entries, 'b');
assert.equal(a.genres[0].name, 'Sci-Fi');
assert.equal(b.genres[0].name, 'Comedy');
const newSciFi = movie(99, 'Space Four', ['Sci-Fi']);
assert.ok(predictStars(a, newSciFi) > predictStars(b, newSciFi), 'a should be predicted to like sci-fi more than b');
assert.equal(predictStars(tasteProfile(entries, 'nobody'), movie(1, 'x', [], 8)), 4, 'no ratings: fall back to the crowd score');

// Suggestions for everyone.
const all = suggest(entries, ['a', 'b', 'c']);
const titles = all.map((e) => e.movie.title);
console.log(all.map((e) => `${e.score}  ${e.movie.title}`).join('\n'));
assert.equal(titles[0], 'Everyone Wants');
assert.ok(titles.indexOf('Everyone Wants') < titles.indexOf('One Shrug'), 'a shrug ranks lower');
assert.ok(!titles.includes('Vetoed'), 'a No thanks rules it out');
assert.ok(!titles.includes('Nobody Asked'), 'nobody present wants it');
assert.ok(!titles.includes('Space One'), 'b gave it 2 stars');

// Who is here changes the answer.
assert.ok(suggest(entries, ['a', 'b']).some((e) => e.movie.title === 'Vetoed'), 'c is not here, so c\'s veto does not count');
assert.ok(suggest(entries, ['a']).some((e) => e.movie.title === 'Space Three'));
assert.deepEqual(suggest(entries, []), []);

// Tonight's vibe: a priority genre lifts matching movies without hiding the rest.
const vibe = suggest(entries, ['a'], { priorityGenres: ['Comedy'] });
const plain = suggest(entries, ['a']);
assert.equal(vibe.length, plain.length, 'priority genre never hides anything');
const boosted = suggest({ ...entries, 10: { movie: movie(10, 'Funny Want', ['Comedy']), ratings: { a: want } } }, ['a'], { priorityGenres: ['Comedy'] });
assert.equal(boosted[0].movie.title, 'Funny Want');
assert.deepEqual(boosted[0].vibes, ['Comedy']);

// "Movies like…": similar movies become candidates even if nobody rated them; vetoes still apply.
const similar = [
  { movie: movie(50, 'Fresh Similar', ['Mystery'], 8), sim: 0.9 },
  { movie: movie(51, 'Weak Similar', ['Mystery'], 8), sim: 0.3 },
  { movie: movie(8, 'Vetoed', ['Adventure'], 9), sim: 1 },
  { movie: movie(1, 'Space One', ['Sci-Fi']), sim: 1 },
];
const like = suggest(entries, ['a', 'b', 'c'], { similar }).map((e) => e.movie.title);
assert.deepEqual(like, ['Fresh Similar', 'Weak Similar'], 'only similar movies, best first, minus vetoes');
assert.ok(!suggest(entries, ['a'], { similar: [{ movie: movie(4, 'Laughs', ['Comedy']), sim: 1 }] }).length, 'a already rated Laughs 2 stars: ruled out');

// Several seeds: similar to both beats similar to one.
const merged = mergeSimilar([[{ movie: movie(60, 'Both'), sim: 0.6 }, { movie: movie(61, 'One'), sim: 0.7 }], [{ movie: movie(60, 'Both'), sim: 0.6 }, { movie: movie(99, 'Seed'), sim: 1 }]], [99]);
assert.deepEqual(merged.map((x) => x.movie.title), ['Both', 'One']);

// Rank 5 → hidden taste signals: 5 down to 2.5, never a veto unless flagged.
assert.deepEqual(rankToLiking(5), [5, 4.5, 3.5, 3, 2.5]);
assert.deepEqual(rankToLiking(4), [5, 4, 3.5, 2.5]);
assert.deepEqual(rankToLiking(3), [5, 3.5, 2.5]);
assert.equal(rankToLiking(5, [false, false, false, false, true])[4], 1.5);
assert.ok(rankToLiking(5).every((s) => s > 2), 'no accidental vetoes');

// A ranking teaches taste without becoming a star rating.
const ranked = { status: 'seen', stars: null, like: 5, via: 'rank', place: 1, of: 5 };
assert.equal(shownStars(ranked), null);
assert.equal(liking(ranked), 5);
assert.equal(shownStars({ status: 'seen', stars: 4 }), 4);
assert.equal(shownStars({ status: 'seen', stars: 4.5, via: 'rank' }), null, 'older rankings stop showing stars too');
assert.equal(liking({ status: 'seen', stars: 4.5, via: 'rank' }), 4.5);
const learned = tasteProfile({ 1: { movie: movie(1, 'A', ['Horror']), ratings: { z: ranked } }, 2: { movie: movie(2, 'B', ['Horror']), ratings: { z: { ...ranked, like: 4.5 } } } }, 'z');
assert.equal(learned.count, 2);
assert.equal(learned.genres[0].name, 'Horror');
// Flagged "never again" in a ranking still rules the movie out; plain last place does not.
const flaggedEntry = { 1: { movie: movie(1, 'Flagged', ['Horror']), ratings: { z: { ...ranked, like: 1.5 }, y: want } }, 2: { movie: movie(2, 'Last', ['Horror']), ratings: { z: { ...ranked, like: 2.5 }, y: want } } };
assert.deepEqual(suggest(flaggedEntry, ['z', 'y']).map((e) => e.movie.title), ['Last']);

// Favourites count double and have no stars; directors and writers of loved movies are learned.
const fav = { status: 'seen', stars: null, like: 5, via: 'favorite' };
assert.equal(shownStars(fav), null);
const nolan = { id: 7, name: 'Dana Director', role: 'director' };
const crewEntries = {
  1: { movie: { ...movie(1, 'Fav', ['Drama']), crew: [nolan] }, ratings: { d: fav } },
  2: { movie: movie(2, 'Other', ['Drama']), ratings: { d: seen(3) } },
};
const dp = tasteProfile(crewEntries, 'd');
assert.equal(dp.count, 3, 'a favourite counts as two');
assert.deepEqual(dp.people.map((p) => p.name), ['Dana Director'], 'one favourite is enough to learn its director');
const sameDirector = { ...movie(3, 'New One', ['Drama']), crew: [nolan] };
assert.ok(predictStars(dp, sameDirector) > predictStars(dp, movie(4, 'Stranger', ['Drama'])), 'liked director lifts the prediction');

// Tonight: wanted movies, plus discoveries nobody present has watched. Nothing else.
const tonight = suggest(entries, ['a', 'b', 'c'], { discoveries: [
  { movie: movie(70, 'Brand New', ['Adventure'], 8), sim: 0.9, because: 'like Everyone Wants' },
  { movie: movie(9, 'Nobody Asked', ['Drama'], 9), sim: 1, because: 'x' }, // a has watched it: not a discovery
  { movie: movie(8, 'Vetoed', ['Adventure'], 9), sim: 1, because: 'x' },   // c said No thanks
] });
const lanes = Object.fromEntries(tonight.map((e) => [e.movie.title, e.lane]));
assert.equal(lanes['Brand New'], 'new');
assert.equal(lanes['Everyone Wants'], 'wanted');
assert.ok(!('Nobody Asked' in lanes) && !('Vetoed' in lanes));
assert.ok(tonight.every((e) => e.lane === 'new' || e.wanting > 0), 'every row is wanted by someone or new to everyone');
assert.equal(tonight.find((e) => e.lane === 'new').because, 'like Everyone Wants');

// Review scores: Rotten Tomatoes wins when known; the nudge is small and capped.
assert.equal(quality({ rt: 93, vote: 6 }), 93);
assert.equal(quality({ rt: null, mc: 82, vote: 7.8 }), 82, 'Metacritic is the fallback critic score');
assert.equal(quality({ rt: null, vote: 7.8 }), 78);
assert.equal(quality({}), null);
assert.equal(qualityNudge({ rt: 100 }), 4);
assert.equal(qualityNudge({ rt: 0 }), -4);
assert.equal(qualityNudge({ rt: 65 }), 0);
assert.equal(qualityNudge({}), 0);
const twins = { 1: { movie: { ...movie(1, 'Acclaimed', ['Drama']), rt: 97 }, ratings: { q: want } }, 2: { movie: { ...movie(2, 'Panned', ['Drama']), rt: 20 }, ratings: { q: want } } };
const order = suggest(twins, ['q']);
assert.deepEqual(order.map((e) => e.movie.title), ['Acclaimed', 'Panned'], 'equal interest: the better-reviewed one leads');
assert.ok(order[0].rank - order[1].rank <= 8, 'but only by a little');
// A panned movie someone wants still beats an acclaimed one nobody asked for... which is not listed at all.
assert.ok(suggest({ 1: twins[2], 2: { movie: { ...movie(3, 'Great Unasked', ['Drama']), rt: 99 }, ratings: { q: seen(4) } } }, ['q']).every((e) => e.movie.title === 'Panned'));

// Votes: a clear winner, a tie, and nobody voting.
const options = [movie(1, 'One'), movie(2, 'Two'), movie(3, 'Three')];
const won = voteResult({ options, voters: ['a', 'b', 'c'], voted: ['a', 'b', 'c'], tally: { 2: 2, 3: 1 } });
assert.deepEqual(won.winners.map((m) => m.title), ['Two']);
assert.equal(won.everyoneIn, true);
assert.deepEqual(won.rows.map((r) => r.votes), [2, 1, 0]);
const tied = voteResult({ options, voters: ['a', 'b', 'c'], voted: ['a', 'b'], tally: { 1: 1, 3: 1 } });
assert.equal(tied.winners.length, 2);
assert.equal(tied.everyoneIn, false);
assert.equal(voteResult({ options, voters: ['a'], voted: [], tally: {} }).winners.length, 0);

// Someone has seen it and doesn't want it again: it drops well below an otherwise equal movie.
const seenOne = suggest({
  1: { movie: movie(1, 'Fresh For All', ['Drama']), ratings: { a: want, b: want } },
  2: { movie: movie(2, 'B Has Seen It', ['Drama']), ratings: { a: want, b: seen(5) } },
  3: { movie: movie(3, 'B Would Rewatch', ['Drama']), ratings: { a: want, b: again(5) } },
}, ['a', 'b']);
assert.deepEqual(seenOne.map((e) => e.movie.title), ['B Would Rewatch', 'Fresh For All', 'B Has Seen It']);
assert.ok(seenOne[1].rank - seenOne[2].rank >= 30, 'the penalty is large');
assert.equal(seenOne[2].alreadySeen, 1);
// A discovery is still offered when someone only shrugged at it, but not if anyone watched it.
const shrugged = { 5: { movie: movie(5, 'Shrugged', ['Drama']), ratings: { a: meh } }, 6: { movie: movie(6, 'Watched', ['Drama']), ratings: { a: seen(4) } } };
const offered = suggest(shrugged, ['a', 'b'], { discoveries: [{ movie: movie(5, 'Shrugged', ['Drama']), sim: 0.8 }, { movie: movie(6, 'Watched', ['Drama']), sim: 0.8 }] });
assert.deepEqual(offered.map((e) => e.movie.title), ['Shrugged']);

// Real stars always win over a leftover mark from a ranking, favourite or "watched" entry.
assert.equal(shownStars({ status: 'seen', stars: 4, via: 'watched' }), 4);
assert.equal(shownStars({ status: 'seen', stars: 3.5, via: 'rank', like: 5 }), 3.5);
assert.equal(liking({ status: 'seen', stars: 3.5, via: 'rank', like: 5 }), 3.5);
assert.equal(shownStars({ status: 'seen', stars: null, via: 'watched' }), null);

// Movies you should like: only unanswered movies, from discoveries and what the family loved.
{
  const A = movie(901, 'Alpha', ['Comedy'], 8), B = movie(902, 'Beta', ['Comedy'], 7), C = movie(903, 'Gamma', ['Drama'], 7), D = movie(904, 'Delta', ['Drama'], 7);
  const people = [{ id: 'me', name: 'Me' }, { id: 'kid', name: 'Kid' }];
  const es = {
    901: { movie: A, ratings: { kid: seen(5) } },
    902: { movie: B, ratings: { kid: seen(5), me: want } },
    903: { movie: C, ratings: { kid: seen(2) } },
  };
  const picks = forYou(es, 'me', [{ movie: D, sim: 0.9, because: 'like Alpha' }], people);
  assert.deepEqual(picks.map((p) => p.movie.id).sort(), [901, 904]);
  assert.equal(picks.find((p) => p.movie.id === 901).because, 'Kid loved it');
  assert.equal(picks.find((p) => p.movie.id === 904).because, 'like Alpha');
  assert.ok(picks.every((p) => p.match >= 0 && p.match <= 100));
}

// Where to watch: a boost for anything streamable, and filters for "no rental" and "free".
{
  const on = (id, title, included, free = []) => ({ ...movie(id, title, ['Comedy']), watch: { v: 2, at: Date.now(), on: included.map((name) => ({ name })), free: free.map((name) => ({ name })), rent: ['Apple TV Store'] } });
  const N = on(801, 'OnNetflix', ['Netflix']), H = on(802, 'FreeOnTubi', [], ['Tubi']), U = on(803, 'RentOnly', []);
  const es = { 801: { movie: N, ratings: { a: want } }, 802: { movie: H, ratings: { a: want } }, 803: { movie: U, ratings: { a: want } } };
  const list = suggest(es, ['a']);
  const rank = (id) => list.find((e) => e.movie.id === id).rank;
  assert.equal(rank(801) - rank(803), 6);
  assert.equal(rank(802) - rank(803), 6);
  assert.deepEqual(streaming(H), { free: ['Tubi'], included: [] });
  assert.deepEqual(applyFilters(list, { certs: [], streamable: true }).map((e) => e.movie.id).sort(), [801, 802]);
  assert.deepEqual(applyFilters(list, { certs: [], freeOnly: true }).map((e) => e.movie.id), [802]);
  // Snoozed movies are left out, but only while the snooze lasts and only for people watching.
  const people = [{ id: 'a', snoozed: { 801: 2000, 802: 500 } }, { id: 'b', snoozed: { 803: 2000 } }];
  assert.deepEqual([...activeSnoozes(people, ['a'], 1000)], ['801']);
  assert.deepEqual(suggest(es, ['a'], { snoozed: activeSnoozes(people, ['a'], 1000) }).map((e) => e.movie.id).sort(), [802, 803]);
}

// Ranked vote: 3, 2, 1 points; changing a ballot moves only the difference.
{
  const { voteDeltas } = await import('../src/lib/votes.js');
  const ranked = { ranked: true }, single = {};
  assert.deepEqual(voteDeltas(ranked, [1, 2, 3]), { 1: 3, 2: 2, 3: 1 });
  assert.deepEqual(voteDeltas(ranked, [2, 1], [1, 2, 3]), { 1: -1, 2: 1, 3: -1 });
  assert.deepEqual(voteDeltas(single, [5], [4]), { 4: -1, 5: 1 });
  assert.deepEqual(voteDeltas(single, [5], [5]), {});
}

// Family stats.
{
  const A = movie(701, 'A', ['Comedy']), B = movie(702, 'B', ['Comedy']), C = movie(703, 'C', ['Drama']), D = movie(704, 'D', ['Drama']);
  const people = [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }, { id: 'z', name: 'Z' }];
  const es = {
    701: { movie: A, ratings: { x: seen(5), y: seen(5), z: seen(1) } },
    702: { movie: B, ratings: { x: seen(4), y: seen(4), z: seen(2) } },
    703: { movie: C, ratings: { x: seen(3), y: seen(3), z: seen(5) } },
    704: { movie: D, ratings: { x: seen(4), y: seen(4), z: { status: 'seen', stars: null, via: 'watched' } } },
  };
  const hist = [{ id: 'n1', at: 1000, movie: A, via: 'vote', watchers: ['x', 'y', 'z'] }, { id: 'n2', at: 5000, movie: D, via: 'spin', watchers: ['x', 'z'] }];
  const st = familyStats(es, people, hist);
  assert.equal(st.pairs[0].agreement, 100);
  assert.deepEqual([st.pairs[0].a.id, st.pairs[0].b.id], ['x', 'y']);
  assert.equal(st.pairs.length, 1); // z shares only 3 rated movies with the others
  assert.equal(st.split.movie.id, 701);
  assert.equal(st.nights.count, 2);
  assert.equal(st.nights.how.vote, 1);
  assert.deepEqual(unscoredNights(hist, es, 'z', 5000 + 3 * 3600e3).map((n) => n.id), ['n2']);
  assert.deepEqual(unscoredNights(hist, es, 'z', 5000 + 60e3), []);
  assert.deepEqual(unscoredNights(hist, es, 'x', 1e12), []);
}

// Month in review counts only that month's nights; unreleased wanted movies stay off Tonight.
{
  const A = { ...movie(601, 'A', ['Comedy']), runtime: 100 }, B = { ...movie(602, 'B', ['Comedy']), runtime: 90 }, C = movie(603, 'C', ['Drama']);
  const people = [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }];
  const es = { 601: { movie: A, ratings: { x: seen(5), y: seen(3) } }, 602: { movie: B, ratings: { x: seen(2), y: seen(2) } }, 603: { movie: C, ratings: {} } };
  const at = (y, m, d) => new Date(y, m, d, 20).getTime();
  const hist = [{ id: 'a', at: at(2026, 10, 3), movie: A, via: 'vote', watchers: ['x', 'y'] }, { id: 'b', at: at(2026, 10, 20), movie: B, via: 'spin', watchers: ['x', 'y'] }, { id: 'c', at: at(2026, 9, 30), movie: C, via: 'pick', watchers: ['x'] }];
  const nov = monthReview(es, people, hist, 2026, 10);
  assert.equal(nov.count, 2);
  assert.equal(nov.minutes, 190);
  assert.equal(nov.best.movie.id, 601);
  assert.equal(nov.worst.movie.id, 602);
  assert.equal(nov.split.movie.id, 601);
  assert.equal(nov.topGenre, 'Comedy');
  assert.equal(monthReview(es, people, hist, 2026, 9).unscored, 1);
  assert.equal(monthReview(es, people, hist, 2026, 11).count, 0);
  const soonMovie = { ...movie(604, 'NotOutYet', ['Comedy']), release: '2999-01-01' };
  assert.equal(suggest({ 604: { movie: soonMovie, ratings: { x: want } } }, ['x']).length, 0);
  assert.equal(suggest({ 604: { movie: { ...soonMovie, release: '2020-01-01' }, ratings: { x: want } } }, ['x']).length, 1);
}

// "Haven't seen it" is remembered but counts as no opinion: no veto, no want, no "already seen" penalty.
{
  const M = movie(501, 'Unseen', ['Comedy']);
  const base = suggest({ 501: { movie: M, ratings: { a: want } } }, ['a', 'b'])[0];
  const withNote = suggest({ 501: { movie: M, ratings: { a: want, b: { status: 'notseen', stars: null } } } }, ['a', 'b'])[0];
  assert.equal(withNote.rank, base.rank);
  assert.equal(withNote.alreadySeen, 0);
  assert.equal(forYou({ 501: { movie: M, ratings: { me: { status: 'notseen', stars: null } } } }, 'me', [{ movie: M, sim: 0.9, because: 'x' }], []).length, 1);
}

// Favourite genres on the stats page come from rankings too, not only star ratings.
{
  const ranked = (like) => ({ status: 'seen', stars: null, like, via: 'rank' });
  const people = [{ id: 'r', name: 'Ranker' }];
  const es = {
    401: { movie: movie(401, 'C1', ['Comedy']), ratings: { r: ranked(5) } },
    402: { movie: movie(402, 'C2', ['Comedy']), ratings: { r: ranked(4.5) } },
    403: { movie: movie(403, 'H1', ['Horror']), ratings: { r: ranked(1.5) } },
    404: { movie: movie(404, 'H2', ['Horror']), ratings: { r: ranked(2) } },
  };
  const person = familyStats(es, people, []).people[0];
  assert.equal(person.rated, 0);
  assert.equal(person.ranked, 4);
  assert.deepEqual(person.genres, ['Comedy']);
}
// The assistant's answer parser allows a longer list when a deck is asked for.
{
  const { parseAnswer } = await import('../api/assistant.js');
  const text = JSON.stringify({ reply: 'ok', picks: Array.from({ length: 30 }, (_, n) => ({ title: `T${n}`, year: 2000 })) });
  assert.equal(parseAnswer(text).picks.length, 8);
  assert.equal(parseAnswer(text, 20).picks.length, 20);
}
console.log('\nAll suggestion checks passed.');
