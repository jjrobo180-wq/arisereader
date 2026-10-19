// Arise premium apps (#/pro): a gallery of every app by group, and each app full-page at
// #/pro?app=<id>. Apps are installed from the App Store (shared/pluginStore.ts) and saved to the
// person's account (useAppData in lib/cloudDocs.ts).
import { Suspense, lazy, useEffect, useMemo, useState, type ComponentType } from "react";
import { ArrowLeft, Eye, Pencil, Search, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { READ_ONLY_EVENT, SharedOwnerContext, type SharedOwner } from "@/lib/cloudDocs";
import { linksApi } from "@/lib/profileLinks";
import { appShareId } from "@shared/profileLinks";
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
const params = () => new URLSearchParams(window.location.hash.split("?")[1] || "");
const readApp = () => params().get("app") || "";

const readOwner = () => { const n = Number(params().get("owner")); return Number.isInteger(n) && n > 0 ? n : 0; };

export default function ProApps() {
  const { user, token } = useAuth();
  const [id, setId] = useState(readApp);
  const [ownerId, setOwnerId] = useState(readOwner);
  useEffect(() => { const on = () => { setId(readApp()); setOwnerId(readOwner()); }; window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  // Opened from "Shared with me" (Linked profiles): show the owner's copy of the app, if it's still shared.
  const [shared, setShared] = useState<SharedOwner | null | "loading" | "denied">(ownerId ? "loading" : null);
  useEffect(() => {
    if (!ownerId || ownerId === Number(user?.id)) { setShared(null); return; }
    let live = true;
    setShared("loading");
    linksApi(token).list().then((r) => {
      if (!live) return;
      const link = r.withMe.find((l) => l.ownerId === ownerId && l.status === "active");
      const access = link?.grants[appShareId(id)];
      setShared(link && access ? { ownerId, ownerName: link.ownerName, access } : "denied");
    }).catch(() => live && setShared("denied"));
    return () => { live = false; };
  }, [ownerId, id, token, user?.id]);
  // Back goes where the app was opened from: the hub (WorkHub or LifeHub) that launched it, or
  // the apps list when it was picked there. The list is never an unexpected stop on the way back.
  const fromHub = params().get("hub");
  const hub = fromHub === "work" ? "#/workhub" : fromHub === "life" ? "#/lifehub" : user?.role === "teacher" ? "#/workhub" : "#/lifehub";
  const fromList = params().get("from") === "apps";
  const found = id ? proApp(id) : undefined;
  const meta = found && PRO_LIVE_GROUPS.includes(found.group) ? found : undefined;
  const App = id ? appComponent(id) : null;
  const hubQ = fromHub ? `&hub=${fromHub}` : "";
  const go = (next: string) => { window.location.hash = next ? `#/pro?app=${next}&from=apps${hubQ}` : `#/pro${fromHub ? `?hub=${fromHub}` : ""}`; window.scrollTo({ top: 0 }); };
  return <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-6 sm:py-6">
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        {meta && fromList ? <button type="button" onClick={() => go("")} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline"><ArrowLeft size={15} />All apps</button>
          : <a href={hub} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline"><ArrowLeft size={15} />Back to {hub === "#/workhub" ? "WorkHub" : "LifeHub"}</a>}
        {meta && fromList && <a href={hub} className="text-sm font-semibold text-slate-500 hover:underline">{hub === "#/workhub" ? "WorkHub" : "LifeHub"}</a>}
      </header>
      {meta && App ? <>
        <div className="flex items-center gap-3">
          <AppBadge icon={meta.icon} color={meta.color} size={48} />
          <div className="min-w-0"><h1 className="text-2xl font-black">{meta.name}</h1><p className="text-sm text-slate-500">{meta.tagline}</p></div>
        </div>
        {shared === "loading" ? <p className="py-10 text-center text-sm font-semibold text-slate-500">Opening the shared {meta.name}…</p>
          : shared === "denied" ? <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200" data-testid="shared-denied"><p className="font-bold">This isn't shared with you any more.</p><p className="mt-1 text-sm text-slate-500">Ask them to share it again from their Linked profiles.</p><a href="#/lifehub" className="mt-4 inline-flex text-sm font-bold text-indigo-700 hover:underline">Back to LifeHub</a></div>
          : <SharedOwnerContext.Provider value={shared}>
            {shared && <SharedBanner shared={shared} />}
            <Suspense fallback={<p className="py-10 text-center text-sm font-semibold text-slate-500">Opening {meta.name}…</p>}><div data-testid={`pro-app-${meta.id}`}><App key={shared ? `of${shared.ownerId}` : "mine"} /></div></Suspense>
          </SharedOwnerContext.Provider>}
      </> : <Gallery onOpen={go} />}
    </div>
  </main>;
}

/** Whose app this is, and whether you can change it. With View only, a try to change something flashes a reminder. */
function SharedBanner({ shared }: { shared: SharedOwner }) {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    let t = 0;
    const on = () => { setFlash(true); window.clearTimeout(t); t = window.setTimeout(() => setFlash(false), 2500); };
    window.addEventListener(READ_ONLY_EVENT, on);
    return () => { window.removeEventListener(READ_ONLY_EVENT, on); window.clearTimeout(t); };
  }, []);
  const edit = shared.access === "edit";
  return <div className={`sticky top-2 z-30 flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3 text-sm shadow-sm ring-1 transition ${flash ? "bg-amber-100 ring-amber-300" : edit ? "bg-emerald-50 ring-emerald-200" : "bg-sky-50 ring-sky-200"}`} data-testid="shared-banner">
    <Users size={16} className="shrink-0" />
    <span className="min-w-0 flex-1"><span className="font-bold">{shared.ownerName}'s</span> {edit ? "— shared with you. Changes you make save to their account." : "— shared with you to look at."}</span>
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${edit ? "bg-emerald-600 text-white" : "bg-sky-600 text-white"}`}>{edit ? <><Pencil size={12} /> Can edit</> : <><Eye size={12} /> View only</>}</span>
    {flash && <span className="w-full text-xs font-semibold text-amber-900">You can look, but not change this. Ask {shared.ownerName} for Edit access.</span>}
  </div>;
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{apps.map((a) => <button key={a.id} type="button" onClick={() => onOpen(a.id)} data-testid={`pro-open-${a.id}`} className="flex items-start gap-3 rounded-2xl bg-white p-3.5 text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
        <AppBadge icon={a.icon} color={a.color} />
        <span className="min-w-0"><span className="block font-black">{a.name}{a.ai && <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 align-middle text-[10px] font-bold text-violet-700">AI</span>}</span><span className="block text-xs text-slate-500">{a.tagline}</span></span>
      </button>)}</div>
    </section>)}
  </div>;
}
