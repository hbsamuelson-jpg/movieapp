// Rotten Tomatoes scores for many movies in one go.
//
// MDBList can answer for 100 movies in a single request, but only from a server: browsers are
// refused (it doesn't answer the browser's permission check for this kind of request). So the
// app sends the movie ids here and this passes them on. One call = one lookup against MDBList's
// daily limit, which is what lets a whole library switch to Rotten Tomatoes scores in minutes.
//
// POST { ids: [tmdbId, ...] }  ->  { scores: [{ id, rt, rtPath, age }] }
//   rt      Rotten Tomatoes critics score, 0–100, or null
//   rtPath  the movie's own Rotten Tomatoes address ("/m/barbie"), or null
//   age     Common Sense Media's recommended age, or null if they haven't reviewed it
// Movies MDBList doesn't know are simply left out.

const KEY = process.env.VITE_MDBLIST_API_KEY || process.env.MDBLIST_API_KEY || '';

export function readScores(item) {
  const tomatoes = (item.ratings || []).find((r) => r.source === 'tomatoes');
  return {
    id: item.ids.tmdb,
    rt: typeof tomatoes?.value === 'number' ? Math.round(tomatoes.value) : null,
    rtPath: typeof tomatoes?.url === 'string' && tomatoes.url.startsWith('/m/') ? tomatoes.url : null,
    age: item.commonsense && Number.isFinite(item.commonsense_media?.common_sense) ? item.commonsense_media.common_sense : null,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!KEY) return res.status(503).json({ error: 'not_configured' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 100);
  if (!ids.length) return res.status(400).json({ error: 'bad_request' });
  let upstream;
  try {
    upstream = await fetch(`https://api.mdblist.com/tmdb/movie?apikey=${KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
  } catch {
    return res.status(502).json({ error: 'unreachable' });
  }
  if (upstream.status === 429) return res.status(429).json({ error: 'limit' });
  if (!upstream.ok) return res.status(502).json({ error: 'upstream', status: upstream.status });
  const list = await upstream.json().catch(() => null);
  if (!Array.isArray(list)) return res.status(502).json({ error: 'upstream' });
  return res.status(200).json({ scores: list.filter((item) => item?.ids?.tmdb != null).map(readScores) });
}
