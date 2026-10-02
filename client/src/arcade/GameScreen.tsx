import { useEffect, useMemo, useRef, useState } from "react";
import { GAME_INFO, LEVEL_NAMES } from "@shared/arcade/catalog";
import type { ArcadeMatch, Seat } from "./api";
import { BOARDS } from "./boards";
import { IconBack, IconHelp, IconSound } from "./icons";
import { isMuted, setMuted, sfx } from "./sound";

type Props = {
  match: ArcadeMatch;
  busy: boolean;
  thinking: boolean;
  error: string;
  onAct: (move: unknown) => void;
  onLeave: () => void; // leave the match and go back to the game room
  onRematch: () => void;
  onClaim: () => void;
  onComputerInstead: () => void;
  onClearError: () => void;
};

const P1 = "var(--ax-p1)", P2 = "var(--ax-p2)";
/** Dark piece colors (black discs and stones) get a light ring so the turn highlight still shows. */
function ringFor(color: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum < 0.25 ? "#a9add9" : color;
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 70 }, (_, i) => ({
    left: (i * 37) % 100, delay: (i % 12) * 0.07, dur: 1.7 + (i % 7) * 0.22,
    color: ["#ffd23f", "#3ee6ff", "#ff4fd8", "#4ade80", "#ff6b6b", "#a78bfa"][i % 6],
  })), []);
  return <div className="ax-confetti" aria-hidden="true">{pieces.map((p, i) => <i key={i} style={{ left: p.left + "%", background: p.color, animationDuration: p.dur + "s", animationDelay: p.delay + "s" }} />)}</div>;
}

