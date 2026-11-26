import { SERVICES } from '../lib/tmdb.js';
import { Chip } from './ui.jsx';

/** Tick the streaming services the family has. Shared by everyone, used to favour and filter suggestions. */
export default function Services({ services, onChange }) {
  const toggle = (name) => onChange(services.includes(name) ? services.filter((s) => s !== name) : [...services, name]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Our streaming services">
        {SERVICES.map((name) => <Chip key={name} on={services.includes(name)} onClick={() => toggle(name)}>{name}</Chip>)}
      </div>
      <p className="text-xs text-dim">Shared by everyone. Movies on these get a small lift, and you can limit Tonight to them.</p>
    </div>
  );
}
