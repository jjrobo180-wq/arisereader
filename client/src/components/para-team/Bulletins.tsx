// Para Team → Bulletin board: notes anyone on the team pins up for a day, a week, or any dates
// ("Fire drill at 10", "J. has a sub in speech this week", "Bring a jacket for recess duty").
// Bulletins that are up today also show at the top of everyone's Today page. A bulletin can carry
// clickable links and several photos and documents; the files are the team's own uploads (kept in
// Documents › Bulletin board) and open through the same private, short-lived links as any team file.
import { Fragment, useEffect, useRef, useState, type ClipboardEvent } from "react";
import { AlertTriangle, ExternalLink, FileText, Image as ImageIcon, Link2, Loader2, Paperclip, Plus, X } from "lucide-react";
import { HubModal } from "@/components/teacher-hub/HubModal";
import { Field, Labeled } from "@/components/teacher-hub/ui";
import { BULLETIN_COLORS, BULLETIN_MAX, addDaysKey, bulletinUp, cleanUrl, isImageType, ofKind, weekEnd, type BulletinData, type BulletinFile, type ParaItem } from "@shared/paraTeam";
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

/** Web addresses in a message become links (a trailing period or bracket stays text). */
function Linkified({ text }: { text: string }) {
  const out: (string | { href: string; label: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(/(?:https?:\/\/|www\.)[^\s<>"]+/gi)) {
    let raw = m[0];
    const tail = /[.,;:!?)\]}'"]+$/.exec(raw)?.[0] || "";
    raw = raw.slice(0, raw.length - tail.length);
    const href = cleanUrl(raw);
    if (!href) continue;
    out.push(text.slice(last, m.index), { href, label: raw });
    last = (m.index || 0) + raw.length;
  }
  out.push(text.slice(last));
  return <>{out.map((part, i) => typeof part === "string" ? <Fragment key={i}>{part}</Fragment>
    : <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-teal-800 underline underline-offset-2 hover:text-teal-950">{part.label}</a>)}</>;
}

/** A photo on a bulletin, loaded through a short-lived private link (kept for a while so the board doesn't ask again). */
const thumbLinks = new Map<string, { url: string; at: number }>();
function BulletinPhoto({ f, tall }: { f: BulletinFile; tall?: boolean }) {
  const p = usePara();
  const cached = thumbLinks.get(f.id);
  const [url, setUrl] = useState(cached && Date.now() - cached.at < 45 * 60_000 ? cached.url : "");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (url) return;
    let live = true;
    p.api.fileUrl(f.id).then((u) => { thumbLinks.set(f.id, { url: u, at: Date.now() }); if (live) setUrl(u); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [f.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button type="button" onClick={() => p.act(() => p.api.openFile(f.id))} aria-label={`Open the photo ${f.name}`} title={f.name}
      className={`relative block w-full overflow-hidden rounded-lg bg-white/70 ring-1 ring-black/10 ${tall ? "aspect-video" : "aspect-square"}`}>
      {url ? <img src={url} alt={f.name} loading="lazy" className="h-full w-full object-cover" onError={() => { thumbLinks.delete(f.id); setUrl(""); setFailed(true); }} />
        : <span className="grid h-full w-full place-items-center text-slate-500">{failed ? <ImageIcon className="h-6 w-6" /> : <Loader2 className="h-5 w-5 animate-spin" />}</span>}
    </button>
  );
}

/** The links, photos and documents on a bulletin. */
function BulletinAttachments({ b, compact }: { b: BulletinData; compact?: boolean }) {
  const p = usePara();
  const files = b.files ?? [], links = b.links ?? [];
  const pics = files.filter((f) => isImageType(f.contentType)), docs = files.filter((f) => !isImageType(f.contentType));
  const shown = compact ? pics.slice(0, 3) : pics;
  if (!files.length && !links.length) return null;
  const chip = "inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-lg bg-white/80 px-2.5 text-sm font-semibold text-slate-800 ring-1 ring-black/10 hover:bg-white";
  return (
    <div className="grid gap-2">
      {shown.length > 0 && <div className={`grid gap-1.5 ${shown.length === 1 ? "grid-cols-1" : shown.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {shown.map((f) => <BulletinPhoto key={f.id} f={f} tall={shown.length === 1} />)}
      </div>}
      {compact && pics.length > shown.length && <p className="text-xs font-semibold text-slate-600">+{pics.length - shown.length} more photo{pics.length - shown.length === 1 ? "" : "s"}</p>}
      {(docs.length > 0 || links.length > 0) && <div className="flex flex-wrap gap-1.5">
        {docs.map((f) => <button key={f.id} type="button" className={chip} onClick={() => p.act(() => p.api.openFile(f.id))} title={`Open ${f.name}`}>
          <FileText className="h-4 w-4 shrink-0 text-slate-500" /><span className="truncate">{f.name}</span></button>)}
        {links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className={chip} title={l.url}>
          <ExternalLink className="h-4 w-4 shrink-0 text-teal-700" /><span className="truncate">{l.title}</span></a>)}
      </div>}
    </div>
  );
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
      {b.data.body && <p className={`whitespace-pre-wrap break-words text-slate-800 ${compact ? "line-clamp-4 text-sm" : "text-[15px] leading-relaxed"}`}><Linkified text={b.data.body} /></p>}
      <BulletinAttachments b={b.data} compact={compact} />
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

const blank = (today: string): BulletinData => ({ title: "", body: "", from: today, until: today, color: "yellow", important: false, links: [], files: [] });
const sizeWords = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

type Span = "today" | "week" | "custom" | "open";

function BulletinForm({ initial, id, onClose }: { initial: BulletinData; id?: string; onClose: () => void }) {
  const p = usePara();
  const [d, setD] = useState<BulletinData>({ ...initial, links: initial.links ?? [], files: initial.files ?? [] });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [linkTitle, setLinkTitle] = useState(""), [linkUrl, setLinkUrl] = useState(""), [linkError, setLinkError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  /** Files uploaded while this form is open: taken back out again if the bulletin isn't posted. */
  const fresh = useRef<string[]>([]);
  const files = d.files ?? [], links = d.links ?? [];

  const addFiles = async (list: FileList | File[] | null) => {
    const all = Array.from(list || []);
    if (!all.length) return;
    const room = BULLETIN_MAX.files - files.length;
    if (room <= 0) { p.say(`A bulletin can hold up to ${BULLETIN_MAX.files} photos and files.`); return; }
    const chosen = all.slice(0, room);
    if (all.length > room) p.say(`A bulletin can hold up to ${BULLETIN_MAX.files} photos and files, so the first ${room} were added.`);
    setUploading({ done: 0, total: chosen.length });
    for (const [i, f] of chosen.entries()) {
      try {
        const item = await p.api.upload(f, "Bulletin board", d.title.trim() ? `On the bulletin "${d.title.trim()}"` : "On a bulletin");
        fresh.current.push(item.id);
        setD((x) => ({ ...x, files: [...(x.files ?? []), { id: item.id, name: item.data.name, contentType: item.data.contentType, size: item.data.size }] }));
      } catch (e: any) { p.say(`${f.name}: ${e?.message || "it didn't upload. Try again."}`); }
      setUploading({ done: i + 1, total: chosen.length });
    }
    setUploading(null);
    if (picker.current) picker.current.value = "";
  };
  const removeFile = (id: string) => {
    setD((x) => ({ ...x, files: (x.files ?? []).filter((f) => f.id !== id) }));
    if (fresh.current.includes(id)) { fresh.current = fresh.current.filter((x) => x !== id); void p.api.remove(id).catch(() => {}); }
  };
  const pendingLink = () => { const url = cleanUrl(linkUrl); return url ? { url, title: linkTitle.trim().slice(0, 120) || new URL(url).hostname.replace(/^www\./, "") } : null; };
  const addLink = () => {
    const l = pendingLink();
    if (!l) { setLinkError("Paste a web address, like https://school.org/lunch-menu"); return; }
    if (links.length >= BULLETIN_MAX.links) { setLinkError(`A bulletin can hold up to ${BULLETIN_MAX.links} links.`); return; }
    setD((x) => ({ ...x, links: [...(x.links ?? []), l] })); setLinkTitle(""); setLinkUrl(""); setLinkError("");
  };
  const onPaste = (e: ClipboardEvent) => { const pasted = Array.from(e.clipboardData?.files || []); if (pasted.length) { e.preventDefault(); void addFiles(pasted); } };
  const cancel = () => { for (const id of fresh.current) void p.api.remove(id).catch(() => {}); fresh.current = []; onClose(); };
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
    // A link typed in but not added yet still goes up with the bulletin.
    const typed = pendingLink();
    const out = typed && links.length < BULLETIN_MAX.links ? { ...d, links: [...links, typed] } : d;
    setSaving(true);
    const ok = await p.act(() => (id ? p.api.update(id, out) : p.api.add("bulletin", out)), id ? "Saved." : "Posted to the board.");
    setSaving(false);
    if (ok) { fresh.current = []; onClose(); }
  };
  const empty = !d.title.trim() && !d.body.trim() && !files.length && !links.length && !pendingLink();
  return (
    <HubModal title={id ? "Edit bulletin" : "Post a bulletin"} onClose={cancel}
      footer={<div className="flex justify-end gap-2"><button type="button" className={SECOND} onClick={cancel}>Cancel</button><button type="button" className={PRIMARY} disabled={saving || !!uploading || empty} onClick={save}>{saving ? "Saving…" : uploading ? "Uploading…" : id ? "Save" : "Post"}</button></div>}>
      <div className="grid gap-4" onPaste={onPaste}>
        <Labeled label="Headline"><Field data-autofocus value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={120} placeholder="Fire drill at 10:15, early release Friday…" /></Labeled>
        <Labeled label="Message"><Area h="min-h-28" value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} maxLength={1500} placeholder="What everyone needs to know. Web addresses become clickable links." /></Labeled>

        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Photos and files</legend>
          {files.length > 0 && <ul className="mb-2 grid gap-1.5" aria-label="Attached photos and files">
            {files.map((f) => <li key={f.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm">
              {isImageType(f.contentType) ? <ImageIcon className="h-4 w-4 shrink-0 text-teal-700" /> : <FileText className="h-4 w-4 shrink-0 text-slate-500" />}
              <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{f.name}</span>
              {f.size > 0 && <span className="shrink-0 text-xs text-slate-500">{sizeWords(f.size)}</span>}
              <button type="button" onClick={() => removeFile(f.id)} aria-label={`Remove ${f.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700"><X className="h-4 w-4" /></button>
            </li>)}
          </ul>}
          <input ref={picker} type="file" multiple className="hidden" aria-label="Choose photos or files"
            accept="image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,video/*" onChange={(e) => void addFiles(e.target.files)} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={SECOND} disabled={!!uploading || files.length >= BULLETIN_MAX.files} onClick={() => picker.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              {uploading ? `Uploading ${Math.min(uploading.done + 1, uploading.total)} of ${uploading.total}…` : "Add photos or files"}
            </button>
            <span className="text-xs text-slate-500">Choose several at once, or paste a photo. Up to {BULLETIN_MAX.files}, 25 MB each.</span>
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Links</legend>
          {links.length > 0 && <ul className="mb-2 grid gap-1.5" aria-label="Links on this bulletin">
            {links.map((l, i) => <li key={i} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm">
              <Link2 className="h-4 w-4 shrink-0 text-teal-700" />
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-800">{l.title}</span><span className="block truncate text-xs text-slate-500">{l.url}</span></span>
              <button type="button" onClick={() => setD((x) => ({ ...x, links: (x.links ?? []).filter((_, j) => j !== i) }))} aria-label={`Remove ${l.title}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700"><X className="h-4 w-4" /></button>
            </li>)}
          </ul>}
          {links.length < BULLETIN_MAX.links && <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
            <Field value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} maxLength={120} placeholder="Name (optional)" aria-label="Link name" />
            <Field value={linkUrl} onChange={(e) => { setLinkUrl(e.target.value); setLinkError(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
              inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="https://…" aria-label="Web address" />
            <button type="button" className={SECOND} onClick={addLink}><Plus className="h-4 w-4" />Add link</button>
          </div>}
          {linkError && <p className="mt-1.5 text-sm font-semibold text-rose-700" role="alert">{linkError}</p>}
        </fieldset>
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
