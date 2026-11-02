// The second half of the Arise To Duo app's first run, on the real hub (after the full-screen tour):
// a spotlight on the actual thing to touch, an animated finger showing the gesture, and a short
// card. Each step moves on when the person really does it (or taps Next):
//   1. Press and hold a widget on Home: Home starts to jiggle (teacher-hub/HubHomeEdit.tsx).
//   2. Drag it somewhere, then tap Done: the jiggle stops.
//   3. Switch between WorkHub and LifeHub with the switch at the top.
//   4. Tap Apps, then App Gallery: the App Gallery opens.
// The step is remembered (per person, on this phone), so it carries on in the other hub after the
// switch. Shown once, in the iPhone app; Skip ends it.
import { useEffect, useRef, useState } from "react";
import { isNativeApp } from "@/lib/nativeApp";
import { isSampleMode } from "@/lib/sampleMode";

const TOUR_DONE = (id: number | string) => `arise-walkthrough-v1:${id}`;
const STEP_KEY = (id: number | string) => `arise-coach-v1:${id}`;
const DONE = 99;

type Step = { target: string; title: string; body: string; gesture: "hold" | "drag" | "tap"; when?: () => boolean; next?: number };
const exists = (sel: string) => !!document.querySelector(sel);
const steps = (hub: "life" | "work"): Step[] => [
  { target: "[data-home-part]", gesture: "hold", title: "Make Home yours", body: "Press and hold any widget until Home starts to wiggle.", when: () => exists(".hub-jiggle") },
  { target: ".hub-jiggle", gesture: "drag", title: "Drag it anywhere", body: "Move it where you want it, then tap Done at the top.", when: () => !exists(".hub-jiggle") },
  { target: '[data-testid="hub-todo-switch"]', gesture: "tap", title: hub === "life" ? "Switch to WorkHub" : "Switch to LifeHub", body: hub === "life" ? "Your work lives in WorkHub. Tap its icon here to go there, and the same switch brings you back." : "Your home life lives in LifeHub. Tap its icon here to go there, and the same switch brings you back." },
  { target: '[data-testid$="tab-apps"], [data-testid="life-apps-open"]', gesture: "tap", title: "Every app is in Apps", body: "Tap Apps to see everything in this hub.", when: () => exists('[data-testid="life-apps"], [data-testid="hub-apps"]') },
  { target: '[data-testid="hub-app-store"], [data-testid="life-app-app-store"]', gesture: "tap", title: "Then the App Gallery", body: "Tap App Gallery to add more, like a budget, habits or meal planning.", when: () => exists('[data-testid="plugin-store"]') },
];

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* starts over next time */ } };

