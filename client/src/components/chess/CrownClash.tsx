// The chess competition on the Ultimate Chess page: the countdown, the podium,
// the standings and the full-screen moments (opening, final day, champion).
// The rules and dates live in shared/chessCompetition.ts. Styles: pages/ultimate-chess.css (.ucc-*).
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { API_BASE } from "@/lib/queryClient";
import {
  CLASH_LEVEL_NAMES, CLASH_POINTS, CLASH_SAME_READER_PER_DAY,
  clashClock, clashDates, clashFirstDay, clashHeat, clashLastDay, clashPhase, clashTarget, clashWhyText, currentClash,
  type ChessCompetition, type ClashHeat, type ClashLast, type ClashPhase, type ClashStanding, type ClashView,
} from "@shared/chessCompetition";

export type Clash = {
  /** null when no competition is on, about to start, or just ended. */
  competition: ChessCompetition | null;
  phase: ClashPhase | null;
  heat: ClashHeat;
  /** The board from the server. null until it answers. */
  view: ClashView | null;
  /** The server's clock, so a computer with the wrong time still counts down correctly. */
  now: () => number;
  refresh: (fresh?: boolean) => Promise<ClashView | null>;
};

/** How often the board is re-read while a reader is looking at it. */
const WATCH_MS = 45_000;

/** Loads the competition and keeps it current. `watching` is true while the lobby or the standings are on screen. */
export function useClash(token: string | null, watching: boolean): Clash {
  const offset = useRef(0);
  const [view, setView] = useState<ClashView | null>(null);
  const [, setBeat] = useState(0);
  const now = useCallback(() => Date.now() + offset.current, []);

  const refresh = useCallback(async (fresh = false) => {
    if (!token) return null;
    try {
      const sent = Date.now();
      const r = await fetch(API_BASE + "/api/chess/competition" + (fresh ? "?fresh=1" : ""), { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
      if (!r.ok) return null;
      const d = (await r.json()) as ClashView;
      if (typeof d.now === "number") offset.current = d.now - (sent + Date.now()) / 2;
      setView(d);
      return d;
    } catch {
      return null; // the countdown still runs from the dates this page already knows
    }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);

  const competition = currentClash(now());
  const phase = competition ? clashPhase(competition, now()) : null;
  const heat = competition ? clashHeat(competition, now()) : null;

  // The moment it starts or ends, redraw and read the board again. Set again after every answer
  // from the server (`view`), because each one can correct this computer's clock.
  useEffect(() => {
    if (!competition || phase === "ended") return;
    const wait = clashTarget(competition, now()) - now();
    if (wait > 2_000_000_000) return; // longer than a timer can wait; a later answer sets it
    const t = window.setTimeout(() => { setBeat((b) => b + 1); void refresh(true); }, Math.max(0, wait) + 400);
    return () => window.clearTimeout(t);
  }, [competition?.id, phase, view, now, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!watching || phase !== "live") return;
    const id = window.setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, WATCH_MS);
    return () => window.clearInterval(id);
  }, [watching, phase, refresh]);

  return { competition, phase, heat, view, now, refresh };
}

const two = (n: number) => String(n).padStart(2, "0");
const places = (n: number) => `${n} ${n === 1 ? "place" : "places"}`;
const pts = (n: number) => `${n} ${n === 1 ? "point" : "points"}`;
const shortPts = (n: number) => `${n} ${n === 1 ? "pt" : "pts"}`;
/** A name that closes a sentence: "Kai J." already has its full stop. */
const lastWord = (name: string) => (/[.!?]$/.test(name) ? name : name + ".");

/** Days, hours, minutes and seconds to the start (before it begins) or to the end. Each number flips as it changes. */
export function ClashCountdown({ clash, compact }: { clash: Clash; compact?: boolean }) {
  const [, setTick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => setTick((t) => t + 1), 1000); return () => window.clearInterval(id); }, []);
  const c = clash.competition;
  if (!c) return null;
  const t = clashClock(clashTarget(c, clash.now()) - clash.now());
  const cells: [string, number][] = [["days", t.days], ["hours", t.hours], ["min", t.minutes], ["sec", t.seconds]];
  return (
    <div className={"ucc-clock" + (compact ? " compact" : "")} role="timer" aria-label={`${t.days} days, ${t.hours} hours, ${t.minutes} minutes and ${t.seconds} seconds ${clash.phase === "soon" ? "until it starts" : "left"}`}>
      {cells.map(([name, n]) => (
        <div key={name} className="ucc-cell" aria-hidden="true">
          <span><b key={n}>{two(n)}</b></span>
          <small>{name}</small>
        </div>
      ))}
    </div>
  );
}

