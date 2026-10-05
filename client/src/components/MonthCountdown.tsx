import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { monthEndMs, monthLabel, schoolYearMonth, timeLeft } from "@shared/schoolMonth";

/**
 * How long until this month's leaderboard closes: midnight Mountain Time on the
 * 1st. Ticks every second. When the month turns over it tells the page
 * (onNewMonth), so a leaderboard left open switches to the new month by itself.
 */
export function useSchoolMonth(onNewMonth?: (yearMonth: string) => void) {
  const [now, setNow] = useState(() => Date.now());
  const month = schoolYearMonth(now);
  const last = useRef(month);
  const callback = useRef(onNewMonth);
  callback.current = onNewMonth;
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (month !== last.current) { last.current = month; callback.current?.(month); }
  }, [month]);
  return { now, month, endsAt: monthEndMs(month) };
}

export default function MonthCountdown({ onNewMonth, compact = false, className = "" }: {
  onNewMonth?: (yearMonth: string) => void;
  /** One short line, for small spaces. */
  compact?: boolean;
  className?: string;
}) {
  const { now, month, endsAt } = useSchoolMonth(onNewMonth);
  const t = timeLeft(endsAt - now);
  const label = monthLabel(month);
  const lastDay = t.days === 0;
  const spoken = `${label} leaderboard closes in ${t.days} days, ${t.hours} hours and ${t.minutes} minutes`;
  const cells: [string, number][] = [["days", t.days], ["hrs", t.hours], ["min", t.minutes], ["sec", t.seconds]];

  if (compact) {
    return (
      <p className={`flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground ${className}`} aria-label={spoken} data-testid="month-countdown">
        <Timer className={`h-3.5 w-3.5 ${lastDay ? "text-amber-400" : "text-primary"}`} aria-hidden="true" />
        <span aria-hidden="true">
          {label} closes in <b className="font-bold tabular-nums text-foreground">{t.days}d {String(t.hours).padStart(2, "0")}h {String(t.minutes).padStart(2, "0")}m {String(t.seconds).padStart(2, "0")}s</b>
        </span>
      </p>
    );
  }

  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-2xl border px-4 py-3 sm:flex-row sm:justify-between ${lastDay ? "border-amber-400/40 bg-amber-500/10" : "border-violet-400/25 bg-white/[.04]"} ${className}`}
      role="timer"
      aria-label={spoken}
      data-testid="month-countdown"
    >
      <div className="flex items-center gap-2 text-sm font-bold text-white" aria-hidden="true">
        <Timer className={`h-4 w-4 ${lastDay ? "text-amber-300" : "text-violet-300"}`} />
        {lastDay ? `Last day of ${label}!` : `${label} ends in`}
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {cells.map(([name, n]) => (
          <span key={name} className="flex min-w-[3.25rem] flex-col items-center rounded-lg border border-white/10 bg-[#0d0b1a]/70 px-2 py-1">
            <b className="text-lg font-black leading-none tabular-nums text-white">{String(n).padStart(2, "0")}</b>
            <i className="mt-0.5 text-[10px] not-italic uppercase tracking-wide text-slate-400">{name}</i>
          </span>
        ))}
      </div>
    </div>
  );
}
