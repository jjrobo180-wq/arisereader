import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/queryClient";

/**
 * "Forgot username?" and "Forgot password?" on the sign-in screens.
 * Students: pick your school, then your student ID number (or first and last name). The username
 * is shown right away; a forgotten password goes to the teacher, who gives a new one.
 * Anyone with an email on their account: we email the username(s) and a link to choose a new password.
 */
type Mode = "username" | "password";
type School = { id: number; name: string };

export default function ForgotSignIn({ dark = false }: { dark?: boolean }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [byEmail, setByEmail] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [how, setHow] = useState<"id" | "name" | "username">("id");
  const [num, setNum] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string; username?: string } | null>(null);

  useEffect(() => {
    if (!mode || schools.length) return;
    fetch(`${API_BASE}/api/schools`).then((r) => r.json()).then((d) => setSchools(Array.isArray(d) ? d.map((s: any) => ({ id: s.id, name: s.name })).sort((a: School, b: School) => a.name.localeCompare(b.name)) : [])).catch(() => {});
  }, [mode, schools.length]);

  const post = async (path: string, body: unknown) => {
    setBusy(true); setNote(null);
    try {
      const r = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      return { ok: r.ok, d };
    } catch { return { ok: false, d: { message: "We couldn't reach the server. Check your connection and try again." } }; }
    finally { setBusy(false); }
  };
  const who = () => (how === "username" ? { username } : { schoolId: Number(schoolId), ...(how === "id" ? { studentNumber: num } : { firstName: first, lastName: last }) });
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (byEmail) {
      const { ok, d } = await post("/api/auth/forgot", { email });
      return setNote({ ok, text: d.message || (ok ? "Check your email." : "Something went wrong. Please try again.") });
    }
    if (how !== "username" && !schoolId) return setNote({ ok: false, text: "Pick your school first." });
    if (mode === "username") {
      const { ok, d } = await post("/api/auth/student/find-username", who());
      setNote(ok ? { ok: true, text: `${d.firstName ? `${d.firstName}, your` : "Your"} username is`, username: d.username } : { ok: false, text: d.message || "We couldn't find your account." });
    } else {
      const { ok, d } = await post("/api/auth/student/password-help", who());
      setNote({ ok, text: d.message || (ok ? "We told your teacher." : "We couldn't find your account.") });
    }
  };
  const close = () => { setMode(null); setNote(null); setByEmail(false); };

  const link = dark ? "text-violet-300 hover:text-white" : "text-[#5b53df] hover:text-[#4941cb]";
  const box = dark ? "border-white/10 bg-white/5 text-slate-200" : "border-[#e3e6f0] bg-[#f8f8fd] text-[#3b4256]";
  const input = `h-11 w-full rounded-lg border px-3 text-base outline-none ${dark ? "border-white/10 bg-[#0f0d1d] text-white" : "border-[#dfe3f1] bg-white text-[#17213b] focus:border-[#665ae6]"}`;
  const chip = (on: boolean) => `min-h-9 flex-1 rounded-lg px-2 text-xs font-black ${on ? "bg-[#5b53df] text-white" : dark ? "bg-white/10 text-slate-200" : "bg-white text-[#3b4256] ring-1 ring-[#dfe3f1]"}`;

  if (!mode) return (
    <div className="mt-3 flex items-center justify-center gap-4 text-sm font-bold">
      <button type="button" onClick={() => setMode("username")} className={`min-h-10 underline-offset-2 hover:underline ${link}`}>Forgot username?</button>
      <span className="opacity-40" aria-hidden>·</span>
      <button type="button" onClick={() => setMode("password")} className={`min-h-10 underline-offset-2 hover:underline ${link}`}>Forgot password?</button>
    </div>
  );
  return (
    <form onSubmit={send} className={`mt-4 space-y-3 rounded-xl border p-4 text-sm ${box}`}>
      <div className="flex gap-2">
        <button type="button" onClick={() => { setMode("username"); setNote(null); }} className={chip(mode === "username")}>Forgot username</button>
        <button type="button" onClick={() => { setMode("password"); setNote(null); }} className={chip(mode === "password")}>Forgot password</button>
      </div>
      {byEmail ? <>
        <p className="font-bold">We'll email your username and a link to choose a new password.</p>
        <input type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email on your account" aria-label="Email on your account" className={input} />
      </> : <>
        <p className="font-bold">{mode === "username" ? "Find your username" : "Ask your teacher for a new password"}</p>
        {how !== "username" && <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} aria-label="Your school" className={input}>
          <option value="">Pick your school</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>}
        <div className="flex gap-2">
          <button type="button" onClick={() => setHow("id")} className={chip(how === "id")}>Student ID</button>
          <button type="button" onClick={() => setHow("name")} className={chip(how === "name")}>My name</button>
          {mode === "password" && <button type="button" onClick={() => setHow("username")} className={chip(how === "username")}>Username</button>}
        </div>
        {how === "id" && <input inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="Your student ID number" aria-label="Your student ID number" required className={input} />}
        {how === "name" && <div className="flex gap-2"><input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" aria-label="First name" required className={input} /><input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" aria-label="Last name" required className={input} /></div>}
        {how === "username" && <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your username" aria-label="Your username" autoCapitalize="none" spellCheck={false} required className={input} />}
      </>}
      {note && <div role="status" className={`rounded-lg p-2.5 font-semibold ${note.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
        {note.text}{note.username && <span className="mt-1 block select-all text-xl font-black tracking-wide text-emerald-900">{note.username}</span>}
        {note.username && <span className="mt-1 block text-xs font-semibold">Use it to sign in. Don't make a new account.</span>}
      </div>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="h-10 flex-1 rounded-lg bg-[#5b53df] px-4 font-black text-white hover:bg-[#4941cb] disabled:opacity-60">{busy ? "Checking…" : byEmail ? "Email me" : mode === "username" ? "Show my username" : "Tell my teacher"}</button>
        <button type="button" onClick={close} className={`h-10 rounded-lg px-3 font-bold ${link}`}>Cancel</button>
      </div>
      <button type="button" onClick={() => { setByEmail(!byEmail); setNote(null); }} className={`text-xs font-bold underline ${link}`}>{byEmail ? "I'm a student without an email" : "Have an email on your account? Use it instead"}</button>
    </form>
  );
}
