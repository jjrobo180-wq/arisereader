// Arise premium apps (#/pro): a gallery of every app by group, and each app full-page at
// #/pro?app=<id>. Apps are installed from the App Store (shared/pluginStore.ts) and saved to the
// person's account (useAppData in lib/cloudDocs.ts).
import { Suspense, lazy, useEffect, useMemo, useState, type ComponentType } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { kitIcon } from "@/components/plugin-kit/kitIcons";
import { PRO_GROUPS, PRO_LIVE_GROUPS, liveProApps, proApp, type ProGroup } from "@shared/pro/apps";

type Bundle = Record<string, ComponentType>;
const LOADERS: Record<ProGroup, () => Promise<Bundle>> = {
  health: () => import("@/components/pro/apps/health").then((m) => m.HEALTH),
  fitness: () => import("@/components/pro/apps/fitness").then((m) => m.FITNESS),
  mind: () => import("@/components/pro/apps/mind").then((m) => m.MIND),
  work: () => import("@/components/pro/apps/work").then((m) => m.WORK),
  meetings: () => import("@/components/pro/apps/meetings").then((m) => m.MEETINGS),
  school: () => import("@/components/pro/apps/school").then((m) => m.SCHOOL),
  teaching: () => import("@/components/pro/apps/teaching").then((m) => m.TEACHING),
  money: () => import("@/components/pro/apps/money").then((m) => m.MONEY),
  create: () => import("@/components/pro/apps/create").then((m) => m.CREATE),
};
const cache = new Map<string, ComponentType>();
function appComponent(id: string): ComponentType | null {
  const meta = proApp(id);
  if (!meta) return null;
  if (!cache.has(id)) cache.set(id, lazy(() => LOADERS[meta.group]().then((b) => ({ default: b[id] || Missing }))));
  return cache.get(id)!;
}
const Missing = () => <p className="text-sm text-slate-500">This app isn't available yet.</p>;
const readApp = () => new URLSearchParams(window.location.hash.split("?")[1] || "").get("app") || "";

export default function ProApps() {
  const { user } = useAuth();
  const [id, setId] = useState(readApp);
  useEffect(() => { const on = () => setId(readApp()); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  const hub = user?.role === "parent" ? "#/lifehub" : "#/workhub";
  const found = id ? proApp(id) : undefined;
  const meta = found && PRO_LIVE_GROUPS.includes(found.group) ? found : undefined;
  const App = id ? appComponent(id) : null;
  const go = (next: string) => { window.location.hash = next ? `#/pro?app=${next}` : "#/pro"; window.scrollTo({ top: 0 }); };
  return <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-6 sm:py-6">
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        {meta ? <button type="button" onClick={() => go("")} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline"><ArrowLeft size={15} />All apps</button>
          : <a href={hub} className="text-sm font-semibold text-indigo-700 hover:underline">← Back to my hub</a>}
        {meta && <a href={hub} className="text-sm font-semibold text-slate-500 hover:underline">My hub</a>}
      </header>
      {meta && App ? <>
        <div className="flex items-center gap-3">
          <AppBadge icon={meta.icon} color={meta.color} size={48} />
          <div className="min-w-0"><h1 className="text-2xl font-black">{meta.name}</h1><p className="text-sm text-slate-500">{meta.tagline}</p></div>
        </div>
        <Suspense fallback={<p className="py-10 text-center text-sm font-semibold text-slate-500">Opening {meta.name}…</p>}><div data-testid={`pro-app-${meta.id}`}><App /></div></Suspense>
      </> : <Gallery onOpen={go} />}
    </div>
  </main>;
}

export function AppBadge({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  const Icon = kitIcon(icon);
  return <span className="inline-flex shrink-0 items-center justify-center rounded-2xl text-white shadow-sm" style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}cc)` }}><Icon size={size * 0.5} /></span>;
}

function Gallery({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const live = useMemo(liveProApps, []);
  const groups = useMemo(() => (Object.keys(PRO_GROUPS) as ProGroup[]).map((g) => ({ g, apps: live.filter((a) => a.group === g && (!q || `${a.name} ${a.tagline} ${a.description}`.toLowerCase().includes(q.toLowerCase()))) })).filter((x) => x.apps.length), [q, live]);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-black">Arise Apps</h1><p className="text-sm text-slate-500">{live.length} apps for health, fitness, calm, work, meetings and school — more on the way. Everything saves to your account.</p></div>
      <div className="relative w-full sm:w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search apps" aria-label="Search apps" className="h-10 w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-slate-400 focus:outline-none" /></div>
    </div>
    {groups.map(({ g, apps }) => <section key={g}>
      <h2 className="mb-2 text-sm font-black uppercase tracking-wide" style={{ color: PRO_GROUPS[g].color }}>{PRO_GROUPS[g].label}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{apps.map((a) => <button key={a.id} type="button" onClick={() => onOpen(a.id)} data-testid={`pro-open-${a.id}`} className="flex items-start gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
        <AppBadge icon={a.icon} color={a.color} />
        <span className="min-w-0"><span className="block font-black">{a.name}{a.ai && <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 align-middle text-[10px] font-bold text-violet-700">AI</span>}</span><span className="block text-xs text-slate-500">{a.tagline}</span></span>
      </button>)}</div>
    </section>)}
  </div>;
}
