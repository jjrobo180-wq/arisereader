// Study Squad: a study hall readers walk around in (3D), with tables to sit
// at and play study games together. This page owns the data and the on-screen
// controls; hall/scene.ts draws the room.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import MobileJoystick from "@/components/MobileJoystick";
import { ROOM } from "@shared/study/game";
import { LOUNGE, type LoungeTable, type LoungeView } from "@shared/study/lounge";
import { STUDY_WORLD_TITLE, type StudySetSummary } from "@shared/study/sets";
import { studyClient, type Boot, type BoardRow, type RoomView, type Synced } from "./api";
import type { HallSpot, StudyHallScene } from "./hall/scene";
import TablePanel from "./TablePanel";
import SetShelf from "./SetShelf";
import Flashcards from "./Flashcards";
import { IconBack, IconCards, IconClose, IconCoin, IconDoor, IconSets, IconTables, IconTrophy, IconWave } from "./icons";
import "./study.css";

type Panel = null | "tables" | "sets" | "pick" | "cards" | "board";

const tableLabel = (t: LoungeTable, i: number) => (!t ? `Table ${i + 1}` : !t.publicTable ? "Private table" : `${t.hostName}'s table`);
const playing = (t: LoungeTable) => !!t && t.phase !== "lobby" && t.phase !== "finished";

