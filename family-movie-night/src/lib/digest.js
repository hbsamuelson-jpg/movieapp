// The weekly digest: a short Friday note with what to watch this weekend.
// Pure: given the same data the app has, it returns { subject, text, html }.

import { planNights, watchedIds } from './marathon.js';
import { genreRankToStars, setStatedGenres, shownStars, suggest } from './suggest.js';

const DAY = 24 * 60 * 60 * 1000;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const names = (list) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
const label = (movie) => `${movie.title}${movie.year ? ` (${movie.year})` : ''}`;
const dayText = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function buildDigest({ entries, members, history = [], marathons = [], now = Date.now(), site = '' }) {
  const family = members.filter((m) => !m.guest);
  const ids = family.map((m) => m.id);
  const nameOf = Object.fromEntries(family.map((m) => [m.id, m.name]));
  const today = new Date(now).toISOString().slice(0, 10);
  const list = Object.values(entries);
  const wanters = (e) => ids.filter((id) => ['unseen', 'again'].includes(e.ratings?.[id]?.status));
  const sections = [];

  setStatedGenres(Object.fromEntries(family.map((m) => [m.id, genreRankToStars(m.genreRank)])));
  const snoozed = new Set(family.flatMap((m) => Object.entries(m.snoozed || {}).filter(([, until]) => until > now).map(([id]) => id)));
  const picks = suggest(entries, ids, { snoozed, today }).slice(0, 3);
  if (picks.length) {
    sections.push({ title: 'Top picks for everyone', lines: picks.map((p) => {
      const where = [...p.where.included, ...p.where.free][0];
      const bits = [`${p.score}% match`, typeof p.movie.rt === 'number' ? `Rotten Tomatoes ${p.movie.rt}%` : null, p.movie.runtime ? `${p.movie.runtime} min` : null, where ? `on ${where}` : null].filter(Boolean);
      const who = wanters(p).map((id) => nameOf[id]);
      return `${label(p.movie)}: ${bits.join(', ')}${who.length ? `. Wanted by ${names(who)}` : ''}`;
    }) });
  }

  const picked = new Set(picks.map((p) => String(p.movie.id)));
  const streamable = list
    .filter((e) => !picked.has(String(e.movie.id)) && !snoozed.has(String(e.movie.id)) && wanters(e).length && ((e.movie.watch?.on || []).length || (e.movie.watch?.free || []).length) && !ids.some((id) => e.ratings?.[id]?.status === 'pass'))
    .sort((a, b) => wanters(b).length - wanters(a).length || (b.movie.rt || 0) - (a.movie.rt || 0))
    .slice(0, 5);
  if (streamable.length) {
    sections.push({ title: 'On your lists and streaming now', lines: streamable.map((e) => {
      const free = (e.movie.watch?.free || [])[0]?.name;
      const on = (e.movie.watch?.on || [])[0]?.name;
      return `${label(e.movie)}: ${on ? `on ${on}` : `free on ${free}`}. Wanted by ${names(wanters(e).map((id) => nameOf[id]))}`;
    }) });
  }

  const weekAgo = new Date(now - 7 * DAY).toISOString().slice(0, 10);
  const soon = new Date(now + 14 * DAY).toISOString().slice(0, 10);
  const releases = list.filter((e) => e.movie.release && e.movie.release >= weekAgo && e.movie.release <= soon && wanters(e).length).sort((a, b) => a.movie.release.localeCompare(b.movie.release));
  if (releases.length) {
    sections.push({ title: 'New and coming soon', lines: releases.map((e) => `${e.movie.title}: ${e.movie.release <= today ? 'out since' : 'out'} ${dayText(e.movie.release)}. Wanted by ${names(wanters(e).map((id) => nameOf[id]))}`) });
  }

  const going = marathons.map((m) => {
    const seen = watchedIds(m, history);
    const next = planNights(m.movies, m.perNight || 240).find((night) => night.some((movie) => !seen.has(String(movie.id))));
    return next ? `${m.title}: ${seen.size} of ${m.movies.length} watched. Next night: ${names(next.filter((movie) => !seen.has(String(movie.id))).map((movie) => movie.title))}` : null;
  }).filter(Boolean);
  if (going.length) sections.push({ title: 'Marathons in progress', lines: going });

  const owed = family.map((m) => {
    const nights = history.filter((n) => (n.watchers || []).includes(m.id) && now - n.at >= 2 * 60 * 60 * 1000 && !shownStars(entries[n.movie.id]?.ratings?.[m.id]));
    return nights.length ? `${m.name}: ${names([...new Set(nights.map((n) => n.movie.title))].slice(0, 4))}` : null;
  }).filter(Boolean);
  if (owed.length) sections.push({ title: 'Still needs a star rating', lines: owed });

  const subject = picks.length ? `Movie night: ${picks[0].movie.title} tops this week's picks` : 'Movie night: this week';
  const intro = sections.length ? 'Here is what the app would put on this weekend.' : 'Nothing to report yet. Add some movies to your Want to lists and this fills in.';
  const text = [intro, ...sections.map((s) => `${s.title.toUpperCase()}\n${s.lines.map((l) => `- ${l}`).join('\n')}`), site ? `Open the app: ${site}` : ''].filter(Boolean).join('\n\n');
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#1f1a17;max-width:560px">`
    + `<p>${esc(intro)}</p>`
    + sections.map((s) => `<h3 style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8a1c2b;margin:22px 0 6px">${esc(s.title)}</h3><ul style="margin:0;padding-left:20px">${s.lines.map((l) => { const cut = l.indexOf(':'); return `<li style="margin:4px 0"><strong>${esc(l.slice(0, cut))}</strong>${esc(l.slice(cut))}</li>`; }).join('')}</ul>`).join('')
    + (site ? `<p style="margin-top:24px"><a href="${esc(site)}" style="color:#8a1c2b;font-weight:bold">Open Family Movie Night</a></p>` : '')
    + '</div>';
  return { subject, text, html, sections };
}
