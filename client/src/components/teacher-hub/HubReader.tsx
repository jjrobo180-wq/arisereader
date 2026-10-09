// Arise WorkHub's A.R.I.S.E. Reader group: links to every A.R.I.S.E. program and, for admins, the
// admin console (loaded only when opened). The teacher's Reader tabs are in HubReaderTools.
import { Suspense, lazy } from "react";
import { BookOpen, Calculator, CheckCheck, Landmark, Users } from "lucide-react";
import HubReaderScope from "@/components/HubReaderScope";

const Admin = lazy(() => import("@/pages/Admin"));

const PROGRAMS = [
  { href: "/#/library", label: "A.R.I.S.E. Reader", detail: "Library, quizzes and reading", icon: BookOpen, tint: "bg-violet-50 text-violet-700" },
  { href: "/math/", label: "Arise Math", detail: "Class add-on", icon: Calculator, tint: "bg-sky-50 text-sky-700" },
  { href: "/history/", label: "Arise History", detail: "Class add-on", icon: Landmark, tint: "bg-amber-50 text-amber-700" },
  { href: "/social/", label: "Arise Social", detail: "Class add-on", icon: Users, tint: "bg-pink-50 text-pink-700" },
  { href: "/#/lifehub", label: "Arise LifeHub", detail: "Your own lists and calendar", icon: CheckCheck, tint: "bg-emerald-50 text-emerald-700" },
];

function Loading({ what }: { what: string }) {
  return <div className="flex min-h-[40vh] items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white text-sm font-medium text-slate-600">
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" /> Opening {what}…
  </div>;
}

export function ProgramLinks({ hideLifeHub = false }: { hideLifeHub?: boolean }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="hub-programs">
    <h2 id="hub-programs" className="mb-3 text-sm font-semibold text-slate-500">Your A.R.I.S.E. programs</h2>
    <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-5">
      {PROGRAMS.filter((p) => !(hideLifeHub && p.href.endsWith("lifehub"))).map((p) => {
        const Icon = p.icon;
        return <a key={p.href} href={p.href} className="flex min-h-14 w-[11.5rem] shrink-0 snap-start items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50 sm:w-auto" data-testid={`hub-program-${p.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
          <span className={`rounded-lg p-2 ${p.tint}`}><Icon className="h-4 w-4" /></span>
          <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{p.label}</span><span className="block truncate text-xs text-slate-500">{p.detail}</span></span>
        </a>;
      })}
    </div>
  </section>;
}

export function AdminTab({ night = false }: { night?: boolean }) {
  return <HubReaderScope which="work" night={night}>
    <Suspense fallback={<Loading what="the admin console" />}><Admin embedded /></Suspense>
  </HubReaderScope>;
}