export default function StudySquad() {
  const { token, user } = useAuth();
  const [, navigate] = useLocation();
  const api = useMemo(() => studyClient(token), [token]);
  const [boot, setBoot] = useState<Boot | null>(null);
  const [fatal, setFatal] = useState("");
  const [lounge, setLounge] = useState<LoungeView | null>(null);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [sets, setSets] = useState<StudySetSummary[]>([]);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [cardsSet, setCardsSet] = useState<string | null>(null);
  const [spot, setSpot] = useState<HallSpot | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [no3d, setNo3d] = useState(false);
  const [tableHidden, setTableHidden] = useState(false);
  const [code, setCode] = useState("");
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<StudyHallScene | null>(null);
  const roomRef = useRef<RoomView | null>(null);
  const offsetRef = useRef(0);
  const seq = useRef(0), applied = useRef(0);
  const wantFloor = useRef<number | undefined>(undefined);
  const phrases = useRef(new Map<number, string>());
  const meId = boot?.me.id ?? 0;
  const meIdRef = useRef(0);
  meIdRef.current = meId;
  const [coins, setCoins] = useState(0);
  const counted = useRef(false);

  const say = useCallback((text: string) => { setNotice(text); }, []);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(""), 4200);
    return () => window.clearTimeout(t);
  }, [notice]);

  /** Takes in fresh data from the server, ignoring replies that arrive out of order. */
  const apply = useCallback((id: number, data: Partial<Synced>) => {
    if (id < applied.current) return;
    applied.current = id;
    if (data.lounge) {
      setLounge(data.lounge);
      sceneRef.current?.setPeople(data.lounge.people);
      sceneRef.current?.setTables(data.lounge.tables);
    }
    if (data.room !== undefined) {
      const next = data.room;
      if (next) {
        offsetRef.current = next.now - Date.now();
        for (const p of next.players) {
          const before = phrases.current.get(p.id) ?? null;
          if (p.phrase && p.phrase !== before) sceneRef.current?.say(p.id, p.phrase);
          if (p.phrase) phrases.current.set(p.id, p.phrase); else phrases.current.delete(p.id);
        }
        const me = next.players.find((p) => p.id === meIdRef.current);
        sceneRef.current?.setSeat(me ? { table: next.table, seat: me.seat } : null);
      } else {
        sceneRef.current?.setSeat(null);
        phrases.current.clear();
      }
      roomRef.current = next;
      setRoom(next);
    }
  }, []);

  // arrive in the hall
  useEffect(() => {
    if (!token) return;
    let alive = true;
    api.boot().then((b) => {
      if (!alive) return;
      setBoot(b); setSets(b.sets); setBoard(b.board); setLounge(b.lounge); setCoins(b.stats.coinsToday);
      // teachers usually come here to add sets for their class
      if (b.me.teacher) setPanel("sets");
    }).catch((e) => alive && setFatal(e.message || "The study hall couldn't open."));
    return () => { alive = false; };
  }, [api, token]);

  // the 3D hall (loaded on its own so a device that can't show 3D still gets the tables list)
  useEffect(() => {
    const mount = mountRef.current;
    if (!boot || !mount) return;
    let gone = false;
    import("./hall/scene").then(({ StudyHallScene }) => {
      if (gone) return;
      try {
        const scene = new StudyHallScene(mount, boot.me, { onSpot: setSpot });
        sceneRef.current = scene;
        scene.setBoard(boot.board);
        scene.setPeople(boot.lounge.people); scene.setTables(boot.lounge.tables);
      } catch (e) { console.error("[study] 3D hall", e); setNo3d(true); }
    }).catch((e) => { console.error("[study] 3D hall", e); if (!gone) setNo3d(true); });
    return () => { gone = true; sceneRef.current?.dispose(); sceneRef.current = null; };
  }, [boot?.me.id, boot?.me.characterId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { sceneRef.current?.setBoard(board); }, [board]);

  // stay in touch with the server: where I am, who else is here, and my table
  useEffect(() => {
    if (!boot) return;
    let stop = false, timer = 0;
    const tick = async () => {
      const id = ++seq.current;
      try {
        const pos = roomRef.current ? {} : sceneRef.current?.position ?? {};
        const data = await api.sync({ ...pos, floor: wantFloor.current });
        wantFloor.current = undefined;
        if (stop) return;
        setOffline(false);
        apply(id, data);
      } catch { if (!stop) setOffline(true); }
      if (!stop) timer = window.setTimeout(tick, roomRef.current ? 650 : 1000);
    };
    void tick();
    return () => { stop = true; window.clearTimeout(timer); void api.leaveHall().catch(() => {}); };
  }, [boot?.me.id, api, apply]); // eslint-disable-line react-hooks/exhaustive-deps

  // refresh the weekly board and my sets when a game ends
  const finishedKey = room?.phase === "finished" ? room.code : "";
  useEffect(() => {
    if (!finishedKey) return;
    api.board().then((d) => setBoard(d.board)).catch(() => {});
  }, [finishedKey, api]);
  // add the coins from a finished game to today's count, once
  useEffect(() => {
    if (room?.phase !== "finished") { counted.current = false; return; }
    if (room.earned && !counted.current) { counted.current = true; setCoins((c) => c + room.earned!.coins); }
  }, [room?.phase, room?.earned]);
  const refreshSets = useCallback(() => api.sets().then((d) => setSets(d.sets)).catch(() => {}), [api]);

  // ─── Things the reader can do ──────────────────────────────────────────────
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await work(); } catch (e: any) { say(e?.message || "That didn't work. Try again."); } finally { setBusy(false); }
  };
  const sit = (where: { table?: number; code?: string }) => run(async () => {
    const id = ++seq.current;
    apply(id, await api.sit(where));
    setPanel(null); setTableHidden(false); setCode("");
  });
  const act = useCallback(async (body: Record<string, unknown>) => {
    const current = roomRef.current; if (!current) return;
    const id = ++seq.current;
    try { apply(id, await api.act(current.code, body)); }
    catch (e: any) { say(e?.message || "That didn't work. Try again."); }
  }, [api, apply, say]);
  const stand = () => run(async () => {
    const current = roomRef.current; if (!current) return;
    const id = ++seq.current;
    const data = await api.stand(current.code);
    apply(id, { lounge: data.lounge, room: null });
  });
  const leaveHall = () => navigate(boot?.me.teacher ? (user?.isAdmin ? "/admin" : "/teacher-dashboard") : "/games");
  const changeFloor = (floor: number) => { wantFloor.current = floor; say(`Heading to floor ${floor}…`); };

  const spotAction = (() => {
    if (!spot || room) return null;
    if (spot.kind === "station") {
      if (spot.id === "library") return { label: "Open the study sets", icon: <IconSets />, go: () => setPanel("sets") };
      if (spot.id === "cards") return { label: "Practice with flashcards", icon: <IconCards />, go: () => { setCardsSet(null); setPanel("cards"); } };
      if (spot.id === "board") return { label: "See the weekly board", icon: <IconTrophy />, go: () => setPanel("board") };
      return { label: "Leave the study hall", icon: <IconDoor />, go: leaveHall };
    }
    const t = lounge?.tables[spot.table] ?? null;
    if (!t) return { label: `Sit at table ${spot.table + 1}`, icon: <IconTables />, go: () => void sit({ table: spot.table }) };
    if (playing(t)) return { label: `${tableLabel(t, spot.table)} is mid-game`, icon: <IconTables />, go: null };
    if (!t.publicTable) return { label: "Private table: enter its code", icon: <IconTables />, go: () => setPanel("tables") };
    if (t.seats.length >= ROOM.seats && !t.seats.some((s) => s.bot)) return { label: `${tableLabel(t, spot.table)} is full`, icon: <IconTables />, go: null };
    return { label: `Join ${tableLabel(t, spot.table)}`, icon: <IconTables />, go: () => void sit({ table: spot.table }) };
  })();

  // Enter (or E) uses whatever the reader is standing next to
  const actionRef = useRef(spotAction); actionRef.current = spotAction;
  const panelRef = useRef(panel); panelRef.current = panel;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.tagName === "BUTTON")) return;
      if (e.key === "Escape" && panelRef.current) { setPanel(null); return; }
      if ((e.key === "Enter" || e.key.toLowerCase() === "e") && !panelRef.current && !roomRef.current) actionRef.current?.go?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (fatal) {
    return (
      <main className="sq sq-center">
        <div className="sq-slate sq-msg">
          <h1>The study hall is closed</h1>
          <p>{fatal}</p>
          <button type="button" className="sq-btn sq-btn-main" onClick={() => navigate("/library")}>Back to the library</button>
        </div>
      </main>
    );
  }

  const here = lounge?.people.length ?? 0;
  const tableOpen = !!room && !tableHidden;
  const canHide = !!room && (room.phase === "lobby" || room.phase === "finished");
  const closePanel = () => setPanel(null);
  // without the 3D hall, the tables list is the hall
  const shown: Panel = panel ?? (no3d && !room && boot ? "tables" : null);

  return (
    <main className={"club-world-root sq" + (no3d ? " sq-flat" : "")} aria-label={STUDY_WORLD_TITLE}>
      <div ref={mountRef} className="sq-stage" aria-hidden="true" />
      {!boot && <div className="sq-loading" role="status">Opening the study hall…</div>}

      <header className="sq-top">
        <button type="button" className="sq-round" onClick={leaveHall} aria-label="Leave the study hall"><IconBack /></button>
        <div className="sq-title">
          <b>{STUDY_WORLD_TITLE}</b>
          {lounge && <span>Floor {lounge.floor}, {here === 1 ? "just you so far" : `${here} readers here`}</span>}
        </div>
        {boot && (
          <nav className="sq-tools" aria-label="Study hall">
            {boot.me.student && <span className="sq-chip" title={`Up to ${boot.rewards.dailyCap} Reader Coins a day from study games`}><IconCoin /> {coins} today</span>}
            <button type="button" className="sq-pill" onClick={() => setPanel("tables")}><IconTables /><span>Tables</span></button>
            <button type="button" className="sq-pill" onClick={() => setPanel("sets")}><IconSets /><span>Study sets</span></button>
            <button type="button" className="sq-pill" onClick={() => { setCardsSet(null); setPanel("cards"); }}><IconCards /><span>Flashcards</span></button>
            <button type="button" className="sq-pill" onClick={() => setPanel("board")}><IconTrophy /><span>Board</span></button>
          </nav>
        )}
      </header>

      {boot && !room && !shown && !no3d && (
        <>
          <MobileJoystick onMove={(key, on) => sceneRef.current?.moveKey(key, on)} className="bottom-24 left-4" label="Walk around the study hall" />
          <button type="button" className="sq-round sq-wave" onClick={() => sceneRef.current?.wave()} aria-label="Wave"><IconWave /></button>
          {spotAction
            ? <button type="button" className="sq-act" disabled={!spotAction.go || busy} onClick={() => spotAction.go?.()}>{spotAction.icon}<span>{spotAction.label}</span></button>
            : <p className="sq-hint">Walk up to a table to sit down. Drag to look around.</p>}
        </>
      )}
      {room && tableHidden && <button type="button" className="sq-act" onClick={() => setTableHidden(false)}><IconTables /><span>Back to my table</span></button>}

      {tableOpen && boot && room && (
        <TablePanel
          room={room} meId={meId} offset={offsetRef.current} phrases={boot.phrases} rewards={boot.rewards} student={boot.me.student}
          act={act} onLeave={() => void stand()} onPickSet={() => setPanel("pick")} onHide={canHide && !no3d ? () => setTableHidden(true) : undefined}
          onFlashcards={(id) => { setCardsSet(id); setPanel("cards"); }}
        />
      )}

      {shown === "tables" && lounge && (
        <section className="sq-sheet" role="dialog" aria-label="Tables">
          <div className="sq-slate">
            <header className="sq-slate-head">
              <h2>Tables on floor {lounge.floor}</h2>
              {(!no3d || room) && <button type="button" className="sq-round sq-round-sm" onClick={closePanel} aria-label="Close"><IconClose /></button>}
            </header>
            {room && <p className="sq-note">You're at {tableLabel(lounge.tables[room.table] ?? null, room.table)}. Sitting somewhere else leaves it.</p>}
            <ul className="sq-tables">
              {lounge.tables.map((t, i) => {
                const full = !!t && t.seats.length >= ROOM.seats && !t.seats.some((s) => s.bot);
                const mine = !!room && room.table === i;
                return (
                  <li key={i} className={"sq-table" + (t ? "" : " open") + (mine ? " mine" : "")}>
                    <div>
                      <b>{tableLabel(t, i)}</b>
                      <span>{!t ? "Open. Sit down to start a game." : playing(t) ? "Game in progress" : !t.publicTable ? "Needs the table code" : `${t.setTitle || "Getting ready"}, ${t.seats.length} of ${ROOM.seats} seats`}</span>
                    </div>
                    {mine ? <button type="button" className="sq-btn" onClick={() => { setPanel(null); setTableHidden(false); }}>Go to table</button>
                      : !t ? <button type="button" className="sq-btn sq-btn-main" disabled={busy} onClick={() => void sit({ table: i })}>Sit here</button>
                      : t.publicTable && !playing(t) && !full ? <button type="button" className="sq-btn sq-btn-main" disabled={busy} onClick={() => void sit({ table: i })}>Join</button>
                      : <span className="sq-tag">{playing(t) ? "Playing" : full ? "Full" : "Private"}</span>}
                  </li>
                );
              })}
            </ul>
            <form className="sq-code" onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 6) void sit({ code: code.trim() }); }}>
              <label htmlFor="sq-code">Have a table code from a friend?</label>
              <div>
                <input id="sq-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="6 letters" autoComplete="off" inputMode="text" />
                <button type="submit" className="sq-btn" disabled={busy || code.trim().length < 6}>Join with code</button>
              </div>
            </form>
            {lounge.floors.length > 1 && (
              <div className="sq-floors" role="group" aria-label="Floor">
                {lounge.floors.map((f) => (
                  <button key={f.floor} type="button" className="sq-opt" aria-pressed={f.floor === lounge.floor} disabled={!!room || (f.floor !== lounge.floor && f.people >= LOUNGE.capacity)} onClick={() => changeFloor(f.floor)}>
                    Floor {f.floor} <small>{f.people} here</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {(shown === "sets" || shown === "pick") && boot && (
        <SetShelf
          api={api} boot={boot} sets={sets} refresh={refreshSets} onClose={closePanel} say={say}
          pick={shown === "pick" && room ? (id) => { void act({ type: "settings", setId: id }); setPanel(null); } : undefined}
          onFlashcards={(id) => { setCardsSet(id); setPanel("cards"); }}
          onAiUsed={(left) => setBoot((b) => (b ? { ...b, ai: { ...b.ai, left } } : b))}
          onRules={(rules) => setBoot((b) => (b ? { ...b, rules } : b))}
        />
      )}

      {shown === "cards" && boot && <Flashcards api={api} sets={sets} startWith={cardsSet} onClose={closePanel} />}

      {shown === "board" && (
        <section className="sq-sheet" role="dialog" aria-label="Weekly board">
          <div className="sq-slate sq-slate-narrow">
            <header className="sq-slate-head">
              <h2>This week's top studiers</h2>
              <button type="button" className="sq-round sq-round-sm" onClick={closePanel} aria-label="Close"><IconClose /></button>
            </header>
            {board.length === 0
              ? <p className="sq-note">Nobody's on the board yet this week. Finish a game and your name goes up.</p>
              : <ol className="sq-board">{board.map((r) => <li key={r.place + r.name} className={r.me ? "me" : ""}><i>{r.place}</i><b>{r.name}{r.me ? " (you)" : ""}</b><span>{r.points} pts</span></li>)}</ol>}
            <p className="sq-fine">10 points for every right answer, plus 20 for winning. The board starts fresh every Monday.</p>
            {boot && boot.stats.games > 0 && <p className="sq-fine">Your total: {boot.stats.games} games, {boot.stats.wins} wins, {boot.stats.answered ? Math.round((boot.stats.correct / boot.stats.answered) * 100) : 0}% right.</p>}
          </div>
        </section>
      )}

      {notice && <div className="sq-toast" role="status">{notice}</div>}
      {offline && <div className="sq-toast sq-toast-warn" role="status">Reconnecting to the study hall…</div>}
    </main>
  );
}
