// Public test drive of the IEP Writer: /#/try/iep-writer. No account needed.
// Everything stays in this browser only (localStorage) — nothing is sent to the server,
// so testers can't see each other's work and no real student data is stored by A.R.I.S.E.
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { emptyWorkspace, type Workspace } from "@shared/teacherHub";
import IepWriter from "@/components/teacher-hub/HubIepWriter";

const KEY = "arise_try_iep_writer_v1";

function load(): Workspace {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyWorkspace(), ...JSON.parse(raw) };
  } catch { /* private window or blocked storage: start fresh */ }
  return emptyWorkspace();
}

const makeId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export default function TryIepWriter() {
  const [workspace, setWs] = useState<Workspace>(load);
  const [round, setRound] = useState(0);
  const setWorkspace = (change: (p: Workspace) => Workspace) => setWs((p) => change(p));

  useEffect(() => {
    document.title = "Try the IEP Writer | A.R.I.S.E.";
    const robots = document.createElement("meta");
    robots.name = "robots"; robots.content = "noindex";
    document.head.appendChild(robots);
    return () => { robots.remove(); };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ iepDrafts: workspace.iepDrafts || [], profile: workspace.profile })); } catch { /* ignore */ }
  }, [workspace]);

  const startOver = () => {
    if (!window.confirm("Clear this test IEP and start over?")) return;
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    setWs(emptyWorkspace());
    setRound((r) => r + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="try-iep-writer">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <b className="block text-lg text-slate-900">IEP Writer · test drive</b>
            <span className="block text-sm text-slate-600">From A.R.I.S.E. WorkHub. No account needed.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={startOver} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RotateCcw className="h-4 w-4" /> Start over</button>
            <Link href="/teacher-signup" className="inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white">Get the full Teacher Hub</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        <p className="flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Please use a <b>made-up student</b> while testing. Your draft is saved only in this browser and is never sent to A.R.I.S.E.</span>
        </p>
        <div key={round} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <IepWriter workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} student={workspace.iepDrafts?.[0]?.student || ""} />
        </div>
      </main>
    </div>
  );
}
