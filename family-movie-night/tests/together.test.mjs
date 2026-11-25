// Sanity check for the Watch Together rules against the demo data. Run with: npm test
import assert from 'node:assert/strict';
import { demoEntries } from '../src/lib/demoData.js';
import { applyFilters, buildWatchTogether } from '../src/lib/together.js';

const lists = buildWatchTogether(demoEntries());
const titles = (l) => l.map((e) => e.movie.title);
console.log('Top Picks  :', lists.topPicks.map((e) => `${e.movie.title} (${e.match}%)`).join(', '));
console.log('Favorites  :', lists.favorites.map((e) => `${e.movie.title} (${e.avg.toFixed(2)})`).join(', '));
console.log('Compromise :', lists.compromise.map((e) => `${e.movie.title} [waiting on ${e.waitingOn}]`).join(', '));
console.log('Vetoed     :', lists.vetoed.map((e) => `${e.movie.title} [${e.vetoedBy}]`).join(', '));

assert.equal(lists.topPicks.length, 5);
assert.equal(lists.topPicks[0].movie.title, 'Back to the Future');
assert.deepEqual(titles(lists.favorites).sort(), ['Coco', 'How to Train Your Dragon', 'The Incredibles', 'Toy Story']);
assert.deepEqual(titles(lists.compromise).sort(), ['Jurassic Park', 'Spirited Away', 'The Goonies']);
assert.deepEqual(titles(lists.vetoed).sort(), ['Frozen', 'Home Alone', 'The Avengers']); // Avengers: a No thanks
assert.equal(lists.topPicks.at(-1).movie.title, 'Paddington 2'); // one Indifferent costs 10 points
assert.equal(lists.topPicks.at(-1).match, 65);
assert.ok(!Object.values(lists).flat().some((e) => e.movie.title === 'Moana' ), 'Moana: liked but nobody wants a rewatch');
assert.deepEqual(titles(applyFilters(lists.compromise, { genre: '', certs: ['PG-13'], maxRuntime: 0 })), ['Jurassic Park']);
assert.equal(applyFilters(lists.topPicks, { genre: '', certs: [], maxRuntime: 100 }).length, 1);
// A low rating marked Watch Again is not a veto.
const guilty = buildWatchTogether({ 1: { movie: { id: 1, title: 'X' }, ratings: { parent: { status: 'again', stars: 2 }, kid1: { status: 'unseen', stars: null }, kid2: { status: 'unseen', stars: null } } } });
assert.equal(guilty.vetoed.length, 0);
assert.equal(guilty.topPicks.length, 1);
// Three shrugs is not a pick; two shrugs and one Want to is.
const shrug = (a) => buildWatchTogether({ 1: { movie: { id: 1, title: 'X', vote: 8 }, ratings: { parent: { status: a }, kid1: { status: 'meh' }, kid2: { status: 'meh' } } } }).topPicks;
assert.equal(shrug('meh').length, 0);
assert.equal(shrug('unseen')[0].match, 60);
console.log('\nAll Watch Together checks passed.');
