import { useState } from 'react';
import { Avatar, AVATARS } from './ui.jsx';

/** Edit the three profiles' names and avatars. */
export default function Profiles({ profiles, onSave, onClose }) {
  const [draft, setDraft] = useState(profiles);
  const update = (id, patch) => setDraft((d) => d.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const save = () => {
    onSave(draft.map((p, n) => ({ ...p, name: p.name.trim() || profiles[n].name })));
    onClose();
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h2 className="text-2xl font-bold text-cream">Profiles</h2>
      {draft.map((p) => (
        <div key={p.id} className="flex flex-col gap-3 rounded-xl bg-seat p-3">
          <div className="flex items-center gap-3">
            <Avatar avatar={p.avatar} size={40} />
            <input id={`name-${p.id}`} aria-label={`Name for ${p.name}`} value={p.name} maxLength={16} onChange={(e) => update(p.id, { name: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-aisle bg-house px-3 py-2 font-bold text-cream focus:border-gold focus:outline-none" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(AVATARS).map(([key, a]) => (
              <button key={key} type="button" title={a.label} aria-label={a.label} aria-pressed={p.avatar === key} onClick={() => update(p.id, { avatar: key })} className={`rounded-full ${p.avatar === key ? 'ring-2 ring-gold ring-offset-2 ring-offset-seat' : 'opacity-50 hover:opacity-100'}`}>
                <Avatar avatar={key} size={32} />
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-aisle px-4 py-3 font-bold text-cream">Cancel</button>
        <button type="button" onClick={save} className="rounded-lg bg-velvet px-4 py-3 font-bold text-cream">Save</button>
      </div>
    </div>
  );
}
