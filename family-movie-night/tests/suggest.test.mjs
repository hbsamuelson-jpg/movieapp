// Checks for the taste and suggestion rules. Run with: npm test
import assert from 'node:assert/strict';
import { predictStars, suggest, tasteProfile } from '../src/lib/suggest.js';

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
console.log('\nAll suggestion checks passed.');
