// The Top Reader Challenge on screen: the board, the full card for the leaderboards, the library
// banner and the sign-in pop-up that announces it. The rules are in shared/topReader.ts.
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { introSeen, markIntroSeen, useTopReader } from "@/lib/topReader";
import { ordinal } from "@shared/advisoryChallenge";
import { topReaderDates, topReaderText, topReaderWinners, type TopReaderView } from "@shared/topReader";

type View = TopReaderView & { challenge: NonNullable<TopReaderView["challenge"]> };
const over = (v: View) => v.challenge.phase === "over";

/** "You're in 3rd place", "tied for 3rd", or how to get on the board. */
export function myPlaceText(v: View, child?: string): string {
  const m = v.mine;
  if (!m) return "";
  const who = child ? `${child} is` : "You're";
  const whoDid = child ? `${child} finished` : "You finished";
  if (!m.rank) return over(v) ? (child ? `${child} didn't score in the challenge.` : "You didn't score in this challenge.") : child ? `${child} hasn't scored yet. Every quiz passed adds points.` : "Pass a quiz to get on the board!";
  const tied = v.standings.filter((s) => s.rank === m.rank).length > 1;
  const place = tied ? `tied for ${ordinal(m.rank)}` : `in ${ordinal(m.rank)} place`;
  return `${over(v) ? whoDid : who} ${place} with ${m.points.toLocaleString()} point${m.points === 1 ? "" : "s"}.`;
}

