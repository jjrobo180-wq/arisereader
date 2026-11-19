// Arise Kids, the Arise AAC app's own screens: the bento Home, the TV-style Apps shelves, the Sticker Album,
// Card Quest and Pick It!. Drawn exactly like the prototype the owner chose (Nov 18, 2026): every size, color
// and space below is copied from it as written (css() turns the prototype's style text into React styles).
// Everything Arise AAC had before is a tile on the Apps shelves and opens its own page, as before.
// Data and rules: shared/ariseKids.ts.
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useLocation } from "wouter";
import TracePad from "./TracePad";
import { AnimalSounds, Breathe, ColorHunt, FirstThen, KidsTimer, type ExtraProps } from "./KidsExtras";
import { Icon, KIDS_TAB_PATHS, KidsTabBar, css, type KidsTab } from "./kidsUi";
import { useAuth } from "@/context/AuthContext";
import { sayAI } from "@/lib/aiVoice";
import { cachedParentControls, fetchFamilySettings, pathAllowed, type ParentControls } from "@/lib/parentControls";
import {
  DECKS, MOODS, QUESTIONS, STICKERS, cardStep, moodReply, pickStep, streak, streakMarks, visibleShelves, winSticker, wordOfDay,
  type DeckId, type KidsTile,
} from "@shared/ariseKids";

const PLAY = <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>;
const SPEAKER = "M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7";
const CLOSE = "M6 6l12 12M18 6 6 18";
const CHECK = "m5 12 5 5 9-10";
const STAR = "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z";

const FONT = "Lexend, system-ui, sans-serif";
const TOP = (px: number) => `max(${px}px, env(safe-area-inset-top))`;

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const say = (text: string) => { void sayAI(text, { voice: "calm" }).catch(() => false); };

function useStored<T>(key: string, start: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : start; } catch { return start; } });
  useEffect(() => { try { const raw = localStorage.getItem(key); setValue(raw ? JSON.parse(raw) as T : start); } catch { /* keep */ } }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (v: T) => { setValue(v); try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* only for now */ } };
  return [value, set];
}

type Extra = "hunt" | "firstthen" | "timer" | "breathe" | "sounds";
const EXTRAS: Record<Extra, ComponentType<ExtraProps>> = { hunt: ColorHunt, firstthen: FirstThen, timer: KidsTimer, breathe: Breathe, sounds: AnimalSounds };
type Screen = { kind: "tab" } | { kind: "cards"; deck: DeckId; index: number } | { kind: "pick"; q: number; on: number; picked: number | null } | { kind: "extra"; game: Extra };

