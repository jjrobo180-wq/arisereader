// The Top Reader Challenge on screen: the board, the card for the leaderboards, the library banner and the
// sign-in pop-up that announces it. The rules are in shared/topReader.ts. Plain on purpose: one dark
// surface, one gold accent for the prize, each fact said once, and numbers that line up.
import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { introSeen, markIntroSeen, useTopReader } from "@/lib/topReader";
import { dayLabel, ordinal } from "@shared/advisoryChallenge";
import { topReaderWinners, type TopReaderView } from "@shared/topReader";

type View = TopReaderView & { challenge: NonNullable<TopReaderView["challenge"]> };
const over = (v: View) => v.challenge.phase === "over";
/** "a $5 gift card or snacks": the prize without the list of snacks. */
const prizeShort = (v: View) => v.challenge.prize.split(" (")[0];

const GOLD = "#ffc93c";
const SURFACE = "bg-[#16141f]";

/** "You're in 3rd place with 80 points.", "tied for 3rd", or how to get on the board. */
export function myPlaceText(v: View, child?: string): string {
  const m = v.mine;
  if (!m) return "";
  const who = child ? `${child} is` : "You're";
  const whoDid = child ? `${child} finished` : "You finished";
  if (!m.rank) return over(v) ? (child ? `${child} didn't score in the challenge.` : "You didn't score in this challenge.") : child ? `${child} hasn't scored yet.` : "You're not on the board yet. Pass a quiz to get on it.";
  const tied = v.standings.filter((s) => s.rank === m.rank).length > 1;
  const place = tied ? `tied for ${ordinal(m.rank)}` : `in ${ordinal(m.rank)} place`;
  return `${over(v) ? whoDid : who} ${place} with ${m.points.toLocaleString()} point${m.points === 1 ? "" : "s"}.`;
}

/** The headline: what you can win, or who won. */
function headline(v: View): string {
  if (!over(v)) return `Read the most, win ${prizeShort(v)}.`;
  const won = topReaderWinners(v.standings, v.challenge.winners);
  return won.length ? `${won.map((w) => w.name).join(" and ")} won.` : "No one scored this time.";
}

