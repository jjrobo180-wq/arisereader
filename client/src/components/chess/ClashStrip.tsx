import { useEffect, useState } from "react";
import { clashClock, clashHeat, clashPhase, clashTarget, currentClash } from "@shared/chessCompetition";

/**
 * The chess competition on the Games page: one strip with the countdown that
 * opens Ultimate Chess. It shows while a competition is about to start, on, or
 * just ended (shared/chessCompetition.ts), and is gone the rest of the time.
 */
export default function ClashStrip({ onOpen }: { onOpen: () => void }) {
  const [, setTick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => setTick((t) => t + 1), 1000); return () => window.clearInterval(id); }, []);
  const now = Date.now(), c = currentClash(now);
  if (!c) return null;
  const phase = clashPhase(c, now), heat = clashHeat(c, now), t = clashClock(clashTarget(c, now) - now);
  const line = phase === "soon" ? "A chess competition is about to begin"
    : phase === "ended" ? "The crown is claimed. See who won!"
    : heat === "hour" ? "Final hour! Last chance to climb the board"
    : heat === "day" ? "Final day! The crown is decided tonight"
    : "Chess competition: win games, climb the board";
  const cells: [string, number][] = [["days", t.days], ["hrs", t.hours], ["min", t.minutes], ["sec", t.seconds]];
  const left = phase === "ended" ? "" : ` ${t.days} days and ${t.hours} hours ${phase === "soon" ? "until it starts" : "left"}.`;
  return (
    <button type="button" className={"worlds-clash " + phase + (heat ? " hot" : "")} onClick={onOpen} aria-label={`${c.name}. ${line}.${left}`} data-testid="games-crown-clash">
      <span className="worlds-clash-crown" aria-hidden="true">♛</span>
      <span className="worlds-clash-text"><b>{c.name}</b><small>{line}</small></span>
      {phase !== "ended" && (
        <span className="worlds-clash-clock" aria-hidden="true">
          {cells.map(([name, n]) => <span key={name}><b>{String(n).padStart(2, "0")}</b><i>{name}</i></span>)}
        </span>
      )}
      <span className="worlds-clash-go">{phase === "ended" ? "See the champions" : phase === "soon" ? "Warm up" : "Play chess"}</span>
    </button>
  );
}
