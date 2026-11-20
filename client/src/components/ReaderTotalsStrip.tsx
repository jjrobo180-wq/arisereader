// The sign-in screen's all-time counter: every quiz taken and every point earned on Arise Reader.
import { CheckCircle2, Trophy } from "lucide-react";
import { formatTotal, sinceLabel, useReaderTotals } from "@/lib/readerTotals";

export default function ReaderTotalsStrip() {
  const totals = useReaderTotals();
  if (!totals) return null;
  const since = sinceLabel(totals.since);
  return (
    <section aria-label="Arise Reader so far" data-testid="reader-totals" className="mb-5 rounded-[1.5rem] border border-white/10 bg-[#151326] p-3 shadow-xl sm:p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-violet-300" aria-hidden="true" />
          <p className="mt-1 text-3xl font-black tabular-nums leading-none tracking-tight text-white sm:text-4xl" data-testid="reader-total-quizzes">{formatTotal(totals.quizzes)}</p>
          <p className="mt-1 text-xs font-bold text-slate-300">quizzes taken</p>
        </div>
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3">
          <Trophy className="h-4 w-4 text-cyan-200" aria-hidden="true" />
          <p className="mt-1 text-3xl font-black tabular-nums leading-none tracking-tight text-white sm:text-4xl" data-testid="reader-total-points">{formatTotal(totals.points)}</p>
          <p className="mt-1 text-xs font-bold text-slate-300">points earned</p>
        </div>
      </div>
      <p className="mt-2 px-1 text-[11px] font-semibold text-slate-400">Across every reader, all time{since ? ` since ${since}` : ""}.</p>
    </section>
  );
}
