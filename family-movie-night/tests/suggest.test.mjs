// Checks for the taste and suggestion rules. Run with: npm test
import assert from 'node:assert/strict';
import { liking, shownStars, mergeSimilar, predictStars, rankToLiking, suggest, tasteProfile } from '../src/lib/suggest.js';

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
console.log('\nAll suggestion checks passed.');
