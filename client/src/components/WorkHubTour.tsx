import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

// Arise To Duo's guided tour for teachers (WorkHub) and parents (LifeHub).
//
// Instead of describing the app in a box, every step opens the real section and points at the
// real thing on screen: the page dims except for that button or section, a label sits right on
// it, and a card beside it says what it does. Because it highlights the live page, what people
// see is always the exact current screen, never an out-of-date picture.
//
// It shows once per person (remembered on the server, so not again on another device) and can
// be started again from Customize ("Take the tour"), which sends "arise-tour:start". To open a
// section it sends "arise-tour:open"; TeacherHub and AriseTodo listen for it.

type TourRole = "teacher" | "parent" | "personal";

/** Where to point. The first selector that is on screen wins; `note` is added when it isn't the first (e.g. a phone's ••• menu). */
type Target = { sel: string; label: string; note?: string };

type TourStep = {
  title: string;
  body: string;
  /** Nothing to point at: a centred card (welcome and wrap-up). */
  targets?: Target[];
  /** Open this section first, so the step shows the actual screen. */
  open?: { tab: string } | { section: string };
  /** Only for parents (a teacher's LifeHub has no linked child to show). */
  parentOnly?: boolean;
  /** Only for teachers (and admins): the A.R.I.S.E. Reader class tools. */
  teacherOnly?: boolean;
};

