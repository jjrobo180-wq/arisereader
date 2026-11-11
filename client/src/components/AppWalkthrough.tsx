// The first-run walkthrough of Arise To Duo (October 2026), in place of the old "Getting started"
// page: a few cards to tap through the first time someone opens a hub, explaining what's where and
// how to make it theirs. It matches the app as it is: the tab bar, the + button, Apps and the App
// Gallery, the ⋯ menu and Customize, Apple connections, reminders, and the split screen (for an
// iPhone Duo, and for everyone else too). It opens again from ⋯ → "How to use Arise To Duo".
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Bell, CalendarDays, Check, Columns2, LayoutGrid, ListChecks, MoreHorizontal, Plus, Search, Sparkles, X } from "lucide-react";
import { IPHONE_SETUP_EVENT, WALKTHROUGH_EVENT } from "@/components/HubMoreMenu";
import { appleRemindersAvailable, appleRemindersOn, connectAppleReminders } from "@/lib/nativeAppleReminders";
import { iphoneCalendarAvailable } from "@/lib/nativeCalendar";
import { looksLikeDuoInner, useAriseDuo } from "@/lib/useAriseDuo";
import { isNativeApp } from "@/lib/nativeApp";
import { isSampleMode } from "@/lib/sampleMode";
import { TourArt } from "@/components/TourArt";
import { nativeRemindersAvailable, nativeRemindersOn, turnOnNativeReminders } from "@/lib/nativeReminders";
import { lockPageScroll } from "@/lib/scrollLock";

const DONE_KEY = (id: number | string) => `arise-walkthrough-v1:${id}`;
/** True once this person has finished (or skipped) the first-run walkthrough on this phone. */
export const walkthroughDone = (id: number | string): boolean => { try { return localStorage.getItem(DONE_KEY(id)) === "1"; } catch { return true; } };
type Step = { id: string; icon: ReactNode; tint: string; title: string; body: ReactNode; action?: { label: string; run: () => void | Promise<void> } };

