// Shared launch tiles: the Office editors and AI tools should be visible in
// both hubs even when someone has customized or hidden the menu.
import { FileText, Presentation, Sheet, Sparkles, ArrowUpRight } from "lucide-react";

const APPS = [
  { title: "Sheets", description: "Spreadsheets and formulas", href: "#/office?kind=sheet", icon: Sheet, tint: "bg-emerald-50 text-emerald-700", test: "office-launch-sheets" },
  { title: "Docs", description: "Write and save documents", href: "#/office?kind=doc", icon: FileText, tint: "bg-sky-50 text-sky-700", test: "office-launch-docs" },
  { title: "Slides", description: "Create presentations", href: "#/office?kind=slides", icon: Presentation, tint: "bg-amber-50 text-amber-700", test: "office-launch-slides" },
  { title: "AI Apps", description: "20 work, teaching and life tools", href: "#/ai-apps", icon: Sparkles, tint: "bg-violet-50 text-violet-700", test: "office-launch-ai" },
] as const;

export default function OfficeLaunchpad() {
  return <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="A.R.I.S.E. Office and AI Apps" data-testid="office-launchpad">
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-lg font-extrabold text-slate-900">A.R.I.S.E. Office & AI Apps</h2>
      <span className="text-xs font-medium text-slate-500">Save your work to your account</span>
    </div>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {APPS.map(({ title, description, href, icon: Icon, tint, test }) =>
        <a key={title} href={href} data-testid={test} className="group flex min-w-0 flex-col items-start gap-2 rounded-xl border border-slate-200 px-3 py-3 transition hover:border-indigo-300 hover:bg-indigo-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 sm:p-4">
          <span className={"flex h-10 w-10 items-center justify-center rounded-xl " + tint}><Icon className="h-5 w-5" aria-hidden="true" /></span>
          <span className="flex w-full items-center justify-between gap-1 text-sm font-bold text-slate-900">{title}<ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-indigo-700" aria-hidden="true"/></span>
          <span className="text-xs leading-5 text-slate-600">{description}</span>
        </a>
      )}
    </div>
  </section>;
}
