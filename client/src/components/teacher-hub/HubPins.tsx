// Arise WorkHub: pinned banners across the top (up to five) and the Pin button for a to-do, event or meeting.
import { useState, type Dispatch, type SetStateAction } from "react";
import { Check, Pencil, Pin as PinIcon, PinOff, X } from "lucide-react";
import { MAX_PINS, PIN_COLORS, cleanColor, isPinned, resolvePins, textOn, togglePin, type PinKind } from "@shared/hubPins";
import type { Workspace } from "@shared/teacherHub";

type Setter = Dispatch<SetStateAction<Workspace>>;

export function PinButton({ workspace, setWorkspace, kind, refId, title, makeId }: { workspace: Workspace; setWorkspace: Setter; kind: PinKind; refId: string; title: string; makeId: () => string }) {
  const [full, setFull] = useState(false);
  const on = isPinned(workspace, kind, refId);
  function toggle() {
    const r = togglePin(workspace, kind, refId, makeId);
    setFull(r.full);
    if (!r.full) setWorkspace(r.workspace);
  }
  return (
    <span className="inline-flex flex-col items-center">
      <button type="button" onClick={toggle} aria-pressed={on} aria-label={`${on ? "Unpin" : "Pin"} ${title}`} title={on ? "Unpin from the top" : "Pin to the top"}
        className={`-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100 ${on ? "text-teal-700" : "text-slate-400"}`} data-testid="pin-button">
        {on ? <PinOff className="h-4 w-4" /> : <PinIcon className="h-4 w-4" />}
      </button>
      {full && <span role="alert" className="mt-3 max-w-[9rem] text-center text-[11px] text-rose-700">You can pin {MAX_PINS}. Unpin one first.</span>}
    </span>
  );
}

export default function PinBanners({ workspace, setWorkspace }: { workspace: Workspace; setWorkspace: Setter }) {
  const items = resolvePins(workspace);
  const [editing, setEditing] = useState<string | null>(null);
  if (!items.length) return null;
  const change = (id: string, patch: Partial<{ color: string; label: string }>) =>
    setWorkspace((p) => ({ ...p, pins: p.pins.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const unpin = (id: string) => setWorkspace((p) => ({ ...p, pins: p.pins.filter((x) => x.id !== id) }));
  function toggleDone(it: (typeof items)[number]) {
    if (it.item.kind === "task") { const id = it.item.task.id; setWorkspace((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })); }
    if (it.item.kind === "meeting") { const id = it.item.meeting.id; setWorkspace((p) => ({ ...p, meetings: p.meetings.map((m) => (m.id === id ? { ...m, done: !m.done } : m)) })); }
  }
  return (
    <section aria-label="Pinned" className="space-y-2" data-testid="pin-banners">
      {items.map((it) => {
        const bg = cleanColor(it.pin.color), fg = textOn(bg), open = editing === it.pin.id;
        const btn = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-black/10";
        return (
          <div key={it.pin.id} className="rounded-2xl shadow-sm" style={{ backgroundColor: bg, color: fg }} data-testid="pin-banner">
            <div className="flex items-center gap-1 px-3 py-2">
              {it.done !== null && (
                <button type="button" role="checkbox" aria-checked={it.done} aria-label={`Done: ${it.title}`} onClick={() => toggleDone(it)} className={btn}>
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border-2" style={{ borderColor: fg }}>{it.done && <Check className="h-4 w-4" />}</span>
                </button>
              )}
              <div className="min-w-0 flex-1 py-1 pl-1">
                <div className={`break-words font-semibold leading-snug ${it.done ? "line-through opacity-70" : ""}`}>{it.title}</div>
                {it.detail && <div className="break-words text-xs opacity-90">{it.detail}</div>}
              </div>
              <button type="button" onClick={() => setEditing(open ? null : it.pin.id)} aria-label={`Change look of ${it.title}`} aria-expanded={open} className={btn}><Pencil className="h-4 w-4" /></button>
              <button type="button" onClick={() => unpin(it.pin.id)} aria-label={`Unpin ${it.title}`} className={btn}><X className="h-4 w-4" /></button>
            </div>
            {open && (
              <div className="space-y-3 rounded-b-2xl bg-white p-3 text-slate-900" data-testid="pin-editor">
                <div role="radiogroup" aria-label="Banner color" className="flex flex-wrap items-center gap-2">
                  {PIN_COLORS.map((c) => (
                    <button key={c.hex} type="button" role="radio" aria-checked={bg === c.hex} aria-label={c.name} onClick={() => change(it.pin.id, { color: c.hex })}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border-2 ${bg === c.hex ? "border-slate-900" : "border-white shadow ring-1 ring-slate-200"}`} style={{ backgroundColor: c.hex }}>
                      {bg === c.hex && <Check className="h-4 w-4" style={{ color: textOn(c.hex) }} />}
                    </button>
                  ))}
                  <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">Any color
                    <input type="color" value={bg} onChange={(e) => change(it.pin.id, { color: e.target.value })} className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" aria-label="Pick any color" />
                  </label>
                </div>
                <label className="block text-sm font-medium text-slate-700">Banner words (leave empty to use the original)
                  <input value={it.pin.label} maxLength={120} onChange={(e) => change(it.pin.id, { label: e.target.value })} placeholder={it.item.kind === "task" ? it.item.task.title : it.item.kind === "event" ? it.item.event.title : "Meeting"}
                    className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus:border-slate-400 sm:text-sm" />
                </label>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
