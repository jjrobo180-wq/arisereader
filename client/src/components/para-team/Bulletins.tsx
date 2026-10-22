// Para Team → Bulletin board: notes anyone on the team pins up for a day, a week, or any dates
// ("Fire drill at 10", "J. has a sub in speech this week", "Bring a jacket for recess duty").
// Bulletins that are up today also show at the top of everyone's Today page.
import { useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { HubModal } from "@/components/teacher-hub/HubModal";
import { Field, Labeled } from "@/components/teacher-hub/ui";
import { BULLETIN_COLORS, addDaysKey, bulletinUp, ofKind, weekEnd, type BulletinData, type ParaItem } from "@shared/paraTeam";
import { Area, DeleteButton, EmptyNote, PRIMARY, SECOND, SMALL, SectionHead, Who, dayWords, usePara } from "./kit";

/** Sticky-note colours: light paper with a darker edge, readable in print and grayscale. */
export const NOTE_TONE: Record<BulletinData["color"], { paper: string; edge: string; label: string }> = {
  yellow: { paper: "#FEF6C7", edge: "#E0B100", label: "Yellow" },
  blue: { paper: "#DCEBFE", edge: "#3B82F6", label: "Blue" },
  green: { paper: "#DCF5E4", edge: "#16A34A", label: "Green" },
  pink: { paper: "#FBE3F0", edge: "#DB2777", label: "Pink" },
  orange: { paper: "#FFE8D2", edge: "#EA580C", label: "Orange" },
};

/** "Today only", "Through Fri, Oct 23", "Mon, Oct 26 – Fri, Oct 30", "Until it's taken down". */
export function bulletinWhen(b: BulletinData, today: string): string {
  if (!b.until) return b.from > today ? `From ${dayWords(b.from)}` : "Until it's taken down";
  if (b.from === b.until) return b.from === today ? "Today only" : dayWords(b.from);
  if (b.from <= today) return `Through ${dayWords(b.until)}`;
  return `${dayWords(b.from)} – ${dayWords(b.until)}`;
}

/** One note on the board. */
export function BulletinNote({ b, onEdit, compact }: { b: ParaItem<"bulletin">; onEdit?: () => void; compact?: boolean }) {
  const p = usePara();
  const tone = NOTE_TONE[b.data.color] || NOTE_TONE.yellow;
  return (
    <article className={`flex min-w-0 flex-col gap-2 rounded-xl border-t-[6px] p-4 shadow-sm ${b.data.important ? "ring-2 ring-rose-500" : ""}`}
      style={{ background: tone.paper, borderTopColor: tone.edge }} aria-label={b.data.title || "Bulletin"}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
        {b.data.important && <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-white"><AlertTriangle className="h-3 w-3" />Important</span>}
        <span>{bulletinWhen(b.data, p.today)}</span>
      </div>
      {b.data.title && <h3 className={`${compact ? "text-base" : "text-lg"} font-extrabold leading-snug text-slate-950`}>{b.data.title}</h3>}
      {b.data.body && <p className={`whitespace-pre-wrap break-words text-slate-800 ${compact ? "line-clamp-4 text-sm" : "text-[15px] leading-relaxed"}`}>{b.data.body}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
        <Who id={b.createdBy} at={b.createdAt} />
        {onEdit && p.mayEdit(b) && <span className="ml-auto flex items-center">
          <button type="button" className={SMALL} onClick={onEdit}>Edit</button>
          <DeleteButton label="Take down" onDelete={() => p.act(() => p.api.remove(b.id), "Taken down.")} />
        </span>}
      </div>
    </article>
  );
}

export function BulletinSection({ focus }: { focus?: string }) {
  const p = usePara();
  const [view, setView] = useState<"now" | "soon" | "past">("now");
  const [form, setForm] = useState<{ id?: string; data: BulletinData } | null>(() => (focus === "new" ? { data: blank(p.today) } : null));
  const all = ofKind(p.team.items, "bulletin");
  const now = all.filter((b) => bulletinUp(b.data, p.today)).sort((a, b) => Number(b.data.important) - Number(a.data.important) || b.createdAt.localeCompare(a.createdAt));
  const soon = all.filter((b) => b.data.from > p.today).sort((a, b) => a.data.from.localeCompare(b.data.from));
  const past = all.filter((b) => b.data.until && b.data.until < p.today).sort((a, b) => b.data.until.localeCompare(a.data.until));
  const list = view === "now" ? now : view === "soon" ? soon : past;

  return <>
    <SectionHead title="Bulletin board" line="Post a note for the day or the week: reminders, changes, shout-outs. Everyone on the team sees it, and today's notes show on Today."
      right={<button type="button" className={PRIMARY} onClick={() => setForm({ data: blank(p.today) })}><Plus className="h-4 w-4" />Post a bulletin</button>} />
    <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1 text-sm font-bold" role="group" aria-label="Which bulletins">
      {([["now", `Up now (${now.length})`], ["soon", `Coming up (${soon.length})`], ["past", "Past"]] as const).map(([v, label]) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`min-h-9 rounded-lg px-3 ${view === v ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>{label}</button>
      ))}
    </div>
    {list.length === 0 ? <EmptyNote>{view === "now" ? "Nothing on the board today. Post the first bulletin." : view === "soon" ? "Nothing scheduled to go up later." : "No past bulletins yet."}</EmptyNote> : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((b) => <BulletinNote key={b.id} b={b} onEdit={() => setForm({ id: b.id, data: b.data })} />)}
      </div>
    )}
    {form && <BulletinForm initial={form.data} id={form.id} onClose={() => setForm(null)} />}
  </>;
}

const blank = (today: string): BulletinData => ({ title: "", body: "", from: today, until: today, color: "yellow", important: false });

type Span = "today" | "week" | "custom" | "open";

function BulletinForm({ initial, id, onClose }: { initial: BulletinData; id?: string; onClose: () => void }) {
  const p = usePara();
  const [d, setD] = useState(initial);
  const [saving, setSaving] = useState(false);
  const spanOf = (x: BulletinData): Span => !x.until ? "open" : x.from === p.today && x.until === p.today ? "today" : x.from === p.today && x.until === weekEnd(p.today) ? "week" : "custom";
  const [span, setSpan] = useState<Span>(spanOf(initial));
  const pick = (s: Span) => {
    setSpan(s);
    if (s === "today") setD((x) => ({ ...x, from: p.today, until: p.today }));
    if (s === "week") setD((x) => ({ ...x, from: p.today, until: weekEnd(p.today) }));
    if (s === "open") setD((x) => ({ ...x, until: "" }));
    if (s === "custom") setD((x) => ({ ...x, until: x.until || addDaysKey(x.from, 1) }));
  };
  const save = async () => {
    setSaving(true);
    const ok = await p.act(() => (id ? p.api.update(id, d) : p.api.add("bulletin", d)), id ? "Saved." : "Posted to the board.");
    setSaving(false);
    if (ok) onClose();
  };
  return (
    <HubModal title={id ? "Edit bulletin" : "Post a bulletin"} onClose={onClose}
      footer={<div className="flex justify-end gap-2"><button type="button" className={SECOND} onClick={onClose}>Cancel</button><button type="button" className={PRIMARY} disabled={saving || (!d.title.trim() && !d.body.trim())} onClick={save}>{saving ? "Saving…" : id ? "Save" : "Post"}</button></div>}>
      <div className="grid gap-4">
        <Labeled label="Headline"><Field data-autofocus value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={120} placeholder="Fire drill at 10:15, early release Friday…" /></Labeled>
        <Labeled label="Message"><Area h="min-h-28" value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} maxLength={1500} placeholder="What everyone needs to know." /></Labeled>
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Keep it up</legend>
          <div className="flex flex-wrap gap-2">
            {([["today", "Today"], ["week", "This week"], ["custom", "Pick dates"], ["open", "Until I take it down"]] as const).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={span === v} onClick={() => pick(v)}
                className={`min-h-10 rounded-full border px-3.5 text-sm font-semibold ${span === v ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</button>
            ))}
          </div>
          {(span === "custom" || span === "open") && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Labeled label="First day"><Field type="date" value={d.from} onChange={(e) => setD({ ...d, from: e.target.value })} /></Labeled>
              {span === "custom" && <Labeled label="Last day"><Field type="date" value={d.until} min={d.from} onChange={(e) => setD({ ...d, until: e.target.value })} /></Labeled>}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">{d.from ? bulletinWhen(d, p.today) : ""}</p>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Color</legend>
          <div className="flex flex-wrap gap-2">
            {BULLETIN_COLORS.map((c) => (
              <button key={c} type="button" aria-pressed={d.color === c} aria-label={NOTE_TONE[c].label} onClick={() => setD({ ...d, color: c })}
                className={`h-10 w-10 rounded-xl border-2 ${d.color === c ? "border-slate-900 ring-2 ring-slate-900 ring-offset-2" : "border-white shadow"}`}
                style={{ background: NOTE_TONE[c].paper, borderTopColor: NOTE_TONE[c].edge, borderTopWidth: 6 }} />
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <input type="checkbox" className="h-4 w-4 accent-rose-600" checked={d.important} onChange={(e) => setD({ ...d, important: e.target.checked })} />Mark as important (shows first, with a red edge)
        </label>
      </div>
    </HubModal>
  );
}
