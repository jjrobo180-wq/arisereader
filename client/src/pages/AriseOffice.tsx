// A.R.I.S.E. Office: Sheets, Docs and Slides — full spreadsheet, word-processor and presentation
// apps whose files are saved to the person's account (server/userDocs.ts) and open on every device.
// The hubs open it at #/office?kind=sheet|doc|slides (App Store entries in shared/pluginStore.ts).
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import OfficeApp from "@/components/office/OfficeApp";
import { OFFICE_KINDS } from "@/components/office/officeKinds";
import type { DocKind } from "@/lib/cloudDocs";

const readKind = (): DocKind => { const k = new URLSearchParams(window.location.hash.split("?")[1] || "").get("kind"); return k === "doc" || k === "slides" ? k : "sheet"; };

export default function AriseOffice() {
  const { user } = useAuth();
  const [kind, setKindState] = useState<DocKind>(readKind);
  useEffect(() => { const on = () => setKindState(readKind()); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  const setKind = (k: DocKind) => { setKindState(k); const base = window.location.hash.split("?")[0] || "#/office"; window.history.replaceState(null, "", `${base}?kind=${k}`); };
  const hub = user?.role === "parent" ? "#/lifehub" : "#/workhub";
  return <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-900 sm:px-6 sm:py-6">
    <div className="mx-auto max-w-[1500px] space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <a href={hub} className="text-sm font-semibold text-indigo-700 hover:underline">← Back to my hub</a>
        <h1 className="mr-auto text-lg font-extrabold">A.R.I.S.E. Office</h1>
        <nav className="flex gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200" aria-label="Office apps">
          {(Object.keys(OFFICE_KINDS) as DocKind[]).map((k) => <button key={k} type="button" onClick={() => setKind(k)} aria-current={kind === k ? "page" : undefined} data-testid={`office-kind-${k}`}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${kind === k ? "text-white" : "text-slate-600 hover:bg-slate-100"}`} style={kind === k ? { background: OFFICE_KINDS[k].color } : undefined}>
            {OFFICE_KINDS[k].icon}<span className="hidden sm:inline">{OFFICE_KINDS[k].title}</span>
          </button>)}
        </nav>
      </header>
      <section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-5"><OfficeApp key={kind} config={OFFICE_KINDS[kind]} /></section>
    </div>
  </main>;
}
