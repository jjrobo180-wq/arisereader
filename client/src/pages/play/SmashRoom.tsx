import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, RotateCcw, Timer, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import TouchStick from "@/components/TouchStick";
import { SmashGame, TOOLS, type SmashHud, type ToolId } from "@/game/smash/smash";
import "./play.css";

const money = (n: number) => "$" + n.toLocaleString();

export default function SmashRoom() {
  const { token, user } = useAuth();
  const [, navigate] = useLocation();
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<SmashGame | null>(null);
  const [hud, setHud] = useState<SmashHud | null>(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem("city_muted") === "1"; } catch { return false; } });
  const [touch] = useState(() => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 0));
  const [toast, setToast] = useState("");
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!host.current || !token) return;
    let alive = true;
    (async () => {
      let character = "robin-hood";
      try {
        const r = await fetch(API_BASE + "/api/city/bootstrap", { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
        const d = await r.json(); if (r.ok && d.self?.characterId) character = d.self.characterId;
      } catch { /* default look */ }
      if (!alive || !host.current) return;
      game.current = new SmashGame(host.current, character, { onHud: setHud, userId: user?.id });
      game.current.setMuted(muted);
      setReady(true);
    })();
    return () => { alive = false; game.current?.dispose(); game.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { game.current?.setMuted(muted); try { localStorage.setItem("city_muted", muted ? "1" : "0"); } catch { /* fine */ } }, [muted]);
  useEffect(() => {
    if (!hud?.last || hud.last === lastRef.current) return;
    lastRef.current = hud.last;
    setToast(`Smashed ${hud.last}!`);
    const t = window.setTimeout(() => setToast(""), 1100);
    return () => window.clearTimeout(t);
  }, [hud?.last, hud?.score]);

  const leave = () => navigate("/city?from=smash");
  const tool = hud?.tool ?? "bat";

  return (
    <main className="play-root" aria-label="Smash Room">
      <div ref={host} className="play-canvas" />
      <header className="play-top">
        <button type="button" className="play-chip" onClick={leave}><ArrowLeft /> Haven City</button>
        <button type="button" className="play-chip" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Sound on" : "Sound off"}>{muted ? <VolumeX /> : <Volume2 />}</button>
        <div className="play-score" role="status">
          <b>{money(hud?.score ?? 0)}</b>
          <span>{hud?.rush ? `Rage Rush · ${hud.timeLeft}s left` : `damage done · best rush ${money(hud?.best ?? 0)}`}</span>
        </div>
      </header>
      {(hud?.combo ?? 0) >= 2 && <div className="play-combo" aria-live="polite">×{Math.min(5, hud!.combo)} COMBO</div>}
      {toast && <div className="play-toast" role="status">{toast}</div>}
      {!touch && ready && (
        <div className="play-help">
          <kbd>WASD</kbd> move · drag to look<br />
          <kbd>Space</kbd> or click: swing · <kbd>F</kbd> or right-click: throw a bottle<br />
          <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> tools · <kbd>R</kbd> restock
        </div>
      )}

      <footer className="play-bottom">
        {touch ? <TouchStick onChange={(v) => game.current?.setStick(v)} /> : <span />}
        <div className="play-tools" role="group" aria-label="Tool">
          {(Object.keys(TOOLS) as ToolId[]).map((id, i) => (
            <button key={id} type="button" aria-pressed={tool === id} onClick={() => game.current?.setTool(id)}>{TOOLS[id].name}{!touch && <kbd>{i + 1}</kbd>}</button>
          ))}
        </div>
        <div className="play-actions">
          <div className="play-side">
            <button type="button" onClick={() => game.current?.restock()}><RotateCcw className="inline h-4 w-4" /> Restock</button>
            {hud?.rush ? <button type="button" onClick={() => game.current?.stopRush()}>End rush</button> : <button type="button" onClick={() => game.current?.startRush()}><Timer className="inline h-4 w-4" /> Rage Rush</button>}
          </div>
          <button type="button" className="play-mid" onPointerDown={(e) => { e.preventDefault(); game.current?.throwBottle(); }}>Throw</button>
          <button type="button" className="play-big" onPointerDown={(e) => { e.preventDefault(); game.current?.swing(); }}>SMASH</button>
        </div>
      </footer>

      {hud?.ended && (
        <div className="play-modal" role="dialog" aria-label="Rage Rush results">
          <div className="play-card">
            <h2>{hud.ended.best ? "New best!" : "Time's up!"}</h2>
            <p>You did {money(hud.ended.score)} of damage in 60 seconds.</p>
            <div className="row">
              <button type="button" className="play-btn" onClick={() => game.current?.startRush()}>Go again</button>
              <button type="button" className="play-btn ghost" onClick={() => game.current?.stopRush()}>Free smash</button>
            </div>
          </div>
        </div>
      )}
      {hud && hud.left === 0 && !hud.rush && !hud.ended && (
        <div className="play-modal" role="dialog" aria-label="Room smashed">
          <div className="play-card">
            <h2>Everything's smashed!</h2>
            <p>{money(hud.score)} of damage. Feeling better?</p>
            <div className="row"><button type="button" className="play-btn" onClick={() => game.current?.restock()}>Restock the room</button><button type="button" className="play-btn ghost" onClick={leave}>Back to the city</button></div>
          </div>
        </div>
      )}
      {!ready && <div className="play-loading">Putting on your hard hat…</div>}
    </main>
  );
}
