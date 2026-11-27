// The weekly digest, built on the server from the family's saved data.
//
// GET /api/digest              -> { subject, text, html }
// GET /api/digest?format=text  -> the subject on the first line, then the plain-text digest
//
// It signs in the same way the app does when nobody has used Google (an anonymous visitor),
// reads the family's names, movie nights and movies, and runs the same suggestion code as the
// Tonight tab. It reads every movie once per call (about one database read per movie), so it is
// meant to be called weekly, not on every page view. Nothing is written.
//
// If DIGEST_KEY is set in Vercel, callers must add ?key=<that value>.

import { buildDigest } from '../src/lib/digest.js';

const API_KEY = process.env.VITE_FIREBASE_API_KEY || '';
const PROJECT = process.env.VITE_FIREBASE_PROJECT_ID || '';
const SPACE = process.env.VITE_SPACE_ID || 'family';
const SITE = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Firestore's REST format wraps every value in its type; this unwraps it to plain JSON. */
export function plain(value) {
  if (!value || typeof value !== 'object') return value;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return Date.parse(value.timestampValue);
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(plain);
  if ('mapValue' in value) return fields(value.mapValue.fields);
  return null;
}
const fields = (map = {}) => Object.fromEntries(Object.entries(map).map(([k, v]) => [k, plain(v)]));

async function visitorToken() {
  // The key only works for requests that say they come from the site, as the app's do.
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Referer: `${SITE}/` }, body: JSON.stringify({ returnSecureToken: true }) });
  const body = await r.json();
  if (!r.ok) throw new Error(`sign-in failed: ${body.error?.message || r.status}`);
  return body.idToken;
}

async function read(path, token) {
  const r = await fetch(`${BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) return {};
  const body = await r.json();
  if (!r.ok) throw new Error(`database read failed: ${body.error?.message || r.status}`);
  return body;
}

export default async function handler(req, res) {
  if (!API_KEY || !PROJECT) return res.status(503).json({ error: 'not_configured' });
  if (process.env.DIGEST_KEY && req.query?.key !== process.env.DIGEST_KEY) return res.status(401).json({ error: 'key' });
  try {
    const token = await visitorToken();
    const group = fields((await read(`groups/${SPACE}`, token)).fields);
    const members = Object.entries(group.members || {}).map(([id, m]) => ({ id, ...m }));
    const entries = {};
    let page = '';
    do {
      const batch = await read(`groups/${SPACE}/movies?pageSize=300${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`, token);
      for (const d of batch.documents || []) {
        const data = fields(d.fields);
        if (data.movie && data.ratings && Object.keys(data.ratings).length) entries[d.name.split('/').pop()] = data;
      }
      page = batch.nextPageToken || '';
    } while (page);
    const digest = buildDigest({ entries, members, history: group.history || [], marathons: group.marathons || [], site: SITE });
    res.setHeader('Cache-Control', 'no-store');
    if (req.query?.format === 'text') { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.status(200).send(`${digest.subject}\n\n${digest.text}`); }
    return res.status(200).json({ subject: digest.subject, text: digest.text, html: digest.html });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
