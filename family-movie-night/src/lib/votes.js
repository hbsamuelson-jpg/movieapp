// Vote arithmetic, kept apart from the stores so it can be tested on its own.
export const VOTE_POINTS = [3, 2, 1];
/** How each movie's total changes when a ballot goes from `previous` to `picks`: { movieId: delta }. */
export function voteDeltas(vote, picks, previous = []) {
  const points = (n) => (vote.ranked ? VOTE_POINTS[n] || 0 : n === 0 ? 1 : 0);
  const delta = {};
  previous.forEach((id, n) => { delta[id] = (delta[id] || 0) - points(n); });
  picks.forEach((id, n) => { delta[id] = (delta[id] || 0) + points(n); });
  return Object.fromEntries(Object.entries(delta).filter(([, d]) => d !== 0));
}
