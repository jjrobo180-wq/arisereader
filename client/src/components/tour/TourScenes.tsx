// Animated scenes for the iPhone apps' first-run tours (Arise To Duo, A.R.I.S.E. Reader, Reader
// Educator and Pod+): a small phone showing the app's real screens (the same tab bar, switch, cards
// and labels), with a finger doing the step, on a loop. They replace the old single-icon pictures.
// Inline styles only (no Tailwind classes), so Pod+'s separate build draws them the same way.
// Respects Reduce Motion: the scene then rests on its finished frame.
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Shrinks a scene so the words and buttons under it always fit on the screen. It measures the
 *  page column it sits in (marked `data-scene-col`), or uses the window's height without one. */
export function SceneFit({ reserve = 470, children }: { reserve?: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState(1);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const col = el.closest<HTMLElement>("[data-scene-col]");
    const fit = () => {
      let avail = window.innerHeight - reserve;
      if (col) {
        let used = 0;
        for (const c of Array.from(col.children) as HTMLElement[]) { const cs = getComputedStyle(c); used += c.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom); }
        const cs = getComputedStyle(col);
        avail = col.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - (used - el.getBoundingClientRect().height) - 8;
      }
      setZ(Math.min(1, Math.max(0.5, avail / 300)));
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" && col ? new ResizeObserver(fit) : null;
    ro?.observe(col!);
    window.addEventListener("resize", fit);
    return () => { ro?.disconnect(); window.removeEventListener("resize", fit); };
  }, [reserve]);
  return <div ref={box} style={{ position: "relative", width: 300 * z, height: 300 * z, flexShrink: 0, margin: "0 auto" }}>
    <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%,-50%) scale(${z})` }}>{children}</div>
  </div>;
}

const KEYFRAMES = `
.ts-a{animation-duration:4.8s;animation-iteration-count:infinite;animation-timing-function:cubic-bezier(.4,0,.2,1);animation-fill-mode:both}
@keyframes ts-in{0%,8%{opacity:0;transform:translateY(10px)}18%,100%{opacity:1;transform:none}}
@keyframes ts-fadeA{0%,38%{opacity:1}46%,88%{opacity:0}96%,100%{opacity:1}}
@keyframes ts-fadeB{0%,38%{opacity:0}46%,88%{opacity:1}96%,100%{opacity:0}}
@keyframes ts-tap{0%,30%{opacity:0;transform:translate(14px,24px) scale(1)}38%{opacity:1;transform:translate(0,0) scale(1)}42%{transform:scale(.8)}48%{transform:scale(1)}60%,100%{opacity:0;transform:translate(10px,20px)}}
@keyframes ts-ripple{0%,40%{opacity:0;transform:scale(.3)}44%{opacity:.6}62%,100%{opacity:0;transform:scale(1.8)}}
@keyframes ts-tabs{0%,16%{transform:translateX(0)}24%,40%{transform:translateX(38px)}48%,64%{transform:translateX(124px)}72%,90%{transform:translateX(162px)}98%,100%{transform:translateX(0)}}
@keyframes ts-sheet{0%,30%{transform:translateY(105%)}40%,62%{transform:translateY(0)}70%,100%{transform:translateY(105%)}}
@keyframes ts-type{0%,64%{clip-path:inset(0 100% 0 0)}84%,100%{clip-path:inset(0 0 0 0)}}
@keyframes ts-chip{0%,84%{opacity:0;transform:scale(.6)}90%,100%{opacity:1;transform:none}}
@keyframes ts-added{0%,44%{opacity:0}50%,100%{opacity:1}}
@keyframes ts-addbtn{0%,44%{opacity:1}50%,100%{opacity:0}}
@keyframes ts-drop{0%,10%{opacity:0;transform:translateY(-30px)}22%,82%{opacity:1;transform:none}92%,100%{opacity:0;transform:translateY(-30px)}}
@keyframes ts-jiggle{0%,100%{transform:rotate(-1.6deg)}50%{transform:rotate(1.6deg)}}
@keyframes ts-swap1{0%,30%{transform:none}50%,80%{transform:translateY(74px)}100%{transform:none}}
@keyframes ts-swap2{0%,30%{transform:none}50%,80%{transform:translateY(-74px)}100%{transform:none}}
@keyframes ts-drag{0%,24%{opacity:0;transform:translate(0,0)}30%{opacity:1;transform:translate(0,0) scale(.85)}50%,78%{opacity:1;transform:translate(0,74px) scale(.85)}86%,100%{opacity:0;transform:translate(0,74px)}}
@keyframes ts-ev{0%{opacity:0;transform:translateX(-12px)}100%{opacity:1;transform:none}}
@keyframes ts-check{0%,50%{background:transparent;border-color:#b9b6c7}58%,100%{background:#34c759;border-color:#34c759}}
@keyframes ts-strike{0%,50%{opacity:0;width:0}62%,100%{opacity:1;width:42px}}
@keyframes ts-split{0%,26%{width:100%}46%,84%{width:50%}100%{width:100%}}
@keyframes ts-splitB{0%,26%{opacity:0;left:100%}46%,84%{opacity:1;left:50%}100%{opacity:0;left:100%}}
@keyframes ts-grow1{0%,10%{height:8%}40%,100%{height:44%}}
@keyframes ts-grow2{0%,20%{height:8%}50%,100%{height:62%}}
@keyframes ts-grow3{0%,30%{height:8%}60%,100%{height:52%}}
@keyframes ts-grow4{0%,40%{height:8%}70%,100%{height:86%}}
@keyframes ts-bar{0%,12%{width:12%}70%,100%{width:78%}}
@keyframes ts-pick{0%,44%{background:#f4f3f8;color:#111018}52%,100%{background:#34c759;color:#fff}}
@keyframes ts-float{0%,50%{opacity:0;transform:translateY(8px)}60%,82%{opacity:1;transform:translateY(-10px)}100%{opacity:0;transform:translateY(-26px)}}
@keyframes ts-open{0%,40%{transform:scale(1);opacity:1}55%,85%{transform:scale(3.6);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes ts-page{0%,44%{opacity:0;transform:scale(.6)}56%,86%{opacity:1;transform:none}96%,100%{opacity:0}}
@keyframes ts-star{0%,46%{color:#d6d4df}54%,100%{color:#ffb020}}
@keyframes ts-feed{0%,22%{transform:translateY(0)}34%,56%{transform:translateY(-100%)}68%,90%{transform:translateY(-200%)}100%{transform:translateY(-200%)}}
@keyframes ts-swipe{0%,14%{opacity:0;transform:translateY(40px)}18%{opacity:1}30%{opacity:1;transform:translateY(-40px)}34%,48%{opacity:0;transform:translateY(40px)}52%{opacity:1}64%{opacity:1;transform:translateY(-40px)}68%,100%{opacity:0}}
@keyframes ts-heart{0%,40%{transform:scale(1);color:#fff}46%{transform:scale(1.45);color:#ff375f}54%,100%{transform:scale(1);color:#ff375f}}
@keyframes ts-wave{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
@keyframes ts-dot{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes ts-cheer{0%{opacity:0;transform:translate(0,0) scale(.6)}15%{opacity:1}100%{opacity:0;transform:translate(var(--dx,0),-120px) scale(1.1)}}
@keyframes ts-press{0%,34%{transform:scale(1)}40%{transform:scale(.92)}46%,100%{transform:scale(1)}}
@keyframes ts-live{0%,40%{opacity:0;transform:scale(.7)}48%,100%{opacity:1;transform:none}}
@keyframes ts-slideup{0%,8%{opacity:0;transform:translateY(16px)}20%,100%{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ts-a,.ts-a *{animation-duration:.001s!important;animation-iteration-count:1!important;animation-delay:0s!important}}
`;

type Theme = "light" | "dark";
const A = (name: string, extra: CSSProperties = {}): CSSProperties => ({ animationName: name, ...extra });
const abs = (s: CSSProperties): CSSProperties => ({ position: "absolute", ...s });
const font = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif";

/** The little phone every scene is drawn in. */
function Phone({ theme = "light", children, wide = false }: { theme?: Theme; children: ReactNode; wide?: boolean }) {
  const dark = theme === "dark";
  return <div aria-hidden className="ts-a" style={{ position: "relative", width: wide ? 288 : 212, height: 290, borderRadius: 38, padding: 7, background: dark ? "#2a2730" : "#16141d", boxShadow: "0 30px 60px -24px rgba(30,20,80,.55), inset 0 0 0 1.5px rgba(255,255,255,.08)", fontFamily: font, animationName: "ts-in", animationIterationCount: 1, animationDuration: ".6s", transition: "width .3s" }}>
    <style>{KEYFRAMES}</style>
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 31, overflow: "hidden", background: dark ? "#0f0d12" : "#f6f5fa", color: dark ? "#fff" : "#111018", textAlign: "left", lineHeight: 1.2 }}>
      <div style={abs({ top: 6, left: "50%", width: 56, height: 16, marginLeft: -28, borderRadius: 10, background: "#000", zIndex: 30 })} />
      {children}
    </div>
  </div>;
}

/** A finger: appears, taps (with a ripple), goes. `anim` moves it (defaults to a tap at x/y). */
function Finger({ x, y, anim = "ts-tap", delay = 0, dur }: { x: number; y: number; anim?: string; delay?: number; dur?: string }) {
  const d = { animationDelay: `${delay}s`, ...(dur ? { animationDuration: dur } : {}) };
  return <>
    <span className="ts-a" style={abs({ left: x - 18, top: y - 18, width: 36, height: 36, borderRadius: 99, background: "rgba(124,77,255,.35)", zIndex: 40, ...A("ts-ripple"), ...d })} />
    <span className="ts-a" style={abs({ left: x - 14, top: y - 14, width: 28, height: 28, borderRadius: 99, background: "rgba(255,255,255,.95)", boxShadow: "0 6px 14px rgba(0,0,0,.35), inset 0 0 0 7px rgba(124,77,255,.9)", zIndex: 41, ...A(anim), ...d })} />
  </>;
}

const Txt = ({ s, w = 600, c, children, style }: { s: number; w?: number; c?: string; children: ReactNode; style?: CSSProperties }) =>
  <span style={{ fontSize: s, fontWeight: w, color: c, whiteSpace: "nowrap", ...style }}>{children}</span>;

// ——— Arise To Duo ————————————————————————————————————————————————————————————————————————————

const LIFE = "#7968e5", WORK = "#0d9488", NAVY = "#1d1a33";
const card: CSSProperties = { background: "#fff", borderRadius: 14, boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 6px 14px -10px rgba(30,20,80,.35)" };

function HubHeader({ title, on }: { title: string; on: "W" | "L" }) {
  const seg = (k: "W" | "L"): CSSProperties => ({ width: 24, height: 20, borderRadius: 6, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, background: on === k ? "#0f172a" : "transparent", color: on === k ? "#fff" : "#64748b" });
  return <div style={abs({ top: 26, left: 12, right: 12, display: "flex", alignItems: "center", justifyContent: "space-between" })}>
    <Txt s={17} w={800}>{title}</Txt>
    <span style={{ display: "flex", gap: 2, padding: 2, borderRadius: 8, background: "#f1f5f9", boxShadow: "inset 0 0 0 1px #e2e8f0" }}><span style={seg("W")}>W</span><span style={seg("L")}>L</span></span>
  </div>;
}

function TabBar({ hub = "life", highlight }: { hub?: "life" | "work"; highlight?: boolean }) {
  const t = (label: string) => <span style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 7.5, fontWeight: 700, color: "rgba(255,255,255,.7)" }}><span style={{ width: 13, height: 13, borderRadius: 4, border: "1.8px solid currentColor" }} />{label}</span>;
  return <div style={abs({ bottom: 10, left: 8, right: 8, height: 40, borderRadius: 99, background: hub === "work" ? "#020617" : NAVY, display: "flex", alignItems: "center", padding: "0 4px", zIndex: 20 })}>
    {highlight && <span className="ts-a" style={abs({ left: 6, top: 4, width: 32, height: 32, borderRadius: 99, background: "rgba(255,255,255,.16)", ...A("ts-tabs") })} />}
    {t("Home")}{t("Tasks")}
    <span style={{ width: 30, height: 30, margin: "0 3px", borderRadius: 99, background: hub === "work" ? WORK : LIFE, color: "#fff", display: "grid", placeItems: "center", fontSize: 18, fontWeight: 400 }}>+</span>
    {t("Apps")}{t("You")}
  </div>;
}

function Widgets({ accent = LIFE, jiggle = false }: { accent?: string; jiggle?: boolean }) {
  const w = (x: number, y: number, wd: number, h: number, title: string, body: ReactNode, i = 0) =>
    <div className={jiggle ? "ts-a" : undefined} style={abs({ left: x, top: y, width: wd, height: h, ...card, padding: 9, ...(jiggle ? { animationName: "ts-jiggle", animationDuration: ".32s", animationDelay: `${i * .07}s` } : {}) })}>
      <Txt s={9} w={700} c="#6b6879">{title}</Txt><div style={{ marginTop: 4 }}>{body}</div>
    </div>;
  return <>
    {w(10, 58, 89, 66, "Tasks due", <><Txt s={20} w={800} c={accent}>3</Txt><div style={{ fontSize: 8, color: "#6b6879", marginTop: 2 }}>Today</div></>, 0)}
    {w(105, 58, 89, 66, "Events today", <><Txt s={20} w={800}>2</Txt><div style={{ fontSize: 8, color: "#6b6879", marginTop: 2 }}>Next at 3:00 PM</div></>, 1)}
    {w(10, 132, 184, 62, "Agenda", <><div style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 9 }}><span style={{ width: 3, height: 14, borderRadius: 2, background: accent }} />Dentist · 3:00 PM</div><div style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 9, marginTop: 5 }}><span style={{ width: 3, height: 14, borderRadius: 2, background: "#f59e0b" }} />Soccer pickup · 5:30 PM</div></>, 2)}
  </>;
}

function TodoWelcome() {
  return <Phone>
    <div className="ts-a" style={abs({ inset: 0, ...A("ts-fadeA") })}><HubHeader title="LifeHub" on="L" /><Widgets /><TabBar /></div>
    <div className="ts-a" style={abs({ inset: 0, background: "#f4f7f7", ...A("ts-fadeB") })}><HubHeader title="WorkHub" on="W" /><Widgets accent={WORK} /><TabBar hub="work" /></div>
    <Finger x={166} y={36} />
  </Phone>;
}

function TodoTabs() {
  return <Phone><HubHeader title="LifeHub" on="L" /><Widgets /><TabBar highlight />
    <span className="ts-a" style={abs({ left: 22, bottom: 14, width: 22, height: 22, borderRadius: 99, background: "rgba(255,255,255,.95)", boxShadow: "0 6px 14px rgba(0,0,0,.35), inset 0 0 0 6px rgba(124,77,255,.9)", zIndex: 41, ...A("ts-tabs") })} />
  </Phone>;
}

function TodoAdd() {
  const row = (t: string, c: string) => <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 10, fontWeight: 600 }}><span style={{ width: 18, height: 18, borderRadius: 6, background: c }} />{t}</div>;
  return <Phone>
    <div style={abs({ top: 26, left: 12 })}><Txt s={17} w={800}>Tasks</Txt></div>
    <div style={abs({ top: 56, left: 10, right: 10, ...card, padding: "4px 10px" })}>
      {["Pay rent", "Pack lunches"].map((t) => <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #f0eff5", fontSize: 10 }}><span style={{ width: 13, height: 13, borderRadius: 99, border: "1.5px solid #b9b6c7" }} />{t}</div>)}
      <div style={{ padding: "7px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10 }}><span style={{ width: 13, height: 13, borderRadius: 99, border: `1.5px solid ${LIFE}` }} />
          <span className="ts-a" style={A("ts-type")}>Dentist tomorrow 3pm</span></div>
        <span className="ts-a" style={{ display: "inline-block", marginTop: 5, marginLeft: 21, padding: "3px 7px", borderRadius: 99, background: "#efecff", color: "#4b3fc4", fontSize: 8.5, fontWeight: 700, ...A("ts-chip") }}>📅 Tomorrow at 3:00 PM</span>
      </div>
    </div>
    <TabBar />
    <div className="ts-a" style={abs({ left: 0, right: 0, bottom: 0, height: 150, borderRadius: "20px 20px 0 0", background: "#fff", padding: "14px 16px", boxShadow: "0 -10px 30px rgba(0,0,0,.18)", zIndex: 25, ...A("ts-sheet") })}>
      <Txt s={11} w={800}>Add</Txt>{row("Task", LIFE)}{row("Event", "#0284c7")}{row("List", "#f59e0b")}{row("Note", "#10b981")}
    </div>
    <Finger x={99} y={262} delay={-1.5} />
  </Phone>;
}

function TodoGallery() {
  const tile = (n: string, c: string, e: string) => <div style={{ ...card, padding: "6px 7px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, minWidth: 0 }}><span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 7, background: c, display: "grid", placeItems: "center", fontSize: 11 }}>{e}</span><Txt s={8.5} w={700} style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{n}</Txt></div>;
  return <Phone>
    <div style={abs({ top: 26, left: 12 })}><Txt s={17} w={800}>App Gallery</Txt></div>
    <div style={abs({ top: 56, left: 10, right: 10, ...card, padding: 10, background: "linear-gradient(150deg,#fff,#f3f0ff)" })}>
      <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(160deg,#4ade80,#15803d)", display: "grid", placeItems: "center", fontSize: 20 }}>💵</span>
        <div style={{ flex: 1 }}><Txt s={11} w={800}>Budget & bills</Txt><div style={{ fontSize: 8.5, color: "#6b6879", marginTop: 2 }}>Spending, bills and savings</div></div>
        <span style={{ position: "relative", width: 46, height: 22 }}>
          <span className="ts-a" style={abs({ inset: 0, borderRadius: 99, background: LIFE, color: "#fff", fontSize: 9, fontWeight: 800, display: "grid", placeItems: "center", ...A("ts-addbtn") })}>Add</span>
          <span className="ts-a" style={abs({ inset: 0, borderRadius: 99, background: "#e8f8ee", color: "#15803d", fontSize: 9, fontWeight: 800, display: "grid", placeItems: "center", ...A("ts-added") })}>✓ Added</span>
        </span>
      </div>
    </div>
    <div style={abs({ top: 122, left: 10, right: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 })}>
      {tile("Calorie counter ✓", "#ffedd5", "🥗")}{tile("Habits", "#ede9fe", "✅")}{tile("Meal planner", "#fee2e2", "🍝")}{tile("Sticky notes", "#e0f2fe", "📝")}
    </div>
    <TabBar />
    <Finger x={170} y={81} />
  </Phone>;
}

function TodoCustomize() {
  return <Phone>
    <div style={abs({ top: 26, left: 12 })}><Txt s={17} w={800}>LifeHub</Txt></div>
    <div style={abs({ top: 28, right: 12 })}><Txt s={11} w={700} c="#6b6879">Done</Txt></div>
    <div className="ts-a" style={abs({ left: 10, top: 58, width: 184, height: 66, ...card, padding: 9, outline: `2px solid ${LIFE}`, zIndex: 5, ...A("ts-swap1") })}><Txt s={9} w={700} c="#6b6879">Agenda</Txt><div style={{ marginTop: 5, fontSize: 9 }}>Dentist · 3:00 PM</div></div>
    <div className="ts-a" style={abs({ left: 10, top: 132, width: 184, height: 66, ...card, padding: 9, ...A("ts-swap2") })}><Txt s={9} w={700} c="#6b6879">Tasks due</Txt><div style={{ marginTop: 3 }}><Txt s={20} w={800} c={LIFE}>3</Txt></div></div>
    <TabBar />
    <span className="ts-a" style={abs({ left: 88, top: 77, width: 28, height: 28, borderRadius: 99, background: "rgba(255,255,255,.95)", boxShadow: "0 6px 14px rgba(0,0,0,.35), inset 0 0 0 7px rgba(124,77,255,.9)", zIndex: 41, ...A("ts-drag") })} />
  </Phone>;
}

function TodoConnect() {
  const ev = (t: string, time: string, c: string, i: number) => <div className="ts-a" style={{ display: "flex", gap: 7, alignItems: "center", padding: "6px 0", fontSize: 9.5, animationName: "ts-ev", animationDuration: ".5s", animationIterationCount: 1, animationDelay: `${.4 + i * .35}s` }}><span style={{ width: 3, height: 20, borderRadius: 2, background: c }} /><span style={{ flex: 1 }}><b style={{ fontWeight: 700 }}>{t}</b><br /><span style={{ color: "#6b6879", fontSize: 8 }}>{time}</span></span></div>;
  return <Phone>
    <div style={abs({ top: 26, left: 12 })}><Txt s={17} w={800}>Calendar</Txt></div>
    <div style={abs({ top: 52, left: 10, right: 10, display: "flex", gap: 3 })}>
      {["Agenda", "Week", "Month", "Free time"].map((t, i) => <span key={t} style={{ flex: 1, textAlign: "center", padding: "5px 0", borderRadius: 7, fontSize: 7.5, fontWeight: 700, background: i === 0 ? "#fff" : "transparent", boxShadow: i === 0 ? "0 1px 3px rgba(0,0,0,.12)" : "none", color: i === 0 ? "#111018" : "#6b6879" }}>{t}</span>)}
    </div>
    <div style={abs({ top: 78, left: 10, right: 10, ...card, padding: "4px 10px" })}>
      {ev("Dentist", "3:00 PM · iPhone Calendar", "#ef4444", 0)}{ev("Soccer pickup", "5:30 PM · Family", "#f59e0b", 1)}{ev("Team sync", "Tomorrow 9:00 AM · Work", WORK, 2)}
    </div>
    <div style={abs({ top: 186, left: 10, right: 10, ...card, padding: "8px 10px" })}>
      <Txt s={8.5} w={700} c="#6b6879">Reminders</Txt>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 7, marginTop: 5, fontSize: 10 }}>
        <span className="ts-a" style={{ width: 13, height: 13, borderRadius: 99, border: "1.5px solid #b9b6c7", ...A("ts-check") }} />Buy milk
        <span className="ts-a" style={abs({ left: 20, top: 6, height: 1.5, background: "#6b6879", ...A("ts-strike") })} />
      </div>
    </div>
    <Finger x={26} y={208} delay={.6} />
  </Phone>;
}

function TodoNotify() {
  return <Phone theme="dark">
    <div style={abs({ inset: 0, background: "linear-gradient(170deg,#3b2f8f,#14112b 70%)" })} />
    <div style={abs({ top: 40, left: 0, right: 0, textAlign: "center", color: "#fff" })}><div style={{ fontSize: 10, opacity: .8 }}>Friday, October 30</div><div style={{ fontSize: 44, fontWeight: 300, letterSpacing: -1 }}>8:41</div></div>
    <div className="ts-a" style={abs({ top: 132, left: 9, right: 9, borderRadius: 16, padding: 9, background: "rgba(255,255,255,.82)", color: "#111018", display: "flex", gap: 7, ...A("ts-drop") })}>
      <span style={{ width: 24, height: 24, borderRadius: 6, background: LIFE, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5 }}><b>Arise To Duo</b><span style={{ color: "#6b6879" }}>now</span></div><div style={{ fontSize: 9, marginTop: 2 }}>Dentist at 3:00 PM. Leave in 20 minutes.</div></div>
    </div>
    <div className="ts-a" style={abs({ top: 190, left: 9, right: 9, borderRadius: 16, padding: 9, background: "rgba(255,255,255,.7)", color: "#111018", fontSize: 9, ...A("ts-drop"), animationDelay: ".5s" })}><b style={{ fontSize: 8.5 }}>Good morning</b><div style={{ marginTop: 2 }}>3 tasks, 2 events and a bill due today.</div></div>
  </Phone>;
}

function TodoSplit() {
  return <Phone wide>
    <div className="ts-a" style={abs({ top: 0, bottom: 0, left: 0, overflow: "hidden", borderRight: "1px solid #e5e3ee", ...A("ts-split") })}>
      <div style={{ position: "relative", width: 212, height: "100%" }}><HubHeader title="LifeHub" on="L" /><Widgets /></div>
    </div>
    <div className="ts-a" style={abs({ top: 0, bottom: 0, width: "50%", overflow: "hidden", background: "#f4f7f7", ...A("ts-splitB") })}>
      <div style={{ position: "relative", width: 212, height: "100%" }}><HubHeader title="WorkHub" on="W" /><Widgets accent={WORK} /></div>
    </div>
    <div style={abs({ bottom: 12, left: "50%", marginLeft: -36, width: 72, height: 24, borderRadius: 99, background: NAVY, color: "#fff", fontSize: 9, fontWeight: 800, display: "grid", placeItems: "center", zIndex: 20 })}>Duo</div>
    <Finger x={144} y={262} delay={-1.4} />
  </Phone>;
}

function TodoArise() {
  const row = (e: string, t: string, c: string) => <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600 }}><span style={{ width: 22, height: 22, borderRadius: 7, background: c, display: "grid", placeItems: "center", fontSize: 11 }}>{e}</span>{t}</div>;
  return <Phone>
    <div style={abs({ top: 26, left: 12 })}><Txt s={17} w={800}>Apps</Txt></div>
    <div style={abs({ top: 54, left: 10, right: 10, ...card, padding: 4 })}>
      {row("🏠", "Home", "#ede9fe")}
      <div className="ts-a" style={{ ...A("ts-slideup"), animationIterationCount: 1, animationDuration: ".8s" }}>{row("📖", "A.R.I.S.E. Reader", "#e0e7ff")}{row("➗", "Arise Math", "#dcfce7")}{row("🏛️", "Arise History", "#ffedd5")}{row("🔗", "Arise Connect", "#e0f2fe")}</div>
    </div>
    <TabBar />
  </Phone>;
}

function TodoSearch() {
  return <Phone>
    <div style={abs({ top: 26, left: 12 })}><Txt s={17} w={800}>Search</Txt></div>
    <div style={abs({ top: 54, left: 10, right: 10, height: 30, borderRadius: 10, background: "#ebe9f2", display: "flex", alignItems: "center", gap: 6, padding: "0 10px", fontSize: 10.5 })}>🔍 <span className="ts-a" style={{ ...A("ts-type"), animationDuration: "3s" }}>dentist</span></div>
    <div className="ts-a" style={abs({ top: 94, left: 10, right: 10, ...card, padding: "4px 10px", ...A("ts-chip"), animationDuration: "3s" })}>
      {[["Dentist", "Event · Tomorrow 3:00 PM"], ["Call dentist about Maya", "Task · LifeHub"], ["Dental plan", "Note"]].map(([a, b]) => <div key={a} style={{ padding: "7px 0", borderBottom: "1px solid #f0eff5", fontSize: 10 }}><b style={{ fontWeight: 700 }}>{a}</b><div style={{ fontSize: 8, color: "#6b6879", marginTop: 2 }}>{b}</div></div>)}
    </div>
    <TabBar />
  </Phone>;
}

/** Arise To Duo tour scenes, by step id (components/AppWalkthrough.tsx). */
export function TodoScene({ id }: { id: string }) {
  switch (id) {
    case "welcome": return <TodoWelcome />;
    case "tabs": return <TodoTabs />;
    case "add": return <TodoAdd />;
    case "gallery": return <TodoGallery />;
    case "customize": return <TodoCustomize />;
    case "connect": return <TodoConnect />;
    case "notify": return <TodoNotify />;
    case "split": return <TodoSplit />;
    case "arise": return <TodoArise />;
    case "done": return <TodoSearch />;
    default: return null;
  }
}

// ——— A.R.I.S.E. Reader (students) and Reader Educator —————————————————————————————————————————

const READ = "#5b4fe0";
const cover = (c1: string, c2: string, t: string): CSSProperties => ({ background: `linear-gradient(160deg,${c1},${c2})`, borderRadius: 8, color: "#fff", fontSize: 8, fontWeight: 800, padding: 6, display: "flex", alignItems: "flex-end", boxShadow: "0 6px 12px -6px rgba(0,0,0,.5)", ...(t ? {} : {}) });

function ReaderLibrary() {
  const books: [string, string, string][] = [["#6a3cf0", "#3b1fa8", "Wild Robot"], ["#0f766e", "#064e3b", "Hatchet"], ["#e08a1a", "#b45309", "Wonder"], ["#e0457b", "#9d174d", "Holes"], ["#0284c7", "#075985", "Ghost"], ["#334155", "#0f172a", "Matilda"]];
  return <Phone>
    <div style={abs({ top: 26, left: 12 })}><Txt s={17} w={800}>Library</Txt><div style={{ fontSize: 8.5, color: "#6b6879", marginTop: 2 }}>Picked for how you read</div></div>
    <div style={abs({ top: 70, left: 12, right: 12, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9 })}>
      {books.map(([a, b, t], i) => <div key={t} className={i === 0 ? "ts-a" : undefined} style={{ height: 82, ...cover(a, b, t), ...(i === 0 ? { transformOrigin: "20% 20%", ...A("ts-open") } : {}) }}>{t}</div>)}
    </div>
    <div className="ts-a" style={abs({ inset: 0, background: "#fffdf7", padding: "34px 16px", zIndex: 10, ...A("ts-page") })}>
      <Txt s={8.5} w={700} c="#8e8b9c">Chapter 3 · Page 12</Txt>
      {[92, 100, 96, 88, 100, 70, 98, 94, 100, 60].map((w, k) => <div key={k} style={{ height: 5, width: `${w}%`, borderRadius: 3, background: "#e4e1d6", marginTop: 9 }} />)}
      <div style={abs({ bottom: 16, left: 16, right: 16, height: 4, borderRadius: 3, background: "#ece9f6" })}><div style={{ width: "34%", height: "100%", borderRadius: 3, background: READ }} /></div>
    </div>
    <Finger x={40} y={110} />
  </Phone>;
}

function ReaderQuiz() {
  const opt = (t: string, right = false) => <div className={right ? "ts-a" : undefined} style={{ padding: "8px 10px", borderRadius: 10, background: "#f4f3f8", fontSize: 10, fontWeight: 600, marginTop: 6, ...(right ? A("ts-pick") : {}) }}>{t}</div>;
  return <Phone>
    <div style={abs({ top: 26, left: 12, right: 12 })}><Txt s={8.5} w={700} c={READ}>Hatchet · Question 2 of 5</Txt>
      <div style={{ fontSize: 12, fontWeight: 800, marginTop: 5, lineHeight: 1.25, whiteSpace: "normal" }}>What does Brian use to start a fire?</div>
      {opt("A match from his pocket")}{opt("His hatchet and a rock", true)}{opt("The plane's radio")}
    </div>
    <div className="ts-a" style={abs({ top: 186, left: 0, right: 0, textAlign: "center", ...A("ts-float") })}><span style={{ padding: "6px 12px", borderRadius: 99, background: "#fff4d6", color: "#a16207", fontSize: 12, fontWeight: 800 }}>+10 points ⭐</span></div>
    <Finger x={100} y={132} />
  </Phone>;
}

function ReaderGrow() {
  const bar = (n: number, h: string, l: string) => <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}><div className="ts-a" style={{ width: "70%", borderRadius: 6, background: n === 4 ? READ : "#c9c3f7", ...A(h) }} /><span style={{ fontSize: 7.5, color: "#6b6879" }}>{l}</span></div>;
  return <Phone>
    <div style={abs({ top: 26, left: 12 })}><Txt s={17} w={800}>My progress</Txt></div>
    <div style={abs({ top: 56, left: 10, right: 10, display: "flex", gap: 7 })}>
      <div style={{ flex: 1, ...card, padding: 8 }}><Txt s={8} w={700} c="#6b6879">Books</Txt><div><Txt s={18} w={800}>12</Txt></div></div>
      <div style={{ flex: 1, ...card, padding: 8 }}><Txt s={8} w={700} c="#6b6879">Streak</Txt><div><Txt s={18} w={800}>🔥 6</Txt></div></div>
    </div>
    <div style={abs({ top: 112, left: 10, right: 10, height: 108, ...card, padding: "10px 8px 6px", display: "flex", gap: 4 })}>
      {bar(1, "ts-grow1", "Jul")}{bar(2, "ts-grow2", "Aug")}{bar(3, "ts-grow3", "Sep")}{bar(4, "ts-grow4", "Oct")}
    </div>
    <div style={abs({ top: 230, left: 10, right: 10, ...card, padding: "8px 10px" })}><Txt s={8.5} w={700} c="#6b6879">Your teacher says</Txt><div style={{ fontSize: 9.5, marginTop: 3 }}>Great week of reading! 🎉</div></div>
  </Phone>;
}

function EducatorClass() {
  const stat = (n: string, l: string, c: string) => <div style={{ flex: 1, ...card, padding: 8 }}><Txt s={18} w={800} c={c}>{n}</Txt><div style={{ fontSize: 7.5, color: "#6b6879", marginTop: 2, whiteSpace: "normal" }}>{l}</div></div>;
  const kid = (n: string, b: string, p: string, i: number) => <div className="ts-a" style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 0", borderBottom: "1px solid #f0eff5", fontSize: 9.5, ...A("ts-ev"), animationDuration: ".5s", animationIterationCount: 1, animationDelay: `${.3 + i * .25}s` }}><span style={{ width: 20, height: 20, borderRadius: 99, background: "#ede9fe", display: "grid", placeItems: "center", fontSize: 8, fontWeight: 800, color: READ }}>{n[0]}</span><span style={{ flex: 1 }}><b>{n}</b><br /><span style={{ fontSize: 7.5, color: "#6b6879" }}>{b}</span></span><span style={{ fontSize: 8, fontWeight: 700, color: "#15803d" }}>{p}</span></div>;
  return <Phone>
    <div style={abs({ top: 26, left: 12 })}><Txt s={17} w={800}>My class</Txt></div>
    <div style={abs({ top: 54, left: 10, right: 10, display: "flex", gap: 6 })}>{stat("24", "students", "#111018")}{stat("3", "books to approve", READ)}{stat("5", "answers to grade", "#e08a1a")}</div>
    <div style={abs({ top: 116, left: 10, right: 10, ...card, padding: "2px 10px" })}>{kid("Maya", "Reading Wonder", "+40", 0)}{kid("Leo", "Finished Hatchet", "+60", 1)}{kid("Ava", "Quiz: 5 of 5", "+50", 2)}{kid("Sam", "Reading Ghost", "+20", 3)}</div>
  </Phone>;
}

function EducatorGrade() {
  return <Phone>
    <div style={abs({ top: 26, left: 12 })}><Txt s={17} w={800}>To grade</Txt></div>
    <div style={abs({ top: 56, left: 10, right: 10, ...card, padding: 10 })}>
      <Txt s={8.5} w={700} c="#6b6879">Leo · Hatchet</Txt>
      <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, whiteSpace: "normal" }}>Why did Brian keep the hatchet close?</div>
      <div style={{ fontSize: 9.5, marginTop: 6, padding: 8, borderRadius: 8, background: "#f6f5fa", whiteSpace: "normal", lineHeight: 1.35 }}>It was his only tool, so it kept him alive.</div>
      <div style={{ display: "flex", gap: 6, marginTop: 9, fontSize: 18 }}>{[0, 1, 2, 3].map((k) => <span key={k} className="ts-a" style={{ ...A("ts-star"), animationDelay: `${k * .08}s` }}>★</span>)}</div>
    </div>
    <div className="ts-a" style={abs({ top: 206, left: 0, right: 0, textAlign: "center", ...A("ts-float") })}><span style={{ padding: "6px 12px", borderRadius: 99, background: "#e8f8ee", color: "#15803d", fontSize: 11, fontWeight: 800 }}>✓ Graded · 4 of 4</span></div>
    <Finger x={104} y={176} />
  </Phone>;
}

function EducatorFamily() {
  const bubble = (t: string, me: boolean, i: number) => <div className="ts-a" style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start", marginTop: 7, ...A("ts-slideup"), animationDelay: `${i * .9}s` }}><span style={{ maxWidth: "78%", padding: "7px 10px", borderRadius: 14, fontSize: 9.5, lineHeight: 1.3, whiteSpace: "normal", background: me ? READ : "#fff", color: me ? "#fff" : "#111018", boxShadow: me ? "none" : "0 1px 3px rgba(0,0,0,.1)" }}>{t}</span></div>;
  return <Phone>
    <div style={abs({ top: 26, left: 12 })}><Txt s={17} w={800}>Maya's reading</Txt></div>
    <div style={abs({ top: 54, left: 10, right: 10, ...card, padding: 9, display: "flex", gap: 8, alignItems: "center" })}>
      <div style={{ width: 34, height: 46, ...cover("#e08a1a", "#b45309", "") }} />
      <div style={{ flex: 1 }}><Txt s={10} w={800}>Finished Wonder 🎉</Txt><div style={{ fontSize: 8, color: "#6b6879", marginTop: 2 }}>Quiz 5 of 5 · +60 points</div></div>
    </div>
    <div style={abs({ top: 116, left: 10, right: 10 })}>{bubble("Maya finished Wonder today!", false, 0)}{bubble("So proud of you, Maya! ❤️", true, 1)}{bubble("Next up: The Wild Robot", false, 2)}</div>
  </Phone>;
}

/** A.R.I.S.E. Reader and Reader Educator tour scenes, by page id (components/ReaderFirstRun.tsx). */
export function ReaderScene({ id }: { id: string }) {
  switch (id) {
    case "library": return <ReaderLibrary />;
    case "quiz": return <ReaderQuiz />;
    case "grow": return <ReaderGrow />;
    case "class": return <EducatorClass />;
    case "grade": return <EducatorGrade />;
    case "family": return <EducatorFamily />;
    default: return null;
  }
}

// ——— Pod+ ————————————————————————————————————————————————————————————————————————————————————

const POD = "#ff6a1f";
const art = (a: string, b: string): CSSProperties => ({ background: `linear-gradient(150deg,${a},${b})` });

function PodSwipe() {
  const ep = (a: string, b: string, show: string, t: string) => <div style={{ position: "relative", height: "100%", padding: "34px 14px 0" }}>
    <div style={{ height: 150, borderRadius: 16, ...art(a, b), display: "grid", placeItems: "center", fontSize: 30 }}>▶︎</div>
    <div style={{ marginTop: 10, fontSize: 8.5, color: "rgba(255,255,255,.6)", fontWeight: 700 }}>{show}</div>
    <div style={{ fontSize: 12, fontWeight: 800, marginTop: 3, whiteSpace: "normal", lineHeight: 1.25 }}>{t}</div>
    <div style={{ marginTop: 10, height: 3, borderRadius: 2, background: "rgba(255,255,255,.18)" }}><div style={{ width: "28%", height: "100%", borderRadius: 2, background: POD }} /></div>
  </div>;
  return <Phone theme="dark">
    <div className="ts-a" style={abs({ inset: 0, ...A("ts-feed") })}>
      <div style={{ height: "100%" }}>{ep("#ff6a1f", "#9a2a00", "Morning Brief", "The 7 stories you need today")}</div>
      <div style={{ height: "100%" }}>{ep("#7c5cff", "#2b1680", "Deep Space", "What the new telescope just saw")}</div>
      <div style={{ height: "100%" }}>{ep("#10b981", "#065f46", "Kitchen Talk", "The 15-minute dinner that works")}</div>
    </div>
    <span className="ts-a" style={abs({ left: 92, top: 170, width: 28, height: 28, borderRadius: 99, background: "rgba(255,255,255,.95)", boxShadow: "0 6px 14px rgba(0,0,0,.5), inset 0 0 0 7px rgba(255,106,31,.9)", zIndex: 41, ...A("ts-swipe") })} />
  </Phone>;
}

function PodLearn() {
  return <Phone theme="dark">
    <div style={abs({ top: 34, left: 12, right: 12 })}>
      <div style={{ height: 150, borderRadius: 16, ...art("#7c5cff", "#2b1680") }} />
      <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800 }}>Deep Space</div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>{["Science", "Space", "News"].map((t, i) => <span key={t} className="ts-a" style={{ padding: "4px 8px", borderRadius: 99, background: "rgba(255,255,255,.12)", fontSize: 8.5, fontWeight: 700, ...A("ts-chip"), animationDelay: `${i * .1}s` }}>{t}</span>)}</div>
    </div>
    <div style={abs({ right: 14, top: 120, display: "flex", flexDirection: "column", gap: 14, alignItems: "center", fontSize: 18 })}>
      <span className="ts-a" style={A("ts-heart")}>♥</span><span>🔖</span><span>＋</span>
    </div>
    <Finger x={196} y={130} />
  </Phone>;
}

function PodMake() {
  return <Phone theme="dark">
    <div style={abs({ top: 28, left: 12 })}><Txt s={15} w={800}>Study Pod+</Txt></div>
    <div className="ts-a" style={abs({ top: 56, left: 10, right: 10, padding: 10, borderRadius: 14, background: "#1c1920", ...A("ts-fadeA") })}>
      <Txt s={8.5} w={700} c="rgba(255,255,255,.55)">Your notes</Txt>
      {[96, 88, 100, 72, 90, 64].map((w, k) => <div key={k} style={{ height: 5, width: `${w}%`, borderRadius: 3, background: "rgba(255,255,255,.14)", marginTop: 8 }} />)}
      <div className="ts-a" style={{ marginTop: 12, height: 30, borderRadius: 99, background: POD, display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800, ...A("ts-press") }}>Make my podcast</div>
    </div>
    <div className="ts-a" style={abs({ top: 56, left: 10, right: 10, padding: 10, borderRadius: 14, background: "#1c1920", ...A("ts-fadeB") })}>
      <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
        <span style={{ width: 44, height: 44, borderRadius: 10, ...art("#7c5cff", "#ff6a1f") }} />
        <div><Txt s={11} w={800}>Biology: The Cell</Txt><div style={{ fontSize: 8, color: "rgba(255,255,255,.55)", marginTop: 2 }}>6 min · two AI hosts</div></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2.5, height: 40, marginTop: 10 }}>
        {Array.from({ length: 26 }, (_, k) => <span key={k} className="ts-a" style={{ flex: 1, height: "100%", borderRadius: 2, background: k < 9 ? POD : "rgba(255,255,255,.3)", transformOrigin: "center", animationName: "ts-wave", animationDuration: `${.7 + (k % 5) * .13}s`, animationDelay: `${-k * .09}s` }} />)}
      </div>
      <div style={{ fontSize: 8.5, color: "rgba(255,255,255,.6)", marginTop: 8 }}>Key points · Quiz yourself</div>
    </div>
    <Finger x={104} y={163} />
  </Phone>;
}

function PodSocial() {
  return <Phone theme="dark">
    <div style={abs({ top: 28, left: 12 })}><Txt s={15} w={800}>Social</Txt></div>
    <div style={abs({ top: 52, left: 10, display: "flex", gap: 4 })}>{["#ff6a1f", "#7c5cff", "#10b981", "#e0457b", "#0284c7"].map((c) => <span key={c} style={{ boxSizing: "border-box", width: 28, height: 28, margin: 2, borderRadius: 99, background: c, border: "2px solid #0f0d12", boxShadow: `0 0 0 2px ${POD}` }} />)}</div>
    <div style={abs({ top: 94, left: 10, right: 10, padding: 10, borderRadius: 14, background: "#1c1920" })}>
      <div style={{ display: "flex", gap: 7, alignItems: "center" }}><span style={{ width: 20, height: 20, borderRadius: 99, background: "#7c5cff" }} /><Txt s={9.5} w={800}>Deep Space</Txt><Txt s={8} w={500} c="rgba(255,255,255,.5)">· 2h</Txt></div>
      <div style={{ fontSize: 9.5, marginTop: 6, whiteSpace: "normal", lineHeight: 1.3 }}>New episode tonight: what the telescope just saw 🔭</div>
      <div style={{ height: 70, borderRadius: 10, marginTop: 7, ...art("#2b1680", "#0f0d12") }} />
      <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 10, alignItems: "center" }}>
        <span className="ts-a" style={A("ts-heart")}>♥</span><span>💬 24</span><span>↗︎</span>
      </div>
    </div>
    <Finger x={24} y={232} />
  </Phone>;
}

function PodLive() {
  const cheer = (e: string, x: number, dx: number, d: number) => <span className="ts-a" style={{ ...abs({ left: x, top: 200, fontSize: 16 }), animationName: "ts-cheer", animationDuration: "2.4s", animationTimingFunction: "ease-out", animationDelay: `${d}s`, ["--dx" as any]: `${dx}px` }}>{e}</span>;
  return <Phone theme="dark">
    <div style={abs({ inset: 0, background: "radial-gradient(120% 70% at 50% 20%,#3a1406,#0f0d12)" })} />
    <div style={abs({ top: 32, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "center" })}>
      <span className="ts-a" style={{ padding: "3px 7px", borderRadius: 5, background: "#ff3b30", fontSize: 8.5, fontWeight: 900, letterSpacing: .5, ...A("ts-live") }}>● LIVE</span>
      <Txt s={9} w={700} c="rgba(255,255,255,.75)">👂 128 listening</Txt>
    </div>
    <div style={abs({ top: 74, left: 0, right: 0, display: "grid", placeItems: "center" })}>
      <span style={{ width: 74, height: 74, borderRadius: 99, ...art(POD, "#9a2a00"), boxShadow: "0 0 0 6px rgba(255,59,48,.25)", display: "grid", placeItems: "center", fontSize: 26 }}>🎙️</span>
      <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800 }}>Friday night Q&A</div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, height: 18, marginTop: 6 }}>{Array.from({ length: 12 }, (_, k) => <span key={k} className="ts-a" style={{ width: 3, height: "100%", borderRadius: 2, background: POD, animationName: "ts-wave", animationDuration: `${.5 + (k % 4) * .12}s`, animationDelay: `${-k * .07}s` }} />)}</div>
    </div>
    {cheer("👏", 150, -20, 1.2)}{cheer("🔥", 168, -6, 1.9)}{cheer("❤️", 182, -26, 2.6)}{cheer("🎉", 158, 10, 3.3)}
    <div style={abs({ left: 10, right: 10, bottom: 14, height: 32, borderRadius: 99, background: "rgba(255,255,255,.13)", display: "flex", alignItems: "center", padding: "0 12px", fontSize: 9, color: "rgba(255,255,255,.65)" })}>Say something…</div>
    <div className="ts-a" style={abs({ inset: 0, background: "#0f0d12", display: "grid", placeItems: "center", ...A("ts-fadeA"), animationName: "ts-addbtn" })}>
      <div style={{ textAlign: "center" }}><span style={{ display: "inline-grid", placeItems: "center", width: 54, height: 54, borderRadius: 99, background: "#ff3b30", fontSize: 22 }}>🎙️</span><div style={{ marginTop: 10, fontSize: 12, fontWeight: 800 }}>Go live</div><div style={{ fontSize: 8.5, color: "rgba(255,255,255,.6)", marginTop: 3 }}>Talk live, take comments and Cheers</div></div>
    </div>
    <Finger x={106} y={148} />
  </Phone>;
}

function PodEarn() {
  const row = (e: string, t: string, d: string, i: number) => <div className="ts-a" style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderBottom: "1px solid #eee", ...A("ts-slideup"), animationDelay: `${.2 + i * .35}s` }}><span style={{ width: 24, height: 24, borderRadius: 7, background: "#fff1e8", display: "grid", placeItems: "center", fontSize: 12 }}>{e}</span><span style={{ flex: 1 }}><Txt s={10} w={800}>{t}</Txt><div style={{ fontSize: 8, color: "#606060", marginTop: 1 }}>{d}</div></span></div>;
  return <Phone>
    <div style={abs({ inset: 0, background: "#fff" })} />
    <div style={abs({ top: 28, left: 12 })}><Txt s={15} w={800}>Studio</Txt></div>
    <div style={abs({ top: 52, left: 10, right: 10, display: "flex", gap: 6 })}>
      {[["1.2K", "plays"], ["86", "followers"], ["412", "Cheer points"]].map(([n, l]) => <div key={l} style={{ flex: 1, padding: 7, borderRadius: 10, background: "#f6f6f6" }}><Txt s={13} w={800}>{n}</Txt><div style={{ fontSize: 7.5, color: "#606060" }}>{l}</div></div>)}
    </div>
    <div style={abs({ top: 102, left: 10, right: 10, padding: "9px 10px", borderRadius: 14, background: "linear-gradient(140deg,#4f5fd6,#3d4fb8)", color: "#fff" })}>
      <Txt s={11} w={900}>Pod+ Rise</Txt><div style={{ fontSize: 8.5, opacity: .85, marginTop: 2, whiteSpace: "normal" }}>Earn from your show, at your own prices</div>
    </div>
    <div style={abs({ top: 150, left: 10, right: 10 })}>{row("💎", "Supporter memberships", "Your biggest fans back you monthly", 0)}{row("🎧", "Premium episodes", "Choose what's free and what's paid", 1)}{row("👏", "Cheers from LivePods", "Listeners cheer while you're live", 2)}</div>
  </Phone>;
}

/** Pod+ tour scenes, by page id (podscroll/Welcome.tsx). */
export function PodScene({ id }: { id: string }) {
  switch (id) {
    case "swipe": return <PodSwipe />;
    case "learn": return <PodLearn />;
    case "make": return <PodMake />;
    case "social": return <PodSocial />;
    case "live": return <PodLive />;
    case "earn": return <PodEarn />;
    default: return null;
  }
}
