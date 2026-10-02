import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, GAMES, GAME_INFO, type CategoryId, type GameInfo } from "@shared/arcade/catalog";
import type { Lobby, LobbyTable, StartOptions } from "./api";
import { IconBack, IconBot, IconClose, IconSearch, IconUsers } from "./icons";

export type Reader = { userId: number; name: string };
type Props = {
  onClose: () => void;
  onStart: (gameId: string, opts: StartOptions) => void;
  onDeclineInvite: (table: LobbyTable) => void;
  onOpenChess?: () => void;
  lobby: Lobby;
  readers: Reader[];
  busy: boolean;
  error: string;
  locked?: string | null; // why games are unavailable right now
  initialCategory?: CategoryId | "all";
  challenge?: Reader | null; // set when the student picked "Challenge" on a reader
  onClearChallenge?: () => void;
};

const LEVELS = [{ id: 1, name: "Easy" }, { id: 2, name: "Medium" }, { id: 3, name: "Hard" }];

export default function GameRoom({ onClose, onStart, onDeclineInvite, onOpenChess, lobby, readers, busy, error, locked, initialCategory = "all", challenge, onClearChallenge }: Props) {
  const [cat, setCat] = useState<CategoryId | "all">(initialCategory);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<GameInfo | null>(null);
  const [level, setLevel] = useState<number>(() => { try { return Number(localStorage.getItem("arcade_level")) || 2; } catch { return 2; } });
  useEffect(() => setCat(initialCategory), [initialCategory]);
  useEffect(() => { try { localStorage.setItem("arcade_level", String(level)); } catch { /* ignore */ } }, [level]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (picked) setPicked(null); else onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked, onClose]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GAMES.filter((g) => (cat === "all" || g.category === cat) && (!q || g.name.toLowerCase().includes(q) || g.blurb.toLowerCase().includes(q)));
  }, [cat, query]);
  const tablesFor = (id: string) => lobby.tables.filter((t) => t.gameId === id);
  const live = [...lobby.invites.map((t) => ({ ...t, invite: true })), ...lobby.tables.map((t) => ({ ...t, invite: false }))];
  const color = (id: string) => GAME_INFO[id]?.color || "#3ee6ff";

  return (
    <section className="ax-root" aria-label="Game room">
      <header className="ax-room-head">
        <button type="button" className="ax-icon-btn" onClick={onClose} aria-label="Back to the arcade lounge"><IconBack /></button>
        <div className="ax-marquee">
          <h1>Game Room</h1>
          <p>{challenge ? `Pick a game to challenge ${challenge.name}.` : `${GAMES.length} games to play with readers or the computer.`}</p>
        </div>
        {challenge && <button type="button" className="ax-btn ax-btn-ghost ax-btn-small" onClick={onClearChallenge}>Cancel challenge</button>}
      </header>

      <div className="ax-tools">
        <label className="ax-search">
          <IconSearch />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games" aria-label="Search games" />
        </label>
      </div>
      <nav className="ax-cats" aria-label="Game categories">
        <button type="button" className="ax-cat" aria-pressed={cat === "all"} onClick={() => setCat("all")} style={{ ["--cat" as any]: "#f6f4ff" }}><span>🎮</span><span>All games</span></button>
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" className="ax-cat" aria-pressed={cat === c.id} onClick={() => setCat(c.id)} style={{ ["--cat" as any]: c.color }}>
            <span aria-hidden="true">{c.emoji}</span><span>{c.name}</span>
          </button>
        ))}
      </nav>

      <div className="ax-room-body">
        {locked && <div className="ax-alert" role="status">{locked}</div>}
        {error && <div className="ax-alert bad" role="alert">{error}</div>}

        {live.length > 0 && !challenge && (
          <>
            <h2 className="ax-section-title"><span><span className="ax-pulse" />Readers waiting to play</span><small>Join a table to start right away</small></h2>
            <div className="ax-live">
              {live.map((t) => (
                <div key={t.matchId} className={"ax-live-card" + (t.invite ? " invite" : "")}>
                  <span className="em" aria-hidden="true">{GAME_INFO[t.gameId]?.emoji}</span>
                  <span className="who">
                    <b>{t.invite ? `${t.hostName} challenged you!` : t.hostName}</b>
                    <span>{t.gameName}</span>
                  </span>
                  {t.invite && <button type="button" className="ax-btn ax-btn-ghost ax-btn-small" onClick={() => onDeclineInvite(t)}>No thanks</button>}
                  <button type="button" className={"ax-btn ax-btn-small " + (t.invite ? "ax-btn-gold" : "ax-btn-live")} disabled={busy || !!locked} onClick={() => onStart(t.gameId, { matchId: t.matchId })}>
                    {t.invite ? "Accept" : "Join"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="ax-section-title">
          {cat === "all" ? "All games" : CATEGORIES.find((c) => c.id === cat)?.name}
          <small>{cat === "all" ? "Tap a game to see how to play" : CATEGORIES.find((c) => c.id === cat)?.blurb}</small>
        </h2>
        {shown.length ? (
          <div className="ax-grid">
            {shown.map((g) => (
              <button key={g.id} type="button" className="ax-cart" aria-pressed={picked?.id === g.id} onClick={() => setPicked(g)} style={{ ["--game" as any]: g.color }}>
                <span className="ax-cart-art" aria-hidden="true"><span>{g.emoji}</span></span>
                {g.isNew && <span className="ax-sticker">New!</span>}
                <span className="ax-cart-text">
                  <b>{g.name}</b>
                  <span>{g.blurb}</span>
                  {tablesFor(g.id).length > 0 && <span style={{ color: "var(--ax-green)", fontWeight: 800 }}><span className="ax-pulse" />{tablesFor(g.id).length} waiting</span>}
                </span>
              </button>
            ))}
            {onOpenChess && (cat === "all" || cat === "board") && !query && !challenge && (
              <button type="button" className="ax-cart" onClick={onOpenChess} style={{ ["--game" as any]: "#d9b44a" }}>
                <span className="ax-cart-art" aria-hidden="true"><span>♛</span></span>
                <span className="ax-cart-text"><b>Ultimate Chess</b><span>Opens the chess arena.</span></span>
              </button>
            )}
          </div>
        ) : <p className="ax-empty">No games match "{query}". Try another word.</p>}
      </div>

      {picked && (
        <>
          <div className="ax-detail-scrim" onClick={() => setPicked(null)} />
          <aside className="ax-detail" style={{ ["--game" as any]: picked.color }} aria-label={picked.name}>
            <div className="ax-detail-top">
              <div className="em" aria-hidden="true">{picked.emoji}</div>
              <h2>{picked.name}</h2>
              <p>{picked.blurb} About {picked.minutes} min.</p>
              <button type="button" className="ax-icon-btn" onClick={() => setPicked(null)} aria-label="Close"><IconClose /></button>
            </div>
            <div className="ax-detail-body">
              <ul className="ax-how">{picked.how.map((h) => <li key={h}>{h}</li>)}</ul>

              {challenge ? (
                <div className="ax-block">
                  <h3>Challenge {challenge.name}</h3>
                  <p className="ax-note" style={{ marginTop: 0 }}>{challenge.name} gets an invite and the game starts when they accept.</p>
                  <button type="button" className="ax-btn ax-btn-live ax-wide" disabled={busy || !!locked} onClick={() => onStart(picked.id, { inviteUserId: challenge.userId })}>Send challenge</button>
                </div>
              ) : (
                <>
                  <div className="ax-block">
                    <h3>Play the computer</h3>
                    <div className="ax-levels" role="group" aria-label="Computer level">
                      {LEVELS.map((l) => <button key={l.id} type="button" aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>{l.name}</button>)}
                    </div>
                    <button type="button" className="ax-btn ax-btn-primary ax-wide" disabled={busy || !!locked} onClick={() => onStart(picked.id, { computer: true, level })}>
                      <IconBot /> Play the computer
                    </button>
                  </div>
                  <div className="ax-block">
                    <h3>Play a reader</h3>
                    {tablesFor(picked.id).map((t) => (
                      <div key={t.matchId} className="ax-reader" style={{ marginBottom: 8 }}>
                        <b><span className="ax-pulse" />{t.hostName} is waiting</b>
                        <button type="button" className="ax-btn ax-btn-live ax-btn-small" disabled={busy || !!locked} onClick={() => onStart(picked.id, { matchId: t.matchId })}>Join</button>
                      </div>
                    ))}
                    <button type="button" className="ax-btn ax-btn-live ax-wide" disabled={busy || !!locked} onClick={() => onStart(picked.id, {})}>
                      <IconUsers /> {tablesFor(picked.id).length ? "Join the next open table" : "Find a reader"}
                    </button>
                    {readers.length > 0 ? (
                      <div className="ax-readers">
                        <p className="ax-note" style={{ margin: "4px 0 0" }}>Or challenge someone in the arcade:</p>
                        {readers.slice(0, 8).map((r) => (
                          <div key={r.userId} className="ax-reader">
                            <b>{r.name}</b>
                            <button type="button" className="ax-btn ax-btn-ghost ax-btn-small" disabled={busy || !!locked} onClick={() => onStart(picked.id, { inviteUserId: r.userId })}>Challenge</button>
                          </div>
                        ))}
                      </div>
                    ) : <p className="ax-note">Your table shows up for everyone in the Game Room. You can play the computer while you wait.</p>}
                  </div>
                </>
              )}
            </div>
          </aside>
        </>
      )}
    </section>
  );
}
