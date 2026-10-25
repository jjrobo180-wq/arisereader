// A.R.I.S.E. Beginners: Say It Studio (like Speech Blubs). Pick a set of words; for each one, Ari says it with a
// moving mouth, the child says it back and the voice bar fills. Mirror shows the child's own face beside Ari (the
// camera picture stays on the device and is never recorded). Each set has a tip for the grown-up.
import { useEffect, useMemo, useRef, useState } from "react";
import { ARI } from "@shared/beginners";
import { SAYIT_CATEGORIES, type SayItCategory } from "@shared/beginners/sayit";
import { Ari, useAri } from "./Ari";
import { Bubble, Confetti, SpeakerIcon } from "./parts";
import { SayWord, type SayResult } from "./SayWord";
import { preload, sounds } from "./voice";

type Stickers = Record<string, "try" | "star">;
const stickerKey = (userId: number | string) => `bg-sayit-stickers-${userId}`;
function loadStickers(userId: number | string): Stickers {
  try { const v = JSON.parse(localStorage.getItem(stickerKey(userId)) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
function saveStickers(userId: number | string, s: Stickers) { try { localStorage.setItem(stickerKey(userId), JSON.stringify(s)); } catch { /* private window */ } }

export function SayItStudio({ userId, onBack, onPoints }: { userId: number | string; onBack: () => void; onPoints: (n: number) => void }) {
  const [cat, setCat] = useState<SayItCategory | null>(null);
  const [stickers, setStickers] = useState<Stickers>(() => loadStickers(userId));
  const ari = useAri();
  useEffect(() => { if (!cat) void ari.talk(ARI.studio); }, [cat]); // eslint-disable-line react-hooks/exhaustive-deps
  const give = (id: string, kind: "try" | "star") => setStickers((s) => {
    if (s[id] === "star" || s[id] === kind) return s;
    const next = { ...s, [id]: kind };
    saveStickers(userId, next);
    return next;
  });
  if (cat) return <StudioSet cat={cat} ari={ari} stickers={stickers} give={give} onBack={() => { ari.hush(); setCat(null); }} onPoints={onPoints} />;
  const groups: { title: string; note: string; list: SayItCategory[] }[] = [
    { title: "Everyday words", note: "Words children use all day.", list: SAYIT_CATEGORIES.filter((c) => c.kind === "theme") },
    { title: "Mouth Gym", note: "Sets grouped by where the sound is made, the way speech therapists practice early sounds.", list: SAYIT_CATEGORIES.filter((c) => c.kind === "mouth") },
  ];
  return (
    <div className="bg-studio">
      <div className="bg-studio-head">
        <button type="button" className="bg-btn bg-btn-quiet" onClick={() => { ari.hush(); onBack(); }}>Back to the map</button>
        <div className="bg-guide is-row">
          <Ari viseme={ari.viseme} size={84} />
          <Bubble onSpeak={() => void ari.talk(ARI.studio)}>{ARI.studio}</Bubble>
        </div>
      </div>
      {groups.map((g) => (
        <section key={g.title} className="bg-studio-group">
          <h2>{g.title}</h2>
          <p className="bg-step-hint">{g.note}</p>
          <div className="bg-studio-grid">
            {g.list.map((c) => {
              const got = c.words.filter((w) => stickers[`${c.id}:${w.w}`]).length;
              return (
                <button key={c.id} type="button" className="bg-set" style={{ ["--set" as any]: c.color }} onClick={() => { sounds.tap(); setCat(c); }}>
                  <span className="bg-set-icon" aria-hidden="true">{c.e}</span>
                  <span className="bg-set-title">{c.title}</span>
                  <span className="bg-set-count">{got ? `${got} of ${c.words.length} said` : `${c.words.length} words`}</span>
                  <span className="bg-set-track" aria-hidden="true"><i style={{ width: `${Math.round((got / c.words.length) * 100)}%` }} /></span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function StudioSet({ cat, ari, stickers, give, onBack, onPoints }: {
  cat: SayItCategory; ari: ReturnType<typeof useAri>; stickers: Stickers; give: (id: string, kind: "try" | "star") => void; onBack: () => void; onPoints: (n: number) => void;
}) {
  const [i, setI] = useState(0);
  const [mirror, setMirror] = useState(false);
  const [line, setLine] = useState<{ text: string; tone: "plain" | "good" | "try" }>({ text: "", tone: "plain" });
  const [party, setParty] = useState(0);
  const [showTip, setShowTip] = useState(false);
  const w = cat.words[i];
  const id = `${cat.id}:${w.w}`;
  const model = () => ari.talkAll([{ text: w.w, slow: true }, { text: w.line }]);
  useEffect(() => { preload(cat.words.flatMap((x) => [x.w, x.line])); preload(cat.words.map((x) => x.w), true); }, [cat]);
  useEffect(() => {
    setLine({ text: w.line, tone: "plain" });
    void ari.talkAll(i === 0 ? [{ text: ARI.sayIt }, { text: w.w, slow: true }, { text: w.line }] : [{ text: w.w, slow: true }, { text: w.line }]);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const result = (r: SayResult) => {
    if (r.correct) { give(id, "star"); setLine({ text: `${ARI.saidIt} ${w.w}!`, tone: "good" }); void ari.talk(ARI.saidIt); setParty((n) => n + 1); }
    else if (r.correct === false) { give(id, "try"); setLine({ text: r.close ? "So close! Watch my mouth and try again." : ARI.niceTry, tone: "try" }); void model(); }
    else { give(id, "try"); setLine({ text: ARI.great, tone: "good" }); void ari.talk(ARI.great); setParty((n) => n + 1); }
    if (r.points) onPoints(r.points);
  };
  const done = useMemo(() => cat.words.filter((x) => stickers[`${cat.id}:${x.w}`]).length, [cat, stickers]);
  return (
    <div className="bg-studio-set" style={{ ["--set" as any]: cat.color }}>
      <Confetti go={party} />
      <div className="bg-studio-bar">
        <button type="button" className="bg-btn bg-btn-quiet" onClick={onBack}>All sets</button>
        <h2>{cat.e} {cat.title}</h2>
        <button type="button" className={`bg-btn bg-btn-soft${mirror ? " is-on" : ""}`} aria-pressed={mirror} onClick={() => setMirror((m) => !m)}>🪞 Mirror</button>
      </div>
      <div className="bg-studio-stage">
        <div className="bg-studio-faces">
          <div className="bg-studio-ari"><Ari viseme={ari.viseme} size={180} mood={line.tone === "good" ? "cheer" : "happy"} label="Ari" /></div>
          {mirror && <Mirror hat={cat.e} onOff={() => setMirror(false)} />}
        </div>
        <button type="button" className="bg-word-card" onClick={() => void model()} aria-label={`Hear ${w.w} again`}>
          <span className="bg-word-pic" aria-hidden="true">{w.e}</span>
          <span className="bg-word-text">{w.w} <SpeakerIcon /></span>
          {stickers[id] && <span className={`bg-sticker is-${stickers[id]}`} aria-label={stickers[id] === "star" ? "Gold star" : "Sticker"}>{stickers[id] === "star" ? "⭐" : "🎈"}</span>}
        </button>
        {line.text && <Bubble tone={line.tone}>{line.text}</Bubble>}
        <SayWord key={id} word={w.w} set={cat.check ? cat.id : undefined} check={cat.check} onResult={result} />
        <div className="bg-row">
          <button type="button" className="bg-btn bg-btn-quiet" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
          <span className="bg-step-hint">{i + 1} of {cat.words.length} · {done} said</span>
          <button type="button" className="bg-btn bg-btn-go" onClick={() => (i < cat.words.length - 1 ? setI(i + 1) : onBack())}>{i < cat.words.length - 1 ? "Next word" : "Finish set"}</button>
        </div>
      </div>
      <div className="bg-grownup">
        <button type="button" className="bg-grownup-toggle" aria-expanded={showTip} onClick={() => setShowTip((s) => !s)}>For grown-ups</button>
        {showTip && <div className="bg-grownup-body"><p><strong>How to help:</strong> {cat.tip}</p><p><strong>Talk about it:</strong> {cat.starter}</p>{!cat.check && <p>These sounds aren't checked by the computer: any real try fills the voice bar and earns a sticker.</p>}</div>}
      </div>
    </div>
  );
}

/** The child's own face from the front camera, mirrored, with a fun hat. Never recorded or sent anywhere. */
function Mirror({ hat, onOff }: { hat: string; onOff: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let live = true;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } }, audio: false })
      .then((s) => { if (!live) { s.getTracks().forEach((t) => t.stop()); return; } stream = s; if (video.current) { video.current.srcObject = s; void video.current.play().catch(() => {}); } })
      .catch(() => setError(true));
    return () => { live = false; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  if (error) return <div className="bg-mirror is-off"><p>The camera is off.</p><button type="button" className="bg-btn bg-btn-quiet" onClick={onOff}>Close mirror</button></div>;
  return (
    <div className="bg-mirror">
      <span className="bg-mirror-hat" aria-hidden="true">{hat}</span>
      <video ref={video} muted playsInline aria-label="Your face, like a mirror" />
    </div>
  );
}
