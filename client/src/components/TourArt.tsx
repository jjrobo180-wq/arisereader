// The animated pictures in the Arise To Duo tour (AppWalkthrough.tsx): one small looping scene per step,
// drawn in HTML and CSS (no image files), so each idea is shown rather than explained. Calm and short;
// people who asked for less motion see the scene standing still.
import type { ReactNode } from "react";
import { Bell, BookOpen, CalendarDays, Check, Home, LayoutGrid, ListChecks, MoreHorizontal, Palette, Plus, Search, Sparkles, User } from "lucide-react";

const CSS = `
.ta{position:relative;height:150px;border-radius:22px;overflow:hidden;background:linear-gradient(160deg,var(--t1),var(--t2));color:#fff}
.ta *{box-sizing:border-box}
.ta-phone{position:absolute;left:50%;top:14px;width:118px;height:150px;margin-left:-59px;border-radius:22px;background:#fff;box-shadow:0 12px 30px -10px rgba(0,0,0,.45);overflow:hidden;color:#1e1b33}
.ta-bar{position:absolute;left:8px;right:8px;bottom:8px;height:24px;border-radius:12px;background:#1e1b33;display:flex;align-items:center;justify-content:space-around;color:#fff}
.ta-bar svg{width:12px;height:12px}
.ta-hi{position:absolute;bottom:10px;width:20px;height:20px;border-radius:8px;background:rgba(255,255,255,.28);animation:ta-hop 4s ease-in-out infinite}
@keyframes ta-hop{0%,15%{left:13px}25%,40%{left:35px}50%,65%{left:57px}75%,90%{left:80px}100%{left:13px}}
.ta-line{height:8px;border-radius:4px;background:#e7e5f2;margin:8px 10px 0}
.ta-pill{position:absolute;left:50%;top:40px;width:180px;height:44px;margin-left:-90px;border-radius:22px;background:rgba(255,255,255,.22);display:flex;align-items:center;padding:4px}
.ta-pill span{position:relative;z-index:1;flex:1;text-align:center;font:700 14px/36px system-ui}
.ta-knob{position:absolute;top:4px;left:4px;width:86px;height:36px;border-radius:18px;background:#fff;animation:ta-slide 3.2s ease-in-out infinite}
@keyframes ta-slide{0%,40%{transform:translateX(0)}50%,90%{transform:translateX(86px)}100%{transform:translateX(0)}}
.ta-pill .on1{animation:ta-c1 3.2s infinite}.ta-pill .on2{animation:ta-c2 3.2s infinite}
@keyframes ta-c1{0%,40%{color:#1e1b33}50%,90%{color:#fff}100%{color:#1e1b33}}@keyframes ta-c2{0%,40%{color:#fff}50%,90%{color:#1e1b33}100%{color:#fff}}
.ta-plus{position:absolute;left:50%;bottom:16px;width:40px;height:40px;margin-left:-20px;border-radius:20px;background:#fff;color:#1e1b33;display:grid;place-items:center;animation:ta-pulse 2.6s ease-in-out infinite}
@keyframes ta-pulse{0%,100%{transform:scale(1)}20%{transform:scale(.86)}30%{transform:scale(1.08)}}
.ta-card{position:absolute;left:50%;top:22px;width:200px;margin-left:-100px;border-radius:14px;background:#fff;color:#1e1b33;padding:10px 12px;font:600 13px/1.3 system-ui;display:flex;gap:8px;align-items:center;animation:ta-pop 2.6s ease-in-out infinite}
@keyframes ta-pop{0%,25%{opacity:0;transform:translateY(14px) scale(.96)}35%,85%{opacity:1;transform:none}100%{opacity:0}}
.ta-type{overflow:hidden;white-space:nowrap;animation:ta-typing 2.6s steps(22) infinite;width:0}
@keyframes ta-typing{0%,30%{width:0}70%,100%{width:150px}}
.ta-grid{position:absolute;left:50%;top:22px;width:168px;margin-left:-84px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.ta-tile{aspect-ratio:1;border-radius:11px;background:rgba(255,255,255,.25)}
.ta-tile.new{background:#fff;color:var(--t2);display:grid;place-items:center;animation:ta-in 3s ease-in-out infinite}
@keyframes ta-in{0%,30%{transform:scale(0)}42%{transform:scale(1.15)}50%,100%{transform:scale(1)}}
.ta-tile svg{width:16px;height:16px}
.ta-w{position:absolute;width:76px;height:44px;border-radius:12px;background:#fff;color:#1e1b33;font:700 11px/44px system-ui;text-align:center}
.ta-w.a{left:calc(50% - 82px);top:24px;animation:ta-swapA 3.6s ease-in-out infinite}
.ta-w.b{left:calc(50% + 6px);top:24px;background:rgba(255,255,255,.85);animation:ta-swapB 3.6s ease-in-out infinite}
@keyframes ta-swapA{0%,30%{transform:none}45%{transform:translate(44px,-8px) rotate(4deg);box-shadow:0 14px 24px -8px rgba(0,0,0,.4)}60%,100%{transform:translateX(88px)}}
@keyframes ta-swapB{0%,30%{transform:none}60%,100%{transform:translateX(-88px)}}
.ta-dots{position:absolute;left:50%;bottom:22px;margin-left:-60px;display:flex;gap:8px}
.ta-dots i{width:16px;height:16px;border-radius:8px;display:block;animation:ta-dot 3s ease-in-out infinite}
@keyframes ta-dot{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}}
.ta-fly{position:absolute;top:56px;width:38px;height:38px;border-radius:11px;background:#fff;display:grid;place-items:center}
.ta-fly svg{width:20px;height:20px}
.ta-fly.l{left:16%;color:#0a84ff;animation:ta-flyL 3s ease-in-out infinite}.ta-fly.r{right:16%;color:#f59e0b;animation:ta-flyR 3s ease-in-out infinite}
@keyframes ta-flyL{0%,20%{transform:none;opacity:1}60%{transform:translateX(70px) scale(.5);opacity:0}100%{opacity:0}}
@keyframes ta-flyR{0%,20%{transform:none;opacity:1}60%{transform:translateX(-70px) scale(.5);opacity:0}100%{opacity:0}}
.ta-note{position:absolute;left:50%;top:-60px;width:210px;margin-left:-105px;border-radius:14px;background:rgba(255,255,255,.96);color:#1e1b33;padding:9px 11px;font:600 12px/1.3 system-ui;display:flex;gap:8px;align-items:center;animation:ta-drop 3.4s ease-in-out infinite}
.ta-note b{display:block;font-size:11px;color:#6b6879;font-weight:600}
@keyframes ta-drop{0%,15%{transform:translateY(0)}30%,80%{transform:translateY(84px)}95%,100%{transform:translateY(0)}}
.ta-split{position:absolute;left:50%;top:14px;width:96px;height:122px;margin-left:-48px;border-radius:18px;background:#1e1b33;padding:5px;display:flex;flex-direction:column;gap:5px}
.ta-split i{flex:1;border-radius:12px;display:grid;place-items:center;font:700 10px system-ui;font-style:normal;color:#1e1b33}
.ta-split i:first-child{background:#fff;animation:ta-grow1 3.4s ease-in-out infinite}.ta-split i:last-child{background:#ede9fe;animation:ta-grow2 3.4s ease-in-out infinite}
@keyframes ta-grow1{0%,20%{flex:1 1 100%}40%,85%{flex:1 1 0}100%{flex:1 1 100%}}
@keyframes ta-grow2{0%,20%{flex:0 0 0;opacity:0}40%,85%{flex:1 1 0;opacity:1}100%{flex:0 0 0;opacity:0}}
.ta-big{position:absolute;left:50%;top:50%;width:66px;height:66px;margin:-33px 0 0 -33px;border-radius:22px;background:#fff;color:var(--t2);display:grid;place-items:center;animation:ta-pulse 2.4s ease-in-out infinite}
.ta-big svg{width:34px;height:34px}
.ta-spark{position:absolute;width:8px;height:8px;border-radius:4px;background:#fff;opacity:.8;animation:ta-twinkle 2.2s ease-in-out infinite}
@keyframes ta-twinkle{0%,100%{opacity:.15;transform:scale(.6)}50%{opacity:.95;transform:scale(1.2)}}
@media (prefers-reduced-motion:reduce){.ta *{animation:none!important}.ta-note{transform:translateY(84px)}.ta-card,.ta-tile.new{opacity:1;transform:none}.ta-type{width:150px}}
`;

