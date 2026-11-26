import { useEffect, useRef, useState } from 'react';
import { Check, Plus, SendHorizontal, Sparkles } from 'lucide-react';
import { askAssistant, buildContext, resolvePicks } from '../lib/assistant.js';
import { Avatar, MemberDots, MovieRow, Notice } from './ui.jsx';

const STARTERS = [
  'What should we watch tonight?',
  'Something funny, under two hours',
  'A movie none of us have seen',
  'A rewatch everyone loves',
];

/** Ask the assistant. It knows everyone's ratings and who is watching, and its picks can go straight on the shortlist. */
export default function Ask({ entries, members, me, present, onTogglePresent, shortlist, onShortlist, onOpen }) {
  const [thread, setThread] = useState([]); // [{ role: 'user' | 'assistant', content, picks? }]
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(null);
  const bottom = useRef(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [thread, busy]);

  const presentIds = present.map((m) => m.id);
  const listed = (movie) => shortlist.some((m) => String(m.id) === String(movie.id));
  const toggleListed = (movie) => onShortlist(listed(movie) ? shortlist.filter((m) => String(m.id) !== String(movie.id)) : [...shortlist, movie]);

  const ask = async (question) => {
    const text = question.trim();
    if (!text || busy) return;
    const next = [...thread, { role: 'user', content: text }];
    setThread(next);
    setDraft('');
    setError('');
    setBusy(true);
    try {
      const answer = await askAssistant({
        messages: next.map((m) => ({ role: m.role, content: m.role === 'assistant' ? `${m.content}${m.picks?.length ? ` Suggested: ${m.picks.map((p) => p.movie.title).join(', ')}.` : ''}` : m.content })),
        context: buildContext(entries, members, presentIds, shortlist),
        memberId: me,
      });
      const picks = await resolvePicks(answer.picks || [], entries, presentIds);
      setRemaining(answer.remaining ?? null);
      setThread([...next, { role: 'assistant', content: answer.reply, picks }]);
    } catch (e) {
      setError(e.message);
      setThread(thread); // put the question back in the box so it isn't lost
      setDraft(text);
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      {members.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-dim">Asking for</h2>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const here = presentIds.includes(m.id);
              return (
                <button key={m.id} type="button" aria-pressed={here} onClick={() => onTogglePresent(m.id)} className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-sm font-bold transition ${here ? 'border-gold text-cream' : 'border-aisle text-dim'}`}>
                  <Avatar member={m} size={28} dim={!here} />
                  {m.id === me ? 'Me' : m.name}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {thread.length === 0 && (
        <section className="flex flex-col gap-3 rounded-xl bg-seat p-4">
          <div className="flex items-center gap-2 text-gold"><Sparkles size={18} /><h2 className="font-bold">Ask the assistant</h2></div>
          <p className="text-sm text-dim">It knows what everyone here has rated, wants to watch, and has ruled out. Ask in your own words.</p>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => <button key={s} type="button" onClick={() => ask(s)} disabled={busy} className="rounded-full border border-aisle px-3 py-1.5 text-left text-sm text-cream hover:border-dim">{s}</button>)}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3" aria-live="polite">
        {thread.map((m, n) => (m.role === 'user' ? (
          <p key={n} className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-aisle px-3.5 py-2 text-sm text-cream">{m.content}</p>
        ) : (
          <div key={n} className="flex flex-col gap-1">
            <p className="max-w-[92%] rounded-2xl rounded-bl-sm bg-seat px-3.5 py-2 text-sm leading-relaxed text-cream">{m.content}</p>
            {m.picks?.length > 0 && (
              <ul className="-mx-2 flex flex-col">
                {m.picks.map(({ movie, reason }) => {
                  const on = listed(movie);
                  return (
                    <MovieRow key={movie.id} movie={movie} onOpen={onOpen} note={<span className="text-dim">{reason}</span>} aside={<MemberDots entry={entries[movie.id]} members={present} />}
                      action={<button type="button" onClick={() => toggleListed(movie)} aria-pressed={on} aria-label={on ? `Remove ${movie.title} from the shortlist` : `Add ${movie.title} to the shortlist`} className={`mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${on ? 'border-gold bg-gold text-house' : 'border-aisle text-cream hover:border-dim'}`}>{on ? <Check size={17} /> : <Plus size={17} />}</button>} />
                  );
                })}
              </ul>
            )}
          </div>
        )))}
        {busy && <p className="self-start rounded-2xl rounded-bl-sm bg-seat px-3.5 py-2 text-sm text-dim">Thinking…</p>}
        {error && <Notice>{error}</Notice>}
        <div ref={bottom} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(draft); }} className="sticky bottom-0 flex gap-2 bg-house pb-1 pt-2">
        <input id="ask-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} autoComplete="off" placeholder="Ask about what to watch" aria-label="Ask the assistant" className="min-w-0 flex-1 rounded-full border border-aisle bg-seat px-4 py-3 text-cream placeholder:text-dim focus:border-gold focus:outline-none" />
        <button type="submit" disabled={busy || !draft.trim()} aria-label="Send" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-velvet text-cream disabled:bg-aisle disabled:text-dim"><SendHorizontal size={19} /></button>
      </form>
      <p className="-mt-2 text-xs text-dim">
        Answers come from an AI and can be wrong. Vetoed movies are filtered out before anything is shown.
        {remaining != null && remaining <= 10 ? ` ${remaining} questions left today.` : ''}
        {thread.length > 0 && <> <button type="button" onClick={() => { setThread([]); setError(''); }} className="underline">Start over</button></>}
      </p>
    </div>
  );
}