/** The board: each student's place, name, quizzes passed and points. */
export function TopReaderBoard({ view, limit, dense = false, youLabel = "you" }: { view: View; limit?: number; dense?: boolean; youLabel?: string }) {
  const all = view.standings;
  let rows = limit ? all.slice(0, limit) : all;
  // A student (or parent) gets an id only on their own row; staff get ids on every row and have no row of their own.
  const mine = view.mine ? all.find((s) => s.id != null) : undefined;
  if (limit && mine && !rows.includes(mine)) rows = [...rows, mine];
  if (!all.length) return <p className="rounded-xl bg-white/[.04] px-3 py-3 text-sm font-semibold text-white/70" data-testid="top-reader-empty">{view.challenge.phase === "soon" ? "No one has started yet." : "No one is on the board yet. Pass a quiz to be first!"}</p>;
  const top = Math.max(1, ...all.map((s) => s.points));
  const n = view.challenge.winners;
  return (
    <ol className={dense ? "space-y-1" : "space-y-1.5"} data-testid="top-reader-board">
      {rows.map((s, i) => {
        const isMine = mine != null && s === mine;
        const prize = s.rank <= n;
        const gap = limit && isMine && !all.slice(0, limit).includes(s);
        return (
          <li key={`${s.rank}-${s.name}-${i}`} className={gap ? "border-t border-dashed border-white/15 pt-1.5" : ""}>
            <div className={`relative flex items-center gap-3 overflow-hidden rounded-xl px-3 ${dense ? "py-1.5" : "py-2.5"} ${isMine ? "bg-[#34d399]/[.14] ring-1 ring-[#34d399]/60" : prize ? "bg-[#ffc93c]/[.12] ring-1 ring-[#ffc93c]/50" : "bg-white/[.04]"}`}>
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#10b981]/25 to-[#10b981]/5" style={{ width: `${Math.round((s.points / top) * 100)}%` }} aria-hidden="true" />
              <span className={`relative w-8 shrink-0 text-center font-black tabular-nums ${prize ? "text-[#ffc93c]" : "text-white/70"} ${dense ? "text-sm" : "text-base"}`}>
                {prize ? (over(view) ? "🏆" : "🎁") : s.rank}
              </span>
              <span className="relative min-w-0 flex-1">
                <span className={`block truncate font-bold text-white ${dense ? "text-[13px]" : "text-sm"}`}>{s.name}{isMine ? ` · ${youLabel}` : ""}</span>
                {!dense && <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/50">
                  {prize && <span className="shrink-0 rounded bg-[#ffc93c] px-1.5 py-px text-[9px] font-black uppercase tracking-wide text-[#2a1405]">{over(view) ? "Winner" : `Top ${n}`}</span>}
                  <span className="truncate">{ordinal(s.rank)}{s.grade ? ` · Grade ${s.grade}` : ""}</span>
                </span>}
              </span>
              <span className="relative shrink-0 text-right" title={`${s.passed} ${s.passed === 1 ? "quiz" : "quizzes"} passed during the challenge`}>
                <span className={`block font-black tabular-nums text-white/85 ${dense ? "text-sm" : "text-base"}`}>{dense ? "📚 " : ""}{s.passed.toLocaleString()}</span>
                {!dense && <span className="block text-[10px] font-semibold text-white/45">{s.passed === 1 ? "quiz passed" : "quizzes passed"}</span>}
              </span>
              <span className="relative min-w-[3.5rem] shrink-0 text-right">
                <span className={`block font-black tabular-nums text-white ${dense ? "text-sm" : "text-base"}`}>{s.points.toLocaleString()}</span>
                {!dense && <span className="block text-[10px] font-semibold text-white/45">points</span>}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The header every Top Reader card shares. */
function Header({ v, compact = false }: { v: View; compact?: boolean }) {
  const won = over(v) ? topReaderWinners(v.standings, v.challenge.winners) : [];
  return (
    <div className="flex items-start gap-3 bg-gradient-to-br from-[#059669] to-[#0e7490] px-4 py-4 sm:px-5">
      <span className="text-3xl leading-none" aria-hidden="true">{over(v) ? "🏆" : "📚"}</span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-black text-[#d1fae5]">
          {v.challenge.title} · {topReaderDates(v.challenge)}
          {v.challenge.phase === "live" && v.challenge.firstDay && <span className="rounded-full bg-[#ffc93c] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#2a1405]">New · Starts today</span>}
          {over(v) && <span className="rounded-full bg-[#ffc93c] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#2a1405]">Over</span>}
        </p>
        <h2 className={`mt-0.5 font-black leading-tight tracking-tight text-white ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}>
          {won.length ? `${won.map((w) => w.name).join(" and ")} won!` : `Top ${v.challenge.winners} readers each win ${v.challenge.prize.split(" (")[0]}`}
        </h2>
      </div>
    </div>
  );
}

/** The whole card: header, how it works, your place and the board. For the leaderboards. */
export function TopReaderCard({ view, child, limit }: { view: TopReaderView; /** A parent's child: "Maya is in 3rd place". */ child?: string; limit?: number }) {
  if (!view.challenge) return null;
  const v = view as View;
  const mine = myPlaceText(v, child);
  return (
    <section className="overflow-hidden rounded-2xl border border-[#10b981]/40 bg-[#0f1a1a] text-white shadow-lg" data-testid="top-reader-card">
      <Header v={v} />
      <div className="space-y-3 p-4 sm:p-5">
        <p className="text-sm font-semibold leading-relaxed text-white/80">{topReaderText(v)}</p>
        {mine && <p className="text-sm font-bold text-[#6ee7b7]" data-testid="top-reader-mine">{mine}</p>}
        <TopReaderBoard view={v} limit={limit} youLabel={child ? child.split(" ")[0] : "you"} />
        {v.racers > v.standings.length && <p className="text-xs font-semibold text-white/50">{v.racers.toLocaleString()} students have scored so far. The top {Math.min(10, v.racers)} are shown.</p>}
      </div>
    </section>
  );
}

/** The library banner: your place and the top 3. Tapping it opens the leaderboard. */
export function TopReaderBanner({ onOpen }: { onOpen: () => void }) {
  const { token } = useAuth();
  const raw = useTopReader(token);
  if (!raw || !raw.challenge) return null;
  const v = raw as View;
  return (
    <button type="button" onClick={onOpen} data-testid="top-reader-banner"
      className="mb-4 block w-full overflow-hidden rounded-2xl border border-[#10b981]/50 bg-[#0f1a1a] text-left text-white shadow-lg transition hover:border-[#34d399] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#34d399]">
      <div className="grid gap-3 p-3 sm:grid-cols-[1fr_minmax(0,18rem)] sm:p-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-black text-[#6ee7b7]"><span className="text-lg" aria-hidden="true">{over(v) ? "🏆" : "📚"}</span>{v.challenge.title}
            {v.challenge.phase === "live" && v.challenge.firstDay && <span className="rounded-full bg-[#ffc93c] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#2a1405]">New</span>}
            {over(v) && <span className="rounded-full bg-[#ffc93c] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#2a1405]">Over</span>}
          </p>
          <p className="mt-1 text-lg font-black leading-tight sm:text-xl">{v.mine?.rank ? myPlaceText(v) : over(v) ? "The Top Reader Challenge is over" : `Win ${v.challenge.prize.split(" (")[0]}!`}</p>
          <p className="mt-1 text-xs font-semibold text-white/65 sm:text-sm">{topReaderText(v)}</p>
          <p className="mt-2 text-xs font-black text-white/80 underline decoration-[#10b981] decoration-2 underline-offset-4">See the leaderboard</p>
        </div>
        <TopReaderBoard view={v} limit={3} dense />
      </div>
    </button>
  );
}

/** Shown when a student signs in while the challenge is on (or its winners are up). The first time
 *  for each challenge it says "New challenge!". With no challenge, `fallback` shows instead. */
export function TopReaderPopup({ onNavigate, fallback }: { onNavigate: (path: string) => void; fallback: ReactNode }) {
  const { token, user } = useAuth();
  const raw = useTopReader(token);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (raw === undefined || !user) return null;
  if (raw === null || !raw.challenge) return <>{fallback}</>;
  if (!open) return null;
  const v = raw as View;
  // Seen is saved when the pop-up closes, so this stays the same while it's open.
  const isNew = !introSeen(v.challenge.id, user.id);
  const close = () => { markIntroSeen(v.challenge.id, user.id); setOpen(false); };
  const mine = myPlaceText(v);
  return (
    <div className="fixed inset-0 z-[360] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4" onClick={close} data-testid="top-reader-popup">
      <div role="dialog" aria-modal="true" aria-labelledby="top-reader-title" className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#10b981]/40 bg-[#0f1a1a] text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 bg-gradient-to-br from-[#059669] to-[#0e7490] px-5 pb-4 pt-5">
          <span className="text-4xl leading-none" aria-hidden="true">{over(v) ? "🏆" : "📚"}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#d1fae5]">{v.challenge.title} · {topReaderDates(v.challenge)}</p>
            <h2 id="top-reader-title" className="mt-0.5 text-2xl font-black leading-tight tracking-tight">
              {over(v) ? "The Top Reader Challenge is over!" : isNew ? (v.challenge.firstDay ? "A new challenge starts today!" : "A new challenge is on!") : "Top Reader Challenge"}
            </h2>
          </div>
          <button type="button" onClick={close} className="-mr-1 -mt-1 rounded-full p-2 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Close">✕</button>
        </div>
        <div className="space-y-3 overflow-y-auto px-5 py-4">
          {!over(v) && <p className="text-[15px] font-semibold leading-relaxed text-white">This time it's you against everyone. The <b>top {v.challenge.winners} readers</b> with the most points from {topReaderDates(v.challenge)} each win <b>{v.challenge.prize}</b>.</p>}
          <p className="text-sm font-semibold leading-relaxed text-white/80">{topReaderText(v)}</p>
          {mine && <p className="text-sm font-bold text-[#6ee7b7]">{mine}</p>}
          <TopReaderBoard view={v} limit={5} dense />
        </div>
        <div className="flex gap-2 border-t border-white/10 px-5 py-4">
          <button type="button" onClick={() => { close(); onNavigate("/leaderboard"); }} className="flex-1 rounded-xl border border-white/20 px-4 py-3 text-sm font-black text-white hover:bg-white/10">See leaderboard</button>
          <button type="button" onClick={() => { close(); onNavigate("/library"); }} className="flex-1 rounded-xl bg-[#ffc93c] px-4 py-3 text-sm font-black text-[#3a1a06] hover:bg-[#ffd666]">{over(v) ? "Keep reading" : "Start reading"}</button>
        </div>
      </div>
    </div>
  );
}
