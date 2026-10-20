// The Advisory Challenge on the student side: the standings board, the library banner and the pop-up
// shown once each time a student signs in. The rules are in shared/advisoryChallenge.ts.
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAdvisoryChallenge, useGamesBegin } from "@/lib/advisoryChallenge";
import { dayLabel, ordinal, type ChallengeView, type Standing } from "@shared/advisoryChallenge";
import LeaderboardPopup from "./LeaderboardPopup";

type View = ChallengeView & { challenge: NonNullable<ChallengeView["challenge"]> };

/** "3rd place", or "tied for 3rd" when another advisory has the same points. */
export function placeText(standings: readonly Standing[], rank: number): string {
  const tied = standings.filter((s) => s.rank === rank).length > 1;
  return tied ? `tied for ${ordinal(rank)}` : `in ${ordinal(rank)} place`;
}

/** When it runs and what the winners get, for the phase it's in. */
export function datesText(v: View): string {
  const c = v.challenge;
  const party = `The advisory with the most points wins ${c.prize} on ${dayLabel(c.prizeDay)}.`;
  // Points from before the start only count when the challenge says so (countsFrom earlier than starts).
  const early = c.countsFrom < c.starts ? ` Points earned since ${dayLabel(c.countsFrom, true)} already count.` : "";
  if (c.phase === "soon") return `Starts ${dayLabel(c.starts)} and ends ${dayLabel(c.lastDay)}. Every advisory starts at 0 points. ${party}${early}`;
  if (c.phase === "live") return `${c.daysLeft === 0 ? "Last day!" : `${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left.`} Ends ${dayLabel(c.lastDay)}. ${party}${early}`;
  const winners = v.standings.filter((s) => s.rank === 1 && s.points > 0).map((s) => s.name);
  return winners.length
    ? `The challenge is over. ${winners.join(" and ")} ${winners.length > 1 ? "win" : "wins"} ${c.prize} on ${dayLabel(c.prizeDay)}!`
    : "The challenge is over.";
}

export function headline(v: View): string {
  const mine = v.mine;
  // Before anyone scores, every advisory is "tied for 1st"; say what's happening instead.
  if (!v.standings.some((s) => s.points > 0) && v.challenge.phase !== "over") {
    if (v.challenge.phase === "soon") return `The Advisory Challenge starts ${dayLabel(v.challenge.starts)}`;
    return mine?.advisory ? `Every advisory is at 0. Get ${mine.advisory} on the board!` : "Every advisory is at 0. Be the first to score!";
  }
  if (mine?.advisory && mine.rank) {
    if (v.challenge.phase === "over" && mine.rank === 1) return `${mine.advisory} won!`;
    return `${mine.advisory} is ${placeText(v.standings, mine.rank)}`;
  }
  return v.challenge.phase === "over" ? "Final standings" : `Which advisory will win ${v.challenge.prize}?`;
}

/** The standings board: every advisory's place, points and a bar against the leader. */
export function AdvisoryStandings({ view, mineName, limit, dense = false }: { view: ChallengeView; mineName?: string | null; limit?: number; dense?: boolean }) {
  const all = view.standings;
  const top = Math.max(1, ...all.map((s) => s.points));
  let rows = limit ? all.slice(0, limit) : all;
  const mine = mineName ? all.find((s) => s.name === mineName) : undefined;
  if (limit && mine && !rows.includes(mine)) rows = [...rows, mine];
  return (
    <ol className={dense ? "space-y-1" : "space-y-1.5"} data-testid="advisory-standings">
      {rows.map((s) => {
        const isMine = s.name === mineName;
        const gap = limit && mine === s && !all.slice(0, limit).includes(s);
        return (
          <li key={s.name} className={gap ? "border-t border-dashed border-white/15 pt-1.5" : ""}>
            <div className={`relative flex items-center gap-3 overflow-hidden rounded-xl px-3 ${dense ? "py-1.5" : "py-2.5"} ${isMine ? "bg-[#ffc93c]/[.14] ring-1 ring-[#ffc93c]/60" : "bg-white/[.04]"}`}>
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#f2542d]/25 to-[#f2542d]/5" style={{ width: `${Math.round((s.points / top) * 100)}%` }} aria-hidden="true" />
              <span className={`relative w-8 shrink-0 text-center font-black tabular-nums ${s.rank === 1 ? "text-[#ffc93c]" : "text-white/70"} ${dense ? "text-sm" : "text-base"}`}>
                {s.rank === 1 && s.points > 0 ? "🍕" : s.rank}
              </span>
              <span className="relative min-w-0 flex-1">
                <span className={`block truncate font-bold text-white ${dense ? "text-[13px]" : "text-sm"}`}>{s.name}{isMine ? " · yours" : ""}</span>
                {!dense && <span className="block text-[11px] font-semibold text-white/50">Grade {s.grade} · Room {s.room}</span>}
              </span>
              <span className="relative shrink-0 text-right" title={`${(s.books || 0).toLocaleString()} ${(s.books || 0) === 1 ? "book" : "books"} quizzed on during the challenge`} data-testid="advisory-books">
                <span className={`block font-black tabular-nums text-white/85 ${dense ? "text-sm" : "text-base"}`}>{dense ? "📚 " : ""}{(s.books || 0).toLocaleString()}</span>
                {!dense && <span className="block text-[10px] font-semibold text-white/45">{(s.books || 0) === 1 ? "book read" : "books read"}</span>}
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

/** The library banner: the reader's advisory's place and the top of the board. Tapping it opens the leaderboard. */
export function AdvisoryChallengeBanner({ onOpen }: { onOpen: () => void }) {
  const { token } = useAuth();
  const raw = useAdvisoryChallenge(token);
  if (!raw || !raw.challenge) return null;
  const v = raw as View;
  const mine = v.mine;
  return (
    <button type="button" onClick={onOpen} className="mb-4 block w-full overflow-hidden rounded-2xl border border-[#f2542d]/40 bg-[#1a1020] text-left text-white shadow-lg transition hover:border-[#ffc93c]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffc93c]" data-testid="advisory-challenge-banner" aria-label="Advisory Challenge. Open the leaderboard">
      <div className="grid gap-3 p-3 sm:grid-cols-[1fr_minmax(0,18rem)] sm:p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black text-[#ffc93c]"><span className="text-lg" aria-hidden="true">🍕</span>Advisory Challenge</p>
          <p className="mt-1 text-lg font-black leading-tight sm:text-xl">
            {mine?.advisory && mine.rank && v.standings.some((s) => s.points > 0) ? <>{mine.advisory} is {placeText(v.standings, mine.rank)} <span className="text-white/50">of {v.standings.length}</span></> : headline(v)}
          </p>
          <p className="mt-1 text-xs font-semibold text-white/65 sm:text-sm">{datesText(v)}</p>
          {mine && mine.points > 0 && <p className="mt-1 text-xs font-bold text-[#ffc93c]/90">You've added {mine.points.toLocaleString()} points.</p>}
          <p className="mt-2 text-xs font-black text-white/80 underline decoration-[#f2542d] decoration-2 underline-offset-4">See the leaderboard</p>
        </div>
        <AdvisoryStandings view={v} mineName={mine?.advisory} limit={3} dense />
      </div>
    </button>
  );
}

/** The "Let the games begin!" introduction for teachers and the administrator: once per account,
 *  over the Reader. Students get it inside their sign-in pop-up instead (below). */
export function GamesBeginStaffPopup({ onChallenge, enabled = true }: { onChallenge: () => void; enabled?: boolean }) {
  const { token, user } = useAuth();
  const raw = useAdvisoryChallenge(token);
  const live = !!raw?.challenge && raw.challenge.phase !== "over";
  const intro = useGamesBegin(token, user?.id, enabled && live);
  if (!enabled || !live || !intro.show || !raw) return null;
  const v = raw as View;
  return <ChallengeDialog v={v} intro="staff" close={intro.done} actions={[
    { label: "See the Advisory Challenge", primary: true, onClick: () => { intro.done(); onChallenge(); } },
    { label: "Let's go", onClick: intro.done },
  ]} />;
}

type DialogAction = { label: string; onClick: () => void; primary?: boolean };

/** The pop-up itself. With `intro`, it opens with "Let the games begin!" and says how the challenge works. */
function ChallengeDialog({ v, intro, close, actions }: { v: View; intro?: "student" | "staff"; close: () => void; actions: DialogAction[] }) {
  const mine = v.mine;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);
  return (
    <div className="fixed inset-0 z-[360] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4" onClick={close} data-testid={intro ? "games-begin-popup" : "advisory-challenge-popup"}>
      <div role="dialog" aria-modal="true" aria-labelledby="advisory-challenge-title" className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#f2542d]/40 bg-[#1a1020] text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 bg-gradient-to-br from-[#f2542d] to-[#c2361b] px-5 pb-4 pt-5">
          <span className="text-4xl leading-none" aria-hidden="true">🍕</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#ffe08a]">Advisory Challenge</p>
            <h2 id="advisory-challenge-title" className="mt-0.5 text-2xl font-black leading-tight tracking-tight">{intro ? "Let the games begin!" : headline(v)}</h2>
          </div>
          <button type="button" onClick={close} className="-mr-1 -mt-1 rounded-full p-2 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Close">✕</button>
        </div>
        <div className="space-y-3 overflow-y-auto px-5 py-4">
          {intro === "student" && <p className="text-[15px] font-semibold leading-relaxed text-white">Your advisory is racing every other advisory for {v.challenge.prize}. Every quiz you pass adds the book's points to your advisory, so every book you read helps your whole team.</p>}
          {intro === "staff" && <p className="text-[15px] font-semibold leading-relaxed text-white">The Advisory Challenge is here. Every advisory races for reading points: each quiz a student passes adds the book's points to their advisory. The poster, student login papers and slide are in the Advisory Challenge menu.</p>}
          <p className="text-sm font-semibold leading-relaxed text-white/80">{datesText(v)}</p>
          {intro !== "staff" && mine && !mine.advisory && <p className="rounded-xl bg-white/[.06] px-3 py-2 text-sm font-semibold text-white/80">You're not in an advisory on Arise Reader yet. Ask your advisory teacher to add you so your points count.</p>}
          {intro !== "staff" && mine?.advisory && <p className="text-sm font-bold text-[#ffc93c]">{mine.points > 0 ? `You've added ${mine.points.toLocaleString()} points to ${mine.advisory}.` : `Pass a quiz to add points to ${mine.advisory}.`}</p>}
          <AdvisoryStandings view={v} mineName={mine?.advisory} limit={intro ? 5 : undefined} dense={!!intro} />
        </div>
        <div className="flex gap-2 border-t border-white/10 px-5 py-4">
          {actions.map((a) => (
            <button key={a.label} type="button" onClick={a.onClick} className={a.primary
              ? "flex-1 rounded-xl bg-[#ffc93c] px-4 py-3 text-sm font-black text-[#3a1a06] hover:bg-[#ffd666]"
              : "flex-1 rounded-xl border border-white/20 px-4 py-3 text-sm font-black text-white hover:bg-white/10"}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Shown once each time a student signs in while their school's challenge is on. The first time
 *  for each account it opens with "Let the games begin!" and how the challenge works. Students at
 *  a school without one get the old "your standing" pop-up instead. */
export default function AdvisoryChallengePopup({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { token, user } = useAuth();
  const raw = useAdvisoryChallenge(token);
  const [open, setOpen] = useState(true);
  const live = !!raw?.challenge && raw.challenge.phase !== "over";
  const intro = useGamesBegin(token, user?.id, live);
  if (raw === undefined || !user) return null;
  if (raw === null || !raw.challenge) return <LeaderboardPopup onNavigate={onNavigate} />;
  if (!open || (live && intro.show === undefined)) return null;
  const v = raw as View;
  const first = live && intro.show === true;
  const close = () => { if (first) intro.done(); setOpen(false); };
  return <ChallengeDialog v={v} intro={first ? "student" : undefined} close={close} actions={[
    { label: "See leaderboard", onClick: () => { close(); onNavigate("/leaderboard"); } },
    { label: first ? "Start reading" : "Keep reading", primary: true, onClick: () => { close(); onNavigate("/library"); } },
  ]} />;
}
