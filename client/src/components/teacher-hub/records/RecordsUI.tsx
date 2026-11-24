// The pieces every class-records plugin shares (Behavior, Hall passes, Attendance, Gradebook, Student wall),
// so they look and work alike: the page head with its tabs, the sharing switches, a switch, initials, and
// the sharing settings loaded once for all of them.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, Users, Eye } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { requester, type Requester } from "@/lib/records";
import { PLUGIN_NAMES, cleanShare, type RecordPlugin, type ShareSettings } from "@shared/classRecords";

export const ink = "text-slate-900 dark:text-white";

export function useRecords(): Requester {
  const { token } = useAuth();
  return useMemo(() => requester(token), [token]);
}

/** Sharing, the class list and the family links, loaded once per page. */
export function useRecordsSetup() {
  const req = useRecords();
  const [setup, setSetup] = useState<{ share: ShareSettings; students: Array<{ id: number; name: string }>; links: Record<string, { token: string; at: string } | null> } | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => req("/api/records/setup").then((s) => { setSetup({ ...s, share: cleanShare(s.share) }); setError(""); }).catch((e) => setError(e.message)), [req]);
  useEffect(() => { void load(); }, [load]);
  const saveShare = async (next: ShareSettings) => {
    setSetup((s) => (s ? { ...s, share: next } : s));
    try { const r = await req("/api/records/share", { method: "PUT", body: next }); setSetup((s) => (s ? { ...s, share: cleanShare(r.share) } : s)); }
    catch (e: any) { setError(e.message); void load(); }
  };
  return { setup, setSetup, error, reload: load, saveShare };
}

export function Toggle({ on, onChange, label, disabled = false }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${on ? "bg-[#6e5ae0]" : "bg-slate-300 dark:bg-white/20"}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

/** The two sharing switches for one plugin. */
export function ShareCard({ plugin, share, onChange, extra }: { plugin: RecordPlugin; share: ShareSettings | undefined; onChange: (s: ShareSettings) => void; extra?: ReactNode }) {
  if (!share) return null;
  const set = (side: "parents" | "staff", v: boolean) => onChange({ ...share, [side]: { ...share[side], [plugin]: v } });
  return (
    <section className="rounded-2xl border border-[#e7e8f0] bg-white p-5 dark:border-white/10 dark:bg-white/[.03]" data-testid={`share-${plugin}`}>
      <h3 className={`text-base font-bold ${ink}`}>Who sees {PLUGIN_NAMES[plugin]}</h3>
      <p className="mt-1 text-sm text-slate-500">Families see it on the family page and get a notification when something new is shared. Admins always see it.</p>
      <div className="mt-4 divide-y divide-slate-100 dark:divide-white/10">
        <label className="flex items-center gap-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"><Users className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className={`block font-semibold ${ink}`}>Families</span><span className="block text-sm text-slate-500">{share.parents[plugin] ? "Each family sees their own child's." : "Not shared with families."}</span></span>
          <Toggle on={share.parents[plugin]} onChange={(v) => set("parents", v)} label={`Share ${PLUGIN_NAMES[plugin]} with families`} />
        </label>
        <label className="flex items-center gap-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/80"><Eye className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className={`block font-semibold ${ink}`}>Other staff at your school</span><span className="block text-sm text-slate-500">{share.staff[plugin] ? "Staff can look your students up." : "Only you and admins."}</span></span>
          <Toggle on={share.staff[plugin]} onChange={(v) => set("staff", v)} label={`Share ${PLUGIN_NAMES[plugin]} with other staff`} />
        </label>
      </div>
      {extra}
    </section>
  );
}

/** A plugin's head: its name, one line on what it is, its tabs and a place for buttons. */
export function PluginHead<T extends string>({ title, blurb, tabs, tab, setTab, right, shared }: { title: string; blurb: string; tabs: Array<{ id: T; label: string; count?: number }>; tab: T; setTab: (t: T) => void; right?: ReactNode; shared?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className={`text-2xl font-bold tracking-tight ${ink}`}>{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{blurb}{shared !== undefined && <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${shared ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/70"}`}>{shared ? "Shared with families" : "Not shared with families"}</span>}</p>
        </div>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>
      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 [scrollbar-width:none] dark:border-white/10" aria-label={`${title} sections`}>
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px min-h-11 shrink-0 border-b-2 px-3 text-sm font-semibold transition ${tab === t.id ? "border-[#6e5ae0] text-slate-900 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white"}`}>
            {t.label}{t.count ? <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">{t.count}</span> : null}
          </button>
        ))}
      </nav>
    </div>
  );
}

const TONES = ["#6e5ae0", "#0f766e", "#b45309", "#1d4ed8", "#be185d", "#4d7c0f", "#7c3aed", "#0e7490"];
export const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
export function Avatar({ id, name, size = 36 }: { id: number; name: string; size?: number }) {
  return <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.38, background: TONES[Math.abs(id) % TONES.length] }}>{initials(name)}</span>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <p className="flex items-center gap-2 py-10 text-sm text-slate-500" role="status"><Loader2 className="h-4 w-4 animate-spin" />{label}</p>;
}
export function ErrorNote({ text, retry }: { text: string; retry?: () => void }) {
  if (!text) return null;
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert"><span>{text}</span>{retry && <button type="button" onClick={retry} className="min-h-9 rounded-lg px-3 font-semibold hover:bg-rose-100">Try again</button>}</div>;
}
export function Btn({ children, onClick, kind = "plain", type = "button", disabled, title, testid }: { children: ReactNode; onClick?: () => void; kind?: "primary" | "plain" | "danger"; type?: "button" | "submit"; disabled?: boolean; title?: string; testid?: string }) {
  const cls = kind === "primary" ? "bg-[#6e5ae0] text-white hover:bg-[#5d49d2]" : kind === "danger" ? "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-white";
  return <button type={type} onClick={onClick} disabled={disabled} title={title} data-testid={testid} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition disabled:opacity-50 ${cls}`}>{children}</button>;
}
/** A page section with a white surface. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[#e7e8f0] bg-white p-5 dark:border-white/10 dark:bg-white/[.03] ${className}`}>{children}</section>;
}
