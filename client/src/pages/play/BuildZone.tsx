import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Blocks, Check, Plane } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import TouchStick from "@/components/TouchStick";
import { BuildGame, type BuildHud } from "@/game/build/build";
import { PLACEABLE, TEMPLATES, blockDef, decodeWorld, encodeWorld, makeWorld, type Template } from "@shared/build/world";
import "./play.css";
import "./build.css";

type Save = "saved" | "saving" | "unsaved" | "offline";

export default function BuildZone() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<BuildGame | null>(null);
  const [hud, setHud] = useState<BuildHud | null>(null);
  const [ready, setReady] = useState(false);
  const [picker, setPicker] = useState(false);
  const [menu, setMenu] = useState<"none" | "new">("none");
  const [save, setSave] = useState<Save>("saved");
  const [touch] = useState(() => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 0));
  const headers = useCallback(() => ({ Authorization: "Bearer " + token, "Content-Type": "application/json" }), [token]);

  const saveNow = useCallback(async () => {
    const g = game.current; if (!g || !token) return;
    setSave("saving");
    try {
      const r = await fetch(API_BASE + "/api/city/build", { method: "PUT", headers: headers(), body: JSON.stringify({ world: encodeWorld(g.world) }) });
      if (!r.ok) throw new Error();
      g.markSaved(); setSave("saved");
    } catch { setSave("offline"); }
  }, [headers, token]);

  useEffect(() => {
    if (!host.current || !token) return;
    let alive = true;
    (async () => {
      let world = null;
      try {
        const r = await fetch(API_BASE + "/api/city/build", { headers: headers(), cache: "no-store" });
        const d = await r.json(); if (r.ok) world = decodeWorld(d.world);
      } catch { /* start a fresh world */ }
      if (!alive || !host.current) return;
      game.current = new BuildGame(host.current, world ?? makeWorld("meadow"), { onHud: setHud, onChange: () => setSave("unsaved"), touch });
      setReady(true);
    })();
    return () => { alive = false; game.current?.dispose(); game.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // save a moment after you stop building
  useEffect(() => {
    const id = window.setInterval(() => { const g = game.current; if (g && g.unsavedSince && performance.now() - g.unsavedSince > 1800) void saveNow(); }, 1500);
    return () => window.clearInterval(id);
  }, [saveNow]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.key === "e" || e.key === "E") && !e.repeat && ready) { setPicker((p) => !p); if (document.pointerLockElement) document.exitPointerLock(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ready]);

  const leave = async () => { if (game.current?.unsavedSince) await saveNow(); navigate("/city?from=build"); };
  const newWorld = (t: Template) => { game.current?.load(makeWorld(t, Math.floor(Math.random() * 1000))); setMenu("none"); setSave("unsaved"); void saveNow(); };
  const paused = !touch && ready && hud && !hud.locked && !picker && menu === "none";

  return (
    <main className="play-root build-root" aria-label="Build Zone">
      <div ref={host} className="play-canvas" />
      {ready && <div className="build-cross" aria-hidden="true" />}
      <header className="play-top">
        <button type="button" className="play-chip" onClick={leave}><ArrowLeft /> Haven City</button>
        <span className="play-chip build-save" role="status">{save === "saved" ? <><Check /> Saved</> : save === "saving" ? "Saving…" : save === "offline" ? "Couldn't save, will retry" : "Building…"}</span>
        {hud?.target && <span className="play-chip build-target">{hud.target}</span>}
        {hud?.flying && <span className="play-chip"><Plane /> Flying</span>}
      </header>

      <div className="build-hotbar" role="toolbar" aria-label="Blocks in your hand">
        {(hud?.hotbar ?? []).map((id, i) => {
          const b = blockDef(id);
          return (
            <button key={i} type="button" aria-pressed={hud?.slot === i} aria-label={`${i + 1}: ${b.name}`} onClick={() => game.current?.selectSlot(i)} onDoubleClick={() => setPicker(true)}>
              <span className={"build-swatch" + (b.transparent ? " clear" : "")} style={{ background: b.color }} />
              {!touch && <kbd>{i + 1}</kbd>}
            </button>
          );
        })}
        <button type="button" className="build-more" onClick={() => { setPicker(true); if (document.pointerLockElement) document.exitPointerLock(); }} aria-label="All blocks"><Blocks /></button>
      </div>

      {touch && ready && (
        <>
          <div className="build-stick"><TouchStick onChange={(v) => game.current?.setStick(v)} /></div>
          <div className="build-buttons">
            <button type="button" className="play-mid" onPointerDown={(e) => { e.preventDefault(); game.current?.breakBlock(); }}>Break</button>
            <button type="button" className="play-big build-place" onPointerDown={(e) => { e.preventDefault(); game.current?.placeBlock(); }}>Place</button>
            <button type="button" className="play-mid" onPointerDown={(e) => { e.preventDefault(); game.current?.jump(); if (hud?.flying) game.current?.setKey("space", true); }} onPointerUp={() => game.current?.setKey("space", false)} onPointerCancel={() => game.current?.setKey("space", false)}>{hud?.flying ? "Up" : "Jump"}</button>
            <button type="button" className="play-mid" onPointerDown={(e) => { e.preventDefault(); game.current?.toggleFly(); }}>{hud?.flying ? "Land" : "Fly"}</button>
            {hud?.flying && <button type="button" className="play-mid" onPointerDown={(e) => { e.preventDefault(); game.current?.setKey("shift", true); }} onPointerUp={() => game.current?.setKey("shift", false)} onPointerCancel={() => game.current?.setKey("shift", false)}>Down</button>}
          </div>
        </>
      )}

      {paused && (
        <div className="play-modal" onClick={() => game.current?.lockPointer()}>
          <div className="play-card" onClick={(e) => e.stopPropagation()}>
            <h2>Build Zone</h2>
            <p className="build-keys">
              <span><kbd>WASD</kbd> walk · mouse to look</span>
              <span><kbd>Left click</kbd> break · <kbd>Right click</kbd> place</span>
              <span><kbd>1–9</kbd> or wheel: pick a block · <kbd>E</kbd> all blocks · <kbd>Q</kbd> copy a block</span>
              <span><kbd>Space</kbd> jump · double-tap or <kbd>F</kbd> to fly · <kbd>Shift</kbd> down</span>
            </p>
            <div className="row">
              <button type="button" className="play-btn build-go" onClick={() => game.current?.lockPointer()}>Play</button>
              <button type="button" className="play-btn ghost" onClick={() => setMenu("new")}>New world</button>
              <button type="button" className="play-btn ghost" onClick={leave}>Back to the city</button>
            </div>
          </div>
        </div>
      )}
      {touch && ready && (
        <button type="button" className="play-chip build-newbtn" onClick={() => setMenu("new")}>New world</button>
      )}

      {picker && (
        <div className="play-modal" onClick={() => setPicker(false)}>
          <div className="play-card build-picker" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose a block">
            <h2>Blocks</h2>
            <p>Pick a block for slot {(hud?.slot ?? 0) + 1}.</p>
            <div className="build-grid">
              {PLACEABLE.map((b) => (
                <button key={b.id} type="button" onClick={() => { game.current?.setSlotBlock(b.id); setPicker(false); }}>
                  <span className={"build-swatch" + (b.transparent ? " clear" : "")} style={{ background: b.color }} /><span>{b.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {menu === "new" && (
        <div className="play-modal" onClick={() => setMenu("none")}>
          <div className="play-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Start a new world">
            <h2>Start a new world?</h2>
            <p>This replaces what you've built here.</p>
            <div className="build-templates">
              {TEMPLATES.map((t) => <button key={t.id} type="button" onClick={() => newWorld(t.id)}><b>{t.name}</b><span>{t.blurb}</span></button>)}
            </div>
            <div className="row"><button type="button" className="play-btn ghost" onClick={() => setMenu("none")}>Keep my world</button></div>
          </div>
        </div>
      )}
      {!ready && <div className="play-loading">Loading your world…</div>}
    </main>
  );
}
