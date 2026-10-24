// Arise To Duo split screen: /#/duo. Two views open at once, one on each side of the iPhone Duo's
// fold: LifeHub and WorkHub, or the To-Do list and Notes, or any two LifeHub sections.
// Each pane is the real app in a frame named "duo-pane-left" / "duo-pane-right", so it keeps the
// phone layout that fits half the screen, remembers its own place (useStayOnRefresh), and saves
// straight to the account. When one pane saves, the other catches up at once (lib/paneSync).
import { useEffect, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { ArrowLeftRight, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { splitDirection } from "@/lib/useAriseDuo";

type PaneOption = { id: string; label: string; path: string; group: "LifeHub" | "WorkHub"; work?: boolean };

const life = (id: string, label: string): PaneOption => ({ id, label, path: `/lifehub?pane=${id}`, group: "LifeHub" });

export const PANE_OPTIONS: PaneOption[] = [
  { id: "workhub", label: "WorkHub", path: "/workhub", group: "WorkHub", work: true },
  life("home", "LifeHub Home"),
  life("tasks", "To-Do list"),
  life("notes", "Notes"),
  life("calendar", "Calendar"),
  life("grocery", "Grocery list"),
  life("meals", "Meal planner"),
  life("chores", "Chores"),
  life("goals", "Goals"),
  life("habits", "Habits"),
  life("journal", "Journal"),
  life("money", "Money"),
  life("countdowns", "Countdowns"),
  life("lifeplan", "AI Reminders"),
  life("focus", "Focus timer"),
];

const KEY = "arise_duo_split_v1";
// Where the fold is, when the browser says (otherwise the two views share the screen evenly).
const knowsFold = () => { try { return CSS.supports("width", "env(viewport-segment-width 0 0, 1px)"); } catch { return false; } };

function loadPicks(canWork: boolean): { left: string; right: string } {
  const fallback = { left: "tasks", right: canWork ? "workhub" : "notes" };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    const ok = (id: unknown) => typeof id === "string" && PANE_OPTIONS.some((o) => o.id === id && (!o.work || canWork));
    if (saved && ok(saved.left) && ok(saved.right)) return { left: saved.left, right: saved.right };
  } catch { /* fresh start */ }
  return fallback;
}

export default function DuoSplit() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const canWork = !!user && (user.role === "teacher" || !!user.isAdmin);
  const [picks, setPicks] = useState(() => loadPicks(canWork));
  const [dir, setDir] = useState<"book" | "stack">(() => splitDirection());

  useEffect(() => {
    const before = document.title;
    document.title = "Arise To Duo";
    const update = () => setDir(splitDirection());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => { document.title = before; window.removeEventListener("resize", update); window.removeEventListener("orientationchange", update); };
  }, []);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch { /* not remembered */ } }, [picks]);

  if (!user) return <Redirect to="/signin" replace />;

  const options = PANE_OPTIONS.filter((o) => !o.work || canWork);
  const pick = (side: "left" | "right", id: string) => setPicks((p) => ({ ...p, [side]: id }));
  const swap = () => setPicks((p) => ({ left: p.right, right: p.left }));
  const close = () => navigate(picks.left === "workhub" ? "/workhub" : "/lifehub");

  const pane = (side: "left" | "right") => {
    const opt = options.find((o) => o.id === picks[side]) || options[0];
    const src = `${window.location.pathname}#${opt.path}`;
    return (
      <section key={side} aria-label={`${side === "left" ? (dir === "book" ? "Left" : "Top") : (dir === "book" ? "Right" : "Bottom")} view: ${opt.label}`}
        className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col bg-white"
        style={side === "left" && knowsFold() ? { flexBasis: dir === "book" ? "env(viewport-segment-width 0 0, 50%)" : "env(viewport-segment-height 0 0, 50%)", flexGrow: 0 } : undefined}
        data-testid={`duo-pane-${side}`}>
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-[#f6f5fc] px-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Show in this view</span>
            <select value={opt.id} onChange={(e) => pick(side, e.target.value)}
              className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800">
              {(["LifeHub", "WorkHub"] as const).map((g) => {
                const inGroup = options.filter((o) => o.group === g);
                return inGroup.length ? <optgroup key={g} label={g}>{inGroup.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup> : null;
              })}
            </select>
          </label>
          {side === "left"
            ? <button type="button" onClick={swap} aria-label="Swap the two views" title="Swap" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-white"><ArrowLeftRight className="h-4 w-4" /></button>
            : <button type="button" onClick={close} aria-label="Close split screen" title="Close split screen" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-white"><X className="h-4 w-4" /></button>}
        </div>
        <iframe key={opt.id} name={`duo-pane-${side}`} title={opt.label} src={src} className="min-h-0 w-full flex-1 border-0" />
      </section>
    );
  };

  return (
    <div className={`fixed inset-0 flex bg-[#292446] ${dir === "book" ? "flex-row" : "flex-col"}`} data-testid="duo-split">
      {pane("left")}
      <div aria-hidden className={dir === "book" ? "w-px shrink-0 bg-[#292446]" : "h-px shrink-0 bg-[#292446]"} />
      {pane("right")}
    </div>
  );
}
