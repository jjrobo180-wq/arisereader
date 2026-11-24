// The family page (#/family): a parent's view of their child's class, from every teacher who shares it,
// with messages to those teachers. A signed-in parent sees all their children; a family link
// (#/family?k=...) opens one child's page with no account at all. Server: server/classRecords.ts.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { requester } from "@/lib/records";
import { ChildRecords, type ChildView } from "@/components/records/ChildRecords";
import { LINK_RE } from "@shared/classRecords";

const SAVED = "family-link-token";
const readLink = (): string | null => {
  const q = window.location.hash.split("?")[1] || "";
  const k = new URLSearchParams(q).get("k");
  if (k && LINK_RE.test(k)) { try { localStorage.setItem(SAVED, k); } catch { /* private mode */ } return k; }
  try { const s = localStorage.getItem(SAVED); return s && LINK_RE.test(s) ? s : null; } catch { return null; }
};

type Kid = { id: number; name: string; first: string };

export default function FamilyPortal() {
  const { user, token } = useAuth();
  const [link, setLink] = useState<string | null>(() => readLink());
  const isParent = !!user && user.role === "parent";
  const req = useMemo(() => (link ? requester(null, link) : requester(token)), [link, token]);
  const [kids, setKids] = useState<Kid[] | null>(null);
  const [me, setMe] = useState<string>("");
  const [sid, setSid] = useState<number | null>(null);
  const [view, setView] = useState<ChildView | null>(null);
  const [err, setErr] = useState("");
  const can = !!link || isParent;

  useEffect(() => { document.title = "Family page"; }, []);
  useEffect(() => {
    if (!can) return;
    setKids(null); setErr("");
    req("/api/family/children").then((r) => { setKids(r.children); setMe(r.me?.name || ""); setSid((s) => (s && r.children.some((c: Kid) => c.id === s) ? s : r.children[0]?.id ?? null)); })
      .catch((e) => { setErr(e.message); if (link && e.status === 404) { try { localStorage.removeItem(SAVED); } catch { /* fine */ } } });
  }, [req, can, link]);
  const load = useCallback(async (quiet = false) => {
    if (!sid) return;
    if (!quiet) setView(null);
    try { setView(await req(`/api/family/child/${sid}`)); setErr(""); } catch (e: any) { if (!quiet) setErr(e.message); }
  }, [req, sid]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const id = window.setInterval(() => { if (document.visibilityState === "visible") void load(true); }, 45000); return () => window.clearInterval(id); }, [load]);

  const send = async (tid: number, body: string, name?: string) => {
    const r = await req(`/api/family/child/${sid}/messages/${tid}`, { method: "POST", body: { body, name } });
    setView((v) => v && { ...v, teachers: v.teachers.map((t) => (t.teacher.id === tid ? { ...t, messages: { messages: r.messages, unread: 0 } } : t)) });
  };
  const markRead = (tid: number) => {
    void req(`/api/family/child/${sid}/read/${tid}`, { method: "POST" }).catch(() => null);
    setView((v) => v && { ...v, teachers: v.teachers.map((t) => (t.teacher.id === tid && t.messages ? { ...t, messages: { ...t.messages, unread: 0 } } : t)) });
  };
  const forget = () => { try { localStorage.removeItem(SAVED); } catch { /* fine */ } setLink(null); window.location.hash = "#/family"; };

  return (
    <div className="min-h-[100dvh] bg-[#f7f7fb] text-slate-900 dark:bg-[#0f0e1a] dark:text-white" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header className="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-white/[.03]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-[#5b47d6]">Family page</p><h1 className="truncate text-lg font-bold">{view ? view.child.name : kids?.length === 1 ? kids[0].name : "Your child's class"}</h1></div>
          {link ? <button type="button" onClick={forget} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10">Forget link</button>
            : me ? <span className="text-sm text-slate-500">{me}</span> : null}
        </div>
        {kids && kids.length > 1 && <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-3" role="tablist" aria-label="Children">{kids.map((k) => (
          <button key={k.id} type="button" role="tab" aria-selected={sid === k.id} onClick={() => setSid(k.id)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${sid === k.id ? "bg-[#6e5ae0] text-white" : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-white/80"}`}>{k.first}</button>
        ))}</div>}
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">
        {!can ? <SignedOut signedIn={!!user} />
          : err && !view ? <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center" role="alert"><p className="font-semibold text-rose-800">{err}</p>{link && <button type="button" onClick={forget} className="mt-4 min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold">Forget this link</button>}</div>
          : kids && !kids.length ? <Empty title="No children linked yet" body="Add your child from your family hub, or ask their teacher for a family link." />
          : view ? <ChildRecords v={view} token={link ? null : token} link={link} send={send} markRead={markRead} needName={!!link} />
          : <p className="py-16 text-center text-sm text-slate-500" role="status">Loading…</p>}
        {link && view && <p className="mt-8 text-center text-xs text-slate-500">You're viewing with a private family link. Keep it to your family. Want notifications? <Link href="/parent-signup" className="font-semibold text-[#5b47d6]">Make a free parent account</Link>.</p>}
      </main>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-white/[.03]"><p className="text-lg font-bold">{title}</p><p className="mt-2 text-sm text-slate-500">{body}</p></div>;
}

function SignedOut({ signedIn }: { signedIn: boolean }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-white/10 dark:bg-white/[.03]">
    <p className="text-lg font-bold">{signedIn ? "This page is for families" : "See your child's class"}</p>
    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{signedIn ? "Teachers and staff can look students up in WorkHub, under Student wall." : "Open the family link your child's teacher sent you, or sign in with your parent account."}</p>
    {!signedIn && <div className="mt-5 flex justify-center gap-2"><Link href="/signin" className="inline-flex min-h-11 items-center rounded-xl bg-[#6e5ae0] px-5 text-sm font-semibold text-white">Sign in</Link><Link href="/parent-signup" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-5 text-sm font-semibold">Make an account</Link></div>}
  </div>;
}