/** One line about the reader's own place. */
function myLine(clash: Clash): string {
  const v = clash.view, me = v?.me, name = clash.competition?.name || "the competition";
  if (clash.phase === "ended") {
    if (!me) return "A new competition is on the way. Keep your openings sharp.";
    return me.rank === 1 ? `You are the ${name} champion with ${pts(me.points)}!` : `You finished #${me.rank} of ${v!.players} with ${pts(me.points)}.`;
  }
  if (!v) return "Win chess games to climb the board.";
  if (!me) return "You are not on the board yet. Win a game to jump on!";
  if (me.rank === 1) return `You hold the crown with ${pts(me.points)}. Defend it!`;
  if (!me.ahead) return `You are #${me.rank} with ${pts(me.points)}.`;
  const gap = me.ahead.points - me.points;
  return gap > 0
    ? `You are #${me.rank} with ${pts(me.points)}, ${gap} behind ${lastWord(me.ahead.displayName)}`
    : `You are #${me.rank} with ${pts(me.points)}, tied with ${lastWord(me.ahead.displayName)} One more win passes them!`;
}

function tagFor(phase: ClashPhase, heat: ClashHeat) {
  return phase === "soon" ? "Coming soon" : phase === "ended" ? "Final results" : heat === "hour" ? "Final hour" : heat === "day" ? "Final day" : "Live now";
}

/** The top of the lobby card: what is on, how long is left, and where the reader stands. */
export function ClashBanner({ clash, onStandings }: { clash: Clash; onStandings: () => void }) {
  const c = clash.competition, phase = clash.phase;
  if (!c || !phase) return null;
  const champ = clash.view?.standings[0];
  return (
    <div className={"ucc-banner " + phase + (clash.heat ? " heat-" + clash.heat : "")} data-testid="crown-clash-banner">
      <div className="ucc-banner-top">
        <span className="ucc-tag"><i />{tagFor(phase, clash.heat)}</span>
        <span className="ucc-dates">{clashDates(c)}</span>
      </div>
      <h1><small>The Ultimate Chess competition</small><em>{c.name}</em></h1>
      <p className="ucc-tagline">
        {phase === "soon" ? `Starts ${clashFirstDay(c)}. Get your openings ready.`
          : phase === "ended" ? (champ ? `${champ.displayName} takes the crown with ${pts(champ.points)}.` : "The competition is over.")
          : clash.heat ? `Last chance! It all ends ${clash.heat === "hour" ? "this hour" : "tonight"}.`
          : `${c.tagline} Win games to climb the board before ${clashLastDay(c)} ends.`}
      </p>
      {phase !== "ended" && <ClashCountdown clash={clash} />}
      <div className="ucc-mine">
        <p data-testid="crown-clash-mine">{phase === "soon" ? "Every chess win will count once it begins." : myLine(clash)}</p>
        <button type="button" onClick={onStandings}>{phase === "ended" ? "Final standings" : phase === "soon" ? "How it works" : "Standings"}</button>
      </div>
    </div>
  );
}

/** First, second and third. Empty places wait for someone to take them. */
export function ClashPodium({ standings, selfId, crowned }: { standings: ClashStanding[]; selfId?: number; crowned?: boolean }) {
  const steps: [number, ClashStanding | undefined][] = [[2, standings[1]], [1, standings[0]], [3, standings[2]]];
  return (
    <div className={"ucc-podium" + (crowned ? " crowned" : "")} data-testid="crown-clash-podium">
      {steps.map(([place, s]) => (
        <div key={place} className={"ucc-step p" + place + (s ? "" : " open") + (s && s.userId === selfId ? " me" : "")}>
          <span className="ucc-medal" aria-hidden="true">{place === 1 ? "👑" : place === 2 ? "🥈" : "🥉"}</span>
          <strong>{s ? s.displayName : "Open place"}</strong>
          <em>{s ? shortPts(s.points) : "Could be you"}</em>
          <div className="ucc-block"><b>{place}</b></div>
        </div>
      ))}
    </div>
  );
}