export default function HubCoach({ userId, hub }: { userId: number | string; hub: "life" | "work" }) {
  const list = steps(hub);
  const [step, setStep] = useState<number>(() => Number(read(STEP_KEY(userId)) ?? 0) || 0);
  const [ready, setReady] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const hubAtStart = useRef(window.location.hash);
  const go = (n: number) => { setStep(n); write(STEP_KEY(userId), String(n)); };

  // Starts once the full-screen tour is finished, after the hub has drawn itself.
  useEffect(() => {
    if (!isNativeApp() || isSampleMode() || step >= DONE) return;
    const t = window.setInterval(() => { if (read(TOUR_DONE(userId)) === "1" && !document.querySelector('[data-testid="app-walkthrough"], [data-testid="native-notify-ask"]')) { setReady(true); window.clearInterval(t); } }, 600);
    return () => window.clearInterval(t);
  }, [userId, step]);

  // The switch step is done when this hub is left (the other hub picks up at the next step).
  useEffect(() => {
    if (!ready || step !== 2) return;
    const left = () => { if (window.location.hash.split("?")[0] !== hubAtStart.current.split("?")[0]) go(3); };
    window.addEventListener("hashchange", left);
    return () => window.removeEventListener("hashchange", left);
  }, [ready, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follows the target as the page scrolls or redraws, and moves on when the step's condition is met.
  useEffect(() => {
    if (!ready || step >= list.length) return;
    const s = list[step];
    let first = true;
    const tick = () => {
      if (s.when?.()) { go(step + 1 >= list.length ? DONE : step + 1); return; }
      const el = [...document.querySelectorAll<HTMLElement>(s.target)].find((e) => e.offsetParent !== null || e.getClientRects().length);
      if (el && first) { first = false; el.scrollIntoView({ block: "center", behavior: "smooth" }); }
      setRect(el ? el.getBoundingClientRect() : null);
    };
    tick();
    const t = window.setInterval(tick, 250);
    return () => window.clearInterval(t);
  }, [ready, step]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready || step >= list.length) return null;
  const s = list[step];
  const pad = 8;
  const hole = rect ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: Math.min(rect.height + pad * 2, window.innerHeight * 0.6) } : null;
  const below = !hole || hole.y + hole.h < window.innerHeight * 0.55;
  const finger = hole ? { x: hole.x + Math.min(hole.w / 2, 140), y: hole.y + Math.min(hole.h / 2, 90) } : null;

  return <div className="pointer-events-none fixed inset-0 z-[650]" aria-live="polite" data-testid="hub-coach">
    <style>{`
      @keyframes coach-hold{0%,15%{transform:translate(-50%,-50%) scale(1)}35%,80%{transform:translate(-50%,-50%) scale(.82)}100%{transform:translate(-50%,-50%) scale(1)}}
      @keyframes coach-ring{0%,30%{transform:translate(-50%,-50%) scale(.4);opacity:0}45%{opacity:.7}85%{transform:translate(-50%,-50%) scale(1.7);opacity:0}100%{opacity:0}}
      @keyframes coach-drag{0%,10%{transform:translate(-50%,-50%) translate(0,0) scale(.85)}60%,75%{transform:translate(-50%,-50%) translate(40px,90px) scale(.85)}100%{transform:translate(-50%,-50%) translate(0,0) scale(.85)}}
      @keyframes coach-tap{0%,40%{transform:translate(-50%,-50%) scale(1)}55%{transform:translate(-50%,-50%) scale(.8)}70%,100%{transform:translate(-50%,-50%) scale(1)}}
      @keyframes coach-pulse{0%,100%{box-shadow:0 0 0 0 rgba(124,77,255,.55)}50%{box-shadow:0 0 0 10px rgba(124,77,255,0)}}
      @media (prefers-reduced-motion:reduce){.coach-anim{animation:none!important}}
    `}</style>
    {/* The dim with a hole over the real thing to touch (touches go straight through to it). */}
    <svg className="absolute inset-0 h-full w-full" aria-hidden>
      <defs><mask id="coach-hole"><rect width="100%" height="100%" fill="white" />{hole && <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={18} fill="black" />}</mask></defs>
      <rect width="100%" height="100%" fill="rgba(17,16,24,.55)" mask="url(#coach-hole)" />
    </svg>
    {hole && <div className="coach-anim absolute rounded-[18px] ring-2 ring-white" style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h, animation: "coach-pulse 1.6s ease-in-out infinite" }} />}
    {finger && <>
      {s.gesture === "hold" && <span className="coach-anim absolute h-16 w-16 rounded-full bg-white/70" style={{ left: finger.x, top: finger.y, animation: "coach-ring 1.8s ease-out infinite" }} aria-hidden />}
      <span className="coach-anim absolute grid h-12 w-12 place-items-center rounded-full bg-white/95 shadow-[0_8px_20px_rgba(0,0,0,.35)]" aria-hidden
        style={{ left: finger.x, top: finger.y, animation: `${s.gesture === "hold" ? "coach-hold 1.8s" : s.gesture === "drag" ? "coach-drag 2.4s" : "coach-tap 1.4s"} ease-in-out infinite` }}>
        <span className="h-5 w-5 rounded-full bg-[#7c4dff]" />
      </span>
    </>}
    <div className="pointer-events-auto absolute inset-x-3 mx-auto max-w-sm rounded-[20px] bg-white p-4 text-[#111018] shadow-[0_20px_50px_-10px_rgba(0,0,0,.5)]"
      style={below ? { top: Math.min((hole ? hole.y + hole.h : 80) + 14, window.innerHeight - 180) } : { bottom: Math.max(window.innerHeight - (hole?.y ?? 0) + 14, 90) }}
      data-testid={`hub-coach-step-${step}`}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[#7c4dff]">Step {step + 1} of {list.length}</span>
        <button type="button" onClick={() => go(DONE)} className="-mr-2 h-9 px-2 text-[14px] font-medium text-[#6b6879]" data-testid="hub-coach-skip">Skip</button>
      </div>
      <p className="mt-1 text-[18px] font-bold leading-tight">{s.title}</p>
      <p className="mt-1 text-[15px] leading-snug text-[#4a4757]">{s.body}</p>
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={() => go(step + 1 >= list.length ? DONE : step + 1)} className="h-10 rounded-full bg-[#111018] px-5 text-[15px] font-semibold text-white" data-testid="hub-coach-next">{step + 1 >= list.length ? "Done" : "Next"}</button>
      </div>
    </div>
  </div>;
}
