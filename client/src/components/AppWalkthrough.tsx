// The first-run walkthrough of Arise To Duo (October 2026), in place of the old "Getting started"
// page: a few cards to tap through the first time someone opens a hub, explaining what's where and
// how to make it theirs. It matches the app as it is: the tab bar, the + button, Apps and the App
// Gallery, the ⋯ menu and Customize, Apple connections, reminders, and the split screen (for an
// iPhone Duo, and for everyone else too). It opens again from ⋯ → "How to use Arise To Duo".
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Bell, CalendarDays, Columns2, LayoutGrid, MoreHorizontal, Plus, Search, Sparkles, X } from "lucide-react";
import { WALKTHROUGH_EVENT } from "@/components/HubMoreMenu";
import { looksLikeDuoInner, useAriseDuo } from "@/lib/useAriseDuo";
import { isNativeApp } from "@/lib/nativeApp";
import { isSampleMode } from "@/lib/sampleMode";
import { nativeRemindersAvailable, nativeRemindersOn, turnOnNativeReminders } from "@/lib/nativeReminders";

const DONE_KEY = (id: number | string) => `arise-walkthrough-v1:${id}`;
type Step = { id: string; icon: ReactNode; tint: string; title: string; body: ReactNode; action?: { label: string; run: () => void | Promise<void> } };

