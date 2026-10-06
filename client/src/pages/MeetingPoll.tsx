// The page someone opens from the "which times work?" email. No account needed:
// the private link in the email is what identifies them.
import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { CalendarCheck, CheckCircle2, Loader2, MapPin } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";

type Answer = "yes" | "maybe" | "no";
type Poll = {
  title: string; location: string; message: string; guest: string; status: "open" | "booked";
  options: { id: string; label: string }[]; chosen: string | null; answers: Record<string, Answer>; comment: string; answered: boolean;
};

const CHOICES: { value: Answer; label: string; on: string }[] = [
  { value: "yes", label: "Works", on: "border-emerald-600 bg-emerald-600 text-white" },
  { value: "maybe", label: "Maybe", on: "border-amber-500 bg-amber-500 text-white" },
  { value: "no", label: "Can't", on: "border-rose-600 bg-rose-600 text-white" },
];

export default function MeetingPoll() {
  const [, params] = useRoute("/meet/:token");
  const token = params?.token || "";
  const [poll, setPoll] = useState<Poll | null>(null);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/meeting-poll/${encodeURIComponent(token)}`);
        const data = await response.json().catch(() => ({}));
        if (!live) return;
        if (!response.ok) return setError(data.message || "This link is not working.");
        setPoll(data); setAnswers(data.answers || {}); setComment(data.comment || ""); setDone(false);
      } catch { if (live) setError("Could not reach the site. Check your internet and try again."); }
    })();
    return () => { live = false; };
  }, [token]);

  async function send() {
    setSaving(true); setError("");
    try {
      const response = await fetch(`${API_BASE}/api/meeting-poll/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, comment }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) setError(data.message || "Could not save your answers.");
      else setDone(true);
    } catch { setError("Could not reach the site. Check your internet and try again."); }
    finally { setSaving(false); }
  }

  const answered = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900" data-testid="meeting-poll">
      <div className="mx-auto max-w-xl">
        <div className="mb-4 text-center text-sm font-semibold tracking-wide text-slate-500">A.R.I.S.E. Reader</div>
        {!poll && !error && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>}
        {!poll && error && <div role="alert" className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">{error}</div>}

        {poll && (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h1 className="text-xl font-bold leading-snug sm:text-2xl">{poll.title}</h1>
            {poll.location && <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><MapPin className="h-4 w-4 shrink-0" />{poll.location}</p>}
            {poll.message && <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">{poll.message}</p>}

            {poll.status === "booked" ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" data-testid="poll-booked">
                <div className="flex items-center gap-2 font-semibold text-emerald-800"><CalendarCheck className="h-5 w-5" /> The time is set</div>
                <div className="mt-1 text-lg font-bold text-emerald-900">{poll.chosen}</div>
                <p className="mt-2 text-sm text-emerald-800">Thank you. If this time doesn't work, reply to the email you got to reach the teacher.</p>
              </div>
            ) : done ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center" data-testid="poll-thanks">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                <div className="mt-2 text-lg font-bold text-emerald-900">Thank you, {poll.guest}!</div>
                <p className="mt-1 text-sm text-emerald-800">Your answers were sent. You'll get an email when the time is set.</p>
                <button type="button" onClick={() => setDone(false)} className="mt-3 min-h-11 text-sm font-medium text-emerald-900 underline underline-offset-4">Change my answers</button>
              </div>
            ) : (
              <>
                <p className="mt-5 text-sm font-medium text-slate-700">Hi {poll.guest}. Tap an answer for each time.</p>
                <div className="mt-3 space-y-3">
                  {poll.options.map((option) => (
                    <fieldset key={option.id} className="rounded-2xl border border-slate-200 p-3">
                      <legend className="px-1 text-sm font-semibold">{option.label}</legend>
                      <div className="mt-1 grid grid-cols-3 gap-2">
                        {CHOICES.map((choice) => (
                          <button
                            key={choice.value} type="button" aria-pressed={answers[option.id] === choice.value}
                            onClick={() => setAnswers((prev) => ({ ...prev, [option.id]: choice.value }))}
                            className={`min-h-12 rounded-xl border text-sm font-semibold transition ${answers[option.id] === choice.value ? choice.on : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                          >{choice.label}</button>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
                <label className="mt-4 block text-sm font-medium text-slate-700">Anything we should know? (optional)
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={400} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus:border-slate-400 sm:text-sm" placeholder="For example: I can only stay until 4:00." />
                </label>
                {error && <div role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
                <button type="button" onClick={send} disabled={saving || !answered} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Send my answers
                </button>
                {!answered && <p className="mt-2 text-center text-xs text-slate-500">Pick an answer for at least one time.</p>}
              </>
            )}
          </div>
        )}
        <p className="mt-4 text-center text-xs text-slate-400">This page is private to you. Please don't share the link.</p>
      </div>
    </div>
  );
}