export default function GameScreen({ match, busy, thinking, error, onAct, onLeave, onRematch, onClaim, onComputerInstead, onClearError }: Props) {
  const info = GAME_INFO[match.gameId];
  const meta = BOARDS[match.gameId];
  const seat = match.seat as Seat;
  const them: Seat = seat === 1 ? 2 : 1;
  const me = match.players.find((p) => p.seat === seat);
  const opp = match.players.find((p) => p.seat === them);
  const theirName = opp?.computer ? "Computer" : opp?.name || "Your opponent";
  const [help, setHelp] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const live = match.status === "active";
  const canAct = live && match.yourTurn && !busy && !thinking;

  // Sounds: a chime when it becomes my turn, a click when the board changes, fanfare at the end.
  const lastV = useRef(match.v);
  const wasMyTurn = useRef(match.yourTurn);
  useEffect(() => {
    if (match.v !== lastV.current) { lastV.current = match.v; if (live) sfx("place"); }
    if (live && match.yourTurn && !wasMyTurn.current && !match.computer) sfx("turn");
    wasMyTurn.current = match.yourTurn;
  }, [match.v, match.yourTurn, live, match.computer]);
  const ended = match.status === "finished";
  const won = ended && match.winner === seat;
  const tie = ended && match.winner === 0;
  useEffect(() => { if (ended) sfx(won ? "win" : tie ? "turn" : "lose"); }, [ended]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(onClearError, 3200);
    return () => window.clearTimeout(t);
  }, [error, onClearError]);

  const scores = meta?.scores && match.view ? meta.scores(match.view, seat) : null;
  const colors = meta?.colors || [P1, P2];
  const levelName = LEVEL_NAMES[match.level] || "Medium";
  const subtitle = match.computer ? `vs Computer (${levelName})` : match.status === "waiting" ? (match.invitee ? `Challenge sent to ${match.invitee.name}` : "Waiting for a reader") : `vs ${theirName}`;

  const status = (() => {
    if (!live) return null;
    if (thinking) return <span className="ax-status wait">Computer is thinking <span className="ax-think" aria-hidden="true"><i /><i /><i /></span></span>;
    if (match.yourTurn) {
      const both = match.toAct.length === 2;
      return <span className="ax-status mine">{both ? "Your move! You both play at the same time." : "Your turn!"}</span>;
    }
    if (match.toAct.length) return <span className="ax-status wait">Waiting for {theirName}<span className="ax-dots" /></span>;
    return null;
  })();

  const leaveNow = () => {
    if (live && !match.computer) { setConfirmLeave(true); return; }
    onLeave();
  };

  const player = (s: Seat, right: boolean) => {
    const p = match.players.find((x) => x.seat === s);
    const label = meta?.labels?.[s - 1];
    const turn = live && match.toAct.includes(s) && !thinking;
    return (
      <div className={"ax-player" + (right ? " right" : "") + (turn ? " turn" : "")} style={{ ["--seat" as any]: colors[s - 1], ["--ring" as any]: ringFor(colors[s - 1]) }}>
        <span className="ax-chip" aria-hidden="true" />
        <span className="nm">
          <b>{s === seat ? "You" : p?.computer ? "Computer" : p?.name || "Reader"}</b>
          <span>{[label, s !== seat && p?.computer ? levelName : ""].filter(Boolean).join(", ") || (s === seat ? me?.name : "")}</span>
        </span>
        {scores && <span className="ax-score" aria-label={`${scores[s - 1]} ${meta?.scoreLabel || "points"}`}>{scores[s - 1]}</span>}
      </div>
    );
  };

  const resultCopy = (() => {
    if (match.status === "cancelled") return { big: "👋", title: match.declined ? "No thanks" : "Game ended", tone: "var(--ax-dim)", text: match.declined ? `${match.invitee?.name || "They"} can't play right now. Try another reader or the computer.` : `${theirName} left the game before it finished.` };
    if (!ended) return null;
    const forfeit = match.result === "forfeit";
    if (won) return { big: "🏆", title: "You win!", tone: "var(--ax-gold)", text: forfeit ? `${theirName} left the game, so the win is yours.` : `Great game against ${theirName}!` };
    if (tie) return { big: "🤝", title: "It's a tie!", tone: "var(--ax-cyan)", text: "Evenly matched. Play again to break the tie?" };
    return { big: "💪", title: match.computer ? "Computer wins" : `${theirName} wins`, tone: "var(--ax-pink)", text: forfeit ? "You left the game, so it counts as a loss." : "So close! Every game makes you sharper." };
  })();

  const rewards = (() => {
    if (!ended || !match.reward) return null;
    const r = match.reward;
    const items: { text: string; on: boolean }[] = [];
    if (r.coins) { items.push({ text: "+10 Reader Coins", on: true }); if (won) items.push({ text: "+20 win bonus", on: true }); }
    if (won && r.points) items.push({ text: "+10 leaderboard points", on: true });
    if (!r.coins) items.push({ text: "Daily coin limit reached. This one was for fun!", on: false });
    else if (won && !r.points && match.result !== "forfeit") items.push({ text: "Leaderboard points are done for today", on: false });
    return items;
  })();

  return (
    <section className="ax-root ax-game" aria-label={`${info?.name || "Arcade"} game`}>
      <header className="ax-game-head">
        <button type="button" className="ax-icon-btn" onClick={leaveNow} aria-label="Back to the game room"><IconBack /></button>
        <div className="ax-game-title">
          <span className="em" aria-hidden="true">{info?.emoji}</span>
          <div style={{ minWidth: 0 }}>
            <h2>{info?.name || "Arcade"}</h2>
            <small>{subtitle}</small>
          </div>
        </div>
        <button type="button" className="ax-icon-btn" onClick={() => { const next = !muted; setMuted(next); setMutedState(next); }} aria-label={muted ? "Turn sound on" : "Turn sound off"}><IconSound off={muted} /></button>
        <button type="button" className="ax-icon-btn" onClick={() => setHelp(true)} aria-label="How to play"><IconHelp /></button>
      </header>

      {match.status === "waiting" ? (
        <div className="ax-waiting">
          <div className="ax-radar" aria-hidden="true">{info?.emoji}</div>
          <h3>{match.invitee ? `Waiting for ${match.invitee.name}` : "Finding a reader"}</h3>
          <p>{match.invitee
            ? `${match.invitee.name} got your challenge. The game starts as soon as they accept.`
            : `Your ${info?.name} table is open. Anyone in the Game Room can join it.`}</p>
          <div className="ax-row" style={{ flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" className="ax-btn ax-btn-primary" onClick={onComputerInstead}>Play the computer instead</button>
            <button type="button" className="ax-btn ax-btn-ghost" onClick={onLeave}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="ax-players">
            {player(seat, false)}
            <span className="ax-vs" aria-hidden="true">VS</span>
            {player(them, true)}
          </div>
          <div className="ax-status-wrap" aria-live="polite">{status || <span className="ax-status">&nbsp;</span>}</div>
          {match.opponentAway && live && !match.computer && (
            <div className="ax-away" role="status">
              <span>{theirName} seems to have left.</span>
              {match.canClaim
                ? <button type="button" className="ax-btn ax-btn-gold ax-btn-small" onClick={onClaim}>Claim the win</button>
                : <span>Waiting a little longer…</span>}
            </div>
          )}
          {meta && match.view ? (
            <div className={meta.scroll ? "ax-stage-scroll" : "ax-stage"}>
              <div style={meta.scroll ? { display: "flex", justifyContent: "center" } : { display: "contents" }}>
                <meta.Board view={match.view} seat={seat} canAct={canAct} act={onAct} finished={ended} myName="You" theirName={theirName} />
              </div>
            </div>
          ) : <div className="ax-empty">This game can't be shown. Go back and start a new one.</div>}
        </>
      )}

      {resultCopy && (
        <>
          {won && <Confetti />}
          <div className="ax-result-scrim">
            <div className="ax-result" role="dialog" aria-label={resultCopy.title} style={{ ["--tone" as any]: resultCopy.tone }}>
              <div className="big" aria-hidden="true">{resultCopy.big}</div>
              <h3>{resultCopy.title}</h3>
              <p>{resultCopy.text}</p>
              {rewards && rewards.length > 0 && <div className="ax-rewards">{rewards.map((r) => <span key={r.text} className={r.on ? "" : "off"}>{r.text}</span>)}</div>}
              <div className="actions">
                <button type="button" className="ax-btn ax-btn-primary ax-wide" onClick={onRematch}>
                  {match.computer ? "Play again" : match.status === "cancelled" ? "Find another reader" : `Rematch ${theirName}`}
                </button>
                <button type="button" className="ax-btn ax-btn-ghost ax-wide" onClick={onLeave}>Pick another game</button>
              </div>
            </div>
          </div>
        </>
      )}

      {help && info && (
        <div className="ax-help" role="dialog" aria-label={`How to play ${info.name}`} onClick={() => setHelp(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <h3>{info.emoji} {info.name}</h3>
            <ul className="ax-how" style={{ ["--game" as any]: info.color }}>{info.how.map((h) => <li key={h}>{h}</li>)}</ul>
            <button type="button" className="ax-btn ax-btn-primary ax-wide" onClick={() => setHelp(false)}>Got it</button>
          </div>
        </div>
      )}

      {confirmLeave && (
        <div className="ax-help" role="dialog" aria-label="Leave this game?">
          <div>
            <h3>Leave this game?</h3>
            <p className="ax-note" style={{ fontSize: 15, color: "var(--ax-dim)" }}>{theirName} will get the win if you leave now.</p>
            <div className="ax-row" style={{ marginTop: 14 }}>
              <button type="button" className="ax-btn ax-btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmLeave(false)}>Keep playing</button>
              <button type="button" className="ax-btn ax-btn-live" style={{ flex: 1 }} onClick={() => { setConfirmLeave(false); onLeave(); }}>Leave</button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="ax-toast" role="alert" onClick={onClearError}>{error}</div>}
    </section>
  );
}
