// A.R.I.S.E. Office: Sheets, Docs and Slides — full spreadsheet, word-processor and presentation
// apps whose files are saved to the person's account (server/userDocs.ts) and open on every device.
// The hubs open it at #/office?kind=sheet|doc|slides (App Store entries in shared/pluginStore.ts).
import { hubNightClass } from "@/lib/hubNight";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import OfficeApp from "@/components/office/OfficeApp";
import { OFFICE_KINDS } from "@/components/office/officeKinds";
import type { DocKind } from "@/lib/cloudDocs";

const readKind = (): DocKind => { const k = new URLSearchParams(window.location.hash.split("?")[1] || "").get("kind"); return k === "doc" || k === "slides" || k === "design" ? k : "sheet"; };

export default function AriseOffice() {
  const { user } = useAuth();
  const [kind, setKindState] = useState<DocKind>(readKind);
  useEffect(() => { const on = () => setKindState(readKind()); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  const setKind = (k: DocKind) => { setKindState(k); const base = window.location.hash.split("?")[0] || "#/office"; window.history.replaceState(null, "", `${base}?kind=${k}`); };
  const hub = user?.role === "parent" ? "#/lifehub" : "#/workhub";
  const mainRef = useRef<HTMLElement>(null);
  // The iPhone app paints the clock strip with the page body's color (todo-app.css). The hub's body can be dark,
  // which left a black band over this light page: match the body to this page while it is open.
  useEffect(() => {
    const body = document.body, was = body.style.backgroundColor;
    const bg = mainRef.current ? getComputedStyle(mainRef.current).backgroundColor : "";
    if (bg) body.style.backgroundColor = bg;
    return () => { body.style.backgroundColor = was; };
  }, []);
  return <main ref={mainRef} className={`${hubNightClass()} min-h-screen bg-slate-50 px-4 pb-6 pt-3 text-slate-900 sm:px-6 sm:pt-6`}>
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <a href={hub} aria-label="Back to my hub" title="Back to my hub" data-testid="office-back"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 hover:text-slate-950">
          <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
        </a>
        <div className="mr-auto min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-slate-500">A.R.I.S.E.</p>
          <h1 className="text-xl font-extrabold leading-tight tracking-tight">Office</h1>
        </div>
        <nav className="grid w-full grid-cols-4 gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200 sm:flex sm:w-auto sm:rounded-full" aria-label="Office apps">
          {(Object.keys(OFFICE_KINDS) as DocKind[]).map((k) => <button key={k} type="button" onClick={() => setKind(k)} aria-current={kind === k ? "page" : undefined} data-testid={`office-kind-${k}`}
            className={`inline-flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-3 text-[11px] font-bold sm:min-h-9 sm:flex-row sm:gap-1.5 sm:rounded-full sm:text-sm ${kind === k ? "text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`} style={kind === k ? { background: OFFICE_KINDS[k].color } : undefined}>
            {OFFICE_KINDS[k].icon}<span>{OFFICE_KINDS[k].title}</span>
          </button>)}
        </nav>
      </header>
      <section className="sm:rounded-2xl sm:bg-white sm:p-5 sm:shadow-sm sm:ring-1 sm:ring-slate-200"><OfficeApp key={kind} config={OFFICE_KINDS[kind]} /></section>
    </div>
  </main>;
}
