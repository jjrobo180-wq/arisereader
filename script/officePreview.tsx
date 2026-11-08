// A preview of Arise Office (Sheets, Docs, Slides) for the office-shots workflow: the real home screen and
// editors, in a stand-in hub layout (sidebar, padding) like Arise To Duo and Arise Notes, with the server
// answered here in the browser so no account is needed. Not part of any app.
//   ?kind=doc|sheet|slides  &open=1 (opens a sample file straight away)
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@/context/AuthContext";
import OfficeApp from "@/components/office/OfficeApp";
import { OFFICE_KINDS } from "@/components/office/officeKinds";

const q = new URLSearchParams(location.search);
const kind = (q.get("kind") === "sheet" || q.get("kind") === "slides" ? q.get("kind") : "doc") as keyof typeof OFFICE_KINDS;
const config = OFFICE_KINDS[kind];
const tpl = config.templates[0];
const now = new Date().toISOString();
const entry = { id: "sample-1", kind: config.kind, name: tpl?.name || `Sample ${config.noun}`, size: 2048, starred: false, createdAt: now, updatedAt: now, trashedAt: null };
const content = tpl ? tpl.make() : config.blank();
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "Content-Type": "application/json" } });
const real = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.includes("/api/")) return real(input as any, init);
  const method = (init?.method || "GET").toUpperCase();
  if (/\/api\/docs\/sample-1$/.test(url)) return method === "GET" ? json({ ...entry, content }) : json({ doc: { ...entry, updatedAt: new Date().toISOString() } });
  if (/\/api\/docs(\?|$)/.test(url)) return json({ docs: [entry] });
  return json({});
};
try { if (q.get("open") === "1") sessionStorage.setItem(`arise-office-open:${config.kind}`, "sample-1"); else sessionStorage.removeItem(`arise-office-open:${config.kind}`); } catch { /* fine */ }

createRoot(document.getElementById("root")!).render(<AuthProvider>
  <div className="flex min-h-screen bg-slate-100">
    <aside className="hidden w-60 shrink-0 bg-[#1e1b4b] p-4 text-sm font-bold text-white/80 md:block">Arise To Duo<br /><br />Tasks<br />Calendar<br />{config.title}</aside>
    <main className="min-w-0 flex-1 p-3 sm:p-6"><section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-5"><OfficeApp config={config} /></section></main>
  </div>
</AuthProvider>);