export default function AppWalkthrough({ userId, hub, arise, onGallery, onCustomize, onNotificationSettings }: {
  userId: number | string; hub: "life" | "work";
  /** A teacher or parent from A.R.I.S.E. Reader (gets a card about Reader and Arise Learning). */ arise: boolean;
  onGallery: () => void; onCustomize: (tab?: string) => void; onNotificationSettings: () => void;
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
  useEffect(() => {
    const show = () => { setI(0); setNote(""); setOpen(true); };
    window.addEventListener(WALKTHROUGH_EVENT, show);
    return () => window.removeEventListener(WALKTHROUGH_EVENT, show);
  }, []);
  const close = () => { setOpen(false); try { localStorage.setItem(DONE_KEY(userId), "1"); } catch { /* shown again next time */ } };
  if (!open) return null;

  const other = hub === "life" ? "WorkHub" : "LifeHub";
  const steps: Step[] = [
    { id: "welcome", icon: <Sparkles />, tint: "#6e5ae0", title: "Welcome to Arise To Duo",
      body: <>Two hubs in one app: <b>LifeHub</b> for you and your family, and <b>WorkHub</b> for work. Switch between them with the two buttons at the top. This quick tour shows you around.</> },
    { id: "tabs", icon: <LayoutGrid />, tint: "#1d1a33", title: "Getting around",
      body: <>On a phone, the bar at the bottom has <b>Home</b>, <b>Tasks</b>, the <b>+</b> button, <b>Apps</b> (every section, with search) and <b>You</b> (your account and settings). On a bigger screen, the same things are in the menu on the side.</> },
    { id: "add", icon: <Plus />, tint: "#7968e5", title: "Add anything with +",
      body: <>Tap <b>+</b> from any screen to add a task, a list, an event, a note and more. In {hub === "work" ? "WorkHub" : "LifeHub"} you can also paste or snap a photo and let AI sort it into tasks and events.</> },
    { id: "gallery", icon: <LayoutGrid />, tint: "#0f766e", title: "Only the apps you want",
      body: <>Nothing extra is added for you. Open the <b>App Gallery</b> to add what helps, like a calorie counter, habits, a budget, meal planning or notes. Remove anything later; nothing you saved is lost.</>,
      action: { label: "Open the App Gallery", run: () => { close(); onGallery(); } } },
    { id: "customize", icon: <MoreHorizontal />, tint: "#334155", title: "Make it yours",
      body: <>The <b>⋯</b> menu at the top has notifications and every setting. <b>Customize</b> changes the menu (tab bar, side menu or app drawer), what's on Home and in what order, the theme and night mode. Both hubs start with the same settings; you can set each one its own way in Customize.</>,
      action: { label: "Open Customize", run: () => { close(); onCustomize("layout"); } } },
    { id: "connect", icon: <CalendarDays />, tint: "#0284c7", title: "Bring in your iPhone",
      body: <>{isNativeApp() ? "Everything connects through your iPhone:" : "In the iPhone app, everything connects through your iPhone:"} <b>Connect iPhone Calendar</b> in Calendar brings every calendar on your phone, and the <b>Calorie counter</b> reads steps and workouts from Apple Health. If your school's calendar can't go on your iPhone, paste its calendar link instead. School email can be forwarded in to your own address and becomes tasks.</> },
    { id: "notify", icon: <Bell />, tint: "#e11d48", title: "Reminders on your phone",
      body: <>Get a morning summary and a heads-up before tasks, events and bills, as notifications on your phone and in the bell at the top. One switch covers both hubs.</>,
      action: isNativeApp() && nativeRemindersAvailable()
        ? { label: nativeRemindersOn(hub) ? "Reminders are on" : "Turn on reminders", run: async () => { try { await turnOnNativeReminders(hub); setNote("Reminders are on."); } catch (e: any) { setNote(e?.message || "That didn't work. Try again from ⋯ → Notification settings."); } } }
        : { label: "Notification settings", run: () => { close(); onNotificationSettings(); } } },
    { id: "split", icon: <Columns2 />, tint: "#292446", title: isDuo ? "Your iPhone Duo: two at once" : "Split screen: two at once",
      body: isDuo
        ? <>Open your iPhone Duo flat and Arise To Duo spreads across the inner screen: the menu on one side, the page on the other. Tap the <b>Duo</b> button at the top for the <b>split screen</b>, with {hub === "life" ? "LifeHub" : "WorkHub"} and {other} side by side, each working on its own.</>
        : <>No iPhone Duo needed: the <b>split screen</b> shows LifeHub and WorkHub together, one above the other on a phone or side by side on a wider screen, so you can check your calendar while you plan. Open it from ⋯ → Customize → <b>Duo & split screen</b>.</>,
      action: { label: "Try the split screen", run: () => { close(); navigate("/duo"); } } },
    ...(arise ? [{ id: "arise", icon: <Sparkles />, tint: "#6d28d9", title: "A.R.I.S.E. Reader and Arise Learning",
      body: <>Because you came from A.R.I.S.E. Reader, Reader and Arise Learning (Math, History and Connect) are in your menu, right below Home.</> }] : []),
    { id: "done", icon: <Search />, tint: "#6e5ae0", title: "You're all set",
      body: <>Use the <b>search</b> at the top to find anything in your hub. You can see this tour again any time from <b>⋯ → How to use Arise To Duo</b>.</> },
  ];
  // The iPhone app gets its own full-screen version: notifications first, then the same steps.
  if (isNativeApp()) return <NativeTour steps={steps} hub={hub} onClose={close} />;

  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;

  return <div className="kb-sheet fixed inset-0 z-[700] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="How to use Arise To Duo" data-testid="app-walkthrough">
    <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] bg-white text-slate-900 shadow-2xl">
      <div className="flex items-center justify-between px-4 pt-4">
        <div className="flex gap-1.5" aria-label={`Step ${i + 1} of ${steps.length}`}>{steps.map((s, k) => <span key={s.id} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-slate-900" : "w-1.5 bg-slate-300"}`} />)}</div>
        <button type="button" onClick={close} className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100" data-testid="walkthrough-skip">Skip <X size={15} /></button>
      </div>
      <div className="px-6 pb-2 pt-5" key={step.id}>
        <span className="grid h-14 w-14 place-items-center rounded-2xl text-white [&_svg]:h-7 [&_svg]:w-7" style={{ background: step.tint }}>{step.icon}</span>
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
function NativeTour({ steps, hub, onClose }: { steps: Step[]; hub: "life" | "work"; onClose: () => void }) {
  const askFirst = nativeRemindersAvailable() && !nativeRemindersOn(hub);
  // The notification page replaces the tour's own reminders step (and its "Turn on reminders" button).
  const pages = (askFirst ? steps.filter((s) => s.id !== "notify") : steps);
  const [asking, setAsking] = useState(askFirst);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const touch = useRef<number | null>(null);
  const last = i >= pages.length - 1;
  const step = pages[Math.min(i, pages.length - 1)];
  const next = () => (last ? onClose() : setI((x) => x + 1));
  const back = () => setI((x) => Math.max(0, x - 1));
  const allow = async () => {
    setBusy(true); setNote("");
    try { await turnOnNativeReminders(hub); setAsking(false); }
    catch (e: any) { setNote(e?.message || "Notifications are off. You can turn them on any time in Settings → Notifications → Arise To Duo."); }
    finally { setBusy(false); }
  };
  const font = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif" };
  const shell = "fixed inset-0 z-[700] flex flex-col bg-white pb-[max(16px,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-[#111018]";
  const primary = "flex h-[54px] w-full items-center justify-center gap-2 rounded-[16px] text-[17px] font-semibold text-white transition active:opacity-85 disabled:opacity-60";

  if (asking) return <div className={shell} style={font} role="dialog" aria-modal="true" aria-label="Turn on notifications" data-testid="native-notify-ask">
    <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col px-7">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
        {/* A notification as it will look on the Lock Screen. */}
        <div className="relative mb-10 w-full max-w-[19rem]" aria-hidden>
          <div className="absolute inset-x-6 -bottom-3 h-14 rounded-[20px] bg-[#ecebf3]" />
          <div className="relative flex items-start gap-3 rounded-[20px] bg-white/90 p-3.5 text-left shadow-[0_20px_50px_-20px_rgba(40,30,100,.45)] ring-1 ring-black/[.06]">
            <img src="/icon-512.png" alt="" className="h-10 w-10 shrink-0 rounded-[10px]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2"><span className="text-[14px] font-semibold">Arise To Duo</span><span className="text-[12px] text-[#8e8b9c]">now</span></div>
              <p className="mt-0.5 text-[14px] leading-snug text-[#3d3a4b]">Dentist at 3:00 PM — leave in 20 minutes.</p>
            </div>
          </div>
        </div>
        <h1 className="text-[30px] font-bold leading-tight tracking-[-.02em] [text-wrap:balance]">Never miss what matters</h1>
        <p className="mt-3 max-w-[20rem] text-[17px] leading-snug text-[#6b6879] [text-wrap:balance]">A morning summary, and a heads-up before tasks, events and bills. One switch covers LifeHub and WorkHub.</p>
        {note && <p role="status" className="mt-5 rounded-[12px] bg-[#f4f3f8] px-4 py-3 text-[14px] leading-snug text-[#3d3a4b]">{note}</p>}
      </div>
      <div className="shrink-0 space-y-2 pt-4">
        <button type="button" onClick={() => void allow()} disabled={busy} className={`${primary} bg-[#5b4fe0] shadow-[0_12px_28px_-12px_rgba(91,79,224,.8)]`} data-testid="native-notify-allow">Turn on notifications</button>
        <button type="button" onClick={() => setAsking(false)} className="h-12 w-full text-[16px] font-medium text-[#6b6879]" data-testid="native-notify-later">Not now</button>
      </div>
    </div>
  </div>;

  return <div className={shell} style={font} role="dialog" aria-modal="true" aria-label="How to use Arise To Duo" data-testid="app-walkthrough"
    onTouchStart={(e) => { touch.current = e.touches[0]?.clientX ?? null; }}
    onTouchEnd={(e) => { const x = touch.current; touch.current = null; if (x == null) return; const dx = (e.changedTouches[0]?.clientX ?? x) - x; if (dx < -50) next(); else if (dx > 50) back(); }}>
    <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-end px-4">
        {!last && <button type="button" onClick={onClose} className="h-11 px-2 text-[16px] font-medium text-[#6b6879]" data-testid="walkthrough-skip">Skip</button>}
      </div>
      <div key={step.id} className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center">
        {/* The step's icon as a large app-style illustration on a soft glow of its own colour. */}
        <div className="relative mb-10 grid h-44 w-44 place-items-center" aria-hidden>
          <span className="absolute inset-0 rounded-full opacity-25 blur-2xl" style={{ background: step.tint }} />
          <span className="absolute inset-5 rounded-[2.4rem] opacity-15" style={{ background: step.tint }} />
          <span className="relative grid h-24 w-24 place-items-center rounded-[1.6rem] text-white shadow-[0_18px_36px_-14px_rgba(0,0,0,.45)] [&_svg]:h-11 [&_svg]:w-11" style={{ background: `linear-gradient(160deg, ${step.tint}cc, ${step.tint})` }}>{step.icon}</span>
        </div>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-.02em] [text-wrap:balance]">{step.title}</h1>
        <p className="mt-3 max-w-[21rem] text-[16px] leading-[1.45] text-[#6b6879] [&_b]:font-semibold [&_b]:text-[#111018]">{step.body}</p>
        {step.action && <button type="button" onClick={() => void step.action!.run()} className="mt-6 inline-flex h-11 items-center rounded-full bg-[#f1f0f7] px-5 text-[15px] font-semibold text-[#3f35c9] active:opacity-80" data-testid={`walkthrough-action-${step.id}`}>{step.action.label}</button>}
      </div>
      <div className="shrink-0 px-6 pt-4">
        <div className="mb-5 flex justify-center gap-2" aria-label={`Page ${i + 1} of ${pages.length}`}>{pages.map((s, k) => <span key={s.id} className={`h-2 rounded-full transition-all duration-300 ${k === i ? "w-6 bg-[#111018]" : "w-2 bg-[#d6d4df]"}`} />)}</div>
        <button type="button" onClick={next} className={`${primary} bg-[#111018]`} data-testid="walkthrough-next">{last ? "Get started" : "Continue"}</button>
      </div>
    </div>
  </div>;
}
