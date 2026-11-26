import { useState } from 'react';
import { ArrowLeftRight, Link2, X } from 'lucide-react';
import { hasFirebase } from '../lib/config.js';
import { applyUpdate, buildLabel } from '../lib/autoUpdate.js';
import { Avatar, Notice } from './ui.jsx';

/** Who's in, and switching person. */
export default function Group({ members, me, canGoogle, googleUid, error, onSwitch, onAdd, onRemove, onLink, onUnlink, onSignOut }) {
  const [name, setName] = useState('');
  const [removing, setRemoving] = useState(null);
  const add = (e) => { e.preventDefault(); if (name.trim()) { onAdd(name); setName(''); } };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-cream">Who's in</h2>
          {!googleUid && <button type="button" onClick={onSwitch} className="inline-flex items-center gap-1.5 rounded-full border border-aisle px-3 py-1.5 text-sm font-bold text-cream"><ArrowLeftRight size={14} /> Switch person</button>}
        </div>
        <ul className="flex flex-col gap-1 rounded-xl bg-seat p-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <Avatar member={m} size={36} />
              <span className="min-w-0 flex-1 truncate font-bold text-cream">{m.name}</span>
              {m.id === me ? <span className="text-xs text-gold">that's you</span>
                : m.uid ? <span className="text-xs text-dim">Google account</span>
                : removing === m.id
                  ? <span className="flex items-center gap-2 text-xs text-dim">Remove? <button type="button" onClick={() => { onRemove(m.id); setRemoving(null); }} className="font-bold text-cream underline">Yes</button><button type="button" onClick={() => setRemoving(null)} className="underline">No</button></span>
                  : <button type="button" onClick={() => setRemoving(m.id)} aria-label={`Remove ${m.name}`} className="rounded-full p-2 text-dim hover:text-cream"><X size={16} /></button>}
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="flex gap-2">
          <input id="add-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Add another name" aria-label="Add another name" autoComplete="off" className="min-w-0 flex-1 rounded-lg border border-aisle bg-seat px-3 py-2.5 text-cream placeholder:text-dim focus:border-gold focus:outline-none" />
          <button type="submit" disabled={!name.trim()} className="rounded-lg bg-velvet px-4 py-2.5 font-bold text-cream disabled:bg-aisle disabled:text-dim">Add</button>
        </form>
        <p className="text-xs text-dim">
          {hasFirebase
            ? 'Everyone who opens this site sees the same names and ratings. A name linked to a Google account can only be used by signing in; any other name can be picked by anyone with the link.'
            : 'Names and ratings are saved on this device only. To share them between phones, the site needs its Firebase keys (README, step 2).'}
        </p>
      </section>

      {canGoogle && (
        <section className="flex flex-col gap-3 rounded-xl bg-seat p-4">
          <h3 className="font-bold text-cream">Google account</h3>
          {error && <Notice>{error}</Notice>}
          {googleUid ? (
            <>
              <p className="text-sm text-dim">Your name is linked to your Google account. Sign in with Google on any device and it opens straight into your ratings. Nobody else can pick your name.</p>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <button type="button" onClick={onSignOut} className="rounded-lg border border-aisle px-3 py-2 font-bold text-cream">Sign out</button>
                <button type="button" onClick={onUnlink} className="text-dim underline">Unlink Google from my name</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-dim">Link your Google account to keep your name and everything you've rated. After that, sign in with Google on any device and you're straight in, and nobody else can pick your name.</p>
              <button type="button" onClick={onLink} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cream px-4 py-2.5 font-bold text-house"><Link2 size={16} /> Link my Google account</button>
            </>
          )}
        </section>
      )}

      <p className="text-xs tabular-nums text-dim">Version {buildLabel} · <button type="button" onClick={applyUpdate} className="underline">Check for update</button></p>
    </div>
  );
}
