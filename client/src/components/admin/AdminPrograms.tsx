// Admin > Settings > Arise programs: every A.R.I.S.E. program in one place, open to the admin
// at no charge, always. The server checks each one the same way the program itself does, so a
// row only says "Free for you" when the admin really can get in.
import { useEffect, useState } from "react";
import { BookOpen, Calculator, CheckSquare, ClipboardList, ExternalLink, Landmark, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { sessionToken } from "@/lib/notifications";
import { AdminSection, StatusPill } from "./AdminUi";

type Program = { id: string; name: string; access: boolean };

const DETAILS: Record<string, { icon: LucideIcon; about: string; href: string }> = {
  reader: { icon: BookOpen, about: "The library, quizzes, live class games and the teacher dashboard.", href: "/#/teacher-dashboard" },
  hub: { icon: ClipboardList, about: "Caseloads, IEP timelines, lessons, minutes and notes.", href: "/#/teacher-hub" },
  todo: { icon: CheckSquare, about: "Lists, the calendar, chores, polls, trips and notes.", href: "/#/to-do" },
  math: { icon: Calculator, about: "Math practice that levels up, with points and a leaderboard.", href: "/math/" },
  history: { icon: Landmark, about: "History Reads and quizzes with points and a leaderboard.", href: "/history/" },
  social: { icon: Users, about: "Career paths to explore, with posts teachers approve.", href: "/social/" },
};

export default function AdminPrograms({ token }: { token: string | null }) {
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch(`${API_BASE}/api/admin/programs`, { headers: { Authorization: `Bearer ${token || sessionToken()}` }, cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(body.programs)) throw new Error(body.message || "Could not check your programs.");
        if (live) setPrograms(body.programs);
      })
      .catch((e: any) => { if (live) setError(e?.message || "Could not check your programs."); });
    return () => { live = false; };
  }, [token]);

  const locked = (programs || []).filter((p) => !p.access);

  return (
    <AdminSection id="programs" icon={ShieldCheck} tone="emerald" title="Your Arise programs"
      description="As the admin you have every A.R.I.S.E. program at no charge, always. No plan, trial or card is needed, and nothing here runs out.">
      {error && <p className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200" role="alert">{error}</p>}
      {!error && !programs && <p className="text-sm text-muted-foreground" role="status">Checking your programs…</p>}
      {locked.length > 0 && (
        <p className="mb-3 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
          {locked.map((p) => p.name).join(", ")} {locked.length === 1 ? "is" : "are"} not opening for this account. That is a fault, not a bill: nothing needs to be paid.
        </p>
      )}
      {programs && (
        <ul className="divide-y divide-border/60" data-testid="admin-programs">
          {programs.map((p) => {
            const d = DETAILS[p.id];
            const Icon = d?.icon ?? ShieldCheck;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0" data-testid={`admin-program-${p.id}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><Icon className="h-[18px] w-[18px]" /></span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    <span className="[overflow-wrap:anywhere]">{p.name}</span>
                    <StatusPill tone={p.access ? "emerald" : "red"}>{p.access ? "Free for you, always" : "Not opening"}</StatusPill>
                  </p>
                  {d && <p className="mt-0.5 text-xs text-muted-foreground">{d.about}</p>}
                </div>
                {d && (
                  <a href={d.href} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-muted">
                    Open <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AdminSection>
  );
}