// One tour per hub. It follows the hub you're on, so a teacher (or admin) taking it from LifeHub
// gets the LifeHub tour, and from WorkHub the WorkHub one.
type Hub = "work" | "life";
const TOUR_STEPS: Record<Hub, TourStep[]> = {
  work: [
    {
      title: "Welcome to your WorkHub",
      body: "Here's a quick walk around the real thing. Each step opens the actual screen and points at it, so you'll know exactly where everything is. It takes about a minute.",
    },
    {
      title: "Work and Life",
      body: "Work is your classroom: Reader, students, calendar and to-dos. Life is your own personal to-do list. Switch between them here any time, with no extra sign-in.",
      targets: [{ sel: '[data-testid="hub-todo-switch"]', label: "Work / Life switch" }],
    },
    {
      title: "A.R.I.S.E. Reader",
      teacherOnly: true,
      body: "Your reading program lives here, in the violet button. Tap it any time to get back to your Reader Overview.",
      open: { tab: "reader" },
      targets: [
        { sel: '[data-testid="hub-menu-arise"]', label: "A.R.I.S.E. Reader" },
        { sel: '[data-testid="hub-rail-show"]', label: "Open your menu", note: "Your menu is tucked away. Tap this tab to open it." },
      ],
    },
    {
      title: "Your Reader Overview",
      teacherOnly: true,
      body: "This is the Overview. It shows what needs you today: students waiting to join, quizzes to grade and requests to answer.",
      open: { tab: "reader" },
      targets: [{ sel: '[data-tour="hub-content"]', label: "Reader Overview" }],
    },
    {
      title: "Your students",
      teacherOnly: true,
      body: "Your class list. You only ever see students assigned to you. Add students one at a time or a whole class from a spreadsheet, and open anyone's profile to see their quizzes and points.",
      open: { tab: "readerStudents" },
      targets: [
        { sel: '[data-testid="hub-menu-readerStudents"]', label: "Students" },
        { sel: '[data-tour="hub-content"]', label: "Students" },
      ],
    },
    {
      title: "Approvals",
      teacherOnly: true,
      body: "New students who sign up with your class code, grade changes and book requests wait here for a yes or no.",
      open: { tab: "readerApprovals" },
      targets: [
        { sel: '[data-testid="hub-menu-readerApprovals"]', label: "Approvals" },
        { sel: '[data-tour="hub-content"]', label: "Approvals" },
      ],
    },
    {
      title: "Live quiz",
      teacherOnly: true,
      body: "Run a live reading quiz with your whole class. Students join on their own devices and you see answers come in as they happen.",
      open: { tab: "readerLive" },
      targets: [
        { sel: '[data-testid="hub-menu-readerLive"]', label: "Live quiz" },
        { sel: '[data-tour="hub-content"]', label: "Live quiz" },
      ],
    },
    {
      title: "The rest of your Reader",
      teacherOnly: true,
      body: "Everything else for your class sits under A.R.I.S.E. Reader too: Scenes, Parents, Quizzes & grading, Game time, Prizes and Reading records.",
      open: { tab: "reader" },
      targets: [{ sel: '[data-tour="hub-menu"]', label: "Your menu" }],
    },
    {
      title: "Arise Learning",
      teacherOnly: true,
      body: "Arise Math, Arise History and A.R.I.S.E. Connect have their own spot, right under A.R.I.S.E. Reader. Tap one to open it. An Add-on tag means it isn't on your plan yet; tapping it shows you how to add it.",
      targets: [
        { sel: '[data-testid="hub-learning-heading"]', label: "Arise Learning" },
        { sel: '[data-testid="hub-learning-math"]', label: "Arise Learning" },
        { sel: '[data-testid="hub-rail-show"]', label: "Open your menu", note: "Your menu is tucked away. Tap this tab to open it." },
      ],
    },
    {
      title: "Add things fast",
      body: "Paste a list, an email or a photo of your notes, and AI turns it into to-dos and calendar events. You check everything before it's saved.",
      open: { tab: "overview" },
      targets: [
        { sel: '[data-testid="hub-add-with-ai"]', label: "Add with AI" },
        { sel: '[data-testid="quick-add-event"]', label: "Add" },
      ],
    },
    {
      title: "App Store",
      body: "Add extra tools to your WorkHub, like behavior points, attendance, a gradebook and notes. Everything there is optional.",
      targets: [
        { sel: '[data-testid="hub-plugin-store"]', label: "App Store" },
        { sel: '[data-testid="hub-menu-app-store"]', label: "App Store" },
      ],
    },
    {
      title: "Make it yours",
      body: "Customize lets you reorder or hide menu items, pick where the menu sits and choose a color. You can take this tour again from there, too.",
      targets: [
        { sel: '[data-tour="customize"]', label: "Customize" },
        { sel: '[data-testid="hub-more"]', label: "More", note: "On a phone, Customize is inside this ••• menu." },
      ],
    },
    {
      title: "Find anything",
      body: "Search finds any student, to-do, event or screen. On a computer, press Ctrl K (or ⌘ K on a Mac) from anywhere.",
      targets: [{ sel: '[data-testid="hub-search-open"]', label: "Search" }],
    },
    {
      title: "You're all set",
      body: "That's the tour. Your Home page is ready. If you want to see this again, open Customize and choose Take the tour.",
      open: { tab: "overview" },
    },
  ],
  life: [
    {
      title: "Welcome to Arise To Duo",
      body: "Here's a quick walk around. Each step opens the real screen and points at it, so you'll know exactly where everything is. It takes about a minute.",
    },
    {
      title: "Your child's reading",
      body: "A.R.I.S.E. Reader is where you follow your child's reading. Tap it any time to come back here.",
      parentOnly: true,
      open: { section: "reader" },
      targets: [
        { sel: '[data-testid="life-section-reader"]', label: "A.R.I.S.E. Reader" },
        { sel: '[data-testid="life-menu-reader"]', label: "A.R.I.S.E. Reader" },
        { sel: '[data-testid="life-rail-show"]', label: "Open your menu", note: "Your menu is tucked away. Tap this tab to open it." },
      ],
    },
    {
      title: "Progress, quizzes and certificates",
      body: "This page shows how your child is doing: books read, quiz scores, points and certificates, plus messages from their teacher.",
      parentOnly: true,
      open: { section: "reader" },
      targets: [{ sel: '[data-tour="life-content"]', label: "Your child's reading" }],
    },
    {
      title: "Arise Learning",
      parentOnly: true,
      body: "Arise Math, Arise History and A.R.I.S.E. Connect have their own spot in your menu. Tap one to open it. An Add-on tag means it isn't on your plan yet; tapping it shows you how to add it.",
      targets: [
        { sel: '[data-testid="life-learning"]', label: "Arise Learning" },
        { sel: '[data-testid="life-menu-learning-math"]', label: "Arise Learning" },
        { sel: '[data-testid="life-rail-show"]', label: "Open your menu", note: "Your menu is tucked away. Tap this tab to open it." },
      ],
    },
    {
      title: "Family to-dos",
      body: "Tasks is your family to-do list. Make lists, give jobs to anyone in the family and tick them off together.",
      open: { section: "tasks" },
      targets: [
        { sel: '[data-testid="life-section-tasks"]', label: "Tasks" },
        { sel: '[data-testid="life-menu-tasks"]', label: "Tasks" },
        { sel: '[data-tour="life-content"]', label: "Tasks" },
      ],
    },
    {
      title: "Add anything",
      body: "The Add button adds a task, list, event, grocery item, note or bill from any screen.",
      targets: [{ sel: '[data-testid="life-add-button"]', label: "Add" }],
    },
    {
      title: "Family and settings",
      body: "Add the people in your family, link more children and choose which sections show in your menu.",
      open: { section: "family" },
      targets: [
        { sel: '[data-testid="life-section-family"]', label: "Family & settings" },
        { sel: '[data-testid="life-menu-family"]', label: "Family & settings" },
        { sel: '[data-tour="life-content"]', label: "Family & settings" },
      ],
    },
    {
      title: "App Store",
      body: "Add extra tools, like a calendar, groceries, money, notes and more. Everything there is optional.",
      targets: [
        { sel: '[data-testid="lifehub-plugin-store-header"]', label: "App Store" },
        { sel: '[data-testid="lifehub-plugin-store"]', label: "App Store" },
        { sel: '[data-testid="life-menu-app-store"]', label: "App Store" },
      ],
    },
    {
      title: "Make it yours",
      body: "Customize lets you reorder or hide sections, choose where the menu sits and pick a look. You can take this tour again from there, too.",
      targets: [
        { sel: '[data-testid="life-customize"]', label: "Customize" },
        { sel: '[data-testid="life-more"]', label: "More", note: "On a phone, Customize is inside this ••• menu." },
      ],
    },
    {
      title: "Find anything",
      body: "Search finds any task, event, note or screen. On a computer, press Ctrl K (or ⌘ K on a Mac) from anywhere.",
      targets: [{ sel: '[data-testid="hub-search-open"]', label: "Search" }],
    },
    {
      title: "You're all set",
      body: "That's the tour. To see it again, open Customize and choose Take the tour again.",
    },
  ],
};

