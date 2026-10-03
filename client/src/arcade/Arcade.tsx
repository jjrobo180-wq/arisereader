import { useCallback, useEffect, useRef, useState } from "react";
import "./arcade.css";
import type { CategoryId } from "@shared/arcade/catalog";
import { GAME_INFO } from "@shared/arcade/catalog";
import { arcadeApi, useArcadeLobby, useArcadeMatch, type LobbyTable, type StartOptions } from "./api";
import GameRoom, { type Reader } from "./GameRoom";
import GameScreen from "./GameScreen";
import { sfx } from "./sound";

type Props = {
  token: string | null;
  /** Game room visible. */
  open: boolean;
  onOpen: (category?: CategoryId | "all") => void;
  onClose: () => void;
  category?: CategoryId | "all";
  readers: Reader[];
  challenge?: Reader | null;
  onClearChallenge?: () => void;
  locked?: string | null;
  onOpenChess?: () => void;
  /** Called when a full-screen arcade view (room or game) opens or closes. */
  onCoverChange?: (covered: boolean) => void;
};

/** The last games this student started, newest first (for "Jump back in"). */
function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem("arcade_recent") || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}
function rememberGame(gameId: string) {
  try {
    localStorage.setItem("arcade_recent", JSON.stringify([gameId, ...readRecent().filter((x) => x !== gameId)].slice(0, 12)));
  } catch { /* storage off */ }
}

export default function Arcade({ token, open, onOpen, onClose, category = "all", readers, challenge, onClearChallenge, locked, onOpenChess, onCoverChange }: Props) {
  const game = useArcadeMatch(token);
  const { match } = game;
  const { lobby, refresh } = useArcadeLobby(token, !match, open ? 4000 : 6000);
  const lastStart = useRef<{ gameId: string; opts: StartOptions } | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [recent, setRecent] = useState<string[]>(readRecent);
  const covered = open || !!match;
  useEffect(() => { onCoverChange?.(covered); }, [covered, onCoverChange]);

  const start = useCallback(async (gameId: string, opts: StartOptions) => {
    sfx("tap");
    lastStart.current = { gameId, opts };
    rememberGame(gameId);
    setRecent(readRecent());
    const m = await game.start(gameId, opts);
    if (m) onClearChallenge?.();
    else void refresh();
  }, [game, onClearChallenge, refresh]);

  const rematch = useCallback(async () => {
    if (!match) return;
    const opponent = match.players.find((p) => p.seat !== match.seat);
    const gameId = match.gameId;
    if (match.computer) await start(gameId, { computer: true, level: match.level });
    else if (match.status === "finished" && opponent?.userId) await start(gameId, { inviteUserId: opponent.userId });
    else await start(gameId, {});
  }, [match, start]);

  const computerInstead = useCallback(async () => {
    if (!match) return;
    const gameId = match.gameId;
    await game.leave();
    let level = 2;
    try { level = Number(localStorage.getItem("arcade_level")) || 2; } catch { /* ignore */ }
    await start(gameId, { computer: true, level });
  }, [match, game, start]);

  const decline = useCallback(async (t: LobbyTable) => {
    setDismissed((d) => new Set(d).add(t.matchId));
    try { await arcadeApi.decline(token, t.matchId); } catch { /* ignore */ }
    void refresh();
  }, [token, refresh]);

  // A challenge that arrives while the student is walking around the arcade.
  const invite = !open && !match ? lobby.invites.find((t) => !dismissed.has(t.matchId)) : undefined;
  const seenInvite = useRef<string | null>(null);
  useEffect(() => {
    if (invite && seenInvite.current !== invite.matchId) { seenInvite.current = invite.matchId; sfx("turn"); }
  }, [invite?.matchId]);

  if (match) {
    return (
      <GameScreen
        match={match}
        busy={game.busy}
        thinking={game.thinking}
        error={game.error}
        onAct={(move) => { sfx("tap"); void game.act(move); }}
        onLeave={() => { void game.leave(); void refresh(); }}
        onRematch={() => void rematch()}
        onClaim={() => void game.claim()}
        onComputerInstead={() => void computerInstead()}
        onClearError={() => game.setError("")}
      />
    );
  }

  return (
    <>
      {open && (
        <GameRoom
          onClose={onClose}
          onStart={(id, opts) => void start(id, opts)}
          onDeclineInvite={(t) => void decline(t)}
          onOpenChess={onOpenChess ? () => { rememberGame("chess"); setRecent(readRecent()); onOpenChess(); } : undefined}
          recent={recent}
          lobby={{ tables: lobby.tables, invites: lobby.invites.filter((t) => !dismissed.has(t.matchId)) }}
          readers={readers}
          busy={game.busy}
          error={game.error}
          locked={locked}
          initialCategory={category}
          challenge={challenge}
          onClearChallenge={onClearChallenge}
        />
      )}
      {invite && (
        <div className="ax-vars">
          <div className="ax-invite-pop" role="alertdialog" aria-label="Game challenge">
            <p>{invite.hostName} challenged you to {GAME_INFO[invite.gameId]?.title || invite.gameName}{GAME_INFO[invite.gameId] ? ` (${GAME_INFO[invite.gameId].name})` : ""}!</p>
            <div className="ax-row">
              <button type="button" className="ax-btn ax-btn-ghost" style={{ flex: 1 }} onClick={() => void decline(invite)}>No thanks</button>
              <button type="button" className="ax-btn ax-btn-gold" style={{ flex: 1 }} disabled={!!locked || game.busy} onClick={() => { onOpen(); void start(invite.gameId, { matchId: invite.matchId }); }}>Accept</button>
            </div>
            {locked && <p className="ax-note">{locked}</p>}
          </div>
        </div>
      )}
    </>
  );
}
