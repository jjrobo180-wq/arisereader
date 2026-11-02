import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { advisoriesForSchool, advisoryName } from "@shared/advisories";
import { HELP_EMAIL_HINT, HELP_ISSUE_MAX, HELP_TICKET_GRADES } from "@shared/helpTicket";

/**
 * "Still stuck?" on the sign-in screens: a message to the admin that doesn't need an account.
 * It asks for the student's name, school, grade, advisory and the problem, and an optional email for
 * answers outside school hours. The rules and wording are in shared/helpTicket.ts.
 */
const NOT_LISTED = "__not_listed__";
const NOT_SURE = "Not sure";

export default function HelpTicketForm({ dark = false, onBack }: { dark?: boolean; onBack: () => void }) {
  const [schools, setSchools] = useState<string[]>([]);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [schoolPick, setSchoolPick] = useState("");
  const [schoolTyped, setSchoolTyped] = useState("");
  const [grade, setGrade] = useState("");
  const [advisory, setAdvisory] = useState("");
  const [issue, setIssue] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // Hidden from people; only spam tools fill it in.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/schools`).then((r) => r.json())
      .then((d) => setSchools(Array.isArray(d) ? d.map((s: any) => String(s.name)).sort((a, b) => a.localeCompare(b)) : []))
      .catch(() => {});
  }, []);

  const school = schoolPick === NOT_LISTED ? schoolTyped : schoolPick;
  const known = useMemo(() => advisoriesForSchool(schoolPick === NOT_LISTED ? "" : schoolPick), [schoolPick]);
  const grades = useMemo(() => {
    const here = known.map((a) => a.grade).filter(Boolean) as string[];
    return here.length ? HELP_TICKET_GRADES.filter((g) => here.includes(g)) : HELP_TICKET_GRADES;
  }, [known]);
  const advisories = useMemo(() => known.filter((a) => !grade || a.grade === grade).map(advisoryName), [known, grade]);

  const pickSchool = (value: string) => { setSchoolPick(value); setGrade(""); setAdvisory(""); };
  const pickGrade = (value: string) => { setGrade(value); if (known.length) setAdvisory(""); };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/auth/help-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: first, lastName: last, school, grade, advisory, issue, email, website }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setSent(d.message || "Your message was sent.");
      else setError(d.message || "Your message didn't send. Try again, or ask a teacher to help you.");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const link = dark ? "text-violet-300 hover:text-white" : "text-[#5b53df] hover:text-[#4941cb]";
  const box = dark ? "border-white/10 bg-white/5 text-slate-200" : "border-[#e3e6f0] bg-[#f8f8fd] text-[#3b4256]";
  const field = `w-full rounded-lg border px-3 text-base outline-none ${dark ? "border-white/10 bg-[#0f0d1d] text-white" : "border-[#dfe3f1] bg-white text-[#17213b] focus:border-[#665ae6]"}`;
  const input = `h-11 ${field}`;

  if (sent) return (
    <div className={`mt-4 space-y-3 rounded-xl border p-4 text-sm ${box}`}>
      <div role="status" className="rounded-lg bg-emerald-50 p-2.5 font-semibold text-emerald-800">{sent}</div>
      <button type="button" onClick={onBack} className={`h-10 w-full rounded-lg px-3 font-bold ${link}`}>Back to sign in</button>
    </div>
  );

  return (
    <form onSubmit={send} className={`mt-4 space-y-3 rounded-xl border p-4 text-sm ${box}`}>
      <div>
        <p className="font-bold">Message the admin</p>
        <p className="mt-1 text-xs font-semibold opacity-80">You don't need an account. Please don't type your password here.</p>
      </div>
      <div className="flex gap-2">
        <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" aria-label="First name" autoComplete="given-name" maxLength={60} required className={input} />
        <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" aria-label="Last name" autoComplete="family-name" maxLength={60} required className={input} />
      </div>
      <select value={schoolPick} onChange={(e) => pickSchool(e.target.value)} aria-label="Your school" required className={input}>
        <option value="">Pick your school</option>
        {schools.map((name) => <option key={name} value={name}>{name}</option>)}
        <option value={NOT_LISTED}>My school isn't listed</option>
      </select>
      {schoolPick === NOT_LISTED && <input value={schoolTyped} onChange={(e) => setSchoolTyped(e.target.value)} placeholder="Your school's name" aria-label="Your school's name" maxLength={160} required className={input} />}
      <select value={grade} onChange={(e) => pickGrade(e.target.value)} aria-label="Your grade" required className={input}>
        <option value="">Pick your grade</option>
        {grades.map((g) => <option key={g} value={g}>{g === "K" ? "Kindergarten" : `Grade ${g}`}</option>)}
      </select>
      {known.length > 0
        ? <select value={advisory} onChange={(e) => setAdvisory(e.target.value)} aria-label="Your advisory" required disabled={!grade} className={`${input} disabled:opacity-60`}>
            <option value="">{grade ? "Pick your advisory" : "Pick your grade first"}</option>
            {advisories.map((name) => <option key={name} value={name}>{name}</option>)}
            <option value={NOT_SURE}>{NOT_SURE}</option>
          </select>
        : <input value={advisory} onChange={(e) => setAdvisory(e.target.value)} placeholder="Your advisory" aria-label="Your advisory" maxLength={120} required className={input} />}
      <textarea value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="What's the problem?" aria-label="What's the problem?" rows={4} maxLength={HELP_ISSUE_MAX} required className={`${field} py-2`} />
      <div>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" aria-label="Email (optional)" aria-describedby="help-ticket-email-hint" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} className={input} />
        <p id="help-ticket-email-hint" className="mt-1.5 text-xs font-semibold opacity-80">{HELP_EMAIL_HINT}</p>
      </div>
      <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-px w-px opacity-0" />
      {error && <div role="alert" className="rounded-lg bg-red-50 p-2.5 font-semibold text-red-700">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="h-10 flex-1 rounded-lg bg-[#5b53df] px-4 font-black text-white hover:bg-[#4941cb] disabled:opacity-60">{busy ? "Sending…" : "Send message"}</button>
        <button type="button" onClick={onBack} className={`h-10 rounded-lg px-3 font-bold ${link}`}>Back</button>
      </div>
    </form>
  );
}
