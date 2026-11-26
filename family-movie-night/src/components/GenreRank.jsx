import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, GripVertical } from 'lucide-react';
import { GENRE_CHOICES } from '../lib/tmdb.js';

const ALL = GENRE_CHOICES.map((g) => g.name);
/** A saved order, with any genre it doesn't mention added at the end. */
const complete = (saved) => [...(saved || []).filter((g) => ALL.includes(g)), ...ALL.filter((g) => !(saved || []).includes(g))];

/**
 * Rank the genres from favourite to least favourite: drag a row by its grip (mouse or finger) or
 * use the arrows. Nothing is saved until the order is first changed; after that every change is
 * saved when the drag ends.
 */
export default function GenreRank({ ranked, onChange }) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState(() => complete(ranked));
  const [dragging, setDragging] = useState(null);
  const orderRef = useRef(order);
  orderRef.current = order;
  const moved = useRef(false);
  const listRef = useRef(null);
  // Follow changes made on another device, but never mid-drag.
  useEffect(() => { if (!dragging) setOrder(complete(ranked)); }, [ranked?.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (from, to) => {
    if (to < 0 || to >= orderRef.current.length || from === to) return orderRef.current;
    const next = [...orderRef.current];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    orderRef.current = next;
    setOrder(next);
    return next;
  };
  const nudge = (index, by) => onChange(move(index, index + by));
  const startDrag = (e, name) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); moved.current = false; setDragging(name); };
  const drag = (e) => {
    if (!dragging || !listRef.current) return;
    const over = [...listRef.current.children].findIndex((row) => { const r = row.getBoundingClientRect(); return e.clientY >= r.top && e.clientY <= r.bottom; });
    const from = orderRef.current.indexOf(dragging);
    if (over < 0 || over === from) return;
    move(from, over);
    moved.current = true;
  };
  const endDrag = () => { if (dragging && moved.current) onChange(orderRef.current); setDragging(null); };

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-seat p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center justify-between gap-3 text-left">
        <span>
          <span className="block font-bold text-cream">Rank genres</span>
          <span className="block text-sm text-dim">{ranked?.length ? `Your top three: ${ranked.slice(0, 3).join(', ')}.` : 'Put the kinds of movie you like in order, favourite first. It steers your suggestions straight away.'}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-dim transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <p className="text-xs text-dim">Drag a row by its grip, or use the arrows. Favourite at the top.{ranked?.length ? '' : ' Nothing counts until you move something.'}</p>
          <ol ref={listRef} className="flex flex-col gap-1.5">
            {order.map((name, index) => (
              <li key={name} className={`flex items-center gap-2 rounded-lg bg-house px-2 py-1.5 ${dragging === name ? 'relative z-10 shadow-xl shadow-black/60 ring-2 ring-gold' : ''} ${ranked?.length ? '' : 'opacity-80'}`}>
                <span role="button" tabIndex={-1} aria-label={`Drag ${name} to reorder`} onPointerDown={(e) => startDrag(e, name)} onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}
                  className={`flex h-9 w-8 shrink-0 touch-none select-none items-center justify-center rounded text-dim ${dragging === name ? 'cursor-grabbing' : 'cursor-grab'}`}><GripVertical size={18} /></span>
                <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-gold">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate font-bold text-cream">{name}</span>
                <button type="button" onClick={() => nudge(index, -1)} disabled={index === 0} aria-label={`Move ${name} up`} className="flex h-9 w-9 items-center justify-center rounded-lg text-cream disabled:text-aisle"><ArrowUp size={17} /></button>
                <button type="button" onClick={() => nudge(index, 1)} disabled={index === order.length - 1} aria-label={`Move ${name} down`} className="flex h-9 w-9 items-center justify-center rounded-lg text-cream disabled:text-aisle"><ArrowDown size={17} /></button>
              </li>
            ))}
          </ol>
          {ranked?.length > 0 && <button type="button" onClick={() => onChange(null)} className="self-start text-sm text-dim underline">Clear my genre ranking</button>}
        </>
      )}
    </section>
  );
}