function ClashRules() {
  return (
    <div className="ucc-rules">
      <h3>How to score</h3>
      <ul>
        {CLASH_LEVEL_NAMES.map((name, i) => <li key={name}><b>{CLASH_POINTS.computer[i]}</b><span>Beat the computer on {name}</span></li>)}
        <li><b>{CLASH_POINTS.reader}</b><span>Beat another reader in a live match</span></li>
        <li><b>{CLASH_POINTS.draw}</b><span>Draw any game</span></li>
      </ul>
      <p>A game counts once you have each played 8 moves, or right away if it ends in checkmate. Up to {CLASH_SAME_READER_PER_DAY} games a day against the same reader count. If two readers tie, the one with more wins is ahead.</p>
    </div>
  );
}

/** The standings window: countdown, podium, the board and the rules. */
export function ClashBoard({ clash, selfId }: { clash: Clash; selfId?: number }) {
  const c = clash.competition, phase = clash.phase, v = clash.view;
  if (!c || !phase) return null;
  const rows = v?.standings || [], me = v?.me;
  const row = (r: ClashStanding) => (
    <div key={r.userId} className={(r.userId === selfId ? "me " : "") + (r.rank <= 3 ? "podium" : "")}>
      <b>{r.rank === 1 ? "👑" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : "#" + r.rank}</b>
      <strong>{r.displayName}</strong>
      <span>{r.wins}W {r.draws}D {r.losses}L</span>
      <em>{shortPts(r.points)}</em>
      <small>{r.games} {r.games === 1 ? "game" : "games"}</small>
    </div>
  );
  return (
    <div className={"ucc-board " + phase + (clash.heat ? " heat-" + clash.heat : "")}>
      <div className="ucc-board-head">
        <div>
          <b>{phase === "ended" ? "Final results" : phase === "soon" ? `Starts ${clashFirstDay(c)}` : `Ends ${clashLastDay(c)}`}</b>
          <span>{clashDates(c)}{v && phase !== "soon" ? ` · ${v.players} ${v.players === 1 ? "reader" : "readers"} · ${v.games} ${v.games === 1 ? "game" : "games"}` : ""}</span>
        </div>
        {phase !== "ended" && <ClashCountdown clash={clash} compact />}
      </div>
      {phase !== "soon" && <>
        <ClashPodium standings={rows} selfId={selfId} crowned={phase === "ended"} />
        {!v ? <p className="ucc-none">Loading the board…</p>
          : rows.length === 0 ? <p className="ucc-none">{phase === "ended" ? "Nobody finished a game this time." : "No games yet. Win the first one and take the crown."}</p>
          : <div className="uc-list">{rows.map(row)}{me && me.rank > rows.length && <><p className="ucc-gap" aria-hidden="true">· · ·</p>{row(me)}</>}</div>}
      </>}
      <ClashRules />
    </div>
  );
}

const CONFETTI = ["#f5d778", "#c4b5fd", "#7ee0ff", "#fb7185", "#86efac", "#fde68a", "#f0abfc"];

/** Paper confetti made of plain boxes, so it needs nothing downloaded and stays above the chess page. */
export function Confetti({ count = 80 }: { count?: number }) {
  return (
    <div className="ucc-confetti" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        // the same piece always gets the same path, so redraws do not make it jump
        const r = (n: number) => { const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
        const style = {
          left: (r(1) * 100).toFixed(2) + "%",
          width: Math.round(6 + r(6) * 6), height: Math.round(9 + r(7) * 9),
          background: CONFETTI[i % CONFETTI.length],
          "--d": (r(2) * 2.4).toFixed(2) + "s", "--t": (2.8 + r(3) * 2.6).toFixed(2) + "s",
          "--x": Math.round((r(4) - 0.5) * 180) + "px", "--r": Math.round((r(5) - 0.5) * 1600) + "deg",
        } as CSSProperties;
        return <i key={i} style={style} />;
      })}
    </div>
  );
}

/** The full-screen moments. Each is shown to a reader once. */
export type FanfareKind = "open" | "final" | "crowned";

/** Which moment fits right now, if any. */
export function fanfareFor(clash: Clash): FanfareKind | null {
  if (clash.phase === "live") return clash.heat ? "final" : "open";
  if (clash.phase === "ended") return "crowned";
  return null;
}