export default function KidsApp({ tab }: { tab: KidsTab }) {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const uid = user?.id ?? "guest";
  const [won, setWon] = useStored<number[]>(`arise-kids:${uid}:stickers`, []);
  const [days, setDays] = useStored<string[]>(`arise-kids:${uid}:days`, []);
  const [mood, setMood] = useStored<string | null>(`arise-kids:${uid}:mood:${today()}`, null);
  const [screen, setScreen] = useState<Screen>({ kind: "tab" });
  const [albumTab, setAlbumTab] = useState(0);
  const [reward, setReward] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [traced, setTraced] = useState(false);
  const toastTimer = useRef<number>();
  const [controls, setControls] = useState<ParentControls>(cachedParentControls());

  // Today counts toward the days in a row.
  useEffect(() => { const d = today(); if (!days.includes(d)) setDays([...days, d].slice(-400)); }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let live = true;
    void fetchFamilySettings(token).then((r) => { if (live && r?.settings) setControls(r.settings); }).catch(() => {});
    return () => { live = false; };
  }, [token, uid]);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  // A new tab closes any game.
  useEffect(() => { setScreen({ kind: "tab" }); setReward(null); }, [tab]);

  // Pick It!: the highlight moves by itself until a box is picked.
  useEffect(() => {
    if (screen.kind !== "pick" || screen.picked !== null || reward !== null) return;
    const t = window.setInterval(() => setScreen((s) => s.kind === "pick" && s.picked === null ? { ...s, on: 1 - s.on } : s), 1500);
    return () => window.clearInterval(t);
  }, [screen.kind, screen.kind === "pick" ? screen.picked : null, reward]);
  // A switch (most send Space or Enter) or a keyboard picks in Pick It!, the same as a tap anywhere.
  const pickRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (screen.kind !== "pick") return;
    const key = (e: KeyboardEvent) => {
      if ((e.key !== " " && e.key !== "Enter") || (e.target as HTMLElement | null)?.closest?.("[data-close]")) return;
      e.preventDefault(); pickRef.current();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [screen.kind]);
  // Card and question are said out loud as they come up.
  const spoken = screen.kind === "cards" ? DECKS[screen.deck].cards[screen.index % DECKS[screen.deck].cards.length].title : screen.kind === "pick" ? QUESTIONS[screen.q % QUESTIONS.length].q : "";
  useEffect(() => { if (spoken) say(spoken); }, [spoken]);

  const showToast = (text: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(text); say(text);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  };
  const win = () => {
    const r = winSticker(won);
    setWon(r.won); setReward(r.sticker); setAlbumTab(r.sticker < 6 ? 0 : 1);
    say(`New sticker! ${STICKERS[r.sticker].name}!`);
  };
  const openCards = (deck: DeckId) => { setReward(null); setTraced(false); setScreen({ kind: "cards", deck, index: 0 }); };
  const openTile = (t: KidsTile) => {
    if (t.game === "cards") return openCards(t.deck ?? "letters");
    if (t.game === "pick") { setReward(null); return setScreen({ kind: "pick", q: 0, on: 0, picked: null }); }
    if (t.game === "stickers") return navigate(KIDS_TAB_PATHS.stickers);
    if (t.game && t.game in EXTRAS) { setReward(null); say(t.name); return setScreen({ kind: "extra", game: t.game as Extra }); }
    if (t.game === "update") { setToast("Checking for the newest version…"); void import("@/lib/nativeApp").then((m) => m.checkForUpdateNow()).catch(() => "Couldn't check for updates.").then((msg) => { setToast(msg); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(""), 8000); }); return; }
    if (t.path) { say(t.name); navigate(t.path); }
  };
  // Closing a game goes back to the screen it was opened from (Home, Apps or Stickers).
  const goHome = () => { setScreen({ kind: "tab" }); };

  // Each tile follows the same permission its page checks (a game: Games; Quizzes and Books: the library).
  const allowed = (path: string) => pathAllowed(path, controls);
  const shelves = useMemo(() => visibleShelves(allowed), [controls]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstName = user?.displayName?.split(" ")[0] || user?.username || "Friend";
  const weekday = new Date().toLocaleDateString(undefined, { weekday: "long" });
  const word = wordOfDay(today());
  const run = streak(days, today());
  const marks = streakMarks(run);
  const have = won.length, total = STICKERS.length;

  let body: ReactNode;
  if (screen.kind === "extra") {
    const Extra = EXTRAS[screen.game];
    body = <Extra key={screen.game} onClose={goHome} onWin={win} say={say} go={(path) => { setScreen({ kind: "tab" }); navigate(path); }} openTab={(t) => { setScreen({ kind: "tab" }); navigate(KIDS_TAB_PATHS[t as KidsTab] ?? KIDS_TAB_PATHS.home); }} />;
  } else if (screen.kind === "cards") {
    const deck = DECKS[screen.deck];
    const card = deck.cards[screen.index % deck.cards.length];
    const step = (done: boolean) => { const r = cardStep(screen.deck, screen.index, done); setTraced(false); setScreen({ ...screen, index: r.index }); if (r.win) win(); };
    // A tracing card counts once the letter is traced; "Later" always moves on.
    const needsTrace = !!card.trace && !traced;
    const didIt = () => { if (needsTrace) { showToast("Trace the letter first, or tap Later."); return; } step(true); };
    const hear = () => say(card.say ?? `${card.title}. ${card.hint}.`);
    body = (
      <div style={css("position: absolute; inset: 0; background: #111827; color: #ffffff; padding: 52px 20px 30px; box-sizing: border-box; display: flex; flex-direction: column; gap: 18px")} data-screen="cards">
        <div style={{ ...css("display: flex; align-items: center; gap: 12px"), marginTop: `calc(${TOP(52)} - 52px)` }}>
          <button type="button" onClick={goHome} aria-label="Close the game" style={css("width: 48px; height: 48px; border-radius: 24px; border: 0; background: #2a3450; color: #ffffff; display: flex; align-items: center; justify-content: center")}><Icon d={CLOSE} size={22} width={2.6} /></button>
          <span style={css("font-size: 17px; font-weight: 600; flex-grow: 1")}>Card Quest · {deck.name}</span>
          <span style={css("font-size: 17px; font-weight: 800")}>{(screen.index % deck.cards.length) + 1} of {deck.cards.length}</span>
        </div>
        <div style={css("flex-grow: 1; position: relative")}>
          <div style={css("position: absolute; left: 24px; right: 24px; top: 28px; bottom: 0; border-radius: 34px; background: #2a3450")} />
          <div style={css("position: absolute; left: 12px; right: 12px; top: 14px; bottom: 10px; border-radius: 34px; background: #3b4770")} />
          <div style={css("position: absolute; left: 0; right: 0; top: 0; bottom: 20px; border-radius: 34px; background: " + deck.bg + "; padding: 28px 22px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; box-shadow: 0 20px 40px rgba(0,0,0,.35)")}>
            <button type="button" onClick={hear} aria-label="Hear it" data-testid="card-hear" style={css("position: absolute; right: 16px; top: 16px; width: 48px; height: 48px; border-radius: 24px; border: 0; background: rgba(255,255,255,.22); color: #ffffff; display: flex; align-items: center; justify-content: center")}><Icon d={SPEAKER} size={24} width={2.2} /></button>
            <span style={css("font-size: 14px; font-weight: 800; letter-spacing: .1em; opacity: .85")}>{card.kicker}</span>
            {card.trace
              ? <TracePad key={`${screen.deck}-${screen.index}`} letter={card.trace} size={220} onChange={(done) => { if (done && !traced) say("Great tracing!"); setTraced(done); }} />
              : <Icon d={card.d} size={150} stroke="#ffffff" width={1.5} />}
            <span style={css("font-size: 32px; font-weight: 800; line-height: 1.15; text-align: center")}>{card.title}</span>
            <span style={css("font-size: 17px; opacity: .9; text-align: center")}>{card.trace && traced ? "You traced it! Tap “I did it”." : card.hint}</span>
          </div>
        </div>
        <div style={css("display: flex; gap: 12px")}>
          <button type="button" onClick={() => step(false)} style={css("flex-grow: 1; min-height: 70px; border-radius: 35px; border: 2px solid #4a5675; background: transparent; color: #ffffff; font-family: inherit; font-size: 18px; font-weight: 600")}>Later</button>
          <button type="button" onClick={didIt} aria-disabled={needsTrace} data-testid="card-done" style={{ ...css("flex-grow: 2; min-height: 70px; border-radius: 35px; border: 0; background: #ffd34d; color: #111827; font-family: inherit; font-size: 20px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px"), opacity: needsTrace ? 0.45 : 1 }}><Icon d={CHECK} size={24} width={3} />I did it</button>
        </div>
      </div>
    );
  } else if (screen.kind === "pick") {
    const q = QUESTIONS[screen.q % QUESTIONS.length];
    const pick = () => { if (reward !== null) return; const r = pickStep(screen); setScreen({ kind: "pick", q: r.q, on: r.on, picked: r.picked }); if (r.win) win(); };
    pickRef.current = pick;
    const boxStyle = (i: number) => {
      const lit = screen.picked === null ? screen.on === i : screen.picked === i;
      const color = screen.picked !== null && lit ? (i === q.right ? "#2ee88a" : "#ff8a3d") : lit ? "#ffe600" : "#3a3a3a";
      return css("flex-grow: 1; border-radius: 28px; border: " + (lit ? "8px" : "3px") + " solid " + color + "; background: #161616; color: #ffffff; font-family: inherit; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px");
    };
    const status = screen.picked === null ? "Watching the yellow box…" : screen.picked === q.right ? "Yes! Tap to go on." : "Good try! Tap to try again.";
    body = (
      <div onClick={(e) => { if (!(e.target as HTMLElement).closest("[data-close]")) pick(); }} style={css("position: absolute; inset: 0; background: #0d0d0d; color: #ffffff; padding: 52px 14px 22px; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px")} data-screen="pick">
        <div style={{ ...css("display: flex; align-items: center; gap: 12px"), marginTop: `calc(${TOP(52)} - 52px)` }}>
          <button type="button" data-close onClick={goHome} aria-label="Close the game" style={css("width: 48px; height: 48px; border-radius: 24px; border: 2px solid #3a3a3a; background: transparent; color: #ffffff; display: flex; align-items: center; justify-content: center")}><Icon d={CLOSE} size={22} width={2.6} /></button>
          <span style={css("font-size: 22px; font-weight: 800; flex-grow: 1")}>{q.q}</span>
          <span style={css("font-size: 16px; color: #d4d4d4")}>{(screen.q % QUESTIONS.length) + 1} of {QUESTIONS.length}</span>
        </div>
        <span style={css("font-size: 15px; color: #d4d4d4")}>The yellow box moves by itself. Tap anywhere, or press a switch, to pick it.</span>
        {q.opts.map((o, i) => (
          <button key={o.label} type="button" style={boxStyle(i)}>
            <Icon d={o.d} size={140} stroke="#ffffff" width={1.3} fill={o.fill} />
            <span style={css("font-size: 36px; font-weight: 800")}>{o.label}</span>
          </button>
        ))}
        <div role="status" style={css("min-height: 56px; border-radius: 18px; background: " + (screen.picked === null ? "#1f1f1f" : screen.picked === q.right ? "#2ee88a" : "#ff8a3d") + "; color: " + (screen.picked === null ? "#ffffff" : "#000000") + "; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; padding: 0 14px; text-align: center")}>{status}</div>
      </div>
    );
  } else if (tab === "apps") {
    body = (
      <div style={css("position: absolute; inset: 0 0 92px 0; background: #14102a; color: #ffffff; overflow-y: auto; overflow-x: hidden; scrollbar-width: none")} data-screen="apps">
        <div style={css("position: relative; height: 300px; background: #ff7a59; overflow: hidden")}>
          <svg width="390" height="300" viewBox="0 0 390 300" aria-hidden="true" style={css("position: absolute; left: 0; top: 0")}><circle cx="320" cy="110" r="110" fill="#ff9b7d" /><rect x="236" y="64" width="84" height="110" rx="14" fill="#6e5ce1" transform="rotate(10 278 119)" /><rect x="250" y="80" width="84" height="110" rx="14" fill="#ffd34d" transform="rotate(-6 292 135)" /></svg>
          <div style={css("position: absolute; left: 0; right: 0; bottom: 0; height: 160px; background: linear-gradient(transparent, #14102a)")} />
          <span style={{ ...css("position: absolute; left: 20px; font-size: 22px; font-weight: 800"), top: TOP(56) }}>Apps &amp; games</span>
          <div style={css("position: absolute; left: 20px; right: 20px; bottom: 16px; display: flex; flex-direction: column; gap: 10px")}>
            <span style={css("font-size: 13px; font-weight: 800; letter-spacing: .1em; color: #ffe1d8")}>KEEP PLAYING</span>
            <span style={css("font-size: 30px; font-weight: 800; line-height: 1")}>Card Quest</span>
            <button type="button" onClick={() => openCards("letters")} style={css("align-self: flex-start; min-height: 52px; padding: 0 22px; border: 0; border-radius: 26px; background: #ffffff; color: #14102a; font-family: inherit; display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 800")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>Play</button>
          </div>
        </div>
        <div style={css("display: flex; flex-direction: column; gap: 18px; padding: 10px 0 24px 20px")}>
          {shelves.map((r) => (
            <div key={r.name} style={css("display: flex; flex-direction: column; gap: 10px")}>
              <span style={css("font-size: 19px; font-weight: 800")}>{r.name}</span>
              <div style={css("display: flex; gap: 12px; overflow-x: auto; scrollbar-width: none; padding-right: 20px")}>
                {r.tiles.map((t) => (
                  <button key={t.name} type="button" onClick={() => openTile(t)} style={css("flex-shrink: 0; width: 132px; height: 116px; border: 0; border-radius: 18px; background: " + t.bg + "; padding: 14px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; font-family: inherit")}>
                    <Icon d={t.d} size={38} stroke="#14102a" />
                    <span style={css("font-size: 15px; font-weight: 800; color: #14102a; text-align: left")}>{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (tab === "stickers") {
    const slots = STICKERS.slice(albumTab * 6, albumTab * 6 + 6).map((s, j) => ({ s, got: won.includes(albumTab * 6 + j) }));
    body = (
      <div style={{ ...css("position: absolute; inset: 0 0 92px 0; background: #2f6fe0; padding: 54px 16px 16px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px"), paddingTop: TOP(54) }} data-screen="stickers">
        <div style={css("display: flex; align-items: flex-end; justify-content: space-between; color: #ffffff")}>
          <div style={css("display: flex; flex-direction: column")}><span style={css("font-size: 15px")}>{firstName}’s</span><span style={css("font-size: 28px; font-weight: 800; line-height: 1")}>Sticker Album</span></div>
          <span style={css("font-size: 18px; font-weight: 800; background: rgba(255,255,255,.18); border-radius: 16px; padding: 6px 12px")}>{have} / {total}</span>
        </div>
        <div role="tablist" style={css("display: flex; gap: 6px")}>
          {["Animals", "Fun things"].map((name, i) => {
            const on = albumTab === i;
            return <button key={name} type="button" role="tab" aria-selected={on} onClick={() => setAlbumTab(i)} style={css("min-height: 46px; padding: 0 18px; border: 0; border-radius: 16px 16px 0 0; background: " + (on ? "#fff6e4" : (i ? "#ffc531" : "#ff8e6b")) + "; font-family: inherit; font-size: 16px; font-weight: " + (on ? 800 : 600) + "; color: #1d2433")}>{name}</button>;
          })}
        </div>
        <div style={css("flex-grow: 1; margin-top: -14px; background: #fff6e4; border-radius: 0 24px 24px 24px; padding: 18px; box-shadow: 0 10px 0 #1f56b8; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; align-content: start")}>
          {slots.map(({ s, got }) => (
            <div key={s.name} style={css("display: flex; flex-direction: column; align-items: center; gap: 6px")}>
              <div style={css(got ? "width: 92px; height: 92px; border-radius: 46px; background: " + s.bg + "; border: 4px solid #ffffff; box-shadow: 0 3px 8px rgba(0,0,0,.18); display: flex; align-items: center; justify-content: center"
                : "width: 92px; height: 92px; border-radius: 46px; border: 3px dashed #d8c9a8; box-sizing: border-box; display: flex; align-items: center; justify-content: center")}>
                {got ? <Icon d={s.d} size={56} stroke="#1d2433" width={1.6} /> : <Icon d="M12 5v14M5 12h14" size={26} stroke="#b8a98c" width={2.4} />}
              </div>
              <span style={css("font-size: 14px; font-weight: 600; color: #1d2433")}>{got ? s.name : "?"}</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => navigate(KIDS_TAB_PATHS.apps)} style={css("min-height: 62px; border: 0; border-radius: 22px; background: #ffc531; box-shadow: 0 6px 0 #c99200; color: #1d2433; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 19px; font-weight: 800")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>Win the next sticker</button>
      </div>
    );
  } else {
    body = (
      <div style={{ ...css("position: absolute; inset: 0 0 92px 0; padding: 56px 14px 14px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; overflow-y: auto"), paddingTop: TOP(56) }} data-screen="home">
        <div style={css("display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px")}>
          <span style={css("font-size: 30px; font-weight: 800; letter-spacing: -.02em")}>Hi {firstName}</span>
          <span style={css("font-size: 15px; color: #555")}>{weekday}</span>
        </div>
        <div style={css("display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 78px; gap: 10px")}>
          <button type="button" onClick={() => openCards("letters")} style={css("grid-column: span 4; grid-row: span 2; border: 0; border-radius: 26px; background: #1f2bd6; color: #ffffff; padding: 18px; text-align: left; font-family: inherit; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden")}>
            <span aria-hidden="true" style={css("position: absolute; right: -6px; bottom: -34px; font-size: 140px; font-weight: 800; color: #3b48f0; line-height: 1")}>Aa</span>
            <span style={css("font-size: 14px; font-weight: 600; opacity: .9; position: relative")}>Next up · Card Quest</span>
            <span style={css("font-size: 30px; font-weight: 800; line-height: 1.05; position: relative")}>Letters</span>
            <span style={css("align-self: flex-start; min-height: 44px; padding: 0 18px; border-radius: 22px; background: #ffffff; color: #1f2bd6; display: flex; align-items: center; gap: 6px; font-weight: 800; position: relative")}>{PLAY}Start</span>
          </button>
          <div style={css("grid-column: span 2; grid-row: span 2; border-radius: 26px; background: #ff6b35; padding: 16px; display: flex; flex-direction: column; justify-content: space-between")}>
            <span style={css("font-size: 14px; font-weight: 600")}>Days in a row</span>
            <span style={css("font-size: 64px; font-weight: 800; line-height: 1")}>{run}</span>
            <div style={css("display: flex; gap: 4px")}>{[1, 2, 3, 4].map((i) => <span key={i} style={css("flex-grow: 1; height: 8px; border-radius: 4px; background: " + (i <= marks ? "#161616" : "rgba(0,0,0,.2)"))} />)}</div>
          </div>
          <div style={css("grid-column: span 2; grid-row: span 2; border-radius: 26px; background: #ffffff; padding: 14px; display: flex; flex-direction: column; gap: 8px")}>
            <span style={css("font-size: 14px; font-weight: 600")}>{mood ? "Feeling " + mood.toLowerCase() : "How do you feel?"}</span>
            <div style={css("display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; flex-grow: 1")}>
              {MOODS.map((m) => {
                const on = mood === m.name;
                return <button key={m.name} type="button" aria-label={m.name} aria-pressed={on} onClick={() => { setMood(m.name); showToast(moodReply(m.name)); }}
                  style={css("border: " + (on ? "3px solid #161616" : "0") + "; border-radius: 16px; background: " + m.bg + "; display: flex; align-items: center; justify-content: center; box-sizing: border-box")}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#161616" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d={m.d} /></svg>
                </button>;
              })}
            </div>
          </div>
          <div style={css("grid-column: span 3; border-radius: 26px; background: #b8f2c9; padding: 12px 16px; display: flex; flex-direction: column; justify-content: center; gap: 2px")}>
            <span style={css("font-size: 13px; font-weight: 600")}>Word of the day</span>
            <span style={css("font-size: 26px; font-weight: 800")}>{word}</span>
          </div>
          <button type="button" onClick={() => showToast(`“${word[0].toUpperCase()}${word.slice(1)}!”`)} aria-label="Hear the word" style={css("grid-column: span 1; border: 0; border-radius: 26px; background: #161616; color: #ffffff; display: flex; align-items: center; justify-content: center")}><Icon d={SPEAKER} size={28} width={2.2} /></button>
          <button type="button" onClick={() => navigate(KIDS_TAB_PATHS.stickers)} style={css("grid-column: span 4; border: 0; border-radius: 26px; background: #ffffff; padding: 12px 16px; font-family: inherit; color: #161616; display: flex; align-items: center; gap: 12px; text-align: left")}>
            <Icon d={STAR} size={34} stroke="#161616" />
            <span style={css("display: flex; flex-direction: column; gap: 6px; flex-grow: 1")}>
              <span style={css("font-size: 15px; font-weight: 600")}>{have} of {total} stickers</span>
              <span style={css("height: 10px; border-radius: 5px; background: #ececec; display: block")}><span style={css("display: block; width: " + Math.round(have / total * 100) + "%; height: 10px; border-radius: 5px; background: #1f2bd6")} /></span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  const rw = STICKERS[reward ?? 0];
  return (
    <div data-arise-kids style={css("position: fixed; inset: 0; overflow: hidden; font-family: " + FONT + "; background: #f2f2ee; color: #161616; -webkit-tap-highlight-color: transparent")}>
      <style>{`[data-arise-kids] *::-webkit-scrollbar{display:none}[data-arise-kids] button{cursor:pointer}`}</style>
      {body}
      {screen.kind === "tab" && <KidsTabBar tab={tab} />}
      {toast && <div role="status" style={css("position: absolute; left: 20px; right: 20px; bottom: 108px; border-radius: 18px; background: #161616; color: #ffffff; padding: 14px 16px; font-size: 16px; font-weight: 600; text-align: center")}>{toast}</div>}
      {reward !== null && (
        <div role="dialog" aria-label="You won a sticker" style={css("position: absolute; inset: 0; background: rgba(20,16,42,.82); display: flex; align-items: center; justify-content: center; padding: 24px")}>
          <div style={css("width: 100%; max-width: 342px; background: #fff6e4; border-radius: 32px; padding: 28px 22px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 16px; color: #1d2433")}>
            <span style={css("font-size: 15px; font-weight: 800; letter-spacing: .1em; color: #6b5f48")}>NEW STICKER</span>
            <div style={css("width: 150px; height: 150px; border-radius: 75px; background: " + rw.bg + "; border: 6px solid #ffffff; box-shadow: 0 6px 18px rgba(0,0,0,.2); display: flex; align-items: center; justify-content: center")}><Icon d={rw.d} size={96} stroke="#1d2433" width={1.5} /></div>
            <span style={css("font-size: 28px; font-weight: 800")}>{rw.name}!</span>
            <span style={css("font-size: 16px; text-align: center")}>You finished it. The sticker is in your album.</span>
            <div style={css("display: flex; gap: 10px; width: 100%")}>
              <button type="button" onClick={() => { setReward(null); setScreen({ kind: "tab" }); navigate(KIDS_TAB_PATHS.apps); }} style={css("flex-grow: 1; min-height: 58px; border-radius: 20px; border: 2px solid #e2d4b8; background: #ffffff; font-family: inherit; font-size: 17px; font-weight: 600; color: #1d2433")}>Keep playing</button>
              <button type="button" onClick={() => { setReward(null); setScreen({ kind: "tab" }); navigate(KIDS_TAB_PATHS.stickers); }} style={css("flex-grow: 1; min-height: 58px; border-radius: 20px; border: 0; background: #2f6fe0; font-family: inherit; font-size: 17px; font-weight: 800; color: #ffffff")}>See album</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
