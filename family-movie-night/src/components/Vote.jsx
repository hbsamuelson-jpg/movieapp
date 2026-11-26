import { useState } from 'react';
import { Check, Dices, Lock, Trophy } from 'lucide-react';
import { pref } from '../lib/config.js';
import { voteResult } from '../lib/suggest.js';
import { Poster } from './ui.jsx';

// Each device remembers what its people chose, so they can change their mind. It is not
// stored anywhere shared: the group only records that you voted, and the running totals.
const myChoice = (voteId, me) => pref.get('vote-choice', {})[`${voteId}:${me}`] ?? null;
const rememberChoice = (voteId, me, movieId) => {
  // Keep only the current vote's choices (several people may share one device).
  const current = Object.fromEntries(Object.entries(pref.get('vote-choice', {})).filter(([key]) => key.startsWith(`${voteId}:`)));
  pref.set('vote-choice', { ...current, [`${voteId}:${me}`]: movieId });
};

/** A secret ballot on tonight's shortlist. Totals stay hidden until everyone has voted or someone ends it. */
export default function Vote({ vote, members, me, onCast, onEnd, onClear, onRevote, onSpin, onOpen }) {
  const [choice, setChoice] = useState(() => myChoice(vote.id, me));
  const [confirmEnd, setConfirmEnd] = useState(false);
  const result = voteResult(vote);
  const iVoted = (vote.voted || []).includes(me);
  const canVote = (vote.voters || []).includes(me);
  const revealed = !vote.open || result.everyoneIn;
  const waiting = members.filter((m) => vote.voters.includes(m.id) && !vote.voted.includes(m.id)).map((m) => (m.id === me ? 'you' : m.name));

  const cast = (movie) => {
    if (!vote.open || !canVote || (iVoted && choice == null)) return; // voted on another device: can't tell what to undo
    onCast(movie.id, choice);
    setChoice(movie.id);
    rememberChoice(vote.id, me, movie.id);
  };

  if (revealed) {
    const [winner, ...others] = result.winners;
    const most = result.rows[0]?.votes || 1;
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-gold/60 bg-seat p-4">
        <div className="flex items-center gap-2 text-gold"><Trophy size={18} /><h2 className="font-bold">{!winner ? 'Nobody voted' : others.length ? "It's a tie" : 'Tonight’s pick'}</h2></div>
        {winner && !others.length && (
          <button type="button" onClick={() => onOpen(winner)} className="flex items-center gap-3 text-left">
            <span className="w-16 shrink-0"><Poster movie={winner} size="w185" /></span>
            <span className="text-xl font-bold leading-tight text-cream">{winner.title}{winner.year ? <span className="font-normal text-dim"> ({winner.year})</span> : null}</span>
          </button>
        )}
        <ul className="flex flex-col gap-2">
          {result.rows.map(({ movie, votes }) => (
            <li key={movie.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
              <span className={`truncate ${result.winners.some((w) => w.id === movie.id) ? 'font-bold text-cream' : 'text-dim'}`}>{movie.title}</span>
              <span className="tabular-nums text-dim">{votes} {votes === 1 ? 'vote' : 'votes'}</span>
              <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-aisle"><span className="block h-full rounded-full bg-gold" style={{ width: `${(votes / most) * 100}%` }} /></span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-dim">{result.cast} of {result.expected} voted. Votes are secret: only the totals are kept.</p>
        <div className="flex flex-wrap gap-2">
          {others.length > 0 && <button type="button" onClick={() => onSpin(result.winners)} className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 font-bold text-house"><Dices size={18} /> Spin the tie</button>}
          <button type="button" onClick={onRevote} className="rounded-lg border border-aisle px-4 py-2.5 text-sm font-bold text-cream">Vote again</button>
          <button type="button" onClick={onClear} className="rounded-lg px-3 py-2.5 text-sm text-dim underline">Close</button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-gold/60 bg-seat p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-gold"><Lock size={16} /><h2 className="font-bold">Secret vote</h2></div>
        <span className="text-xs tabular-nums text-dim">{result.cast} of {result.expected} voted</span>
      </div>
      <p className="text-sm text-dim">
        {!canVote ? "You're not in this vote. You'll see the result when it's done."
          : iVoted && choice == null ? "You've voted on another device. The result shows when everyone's in."
            : iVoted ? 'Your vote is in. You can change it until the result shows.'
              : 'Pick one. Nobody sees who voted for what, and totals stay hidden until everyone has voted.'}
      </p>
      <ul className="flex flex-col gap-2">
        {vote.options.map((movie) => {
          const mine = choice === movie.id;
          return (
            <li key={movie.id}>
              <button type="button" onClick={() => cast(movie)} disabled={!canVote || (iVoted && choice == null)} aria-pressed={mine} className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition ${mine ? 'border-gold bg-gold/15' : 'border-aisle hover:border-dim'} disabled:opacity-60`}>
                <span className="w-11 shrink-0"><Poster movie={movie} size="w92" className="rounded-sm" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-cream">{movie.title}</span>
                  <span className="block text-xs tabular-nums text-dim">{movie.year || ''}</span>
                </span>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${mine ? 'border-gold bg-gold text-house' : 'border-aisle'}`}>{mine && <Check size={16} />}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-dim">
        <span>{waiting.length ? `Waiting on ${waiting.join(', ')}` : ''}</span>
        {confirmEnd
          ? <span className="flex items-center gap-2">Show the result now? <button type="button" onClick={onEnd} className="font-bold text-cream underline">Yes</button><button type="button" onClick={() => setConfirmEnd(false)} className="underline">No</button></span>
          : <span className="flex items-center gap-3"><button type="button" onClick={() => setConfirmEnd(true)} className="underline">End vote now</button><button type="button" onClick={onClear} className="underline">Cancel vote</button></span>}
      </div>
    </section>
  );
}