const seenKey = (c: ChessCompetition, kind: FanfareKind, userId: number) => `uc_clash_${c.id}_${kind}_${userId}`;
export function fanfareSeen(c: ChessCompetition, kind: FanfareKind, userId: number): boolean {
  try { return localStorage.getItem(seenKey(c, kind, userId)) === "1"; } catch { return true; }
}
export function markFanfareSeen(c: ChessCompetition, kind: FanfareKind, userId: number) {
  try { localStorage.setItem(seenKey(c, kind, userId), "1"); } catch { /* private mode: it may show again */ }
}

export function ClashFanfare({ kind, clash, selfId, onClose, onStandings }: { kind: FanfareKind; clash: Clash; selfId?: number; onClose: () => void; onStandings: () => void }) {
  const c = clash.competition;
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => { go.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!c) return null;
  const v = clash.view, champ = v?.standings[0], iWon = !!champ && champ.userId === selfId;
  return (
    <div className={"ucc-fanfare " + kind + (clash.heat ? " heat-" + clash.heat : "")} role="dialog" aria-modal="true" aria-label={c.name} data-testid={"crown-clash-fanfare-" + kind}>
      <span className="ucc-rays" aria-hidden="true" />
      <Confetti count={kind === "final" ? 40 : 90} />
      <div className="ucc-fanfare-in">
        <span className="ucc-crown" aria-hidden="true">♛</span>
        {kind === "open" && <>
          <small>A.R.I.S.E. presents</small>
          <h2>{c.name}</h2>
          <p className="ucc-big">{c.tagline}</p>
          <ClashCountdown clash={clash} />
          <p>Every chess win earns points from now until {clashLastDay(c)}. Climb the board and take the crown.</p>
        </>}
        {kind === "final" && <>
          <small>{c.name}</small>
          <h2>{clash.heat === "hour" ? "Final hour" : "Final day"}</h2>
          <p className="ucc-big">The crown is decided {clash.heat === "hour" ? "this hour" : "tonight"}.</p>
          <ClashCountdown clash={clash} />
          <p>{myLine(clash)}</p>
        </>}
        {kind === "crowned" && <>
          <small>{c.name} · final results</small>
          <h2>{iWon ? "You are the champion!" : "The crown is claimed"}</h2>
          {champ && !iWon && <p className="ucc-big">{champ.displayName} wins with {pts(champ.points)}.</p>}
          <ClashPodium standings={v?.standings || []} selfId={selfId} crowned />
          <p>{myLine(clash)}</p>
        </>}
        <div className="ucc-fanfare-actions">
          <button ref={go} type="button" className="ucc-go" onClick={onClose}>{kind === "open" ? "I'm in!" : kind === "final" ? "Let's play" : "Nice!"}</button>
          <button type="button" className="ucc-more" onClick={onStandings}>{kind === "crowned" ? "See the final standings" : "See the standings"}</button>
        </div>
      </div>
    </div>
  );
}

/** What the game that just finished did to the reader's place. */
export type ClashEarned = { last: ClashLast; before: number | null; after: number | null; points: number };

/** True when the game moved the reader up the board (or onto it). */
export function clashClimbed({ last, before, after }: ClashEarned): boolean {
  return last.counted && last.points > 0 && after !== null && (before === null || after < before);
}

/** The competition line on the end-of-game window. */
export function ClashEarnedLine({ earned, name }: { earned: ClashEarned; name: string }) {
  const { last, before, after, points } = earned;
  if (!last.counted) {
    return <div className="ucc-earned off" data-testid="crown-clash-earned"><b>{name}</b><span>{clashWhyText(last.why)}</span></div>;
  }
  const climbed = clashClimbed(earned);
  const place = after === null ? `Win a game to get on the ${name} board.`
    : after === 1 ? "You hold the crown!"
    : before === null ? `You are on the board at #${after}!`
    : after < before ? `Up ${places(before - after)} to #${after}!`
    : `You are #${after} with ${pts(points)}.`;
  return (
    <div className={"ucc-earned" + (last.points > 0 ? " win" : "") + (climbed ? " climbed" : "")} data-testid="crown-clash-earned">
      <b>{last.points > 0 ? "+" + last.points : name}</b>
      <span>{last.points > 0 ? `${name} ${last.points === 1 ? "point" : "points"}` : "No points this game. The next win counts!"}</span>
      <em>{place}</em>
    </div>
  );
}

/** "+4" for the game the reader is about to start. */
export function clashStake(mode: "computer" | "multiplayer", level: number): number {
  return mode === "computer" ? CLASH_POINTS.computer[Math.max(1, Math.min(4, level)) - 1] : CLASH_POINTS.reader;
}