export default function AppWalkthrough({ userId, hub, arise, onGallery, onCustomize, onNotificationSettings, onConnectCalendar }: {
  userId: number | string; hub: "life" | "work";
  /** A teacher or parent from Arise Reader (gets a card about Reader and Arise Learning). */ arise: boolean;
  onGallery: () => void; onCustomize: (tab?: string) => void; onNotificationSettings: () => void;
  /** Reads the iPhone's calendars into this hub's calendar (the app's setup page). Resolves with how many events. */
  onConnectCalendar?: () => Promise<number>;
}) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [note, setNote] = useState("");
  const [, navigate] = useLocation();
  const duo = useAriseDuo();
  const isDuo = duo.isDuo || looksLikeDuoInner();
  // The first time, by itself (once for both hubs); and again whenever ⋯ → How to use is picked.
  useEffect(() => {
    let first = false;
    // Not in the homepage's sample viewer (the tour would cover the demo); it's still in its ⋯ menu.
    if (isSampleMode()) return;
    try { first = localStorage.getItem(DONE_KEY(userId)) !== "1"; } catch { first = false; }
    // In the iPhone app it opens straight after sign-in (the notification question comes first).
    if (first) { const t = window.setTimeout(() => setOpen(true), isNativeApp() ? 250 : 900); return () => window.clearTimeout(t); }
  }, [userId]);
  // Only the iPhone setup page (⋯ → iPhone connections), not the whole tour.
  const [setupOnly, setSetupOnly] = useState(false);
  useEffect(() => {
    const show = () => { setI(0); setNote(""); setSetupOnly(false); setOpen(true); };
    const setup = () => { setSetupOnly(true); setOpen(true); };
    window.addEventListener(WALKTHROUGH_EVENT, show);
    window.addEventListener(IPHONE_SETUP_EVENT, setup);
    return () => { window.removeEventListener(WALKTHROUGH_EVENT, show); window.removeEventListener(IPHONE_SETUP_EVENT, setup); };
  }, []);
  const close = () => { setOpen(false); setSetupOnly(false); try { localStorage.setItem(DONE_KEY(userId), "1"); } catch { /* shown again next time */ } };
  if (!open) return null;

  const other = hub === "life" ? "WorkHub" : "LifeHub";
  // One short line each: the animated picture (TourArt.tsx) does the explaining.
  const steps: Step[] = [
    { id: "welcome", icon: <Sparkles />, tint: "#6e5ae0", title: "Welcome to Arise To Duo",
      body: <>Two hubs, one app: <b>LifeHub</b> for home, <b>WorkHub</b> for work.</> },
    { id: "tabs", icon: <LayoutGrid />, tint: "#4f46e5", title: "Getting around",
      body: <>Home, Tasks, <b>+</b>, Plugins and You live in the bar at the bottom.</> },
    { id: "add", icon: <Plus />, tint: "#7968e5", title: "Add anything with +",
      body: <>Just type it: “dentist tomorrow 3pm” sets the day and time for you.</> },
    { id: "gallery", icon: <LayoutGrid />, tint: "#0f766e", title: "Only the plugins you want",
      body: <>Add habits, budgets, meals and more from the <b>Plugin Gallery</b>.</>,
      action: { label: "Open the Plugin Gallery", run: () => { close(); onGallery(); } } },
    { id: "customize", icon: <MoreHorizontal />, tint: "#db2777", title: "Make it yours",
      body: <>Hold anything on Home to move it. <b>Customize</b> changes themes and the menu.</>,
      action: { label: "Open Customize", run: () => { close(); onCustomize("layout"); } } },
    { id: "connect", icon: <CalendarDays />, tint: "#0284c7", title: "Bring in your iPhone",
      body: <>Your iPhone Calendar and Apple Reminders show up right here.</> },
    { id: "notify", icon: <Bell />, tint: "#e11d48", title: "Reminders on your phone",
      body: <>A morning summary and a heads-up before anything's due.</>,
      action: isNativeApp() && nativeRemindersAvailable()
        ? { label: nativeRemindersOn(hub) ? "Reminders are on" : "Turn on reminders", run: async () => { try { await turnOnNativeReminders(hub); setNote("Reminders are on."); } catch (e: any) { setNote(e?.message || "That didn't work. Try again from ⋯ → Notifications."); } } }
        : { label: "Notification settings", run: () => { close(); onNotificationSettings(); } } },
    { id: "split", icon: <Columns2 />, tint: "#292446", title: isDuo ? "Your iPhone Duo: two at once" : "Split screen: two at once",
      body: isDuo ? <>Open it flat for two pages, or use split screen for both hubs.</> : <>See both hubs together with split screen, on any phone.</>,
      action: { label: "Try the split screen", run: () => { close(); navigate("/duo"); } } },
    ...(arise ? [{ id: "arise", icon: <Sparkles />, tint: "#6d28d9", title: "Arise Reader and Arise Learning",
      body: <>Reader, Math, History and Connect are in your menu, below Home.</> }] : []),
    { id: "done", icon: <Search />, tint: "#16a34a", title: "You're all set",
      body: <>See this again any time: <b>⋯ → How to use Arise To Duo</b>.</> },
  ];
  void other; void looksLikeDuoInner;
  // The iPhone app gets its own full-screen version: notifications first, then the same steps.
  if (isNativeApp()) return <NativeTour steps={steps} hub={hub} onClose={close} setupOnly={setupOnly} onConnectCalendar={onConnectCalendar} />;

  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;

  return <div className="kb-sheet fixed inset-0 z-[700] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center" data-light-island role="dialog" aria-modal="true" aria-label="How to use Arise To Duo" data-testid="app-walkthrough">
    <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] bg-white text-slate-900 shadow-2xl">
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex gap-1.5" aria-label={`Step ${i + 1} of ${steps.length}`}>{steps.map((s, k) => <span key={s.id} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-slate-900" : "w-1.5 bg-slate-300"}`} />)}</div>
        <button type="button" onClick={close} className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100" data-testid="walkthrough-skip">Skip <X size={15} /></button>
      </div>
      <div className="px-6 pb-2 pt-5" key={step.id}>
        <TourArt id={step.id} tint={step.tint} />
        <h2 className="mt-4 text-[22px] font-black leading-tight tracking-tight">{step.title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{step.body}</p>
        {step.action && <button type="button" onClick={() => void step.action!.run()} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-slate-100 px-4 text-sm font-bold text-slate-900 hover:bg-slate-200" data-testid={`walkthrough-action-${step.id}`}>{step.action.label}</button>}
        {note && step.id === "notify" && <p role="status" className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{note}</p>}
      </div>
      <div className="flex items-center justify-between gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <button type="button" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} className="inline-flex h-12 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-slate-600 disabled:opacity-0"><ArrowLeft size={17} />Back</button>
        <button type="button" onClick={() => (last ? close() : setI((x) => x + 1))} className="inline-flex h-12 items-center gap-1.5 rounded-full bg-slate-900 px-6 text-sm font-bold text-white" data-testid="walkthrough-next">{last ? "Start using it" : <>Next <ArrowRight size={17} /></>}</button>
      </div>
    </div>
  </div>;
}

/** The iPhone app's first run: full-screen pages like a native app's onboarding. The first page asks
 *  for notifications (the iOS permission prompt comes from its button); then the tour, one idea per
 *  page, swipeable, with dots, Skip, and a big button at the thumb. */
function NativeTour({ steps, hub, onClose, setupOnly, onConnectCalendar }: { steps: Step[]; hub: "life" | "work"; onClose: () => void; setupOnly: boolean; onConnectCalendar?: () => Promise<number> }) {
  // The setup page (notifications, iPhone Calendar, Apple Reminders) comes first; it replaces the
  // tour's own reminders step. From ⋯ → iPhone connections it's shown on its own.
  const pages = steps.filter((s) => s.id !== "notify");
  const [asking, setAsking] = useState(true);
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  const last = i >= pages.length - 1;
  const step = pages[Math.min(i, pages.length - 1)];
  const next = () => (last ? onClose() : setI((x) => x + 1));
  const back = () => setI((x) => Math.max(0, x - 1));

  const font = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif" };
  const shell = "fixed inset-0 z-[700] flex flex-col bg-white pb-[max(16px,env(safe-area-inset-bottom))] pt-[var(--sat,env(safe-area-inset-top,0px))] text-[#111018]";
  const primary = "flex h-[54px] w-full items-center justify-center gap-2 rounded-[16px] text-[17px] font-semibold text-white transition active:opacity-85 disabled:opacity-60";

  if (asking) return <IphoneSetup hub={hub} font={font} shell={shell} primary={primary} onConnectCalendar={onConnectCalendar}
    onDone={() => (setupOnly ? onClose() : setAsking(false))} doneLabel={setupOnly ? "Done" : "Continue"} />;

  return <LiveTour step={step} i={i} count={pages.length} last={last} next={next} back={back} onClose={onClose} font={font} />;
}

/** Where on the real screen each step points. The tour is drawn over the real app, not a picture of it. */
const TARGETS: Record<string, string> = {
  tabs: '[data-testid$="tab-apps"], [data-testid="life-apps-open"]',
  add: '[data-testid="life-add-button"], [data-testid="hub-add-button"]',
  gallery: '[data-testid$="tab-apps"], [data-testid="life-apps-open"]',
  customize: '[data-testid="hub-more-menu"], [data-testid="life-more-menu"]',
  split: '[data-testid="hub-todo-switch"]',
};

/** The iPhone tour on the live app: the real hub stays visible behind, the thing being explained is lit
 *  with a ring, and a short card sits at the thumb. Swipe or tap to move on. */
function LiveTour({ step, i, count, last, next, back, onClose, font }: { step: Step; i: number; count: number; last: boolean; next: () => void; back: () => void; onClose: () => void; font: CSSProperties }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const touch = useRef<number | null>(null);
  useEffect(() => {
    const sel = TARGETS[step.id];
    const measure = () => {
      const el = sel ? Array.from(document.querySelectorAll<HTMLElement>(sel)).find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    // The tour never needs a scroll: a target that is off screen is brought into view once, then the page holds still.
    const target = sel ? Array.from(document.querySelectorAll<HTMLElement>(sel)).find((e) => e.getBoundingClientRect().width > 0) : null;
    if (target) { const r = target.getBoundingClientRect(); if (r.top < 0 || r.bottom > window.innerHeight) target.scrollIntoView({ block: "center" }); }
    measure();
    const t = window.setInterval(measure, 400);
    window.addEventListener("resize", measure);
    return () => { window.clearInterval(t); window.removeEventListener("resize", measure); };
  }, [step.id]);
  useEffect(() => {
    return lockPageScroll();
  }, []);
  const pad = 8;
  const high = rect && rect.top < window.innerHeight / 2; // the lit thing is in the top half: card goes below
  return <div className="fixed inset-0 z-[700]" style={{ ...font, touchAction: "none" }} data-light-island role="dialog" aria-modal="true" aria-label="How to use Arise To Duo" data-testid="app-walkthrough"
    onTouchStart={(e) => { touch.current = e.touches[0]?.clientX ?? null; }}
    onTouchEnd={(e) => { const x = touch.current; touch.current = null; if (x == null) return; const dx = (e.changedTouches[0]?.clientX ?? x) - x; if (dx < -60) next(); else if (dx > 60) back(); }}>
    {rect
      ? <div aria-hidden className="pointer-events-none fixed rounded-2xl transition-all duration-300" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(17,16,24,.62), 0 0 0 3px #fff" }} />
      : <div aria-hidden className="fixed inset-0 bg-[#111018]/60" />}
    <div key={step.id} className={`fixed inset-x-0 mx-auto w-[min(92vw,26rem)] rounded-[24px] bg-white p-5 text-[#111018] shadow-[0_24px_60px_rgba(0,0,0,.35)] ${high ? "top-[max(7rem,calc(var(--sat,env(safe-area-inset-top,0px))+6rem))]" : "bottom-[max(16px,env(safe-area-inset-bottom))]"}`}>
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5" aria-label={`Page ${i + 1} of ${count}`}>{Array.from({ length: count }, (_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-[#111018]" : "w-1.5 bg-black/15"}`} />)}</div>
        {!last && <button type="button" onClick={onClose} className="h-9 px-1 text-[15px] font-medium text-[#6b6879]" data-testid="walkthrough-skip">Skip</button>}
      </div>
      <div className="mt-3"><TourArt id={step.id} tint={step.tint} /></div>
      <h1 className="mt-3 text-[22px] font-bold leading-tight tracking-[-.01em]">{step.title}</h1>
      <p className="mt-1.5 text-[15px] leading-[1.45] text-[#6b6879] [&_b]:font-semibold [&_b]:text-[#111018]">{step.body}</p>
      {step.action && <button type="button" onClick={() => void step.action!.run()} className="mt-3 inline-flex h-10 items-center rounded-full bg-[#f1f0f7] px-4 text-[14px] font-semibold text-[#3f35c9] active:opacity-80">{step.action.label}</button>}
      <div className="mt-4 flex gap-2">
        {i > 0 && <button type="button" onClick={back} className="h-12 rounded-2xl bg-[#f1f0f7] px-5 text-[16px] font-semibold">Back</button>}
        <button type="button" onClick={next} className="h-12 flex-1 rounded-2xl bg-[#111018] text-[16px] font-semibold text-white active:opacity-85" data-testid="walkthrough-next">{last ? "Get started" : "Continue"}</button>
      </div>
    </div>
  </div>;
}

/** The iPhone setup page: three things to connect, each with its own button and a check once it's on.
 *  Notifications raise iOS's prompt; Calendar and Reminders ask for their own permission when tapped. */
function IphoneSetup({ hub, font, shell, primary, onConnectCalendar, onDone, doneLabel }: {
  hub: "life" | "work"; font: CSSProperties; shell: string; primary: string;
  onConnectCalendar?: () => Promise<number>; onDone: () => void; doneLabel: string;
}) {
  type Row = "notify" | "calendar" | "reminders";
  const [on, setOn] = useState<Record<Row, boolean>>(() => ({
    notify: nativeRemindersOn(hub),
    calendar: (() => { try { return localStorage.getItem("arise-iphone-calendar-on") === "1"; } catch { return false; } })(),
    reminders: appleRemindersOn(),
  }));
  const [busy, setBusy] = useState<Row | "">("");
  const [note, setNote] = useState<{ row: Row; text: string } | null>(null);
  const run = async (row: Row, fn: () => Promise<string | void>) => {
    if (busy) return;
    setBusy(row); setNote(null);
    try { const text = await fn(); setOn((o) => ({ ...o, [row]: true })); if (text) setNote({ row, text }); }
    catch (e: any) { setNote({ row, text: e?.message || "That didn't work. You can try again any time from ⋯ → iPhone connections." }); }
    finally { setBusy(""); }
  };
  const rows: { id: Row; show: boolean; icon: ReactNode; tint: string; title: string; text: string; go: () => Promise<string | void> }[] = [
    { id: "notify", show: nativeRemindersAvailable(), icon: <Bell />, tint: "#e0465f", title: "Notifications", text: "A morning summary and a heads-up before tasks, events and bills.",
      go: async () => { await turnOnNativeReminders(hub); } },
    { id: "calendar", show: iphoneCalendarAvailable() && !!onConnectCalendar, icon: <CalendarDays />, tint: "#0a84ff", title: "iPhone Calendar", text: "Every calendar on your phone (iCloud, Google, Outlook, school), in your hub.",
      go: async () => { const n = await onConnectCalendar!(); try { localStorage.setItem("arise-iphone-calendar-on", "1"); } catch { /* still connected */ } return `${n} ${n === 1 ? "event" : "events"} brought in.`; } },
    { id: "reminders", show: appleRemindersAvailable(), icon: <ListChecks />, tint: "#f59e0b", title: "Apple Reminders", text: "Your reminders come into LifeHub → Tasks, and check-offs stay in step.",
      go: async () => { await connectAppleReminders(); } },
  ];
  const shown = rows.filter((r) => r.show);
  return <div className={shell} style={font} data-light-island role="dialog" aria-modal="true" aria-label="Set up your iPhone" data-testid="native-notify-ask">
    <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col px-6">
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto py-6">
        <div className="text-center">
          <h1 className="text-[30px] font-bold leading-tight tracking-[-.02em] [text-wrap:balance]">Bring in your iPhone</h1>
          <p className="mx-auto mt-2 max-w-[20rem] text-[16px] leading-snug text-[#6b6879] [text-wrap:balance]">Turn on what you want. You can change any of it later in ⋯ → iPhone connections.</p>
        </div>
        <ul className="mt-7 divide-y divide-black/[.06] overflow-hidden rounded-[18px] bg-[#f6f5fb]">
          {shown.map((r) => <li key={r.id} className="px-4 py-3.5" data-testid={`setup-${r.id}`}>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] text-white [&_svg]:h-[22px] [&_svg]:w-[22px]" style={{ background: r.tint }}>{r.icon}</span>
              <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold leading-tight">{r.title}</span><span className="mt-0.5 block text-[13px] leading-snug text-[#6b6879]">{r.text}</span></span>
              {on[r.id]
                ? <span className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-3 text-[13px] font-semibold text-emerald-800" data-testid={`setup-${r.id}-on`}><Check className="h-4 w-4" strokeWidth={3} />On</span>
                : <button type="button" onClick={() => void run(r.id, r.go)} disabled={!!busy} className="inline-flex h-9 shrink-0 items-center rounded-full bg-[#5b4fe0] px-4 text-[14px] font-semibold text-white active:opacity-85 disabled:opacity-50" data-testid={`setup-${r.id}-go`}>{busy === r.id ? "…" : r.id === "notify" ? "Turn on" : "Connect"}</button>}
            </div>
            {note?.row === r.id && <p role="status" className="mt-2 pl-[3.25rem] text-[13px] leading-snug text-[#3d3a4b]">{note.text}</p>}
          </li>)}
        </ul>
      </div>
      <div className="shrink-0 space-y-2 pt-3">
        <button type="button" onClick={onDone} className={`${primary} bg-[#111018]`} data-testid="native-notify-later">{doneLabel === "Continue" && !shown.some((r) => on[r.id]) ? "Not now" : doneLabel}</button>
      </div>
    </div>
  </div>;
}
