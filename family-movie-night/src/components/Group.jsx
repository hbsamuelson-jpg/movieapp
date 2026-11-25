import { useState } from 'react';
import { Copy, LogOut } from 'lucide-react';
import { hasFirebase } from '../lib/config.js';
import { applyUpdate, buildLabel } from '../lib/autoUpdate.js';
import { Avatar, Notice } from './ui.jsx';

/** Your group: who is in it, how to invite people, and a few settings. */
export default function Group({ group, members, me, signedIn, includeR, onIncludeR, onLeave, onSignOut, onSignIn, onClearLocal }) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const link = group ? `${window.location.origin}/?join=${group.id}` : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the link is shown, so it can be copied by hand */ }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      {group ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold text-cream">{group.name}</h2>
            <ul className="flex flex-col gap-2 rounded-xl bg-seat p-3">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <Avatar member={m} size={36} />
                  <span className="font-bold text-cream">{m.name}</span>
                  {m.id === me && <span className="text-xs text-dim">you</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-2 rounded-xl bg-seat p-4">
            <h3 className="font-bold text-cream">Invite someone</h3>
            <p className="text-sm text-dim">Send them this link, or have them sign in and enter the code. Everyone in the group is equal: each person rates for themselves and sees the same suggestions.</p>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-house px-3 py-2">
              <span className="font-display text-2xl tracking-[0.2em] text-gold">{group.id}</span>
              <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-full border border-aisle px-3 py-1.5 text-sm font-bold text-cream"><Copy size={14} /> {copied ? 'Copied' : 'Copy link'}</button>
            </div>
            <span className="break-all text-xs text-dim">{link}</span>
          </section>
        </>
      ) : (
        <section className="flex flex-col gap-3 rounded-xl bg-seat p-4">
          <h2 className="text-xl font-bold text-cream">Just you, on this device</h2>
          {hasFirebase ? (
            <>
              <p className="text-sm text-dim">Sign in to share ratings with other people and get suggestions for whoever is watching.</p>
              <button type="button" onClick={onSignIn} className="rounded-lg bg-cream px-4 py-2.5 font-bold text-house">Sign in with Google</button>
            </>
          ) : (
            <Notice>Google sign-in isn't switched on for this site yet. Until the Firebase keys are added (README, steps 2–4), ratings stay on this device and can't be shared.</Notice>
          )}
          <button type="button" onClick={onClearLocal} className="self-start text-sm text-dim underline">Erase the ratings on this device</button>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-xl bg-seat p-4">
        <label className="flex items-center justify-between gap-3 text-sm font-bold text-cream">
          Show R-rated movies when I'm rating
          <input id="include-r" type="checkbox" className="h-5 w-5 accent-[#F5C518]" checked={includeR} onChange={(e) => onIncludeR(e.target.checked)} />
        </label>
        <p className="text-xs text-dim">Off by default. This is a setting for this device only.</p>
      </section>

      {signedIn && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={onSignOut} className="inline-flex items-center gap-1.5 rounded-lg border border-aisle px-3 py-2 font-bold text-cream"><LogOut size={15} /> Sign out</button>
          {group && (confirming
            ? <span className="flex items-center gap-2 text-dim">Leave {group.name}? <button type="button" onClick={onLeave} className="font-bold text-cream underline">Yes, leave</button> <button type="button" onClick={() => setConfirming(false)} className="underline">Cancel</button></span>
            : <button type="button" onClick={() => setConfirming(true)} className="text-dim underline">Leave this group</button>)}
        </div>
      )}

      <p className="text-xs tabular-nums text-dim">Version {buildLabel} · <button type="button" onClick={applyUpdate} className="underline">Check for update</button></p>
    </div>
  );
}
