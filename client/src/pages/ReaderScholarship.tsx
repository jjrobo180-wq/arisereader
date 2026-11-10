// A family, teacher or school asks for A.R.I.S.E. Reader free: a scholarship, or a grant or program
// that covers them. Public; the admin reads the applications in Admin, under Plans and billing.
import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";

const field = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-[15px] text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200";
const label = "block text-sm font-bold text-slate-800";

export default function ReaderScholarship() {
  const [, navigate] = useLocation();
  const [f, setF] = useState({ who: "family", name: "", email: "", username: "", school: "", students: "", program: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/reader-scholarship`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSent(true); else setError(data.message || "That didn't send. Please try again.");
    } catch { setError("That didn't send. Please check your connection and try again."); }
    setBusy(false);
  };

  return (
    <main className="min-h-screen bg-[#f7f8ff] px-4 pb-16 pt-6 text-[#191b35]" data-testid="reader-scholarship">
      <div className="mx-auto max-w-xl">
        <button onClick={() => navigate("/pricing")} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-slate-700 hover:bg-white"><ArrowLeft className="h-4 w-4" />Back to pricing</button>
        <section className="mt-3 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {sent ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h1 className="mt-4 text-2xl font-black">Thank you. We got it.</h1>
              <p className="mt-3 text-[15px] leading-7 text-slate-600">Every application is read by a person. We'll email you at <b>{f.email}</b>, usually within a few days.</p>
            </div>
          ) : (
            <form onSubmit={send}>
              <p className="text-xs font-black uppercase tracking-widest text-violet-600">Scholarships &amp; grants</p>
              <h1 className="mt-2 text-3xl font-black leading-tight">Apply for a free A.R.I.S.E. Reader account</h1>
              <p className="mt-3 text-[15px] leading-7 text-slate-600">No child should miss out on reading because of money. Tell us a little about you. If a grant, Title I, a nonprofit or another program covers you, say which one.</p>
              <div className="mt-6 space-y-4">
                <label className={label}>This is for
                  <select value={f.who} onChange={set("who")} className={field}><option value="family">My family</option><option value="teacher">My class (I'm a teacher)</option><option value="school">My whole school</option></select>
                </label>
                <label className={label}>Your name<input required value={f.name} onChange={set("name")} className={field} autoComplete="name" /></label>
                <label className={label}>Email<input required type="email" value={f.email} onChange={set("email")} className={field} autoComplete="email" /></label>
                <label className={label}>A.R.I.S.E. username <span className="font-normal text-slate-500">(if you have one)</span><input value={f.username} onChange={set("username")} className={field} autoComplete="username" /></label>
                {f.who !== "family" && <>
                  <label className={label}>School<input value={f.school} onChange={set("school")} className={field} /></label>
                  <label className={label}>How many students?<input inputMode="numeric" value={f.students} onChange={set("students")} className={field} /></label>
                </>}
                <label className={label}>Grant, scholarship or program <span className="font-normal text-slate-500">(optional)</span><input value={f.program} onChange={set("program")} placeholder="Title I, a nonprofit, a district grant…" className={field} /></label>
                <label className={label}>Why are you asking?<textarea required minLength={20} rows={5} value={f.reason} onChange={set("reason")} className={field} placeholder="A few sentences is plenty." /></label>
              </div>
              {error && <p className="mt-4 text-sm font-semibold text-rose-700" role="alert">{error}</p>}
              <button type="submit" disabled={busy} className="mt-6 w-full rounded-xl bg-violet-700 px-5 py-3.5 font-bold text-white disabled:opacity-60" data-testid="scholarship-send">{busy ? "Sending…" : "Send my application"}</button>
              <p className="mt-3 text-center text-xs text-slate-500">We only use this to decide on your application. It's never sold or shared.</p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