const sparks = (n = 6) => Array.from({ length: n }, (_, i) => <span key={i} className="ta-spark" style={{ left: `${10 + ((i * 37) % 80)}%`, top: `${12 + ((i * 53) % 70)}%`, animationDelay: `${i * 0.35}s` }} />);

export function TourArt({ id, tint }: { id: string; tint: string }) {
  let scene: ReactNode;
  switch (id) {
    case "welcome": scene = <><div className="ta-pill"><div className="ta-knob" /><span className="on1">LifeHub</span><span className="on2">WorkHub</span></div>{sparks(5)}</>; break;
    case "tabs": scene = <div className="ta-phone"><div className="ta-line" style={{ width: "60%" }} /><div className="ta-line" /><div className="ta-line" style={{ width: "75%" }} />
      <div className="ta-bar"><Home /><ListChecks /><Plus /><LayoutGrid /><User /></div><span className="ta-hi" /></div>; break;
    case "add": scene = <><div className="ta-card"><Check size={16} color="#16a34a" /><span className="ta-type">Dentist tomorrow 3pm</span></div><div className="ta-plus"><Plus size={22} /></div></>; break;
    case "gallery": scene = <div className="ta-grid">{Array.from({ length: 8 }, (_, i) => i === 5 ? <span key={i} className="ta-tile new"><Sparkles /></span> : <span key={i} className="ta-tile" />)}</div>; break;
    case "customize": scene = <><span className="ta-w a">Calendar</span><span className="ta-w b">To-dos</span>
      <div className="ta-dots">{["#f87171", "#fbbf24", "#34d399", "#a78bfa"].map((c, i) => <i key={c} style={{ background: c, animationDelay: `${i * 0.3}s` }} />)}<Palette size={16} style={{ marginLeft: 4 }} /></div></>; break;
    case "connect": scene = <><span className="ta-fly l"><CalendarDays /></span><span className="ta-fly r"><ListChecks /></span><div className="ta-big" style={{ width: 54, height: 54, margin: "-27px 0 0 -27px" }}><Sparkles /></div></>; break;
    case "notify": scene = <><div className="ta-note"><Bell size={18} color="#e11d48" /><span><b>Arise To Duo · now</b>Soccer practice in 30 min</span></div>{sparks(4)}</>; break;
    case "split": scene = <div className="ta-split"><i>LifeHub</i><i>WorkHub</i></div>; break;
    case "arise": scene = <><div className="ta-big"><BookOpen /></div>{sparks(6)}</>; break;
    case "done": scene = <><div className="ta-big"><Check strokeWidth={3} /></div>{sparks(8)}</>; break;
    case "search": scene = <div className="ta-big"><Search /></div>; break;
    default: scene = <><div className="ta-big"><MoreHorizontal /></div>{sparks(4)}</>;
  }
  return <div className="ta" aria-hidden style={{ ["--t1" as string]: tint, ["--t2" as string]: `color-mix(in srgb, ${tint} 60%, #000)` }} data-testid={`tour-art-${id}`}><style>{CSS}</style>{scene}</div>;
}