/** Which hub a page is, if any. */
const hubAt = (path: string): Hub | null => (path === "/workhub" ? "work" : path === "/lifehub" ? "life" : null);
/** The hub a person lands in, where the tour shows itself on their first visit. */
const HOME_HUB: Record<TourRole, Hub> = { teacher: "work", parent: "life", personal: "life" };
const SEEN_KEY = (id: number, role: TourRole) => `arise_todo_tour_v2_seen_${id}_${role}`;

function tokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/(?:^|; )arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch {
    return null;
  }
}

function roleForUser(user: any): TourRole | null {
  if (!user) return null;
  if (user.role === "parent") return "parent";
  if (user.role === "todo") return "personal";
  if (user.role === "teacher" || user.isAdmin) return "teacher";
  return null;
}

const hashPath = () => (typeof window === "undefined" ? "" : window.location.hash.replace(/^#/, "").split("?")[0] || "/");

/** On screen and big enough to point at. */
function shown(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  const style = getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
  // Something along the way may hide it (e.g. a parent with `hidden`).
  if (typeof (el as any).checkVisibility === "function" && !(el as any).checkVisibility()) return false;
  return true;
}

function findTarget(targets: Target[] | undefined): { el: HTMLElement; target: Target; fallback: boolean } | null {
  if (!targets) return null;
  for (let i = 0; i < targets.length; i++) {
    const el = document.querySelector(targets[i].sel);
    if (shown(el)) return { el, target: targets[i], fallback: i > 0 };
  }
  return null;
}

type Box = { top: number; left: number; width: number; height: number };
const PAD = 6;

export default function WorkHubTour() {
  const { user } = useAuth();
  const role = roleForUser(user);
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [path, setPath] = useState(hashPath);
  const [box, setBox] = useState<Box | null>(null);
  const [hit, setHit] = useState<{ target: Target; fallback: boolean } | null>(null);
  const [vw, setVw] = useState(() => (typeof window === "undefined" ? 1024 : window.innerWidth));
  const [vh, setVh] = useState(() => (typeof window === "undefined" ? 768 : window.innerHeight));
  const elRef = useRef<HTMLElement | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const hub = hubAt(path);
  // The hub the tour was started in. It stays put if the page changes underneath it.
  const [tourHub, setTourHub] = useState<Hub | null>(null);
  const steps = useMemo(() => (tourHub ? TOUR_STEPS[tourHub].filter((x) => (!x.parentOnly || role === "parent") && (!x.teacherOnly || role === "teacher")) : []), [tourHub, role]);
  const current = steps[step];
  const onHub = !!tourHub && hub === tourHub;

  useEffect(() => {
    const onHash = () => setPath(hashPath());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // First visit: introduce the hub as soon as the signed-in user reaches it.
  // The status endpoint can take many seconds (or time out); it must never delay
  // the tour while someone stares at an empty page. A local seen flag prevents
  // repeat intros on this device; the server remains the cross-device source.
  useEffect(() => {
    if (!user || !role) return;
    const key = SEEN_KEY(user.id, role);
    if (user.isAdmin && user.role !== "teacher" && user.role !== "parent") return;
    try { if (localStorage.getItem(key) === "true") return; } catch { /* private browsing */ }

    const home = HOME_HUB[role];
    let cancelled = false;
    let serverSeen = false;
    let opened = false;
    const openAtHome = () => {
      if (cancelled || serverSeen || opened || hubAt(hashPath()) !== home) return;
      opened = true;
      setTourHub(home);
      setStep(0);
      setShow(true);
    };
    // React has to mount the hub first, but an intro never waits on the network.
    const timer = window.setTimeout(openAtHome, 100);
    window.addEventListener("hashchange", openAtHome);

    const token = tokenFromCookie();
    if (token) {
      fetch(`${API_BASE}/api/todo-tour/status`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(2500),
      }).then((res) => res.ok ? res.json() : null).then((data) => {
        if (cancelled || !data?.shown) return;
        serverSeen = true;
        try { localStorage.setItem(key, "true"); } catch { /* private browsing */ }
        // If their first visit was already completed on another device, do
        // not keep a stale first-step tour visible here.
        if (opened) setShow((wasOpen) => wasOpen && step === 0 ? false : wasOpen);
      }).catch(() => { /* The local first-visit tour still works offline. */ });
    }
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", openAtHome);
    };
  }, [user?.id, role]);

  // "Take the tour" in Customize starts it again from the top.
  useEffect(() => {
    const start = () => {
      const here = hubAt(hashPath());
      if (!here) return;
      setTourHub(here); setStep(0); setShow(true);
    };
    window.addEventListener("arise-tour:start", start);
    return () => window.removeEventListener("arise-tour:start", start);
  }, []);

  const finish = useCallback(async () => {
    setShow(false);
    setBox(null);
    if (user?.id && role) { try { localStorage.setItem(SEEN_KEY(user.id, role), "true"); } catch { /* fine */ } }
    const token = tokenFromCookie();
    if (token) {
      try { await fetch(`${API_BASE}/api/todo-tour/dismiss`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }); } catch { /* fine */ }
    }
  }, [user?.id, role]);

  const measure = useCallback(() => {
    setVw(window.innerWidth);
    setVh(window.innerHeight);
    const el = elRef.current;
    if (!el || !el.isConnected) { setBox(null); return; }
    const r = el.getBoundingClientRect();
    // A whole page is taller than the screen: frame the part that's showing, below the top bar.
    const top = Math.max(r.top, 0) - PAD, bottom = Math.min(r.bottom, window.innerHeight) + PAD;
    const left = Math.max(r.left, 0) - PAD, right = Math.min(r.right, window.innerWidth) + PAD;
    setBox({ top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) });
  }, []);

  // Each step: open its section, then wait for the thing to point at to appear (sections load lazily).
  useEffect(() => {
    if (!show || !onHub || !current) return;
    setBox(null);
    setHit(null);
    elRef.current = null;
    if (current.open) window.dispatchEvent(new CustomEvent("arise-tour:open", { detail: current.open }));
    if (!current.targets) return;
    let tries = 0;
    let timer = 0;
    const look = () => {
      const found = findTarget(current.targets);
      // Prefer the main target: give it a moment to appear before settling for a fallback.
      if (found && (!found.fallback || tries >= 6)) {
        elRef.current = found.el;
        setHit({ target: found.target, fallback: found.fallback });
        const r = found.el.getBoundingClientRect();
        const big = r.height > window.innerHeight * 0.5;
        if (big) window.scrollTo({ top: 0 });
        else if (r.top < 70 || r.bottom > window.innerHeight - 10) found.el.scrollIntoView({ block: "center" });
        measure();
        return;
      }
      if (++tries < 15) timer = window.setTimeout(look, 120);
      else if (found) { elRef.current = found.el; setHit({ target: found.target, fallback: found.fallback }); measure(); }
    };
    timer = window.setTimeout(look, current.open ? 250 : 30);
    return () => window.clearTimeout(timer);
  }, [show, onHub, step]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    if (!show) return;
    const again = () => measure();
    window.addEventListener("resize", again);
    window.addEventListener("scroll", again, true);
    // Pages settle as their data loads; keep the frame on the target.
    const tick = window.setInterval(again, 400);
    return () => { window.removeEventListener("resize", again); window.removeEventListener("scroll", again, true); window.clearInterval(tick); };
  }, [show, measure]);

  useLayoutEffect(() => { if (show) nextRef.current?.focus({ preventScroll: true }); }, [show, step]);

  const next = () => (step >= steps.length - 1 ? void finish() : setStep((s) => Math.min(steps.length - 1, s + 1)));
  const back = () => setStep((s) => Math.max(0, s - 1));

  useEffect(() => {
    if (!show || !onHub) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); void finish(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show || !role || !current || !onHub) return null;

  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const phone = vw < 640;
  const cardW = Math.min(360, vw - 24);
  const pointing = !!(current.targets && box && hit);

  // Where the card goes: beside the highlighted thing when there's room, otherwise along the bottom.
  let place: "below" | "above" | "right" | "left" | "sheet" | "center" = pointing ? "sheet" : "center";
  const style: CSSProperties = { width: cardW };
  let arrowX = 0;
  if (pointing && box) {
    const below = vh - (box.top + box.height), above = box.top;
    const big = box.height > vh * 0.5;
    if (!big && below >= 250) place = "below";
    else if (!big && above >= 250) place = "above";
    else if (!phone && vw - (box.left + box.width) >= cardW + 28) place = "right";
    else if (!phone && box.left >= cardW + 28) place = "left";
    const x = Math.min(Math.max(box.left + box.width / 2 - cardW / 2, 12), vw - cardW - 12);
    if (place === "below") { style.top = box.top + box.height + 14; style.left = x; arrowX = box.left + box.width / 2 - x; }
    else if (place === "above") { style.bottom = vh - box.top + 14; style.left = x; arrowX = box.left + box.width / 2 - x; }
    else if (place === "right") { style.left = box.left + box.width + 14; style.top = Math.min(Math.max(box.top, 76), vh - 300); }
    else if (place === "left") { style.left = box.left - cardW - 14; style.top = Math.min(Math.max(box.top, 76), vh - 300); }
    else if (phone) { style.left = 12; style.bottom = 12; }
    else { style.right = 24; style.bottom = 24; }
  }
  arrowX = Math.min(Math.max(arrowX, 22), cardW - 22);

  // The label sits on the highlighted thing's top edge, or just inside when that edge is off the top.
  const labelTop = box ? (box.top > 40 ? box.top - 30 : box.top + 8) : 0;
  const labelLeft = box ? Math.min(Math.max(box.left, 8), vw - 200) : 0;

  return (
    <div className="fixed inset-0 z-[300]" role="dialog" aria-modal="true" aria-label={`Arise To Duo tour, step ${step + 1} of ${steps.length}: ${current.title}`} data-testid="todo-tour">
      {/* Catches clicks so the page underneath isn't changed mid-tour. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      {pointing && box ? (
        <>
          <div aria-hidden className="pointer-events-none fixed rounded-2xl ring-4 ring-violet-500 transition-all duration-200"
            style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: "0 0 0 9999px rgba(15,23,42,.62)" }} />
          <div aria-hidden className="pointer-events-none fixed z-[1] flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white shadow-lg transition-all duration-200"
            style={{ top: labelTop, left: labelLeft }} data-testid="todo-tour-label">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />{hit!.target.label}
          </div>
        </>
      ) : (
        <div aria-hidden className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px]" />
      )}

      <div
        className={`fixed z-[2] flex flex-col overflow-hidden bg-white shadow-[0_24px_70px_rgba(15,23,42,.35)] ${
          place === "center" ? (phone ? "inset-x-3 bottom-3 rounded-3xl" : "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-3xl") : "rounded-2xl"
        }`}
        style={place === "center" ? (phone ? undefined : { width: Math.min(440, vw - 24) }) : style}
        data-testid="todo-tour-card"
      >
        {(place === "below" || place === "above") && (
          <span aria-hidden className={`absolute h-3.5 w-3.5 rotate-45 bg-white ${place === "below" ? "-top-1.5" : "-bottom-1.5"}`} style={{ left: arrowX - 7 }} />
        )}
        <div className="h-1 w-full bg-slate-100">
          <div className="h-full bg-violet-600 transition-all duration-300" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
        <button type="button" onClick={() => void finish()} aria-label="Close tour" className="absolute right-2 top-3 grid grid-cols-1 h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" data-testid="todo-tour-close">
          <X className="h-4 w-4" />
        </button>
        <div className="px-5 pb-1 pt-4">
          <p className="pr-8 text-[11px] font-bold uppercase tracking-wide text-violet-600">
            {tourHub === "work" ? "WorkHub tour" : "LifeHub tour"} · {step + 1} of {steps.length}
          </p>
          <h2 className="mt-1 text-lg font-extrabold leading-tight tracking-tight text-slate-900">{current.title}</h2>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">{current.body}</p>
          {hit?.fallback && hit.target.note && <p className="mt-2 rounded-xl bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900">{hit.target.note}</p>}
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          {isFirst
            ? <button type="button" onClick={() => void finish()} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-slate-100" data-testid="todo-tour-skip">Skip tour</button>
            : <button type="button" onClick={back} className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100" data-testid="todo-tour-back"><ArrowLeft className="h-4 w-4" /> Back</button>}
          <button ref={nextRef} type="button" onClick={next} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-violet-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700" data-testid="todo-tour-next">
            {isFirst ? "Start the tour" : isLast ? "Done" : "Next"}
            {!isLast && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