/** The small gold line above the headline: the challenge and where it's at. */
function kicker(v: View, isNew = false): string {
  const c = v.challenge;
  if (isNew && c.phase === "live") return c.firstDay ? "New challenge · Starts today" : "New challenge";
  if (over(v)) return `${c.title} · Over`;
  if (c.phase === "soon") return `${c.title} · Starts ${dayLabel(c.starts, true)}`;
  return `${c.title} · ${c.firstDay ? "Started today" : c.daysLeft === 0 ? "Last day" : `${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left`}`;
}

/** The board: place, name, quizzes passed and points. Only the prize places are marked. */
export function TopReaderBoard({ view, limit, dense = false, youLabel = "you" }: { view: View; limit?: number; dense?: boolean; youLabel?: string }) {
  const all = view.standings;
  let rows = limit ? all.slice(0, limit) : all;
  // A student (or parent) gets an id only on their own row; staff get ids on every row and have no row of their own.
  const mine = view.mine ? all.find((s) => s.id != null) : undefined;
  if (limit && mine && !rows.includes(mine)) rows = [...rows, mine];
  if (!all.length) return <p className="py-2 text-sm text-white/60" data-testid="top-reader-empty">{view.challenge.phase === "soon" ? "No one has started yet." : "No one is on the board yet. The first quiz passed takes 1st place."}</p>;
  const n = view.challenge.winners;
  return (
    <ol className="divide-y divide-white/[.07]" data-testid="top-reader-board">
      {!dense && <li className="flex items-center gap-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40" aria-hidden="true"><span className="w-7">#</span><span className="flex-1">Reader</span><span className="w-16 text-right">Quizzes</span><span className="w-16 text-right">Points</span></li>}
      {rows.map((s, i) => {
        const isMine = mine != null && s === mine;
        const prize = s.rank <= n;
        const gap = limit && isMine && !all.slice(0, limit).includes(s);
        return (
          <li key={`${s.rank}-${s.name}-${i}`} className={`flex items-center gap-3 ${dense ? "py-2" : "py-2.5"} ${gap ? "border-t border-dashed border-white/15" : ""} ${isMine ? "-mx-2 rounded-lg bg-white/[.06] px-2" : ""}`}>
            <span className="w-7 text-[15px] font-bold tabular-nums" style={{ color: prize ? GOLD : "rgba(255,255,255,.55)" }}>{s.rank}</span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">
              {s.name}{isMine && <span className="font-normal text-white/55"> · {youLabel}</span>}
              {prize && !dense && <span className="ml-2 align-middle text-[11px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>{over(view) ? "Winner" : "Prize"}</span>}
            </span>
            {!dense && <span className="w-16 text-right text-[14px] tabular-nums text-white/60">{s.passed}</span>}
            <span className="w-16 text-right text-[15px] font-bold tabular-nums text-white">{s.points.toLocaleString()}<span className="sr-only"> points</span></span>
          </li>
        );
      })}
    </ol>
  );
}

/** The three facts, once each: the prize, who wins, when it ends. */
function Facts({ v }: { v: View }) {
  const items: Array<[string, string]> = [
    ["Prize", `${prizeShort(v).replace(/^a /, "")} each`],
    ["Winners", `Top ${v.challenge.winners} by points`],
    [over(v) ? "Ended" : "Ends", `${dayLabel(v.challenge.lastDay, true)}, midnight`],
  ];
  return (
    <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-white/[.08]">
      {items.map(([k, val]) => <div key={k} className={`${SURFACE} px-3 py-2.5`}><dt className="text-[11px] font-semibold uppercase tracking-wider text-white/45">{k}</dt><dd className="mt-0.5 text-[14px] font-semibold leading-snug text-white">{val}</dd></div>)}
    </dl>
  );
}

/** The whole card: what it is, your place and the board. For the leaderboards. */
export function TopReaderCard({ view, child, limit }: { view: TopReaderView; /** A parent's child: "Maya is in 3rd place". */ child?: string; limit?: number }) {
  if (!view.challenge) return null;
  const v = view as View;
  const mine = myPlaceText(v, child);
  return (
    <section className={`space-y-4 rounded-2xl border border-white/10 ${SURFACE} p-5 text-white`} data-testid="top-reader-card">
      <div className="space-y-1"><p className="text-[13px] font-semibold" style={{ color: GOLD }}>{kicker(v)}</p><h2 className="text-2xl font-bold leading-tight tracking-tight">{headline(v)}</h2></div>
      <Facts v={v} />
      {mine && <p className="text-[15px] text-white/80" data-testid="top-reader-mine">{mine}</p>}
      <TopReaderBoard view={v} limit={limit} youLabel={child ? child.split(" ")[0] : "you"} />
      {v.racers > v.standings.length && <p className="text-xs text-white/45">{v.racers.toLocaleString()} students have scored. The top 10 are shown.</p>}
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
      className={`mb-4 grid w-full gap-4 rounded-2xl border border-white/10 ${SURFACE} p-4 text-left text-white transition hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white sm:grid-cols-[1fr_minmax(0,17rem)]`}>
      <span className="min-w-0 space-y-1">
        <span className="block text-[13px] font-semibold" style={{ color: GOLD }}>{kicker(v)}</span>
        <span className="block text-lg font-bold leading-snug">{v.mine?.rank ? myPlaceText(v) : headline(v)}</span>
        <span className="block text-sm text-white/60">{over(v) ? "See the final board →" : `The top ${v.challenge.winners} win. Ends ${dayLabel(v.challenge.lastDay)} at midnight. See the board →`}</span>
      </span>
      <TopReaderBoard view={v} limit={3} dense />
    </button>
  );
}

/** Shown when a student signs in while the challenge is on (or its winners are up). The first time it says
 *  it's new. With no challenge, `fallback` shows instead. */
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
    <div className="fixed inset-0 z-[360] flex items-center justify-center bg-black/75 p-3 sm:p-4" onClick={close} data-testid="top-reader-popup">
      <div role="dialog" aria-modal="true" aria-labelledby="top-reader-title" className={`flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 ${SURFACE} text-white shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="space-y-4 overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[13px] font-semibold" style={{ color: GOLD }}>{kicker(v, isNew)}</p>
              <h2 id="top-reader-title" className="text-[26px] font-bold leading-tight tracking-tight">{headline(v)}</h2>
            </div>
            <button type="button" onClick={close} className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button>
          </div>
          {!over(v) && <p className="text-[15px] leading-relaxed text-white/75">Everyone started at 0 on {dayLabel(v.challenge.starts, true)}. Every quiz you pass adds the book's points, and the {v.challenge.winners} readers with the most points win.</p>}
          <Facts v={v} />
          {mine && <p className="text-[15px] font-semibold text-white">{mine}</p>}
          <TopReaderBoard view={v} limit={5} dense />
        </div>
        <div className="flex gap-2 border-t border-white/10 p-4">
          <button type="button" onClick={() => { close(); onNavigate("/leaderboard"); }} className="min-h-12 flex-1 rounded-xl border border-white/15 text-[15px] font-semibold text-white hover:bg-white/5">Leaderboard</button>
          <button type="button" onClick={() => { close(); onNavigate("/library"); }} className="min-h-12 flex-1 rounded-xl text-[15px] font-bold text-[#1a1305] hover:brightness-105" style={{ background: GOLD }}>{over(v) ? "Keep reading" : "Start reading"}</button>
        </div>
      </div>
    </div>
  );
}
