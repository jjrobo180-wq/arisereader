// "Message parents" in the admin (Nov 25, 2026): choose who gets it (every parent, the parents at a school, or picked
// parents), say what it's about and let the AI write the email, edit it, see it as a parent will, send yourself a
// test, then send. Each parent gets their own copy with their name and their children's names filled in.
// Server: server/parentMessages.ts. The filling-in and the email's look: shared/parentMessages.ts.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Mail, Search, Send, Sparkles } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { audienceOf, fillParentEmail, renderParentEmail, type ParentRecipient } from "@shared/parentMessages";

type Audience = { parents: ParentRecipient[]; schools: { id: number; name: string }[]; history: { at: string; subject: string; sent: number; failed: number }[] };
type Choice = { kind: "all" } | { kind: "school"; schoolId: number } | { kind: "some"; ids: number[] };
const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400";
const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-sm font-semibold ${on ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`;

export default function AdminParentMessages({ token, start }: { token: string | null; start?: { prompt?: string; subject?: string; body?: string; schoolId?: number } }) {
  const [data, setData] = useState<Audience | null>(null);
  const [pick, setPick] = useState<Choice>(start?.schoolId ? { kind: "school", schoolId: start.schoolId } : { kind: "all" });
  const [q, setQ] = useState("");
  const [prompt, setPrompt] = useState(start?.prompt ?? "");
  const [subject, setSubject] = useState(start?.subject ?? "");
  const [body, setBody] = useState(start?.body ?? "");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const call = useCallback(async (path: string, method = "GET", payload?: unknown) => {
    const res = await fetch(`${API_BASE}/api/admin/parent-messages${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(payload !== undefined ? { "Content-Type": "application/json" } : {}) }, body: payload !== undefined ? JSON.stringify(payload) : undefined });
    const b = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(b?.message || "Something went wrong.");
    return b;
  }, [token]);
  const load = useCallback(() => call("/audience").then(setData).catch((e) => setMsg({ ok: false, text: e.message })), [call]);
  useEffect(() => { void load(); }, [load]);

  const to = useMemo(() => (data ? audienceOf(data.parents, pick) : []), [data, pick]);
  const shown = useMemo(() => (data?.parents ?? []).filter((p) => !q || `${p.name} ${p.email} ${p.kids.join(" ")}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const schoolName = (id: number) => data?.schools.find((s) => s.id === id)?.name.replace(/\s*\(.*\)$/, "") ?? `School ${id}`;
  const sample = to[0] ?? { name: "Jordan Smith", kids: ["Maya"] };
  const preview = subject || body ? fillParentEmail({ subject, body }, sample) : null;

  const write = async () => {
    setBusy("draft"); setMsg(null);
    try { const d = await call("/draft", "POST", { prompt }); setSubject(d.subject); setBody(d.body); }
    catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(""); }
  };
  const send = async (test: boolean) => {
    setBusy(test ? "test" : "send"); setMsg(null); setConfirming(false);
    try {
      const r = await call("/send", "POST", { subject, body, test, parentIds: to.map((p) => p.id) });
      setMsg({ ok: !r.failed.length, text: test ? (r.sent ? "Test sent to your email." : "The test didn't send.") : `Sent to ${r.sent} parent${r.sent === 1 ? "" : "s"}.${r.failed.length ? ` ${r.failed.length} didn't go through: ${r.failed.join(", ")}` : ""}` });
      if (!test) void load();
    } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(""); }
  };
  const toggle = (id: number) => setPick((p) => { const ids = p.kind === "some" ? p.ids : []; return { kind: "some", ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] }; });

  if (!data) return <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading parents…</p>;
  const schoolsWithParents = data.schools.filter((s) => data.parents.some((p) => p.schoolIds.includes(s.id)));
  return <div className="space-y-5" data-testid="admin-parent-messages">
    <div>
      <p className="mb-2 text-sm font-bold text-slate-800">1. Who gets it</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(pick.kind === "all")} onClick={() => setPick({ kind: "all" })}>All parents ({data.parents.length})</button>
        {schoolsWithParents.map((s) => <button key={s.id} type="button" className={chip(pick.kind === "school" && pick.schoolId === s.id)} onClick={() => setPick({ kind: "school", schoolId: s.id })}>
          {schoolName(s.id)} ({data.parents.filter((p) => p.schoolIds.includes(s.id)).length})</button>)}
        <button type="button" className={chip(pick.kind === "some")} onClick={() => setPick({ kind: "some", ids: pick.kind === "some" ? pick.ids : [] })}>Pick parents</button>
      </div>
      {pick.kind === "some" && <div className="mt-3 rounded-xl border border-slate-200">
        <label className="flex items-center gap-2 border-b border-slate-100 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search parents or children" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">{shown.map((p) => { const on = pick.ids.includes(p.id); return <li key={p.id}>
          <button type="button" onClick={() => toggle(p.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50">
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${on ? "bg-violet-600 text-white" : "border-2 border-slate-300"}`}>{on && <Check className="h-3.5 w-3.5" />}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-800">{p.name || p.email}</span><span className="block truncate text-xs text-slate-500">{p.email}{p.kids.length ? ` · ${p.kids.join(", ")}` : " · no child linked"}</span></span>
          </button></li>; })}</ul>
      </div>}
      <p className="mt-2 text-xs text-slate-500">{to.length} parent{to.length === 1 ? "" : "s"} will get it, each in their own email.</p>
    </div>

    <div>
      <p className="mb-2 text-sm font-bold text-slate-800">2. What it's about</p>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className={field} placeholder="For example: remind parents that the Top Reader Challenge ends Monday night and the top 2 readers win a $5 gift card or snacks." />
      <button type="button" onClick={() => void write()} disabled={!prompt.trim() || !!busy} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white disabled:opacity-50" data-testid="parent-msg-write">
        {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{subject || body ? "Write it again" : "Write the email for me"}</button>
    </div>

    <div>
      <p className="mb-2 text-sm font-bold text-slate-800">3. Check and edit</p>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={`${field} mb-2 font-semibold`} data-testid="parent-msg-subject" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="Your message. Leave a blank line between paragraphs." className={field} data-testid="parent-msg-body" />
      <p className="mt-1 text-xs text-slate-500">{"{first_name}"} becomes each parent's first name and {"{child_names}"} their children's names.</p>
    </div>

    {preview && <div>
      <p className="mb-2 text-sm font-bold text-slate-800">How {sample.name ? sample.name.split(" ")[0] : "a parent"} will see it</p>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 border-b border-slate-100 pb-2 text-sm"><span className="text-slate-500">From:</span> Arise Reader · <span className="text-slate-500">Subject:</span> <b>{preview.subject}</b></p>
        <div dangerouslySetInnerHTML={{ __html: renderParentEmail(preview.body) }} />
      </div>
    </div>}

    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void send(true)} disabled={!subject || !body || !!busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:opacity-50" data-testid="parent-msg-test">
        {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Send me a test</button>
      {!confirming ? <button type="button" onClick={() => setConfirming(true)} disabled={!subject || !body || !to.length || !!busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-50" data-testid="parent-msg-send">
        <Send className="h-4 w-4" />Send to {to.length} parent{to.length === 1 ? "" : "s"}</button>
        : <span className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">Send this to {to.length} parent{to.length === 1 ? "" : "s"} now?
          <button type="button" onClick={() => void send(false)} className="rounded-lg bg-emerald-600 px-3 py-1 font-bold text-white" data-testid="parent-msg-confirm">{busy === "send" ? "Sending…" : "Yes, send"}</button>
          <button type="button" onClick={() => setConfirming(false)} className="rounded-lg px-2 py-1 font-semibold text-slate-600">Cancel</button></span>}
    </div>
    {msg && <p className={`text-sm font-semibold ${msg.ok ? "text-emerald-700" : "text-rose-700"}`} role="status">{msg.text}</p>}

    {data.history.length > 0 && <div>
      <p className="mb-1 text-sm font-bold text-slate-800">Sent before</p>
      <ul className="divide-y divide-slate-100 text-sm">{data.history.slice(0, 8).map((h, i) => <li key={i} className="flex justify-between gap-3 py-1.5"><span className="truncate text-slate-700">{h.subject}</span><span className="shrink-0 text-xs text-slate-500">{new Date(h.at).toLocaleDateString()} · {h.sent} sent{h.failed ? `, ${h.failed} failed` : ""}</span></li>)}</ul>
    </div>}
  </div>;
}
