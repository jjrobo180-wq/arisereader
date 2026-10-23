// What we know about an AI quiz's book before it's approved: the real book it was matched to (or
// that it wasn't), the risks (shared/bookMatch.ts quizRiskFlags), and the web pages the AI used.
// When there's a serious risk, approving needs the "I checked these against the book" box ticked.
import { AlertTriangle, BookCheck, ExternalLink } from "lucide-react";
import { quizRiskFlags, type QuizVerification } from "@shared/bookMatch";

export function parseVerification(raw: unknown): QuizVerification | null {
  let v: any = raw;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = null; } }
  return v && typeof v === "object" && v.typed ? (v as QuizVerification) : null;
}

/** True when the quiz shouldn't be approved without someone checking it against the book. */
export function needsBookCheck(raw: unknown, quizType?: string): boolean {
  if (quizType && quizType !== "book") return false;
  return quizRiskFlags(parseVerification(raw)).some((f) => f.level === "high") || !parseVerification(raw);
}

export default function QuizCheckPanel({ verification, quizType, checked, onChecked }: {
  verification: unknown; quizType?: string; checked: boolean; onChecked: (v: boolean) => void;
}) {
  if (quizType && quizType !== "book") return null;
  const v = parseVerification(verification);
  const flags = quizRiskFlags(v);
  const mustCheck = needsBookCheck(verification, quizType);
  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-sm" data-testid="quiz-check-panel">
      {v?.book && (v.match === "exact" || v.match === "picked") && (
        <div className="flex items-start gap-2 text-emerald-800">
          <BookCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Real book: <b>{v.book.title}</b> by {v.book.author}
            {v.match === "picked" && v.typed.title.toLowerCase() !== v.book.title.toLowerCase() ? <span className="text-slate-600"> (the student typed "{v.typed.title}" and picked this from "Did you mean")</span> : null}
          </span>
        </div>
      )}
      {flags.map((f, i) => (
        <div key={i} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${f.level === "high" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{f.text}</span>
        </div>
      ))}
      {v?.sources?.length ? (
        <div className="text-slate-600">
          <span className="font-semibold text-slate-800">Sources the AI used:</span>{" "}
          {v.sources.slice(0, 6).map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline decoration-slate-300 underline-offset-2 hover:text-slate-900">
              {host(u)}<ExternalLink className="h-3 w-3" />{i < Math.min(5, v.sources.length - 1) ? <span className="mr-1">,</span> : null}
            </a>
          ))}
        </div>
      ) : null}
      {mustCheck && (
        <label className="flex min-h-11 items-start gap-2 rounded-lg bg-slate-50 p-2 font-medium text-slate-800">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={checked} onChange={(e) => onChecked(e.target.checked)} data-testid="quiz-check-confirm" />
          <span>I checked these questions and answers against the book. Students will be graded on them.</span>
        </label>
      )}
    </div>
  );
}
