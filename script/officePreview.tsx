// A preview of Arise Office (Sheets, Docs, Slides) for the office-shots workflow: the real home screen and
// editors, in a stand-in hub layout (sidebar, padding) like Arise To Duo and Arise Notes, with the server
// answered here in the browser so no account is needed. Not part of any app.
//   ?kind=doc|sheet|slides  &open=1 (opens a sample file straight away)
import { createRoot } from "react-dom/client";
import { AuthProvider } from "@/context/AuthContext";
import OfficeApp from "@/components/office/OfficeApp";
import { OFFICE_KINDS } from "@/components/office/officeKinds";
import LinkedProfiles, { LinkSomeoneModal } from "@/components/family-hub/LinkedProfiles";
import { emptyFamily } from "@shared/familyHub";

const q = new URLSearchParams(location.search);
const kind = (["sheet", "slides", "design"].includes(q.get("kind") || "") ? q.get("kind") : "doc") as keyof typeof OFFICE_KINDS;
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
  // The Sharing page (?screen=sharing): someone already in an Accountability space, an invite waiting, a link.
  if (/\/api\/profile-links(\?|$)/.test(url)) return json({ mine: [{ id: "l1aaaaaa", email: "grandma@example.com", nickname: "Grandma", status: "pending", grants: { "app:potty": "view", "life:calendar": "view" }, viewerName: "", viewerId: null }], withMe: [], myEmail: "me@example.com", requests: [] });
  if (/\/api\/accountability(\?|$)/.test(url)) return json({ me: 1, spaces: [{ id: "s1", name: "Our family", code: "ABC123", createdBy: 1, members: [{ userId: 1, name: "Jermaine", role: "owner", tz: "" }, { userId: 2, name: "Vanessa", role: "member", tz: "" }] }], tasks: [], checkins: [] });
  if (/\/api\/arise-todo\/shares/.test(url)) return json({ shares: [{ token: "t1", target: "calendar", label: "Family calendar", url: "https://example.com/s/t1", createdAt: "2026-10-24T12:00:00Z" }], guestVotes: {} });
  return json({});
};
try { if (q.get("open") === "1") sessionStorage.setItem(`arise-office-open:${config.kind}`, "sample-1"); else sessionStorage.removeItem(`arise-office-open:${config.kind}`); } catch { /* fine */ }

// ?screen=link: Arise To Duo's "Add someone" screen instead; ?screen=sharing: the Sharing page itself.
if (q.get("screen") === "sharing") {
  createRoot(document.getElementById("root")!).render(<AuthProvider><div className="min-h-screen bg-slate-50 p-4"><LinkedProfiles family={emptyFamily()} say={() => {}} {...({} as any)} /></div></AuthProvider>);
} else if (q.get("screen") === "link") {
  createRoot(document.getElementById("root")!).render(<AuthProvider><div className="min-h-screen bg-slate-100" /><LinkSomeoneModal family={emptyFamily()} say={() => {}} onClose={() => {}} title={q.get("title") || "Link someone"} /></AuthProvider>);
} else createRoot(document.getElementById("root")!).render(<AuthProvider>
  <div className="flex min-h-screen bg-slate-100">
    <aside className="hidden w-60 shrink-0 bg-[#1e1b4b] p-4 text-sm font-bold text-white/80 md:block">Arise To Duo<br /><br />Tasks<br />Calendar<br />{config.title}</aside>
    <main className="min-w-0 flex-1 p-3 sm:p-6"><section className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:p-5"><OfficeApp config={config} /></section></main>
  </div>
</AuthProvider>);
