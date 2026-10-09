import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useTodoCloud } from "@/lib/useTodoCloud";
import AriseTodoSignIn from "./AriseTodoSignIn";
import {
  ArrowLeft, CalendarDays, Check, CheckCircle2,
  Circle, Clock3, FileUp, FolderPlus, Heart, Home, ListTodo,
  Pencil, Plus, Repeat2, Search, Sparkles, Trash2, Users, X,
  Sun, CalendarClock, CheckCheck, Download, ShieldCheck, Cloud, CloudOff, LogOut, RefreshCw, AlertCircle,
  CalendarRange, Smile, Vote, Bell, BookOpen, Plane, Wallet, StickyNote, Settings2, Moon, Apple, Target, Droplets, SmilePlus, Newspaper,
} from "lucide-react";
import { cleanFamily, emptyFamily, isCurrentFamily, isOn, type Family, type FamilySection } from "@shared/familyHub";
import FamilyHome from "@/components/family-hub/FamilyHome";
import Chores from "@/components/family-hub/Chores";
import Behavior from "@/components/family-hub/Behavior";
import FamilyCalendar from "@/components/family-hub/FamilyCalendar";
import Polls from "@/components/family-hub/Polls";
import { ShareButton } from "@/components/family-hub/ShareLink";
import Trips from "@/components/family-hub/Trips";
import Money from "@/components/family-hub/Money";
import Notes from "@/components/family-hub/Notes";
import Health from "@/components/family-hub/Health";
import Goals from "@/components/family-hub/Goals";
import Cycle from "@/components/family-hub/Cycle";
import Mood from "@/components/family-hub/Mood";
import News from "@/components/family-hub/News";
import NotificationSettings from "@/components/family-hub/NotificationSettings";
import { EmailForwardCard, useEmailInbox } from "@/components/family-hub/EmailForward";
import Members, { SECTION_INFO } from "@/components/family-hub/Members";
import { Avatar } from "@/components/family-hub/ui";
import HubSwitch from "@/components/HubSwitch";
import { HubTrialNote } from "@/components/HubTrialNote";
import { useLifeHubTrial } from "@/components/TodoGate";

// The parents' A.R.I.S.E. Reader tab, built from LifeHub parts (loaded when opened).
const Reader = lazy(() => import("@/components/family-hub/Reader"));
import "./todoNight.css";

type Priority = "low" | "normal" | "high";
type Repeat = "none" | "daily" | "weekly" | "monthly";
type View = "all" | "today" | "upcoming" | "completed";
type List = { id: string; name: string; color: string };
type Task = {
  id: string; title: string; notes: string; listId: string; assignee: string;
  due: string; time: string; priority: Priority; repeat: Repeat;
  done: boolean; createdAt: string; completedAt?: string;
};
// Version 2 adds the Family Hub beside the lists and tasks. Version 1 workspaces open as version 2.
type Data = { version: 2; lists: List[]; tasks: Task[]; family: Family };

const STORE = "arise-todo-v1";
const COLORS = ["#7566e8", "#f59e72", "#36b6a5", "#619ee6", "#db77ac", "#e5b04f"];
const DEFAULT_LISTS: List[] = [
  { id: "personal", name: "Personal", color: COLORS[0] },
  { id: "work", name: "Work", color: COLORS[1] },
  { id: "family", name: "Family", color: COLORS[2] },
];
const today = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
};
const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const short = (value: unknown, max: number) => typeof value === "string" ? value.slice(0, max) : "";
const isDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T12:00:00"));
const fresh = (): Data => ({ version: 2, lists: DEFAULT_LISTS.map(list => ({ ...list })), tasks: [], family: emptyFamily() });
const validate = (value: unknown): Data => {
  if (!value || typeof value !== "object") throw new Error("This is not an Arise LifeHub backup.");
  const raw = value as Record<string, unknown>;
  if ((raw.version !== 1 && raw.version !== 2) || !Array.isArray(raw.lists) || !Array.isArray(raw.tasks) || raw.tasks.length > 5000 || raw.lists.length > 100) {
    throw new Error("This backup is not supported or is too large.");
  }
  const lists = raw.lists.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map(item => ({ id: short(item.id, 100), name: short(item.name, 60), color: short(item.color, 20) }))
    .filter(item => item.id && item.name && /^#[0-9a-f]{6}$/i.test(item.color));
  const uniqueLists = [...new Map(lists.map(item => [item.id, item])).values()];
  if (!uniqueLists.length) throw new Error("This backup has no usable lists.");
  const validIds = new Set(uniqueLists.map(item => item.id));
  const tasks = raw.tasks.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map(item => ({
      id: short(item.id, 100) || uid(),
      title: short(item.title, 200).trim(),
      notes: short(item.notes, 2000),
      listId: validIds.has(short(item.listId, 100)) ? short(item.listId, 100) : uniqueLists[0].id,
      assignee: short(item.assignee, 100),
      due: isDate(item.due) ? String(item.due) : "",
      time: typeof item.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time) ? item.time : "",
      priority: (["low", "normal", "high"].includes(String(item.priority)) ? item.priority : "normal") as Priority,
      repeat: (["none", "daily", "weekly", "monthly"].includes(String(item.repeat)) ? item.repeat : "none") as Repeat,
      done: item.done === true,
      createdAt: short(item.createdAt, 40) || new Date().toISOString(),
      completedAt: short(item.completedAt, 40) || undefined,
    })).filter(item => item.title);
  return { version: 2, lists: uniqueLists, tasks: [...new Map(tasks.map(item => [item.id, item])).values()], family: cleanFamily(raw.family) };
};
const read = (): Data => {
  try {
    const stored = localStorage.getItem(STORE);
    return stored ? validate(JSON.parse(stored)) : fresh();
  } catch { return fresh(); }
};
const isValidTodo = (value: unknown): value is Data => {
  try {
    const data = validate(value);
    return !!data.lists.length && data.tasks.length <= 5000;
  } catch { return false; }
};
const mergeTodo = (cloud: Data, old: Data): Data => {
  const lists = cloud.lists.map(list => ({ ...list }));
  const listIds = new Set(lists.map(list => list.id));
  const rename = new Map<string, string>();
  for (const list of old.lists) {
    const byName = lists.find(row => row.name.toLowerCase() === list.name.toLowerCase());
    if (byName) { rename.set(list.id, byName.id); continue; }
    const key = listIds.has(list.id) ? uid() : list.id;
    lists.push({ ...list, id: key });
    listIds.add(key);
    rename.set(list.id, key);
  }
  const tasks = cloud.tasks.map(task => ({ ...task }));
  const existing = new Map(tasks.map(task => [task.id, JSON.stringify(task)]));
  for (const task of old.tasks) {
    const candidate = { ...task, listId: rename.get(task.listId) || lists[0].id };
    const duplicate = existing.get(candidate.id);
    if (duplicate === JSON.stringify(candidate)) continue;
    candidate.id = duplicate ? uid() : candidate.id;
    tasks.push(candidate);
    existing.set(candidate.id, JSON.stringify(candidate));
  }
  return { ...cloud, version: 2, lists, tasks };
};
/** The cloud may still hold a version 1 workspace (no family yet): open it as version 2. */
/** Opens any saved workspace in today's shape: version 1 (no family yet) and version 2 data saved by an
 *  older page (missing newer parts like calorie plans) are filled in. The same input always gives the
 *  same object back, so nothing is saved again just for being opened. */
const upgraded = new WeakMap<object, Data>();
const upgrade = (value: Data | Record<string, unknown>): Data => {
  const d = value as Data;
  if (d.version === 2 && isCurrentFamily(d.family)) return d;
  const known = upgraded.get(value as object);
  if (known) return known;
  const next = d.version === 2 && d.family ? { ...d, family: cleanFamily(d.family) } : validate(value);
  upgraded.set(value as object, next);
  return next;
};
const SECTION_ICONS: Record<FamilySection, typeof Home> = {
  home: Home, tasks: ListTodo, chores: Sparkles, calendar: CalendarRange, behavior: Smile, health: Apple, goals: Target, cycle: Droplets, mood: SmilePlus, news: Newspaper, notifications: Bell, reader: BookOpen,
  polls: Vote, trips: Plane, money: Wallet, notes: StickyNote, family: Settings2,
};
const SECTION_ORDER: FamilySection[] = ["home", "reader", "tasks", "goals", "chores", "calendar", "behavior", "health", "cycle", "mood", "polls", "trips", "money", "notes", "news", "notifications", "family"];
const SECTION_KEY = "arise-todo-section";
const NIGHT_KEY = "arise-todo-night";
const nextDate = (due: string, repeat: Repeat): string => {
  if (!isDate(due) || repeat === "none") return "";
  const date = new Date(`${due}T12:00:00`);
  if (repeat === "daily") date.setDate(date.getDate() + 1);
  if (repeat === "weekly") date.setDate(date.getDate() + 7);
  if (repeat === "monthly") {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
  }
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
};
const emptyTask = (listId: string): Task => ({
  id: uid(), title: "", notes: "", listId, assignee: "", due: "", time: "",
  priority: "normal", repeat: "none", done: false, createdAt: new Date().toISOString(),
});
const prettyDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const inputClass = "w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100";
const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500";

export default function AriseTodo() {
  const [location, navigate] = useLocation();
  const { user, token, logout } = useAuth();
  const sync = useTodoCloud<Data>({ userId: user?.id, token: user ? token : null, blank: fresh, isValid: isValidTodo });
  const data = useMemo(() => upgrade(sync.workspace), [sync.workspace]);
  const rawSet = sync.setWorkspace;
  const setData = useCallback((next: Data | ((previous: Data) => Data)) => {
    rawSet(previous => typeof next === "function" ? next(upgrade(previous)) : next);
  }, [rawSet]);
  const setFamily = useCallback((update: (family: Family) => Family) => {
    // Unchanged family (e.g. an Apple Health check with nothing new) is not saved again.
    setData(previous => { const family = update(previous.family); return family === previous.family ? previous : { ...previous, family }; });
  }, [setData]);
  const [section, setSectionState] = useState<FamilySection>(() => {
    // The old parent dashboard address opens the Reader tab (see OpenHubTab in App.tsx).
    try { if (sessionStorage.getItem("lifehub_tab") === "reader") { sessionStorage.removeItem("lifehub_tab"); return "reader"; } } catch { /* fine */ }
    // Parents start on their A.R.I.S.E. Reader tab (the parent portal) until they pick another.
    const first: FamilySection = user?.role === "parent" ? "reader" : "home";
    try { const saved = localStorage.getItem(SECTION_KEY) as FamilySection | null; return saved && SECTION_ORDER.includes(saved) ? saved : first; } catch { return first; }
  });
  // Going back to the old parent dashboard address while LifeHub is open lands on the Reader tab.
  useEffect(() => {
    try { if (sessionStorage.getItem("lifehub_tab") === "reader") { sessionStorage.removeItem("lifehub_tab"); setSectionState("reader"); } } catch { /* fine */ }
  }, [location]);
  const setSection = (next: FamilySection) => {
    setSectionState(next);
    try { localStorage.setItem(SECTION_KEY, next); } catch {}
    window.scrollTo({ top: 0 });
  };
  const [memberFilter, setMemberFilter] = useState("");
  // Forwarded emails become tasks in an "Email" list (made the first time one arrives).
  useEmailInbox(user ? token : null, !!user && sync.loaded && !sync.recovery, items => {
    setData(previous => {
      let lists = previous.lists;
      let email = lists.find(list => list.name.toLowerCase() === "email");
      if (!email) { email = { id: uid(), name: "Email", color: "#619ee6" }; lists = [...lists, email]; }
      const have = new Set(previous.tasks.map(task => task.id));
      const fresh = items.filter(item => !have.has(`email-${item.id}`)).map(item => ({
        id: `email-${item.id}`.slice(0, 100), title: (item.subject || `Email from ${item.from}`).slice(0, 200),
        notes: [`From: ${item.from}`, item.sent ? `Sent: ${item.sent}` : "", "", (item.message || item.body || "").trim()].filter((line, i) => i === 2 || line).join("\n").slice(0, 2000),
        listId: email!.id, assignee: "", due: "", time: "", priority: "normal" as Priority, repeat: "none" as Repeat, done: false, createdAt: new Date().toISOString(),
      }));
      if (!fresh.length) return previous;
      setMessage(`${fresh.length} forwarded email${fresh.length === 1 ? "" : "s"} added to your Email list`);
      return { ...previous, lists, tasks: [...previous.tasks, ...fresh] };
    });
  });
  // Night mode: remembered on this device; until chosen, it follows the device's dark-mode setting.
  const [night, setNight] = useState(() => {
    try {
      const saved = localStorage.getItem(NIGHT_KEY);
      if (saved) return saved === "1";
      return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    } catch { return false; }
  });
  const toggleNight = () => setNight(on => {
    try { localStorage.setItem(NIGHT_KEY, on ? "0" : "1"); } catch { /* the choice just isn't remembered */ }
    return !on;
  });
  const [legacy, setLegacy] = useState<Data | null>(() => {
    const old = read();
    return old.tasks.length || old.lists.some(list => !DEFAULT_LISTS.some(def => def.id === list.id && def.name === list.name)) ? old : null;
  });
  const [skipLegacy, setSkipLegacy] = useState(false);
  const [selectedList, setSelectedList] = useState("all");
  const [view, setView] = useState<View>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [newListName, setNewListName] = useState("");
  const [addingList, setAddingList] = useState(false);
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const currentDay = today();

  useEffect(() => {
    setSkipLegacy(!!user && localStorage.getItem(`arise-todo-legacy-dismissed:${user.id}`) === "1");
  }, [user?.id]);
  const dismissLegacy = () => {
    if (user) localStorage.setItem(`arise-todo-legacy-dismissed:${user.id}`, "1");
    setSkipLegacy(true);
  };
  const importOldTasks = () => {
    if (!legacy) return;
    const candidate = mergeTodo(data, legacy);
    if (candidate.tasks.length > 5000 || candidate.lists.length > 100 || new TextEncoder().encode(JSON.stringify(candidate)).length > 5_000_000) {
      setMessage("Your old tasks exceed cloud storage limits. Please export a backup first."); return;
    }
    setData(candidate);
    dismissLegacy();
    setLegacy(null);
    setMessage("Old tasks added to your account. Cloud sync is saving them.");
  };
  const signOut = async () => {
    await sync.flush();
    if (sync.view.kind !== "saved" && !window.confirm("Some changes may not have reached the cloud. Sign out anyway? A local safety copy is kept on this device.")) return;
    logout();
    navigate("/lifehub");
  };
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const active = data.tasks.filter(task => !task.done);
  const countFor = (listId: string) => active.filter(task => task.listId === listId).length;
  const overdue = active.filter(task => task.due && task.due < currentDay);
  const dueToday = active.filter(task => task.due && task.due <= currentDay);
  const upcoming = active.filter(task => task.due && task.due > currentDay)
    .sort((a, b) => (a.due + a.time).localeCompare(b.due + b.time));
  const completed = data.tasks.filter(task => task.done).length;
  const filtered = useMemo(() => data.tasks.filter(task => {
    if (selectedList !== "all" && task.listId !== selectedList) return false;
    if (view === "completed" ? !task.done : task.done) return false;
    if (view === "today" && (!task.due || task.due > currentDay)) return false;
    if (view === "upcoming" && (!task.due || task.due <= currentDay)) return false;
    if (memberFilter && task.assignee.trim().toLowerCase() !== memberFilter.toLowerCase()) return false;
    const q = search.trim().toLowerCase();
    return !q || [task.title, task.notes, task.assignee].some(text => text.toLowerCase().includes(q));
  }).sort((a, b) => {
    if (view === "completed") return (b.completedAt || "").localeCompare(a.completedAt || "");
    if (a.due && b.due) return (a.due + a.time).localeCompare(b.due + b.time);
    if (a.due) return -1;
    if (b.due) return 1;
    const priority = { high: 0, normal: 1, low: 2 };
    return priority[a.priority] - priority[b.priority] || b.createdAt.localeCompare(a.createdAt);
  }), [data.tasks, selectedList, view, search, currentDay, memberFilter]);

  const saveTask = (event: FormEvent) => {
    event.preventDefault();
    if (!editing?.title.trim()) return;
    const clean = { ...editing, title: editing.title.trim(), notes: editing.notes.trim(), assignee: editing.assignee.trim(), repeat: editing.due ? editing.repeat : "none" };
    setData(previous => ({
      ...previous,
      tasks: previous.tasks.some(task => task.id === clean.id)
        ? previous.tasks.map(task => task.id === clean.id ? clean : task)
        : [...previous.tasks, clean],
    }));
    setEditing(null);
    if (selectedList !== "all" && selectedList !== clean.listId) setSelectedList(clean.listId);
    if (view === "completed" || (view === "today" && (!clean.due || clean.due > currentDay)) || (view === "upcoming" && (!clean.due || clean.due <= currentDay))) setView("all");
    setMessage("Task saved");
  };
  const toggleDone = (task: Task) => {
    setData(previous => {
      const finished = !task.done;
      const tasks = previous.tasks.map(row => row.id === task.id
        ? { ...row, done: finished, completedAt: finished ? new Date().toISOString() : undefined }
        : row);
      if (finished && task.repeat !== "none" && task.due) {
        const next = nextDate(task.due, task.repeat);
        if (next) tasks.push({ ...task, id: uid(), due: next, done: false, completedAt: undefined, createdAt: new Date().toISOString() });
      }
      return { ...previous, tasks };
    });
    setMessage(task.done ? "Task reopened" : "Nice work! Task completed");
  };
  const removeTask = (task: Task) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    setData(previous => ({ ...previous, tasks: previous.tasks.filter(item => item.id !== task.id) }));
    setEditing(null);
    setMessage("Task deleted");
  };
  const createList = (event: FormEvent) => {
    event.preventDefault();
    const name = newListName.trim();
    if (!name) return;
    if (data.lists.some(list => list.name.toLowerCase() === name.toLowerCase())) { setMessage("That list already exists."); return; }
    const id = uid();
    setData(previous => ({ ...previous, lists: [...previous.lists, { id, name: name.slice(0, 60), color: COLORS[previous.lists.length % COLORS.length] }] }));
    setSelectedList(id);
    setView("all");
    setNewListName("");
    setAddingList(false);
    setMessage("List created");
  };
  const removeList = (list: List) => {
    if (data.lists.length === 1) { setMessage("Keep at least one list."); return; }
    const destination = data.lists.find(other => other.id !== list.id)!;
    if (!window.confirm(`Delete "${list.name}"? Its tasks will move to "${destination.name}".`)) return;
    setData(previous => ({
      ...previous, lists: previous.lists.filter(row => row.id !== list.id),
      tasks: previous.tasks.map(task => task.listId === list.id ? { ...task, listId: destination.id } : task),
    }));
    setSelectedList(destination.id);
    setMessage("List removed; tasks moved safely");
  };
  const exportData = () => {
    const contents = JSON.stringify(data, null, 2);
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `arise-todo-backup-${currentDay}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Backup downloaded");
  };
  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5_000_000) { setMessage("File too large. Choose a LifeHub backup under 5 MB."); return; }
    try {
      const restored = validate(JSON.parse(await file.text()));
      if (!window.confirm(`Restore ${restored.tasks.length} tasks and ${restored.lists.length} lists? This replaces the tasks saved in your account across devices. Export a backup first if needed.`)) return;
      setData(restored);
      setSelectedList("all");
      setView("all");
      setMessage("Backup restored. Syncing it to your account…");
    } catch (error) { setMessage(error instanceof Error ? error.message : "This file is not a valid backup."); }
  };
  const selectedName = data.lists.find(list => list.id === selectedList)?.name || "All lists";
  const openAdd = () => setEditing(emptyTask(selectedList === "all" ? data.lists[0].id : selectedList));
  const viewTabs: { id: View; title: string; icon: typeof Home; count: number }[] = [
    { id: "all", title: "All tasks", icon: ListTodo, count: active.length },
    { id: "today", title: "Today", icon: Sun, count: dueToday.length },
    { id: "upcoming", title: "Upcoming", icon: CalendarClock, count: upcoming.length },
    { id: "completed", title: "Completed", icon: CheckCheck, count: completed },
  ];

  const family = data.family;
  const members = family.members;
  const memberByName = (name: string) => members.find(m => m.name.toLowerCase() === name.trim().toLowerCase());
  // The A.R.I.S.E. Reader tab is the parent portal, so only parents have it.
  const sections = SECTION_ORDER.filter(id => isOn(id, family) && (id !== "reader" || user?.role === "parent"));
  const trial = useLifeHubTrial();
  const shown: FamilySection = sections.includes(section) ? section : "home";
  const badge = (id: FamilySection) => id === "tasks" ? dueToday.length : 0;
  const makeId = uid;
  const calendarTasks = data.tasks.map(task => ({ id: task.id, title: task.title, due: task.due, time: task.time, assignee: task.assignee, done: task.done }));
  const common = { family, setFamily, today: currentDay, makeId, say: setMessage };
  const familyContent: ReactNode = shown === "home" ? <FamilyHome {...common} tasks={calendarTasks} go={setSection} name={(user?.displayName || "").split(" ")[0]} onToggleTask={id => { const task = data.tasks.find(row => row.id === id); if (task) toggleDone(task); }} />
    : shown === "chores" ? <Chores {...common} />
    : shown === "calendar" ? <FamilyCalendar {...common} tasks={calendarTasks} onOpenTasks={() => { setSection("tasks"); setView("today"); }} />
    : shown === "behavior" ? <Behavior {...common} />
    : shown === "health" ? <Health {...common} />
    : shown === "goals" ? <Goals {...common} />
    : shown === "cycle" ? <Cycle {...common} />
    : shown === "mood" ? <Mood {...common} />
    : shown === "news" ? <News {...common} />
    : shown === "notifications" ? <NotificationSettings {...common} />
    : shown === "reader" ? <Suspense fallback={<div className="grid min-h-[40vh] place-items-center"><RefreshCw className="animate-spin text-violet-600" size={30} /></div>}><Reader say={setMessage} night={night} /></Suspense>
    : shown === "polls" ? <Polls {...common} />
    : shown === "trips" ? <Trips {...common} />
    : shown === "money" ? <Money {...common} />
    : shown === "notes" ? <Notes {...common} />
    : shown === "family" ? <Members {...common} />
    : null;

  if (!user) return <AriseTodoSignIn />;
  if (!sync.loaded) return <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#f6f7fc] px-4 text-center text-slate-800">
    {sync.error ? <><CloudOff size={40} className="text-rose-500" /><h1 className="text-2xl font-black">We couldn't open your saved LifeHub lists.</h1><p className="max-w-md text-sm text-slate-600">{sync.error}</p><button onClick={sync.retry} className={buttonClass + " bg-violet-700 px-6 text-white"}><RefreshCw size={17} /> Try again</button><button onClick={() => void signOut()} className="text-sm font-bold text-slate-500">Switch account</button></> : <><RefreshCw className="animate-spin text-violet-600" size={34} /><p className="text-sm font-semibold text-slate-600">Opening your tasks from your account…</p></>}
  </div>;
  const saveStatus = sync.view.kind === "saved" ? "Saved to account" : sync.view.kind === "waiting" ? "Saving soon…" : sync.view.kind === "saving" ? "Saving to cloud…" : sync.view.kind === "retrying" ? "Waiting for connection…" : "Needs your attention";

  return <div className={`min-h-screen bg-[#f6f7fc] text-slate-900 ${night ? "todo-night" : ""}`}>
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <aside className="w-full border-b border-[#e4e6f0] bg-white lg:[&>*]:shrink-0 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r xl:w-72">
        <div className="flex items-center justify-between gap-2 px-5 py-5 lg:px-6 lg:py-7">
          <button onClick={() => navigate("/")} className="flex min-w-0 items-center gap-3 text-left" aria-label="Back to A.R.I.S.E. Reader">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#6d5ce7] text-white shadow-[0_5px_14px_#6d5ce72b]"><CheckCheck className="h-5 w-5" /></span>
            <span className="min-w-0"><span className="block text-xs font-extrabold tracking-[.16em] text-[#7e76aa]">ARISE</span><span className="block text-xl font-black tracking-tight">LifeHub<span className="text-[#7968e5]">.</span></span></span>
          </button>
          <div className="flex items-center gap-2 lg:hidden"><button onClick={() => setSection("notifications")} aria-current={shown === "notifications" ? "page" : undefined} className={`flex h-10 w-10 items-center justify-center rounded-xl ${shown === "notifications" ? "bg-[#292446] text-white" : "bg-slate-50 text-slate-600"}`} aria-label="Notification settings"><Bell size={20} /></button><button onClick={openAdd} className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-[#6854cf]" aria-label="Add task"><Plus /></button></div>
        </div>
        <nav aria-label="Family Hub" className="flex gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none] lg:block lg:space-y-0.5 lg:px-3 lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {sections.map(id => { const Icon = SECTION_ICONS[id]; return <button key={id} onClick={() => setSection(id)} aria-current={shown === id ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-4 text-sm font-bold transition lg:w-full ${shown === id ? "bg-[#292446] text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}><Icon className="h-[18px] w-[18px]" /><span className="whitespace-nowrap">{SECTION_INFO[id].label}</span>{badge(id) > 0 && <span className={`ml-auto rounded-lg px-1.5 text-xs font-semibold ${shown === id ? "text-white/70" : "opacity-65"}`}>{badge(id)}</span>}</button>; })}
        </nav>
        {shown === "tasks" && <>
        <div className="hidden px-6 pb-3 pt-7 lg:block"><span className="text-[11px] font-black uppercase tracking-[.16em] text-slate-400">Tasks</span></div>
        <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 pb-4 pt-3 lg:block lg:space-y-1 lg:border-t-0 lg:px-3 lg:pb-0 lg:pt-0">
          {viewTabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} onClick={() => setView(tab.id)} className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-4 text-sm font-bold transition lg:w-full ${view === tab.id ? "bg-[#eeeafe] text-[#5f4dc8]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}><Icon className="h-[18px] w-[18px]" /><span>{tab.title}</span><span className="ml-auto rounded-lg px-1.5 text-xs font-semibold opacity-65">{tab.count}</span></button>; })}
        </div>
        <div className="hidden px-6 pb-3 pt-8 lg:flex lg:items-center lg:justify-between"><span className="text-[11px] font-black uppercase tracking-[.16em] text-slate-400">My lists</span><button onClick={() => setAddingList(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-700" title="New list" aria-label="New list"><FolderPlus size={18} /></button></div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:space-y-0.5 lg:px-3">
          <button onClick={() => setSelectedList("all")} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold lg:flex lg:min-h-10 lg:w-full lg:items-center lg:gap-3 ${selectedList === "all" ? "bg-[#f4f2ff] text-[#6c5cce]" : "text-slate-500 hover:bg-slate-50"}`}><Circle size={12} className="hidden lg:block" />Everything</button>
          {data.lists.map(list => <button key={list.id} onClick={() => setSelectedList(list.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold lg:min-h-10 lg:w-full ${selectedList === list.id ? "bg-[#f4f2ff] text-[#6c5cce]" : "text-slate-500 hover:bg-slate-50"}`}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: list.color }} /><span className="max-w-32 truncate">{list.name}</span><span className="ml-auto hidden text-xs opacity-60 lg:inline">{countFor(list.id)}</span></button>)}
          <button onClick={() => setAddingList(true)} className="flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 lg:hidden"><Plus size={14} /> List</button>
        </div>
        {addingList && <form onSubmit={createList} className="mx-4 mb-4 flex gap-2 lg:mx-5"><input className={inputClass + " min-w-0"} value={newListName} autoFocus maxLength={60} onChange={e => setNewListName(e.target.value)} placeholder="List name" aria-label="New list name" /><button type="submit" className="rounded-xl bg-[#705ee2] px-3 text-white" aria-label="Save list"><Check size={18} /></button><button type="button" onClick={() => { setAddingList(false); setNewListName(""); }} className="rounded-xl bg-slate-100 px-2 text-slate-500" aria-label="Cancel list"><X size={18} /></button></form>}
        </>}
        <div className="mt-auto hidden px-5 pb-7 pt-6 lg:block">
          <div className="rounded-2xl bg-[#f4f1ff] p-4">
            <div className="mb-2 inline-flex rounded-xl bg-white p-2 text-[#715fe3]"><Heart size={18} /></div>
            <p className="text-sm font-extrabold text-[#2d2555]">A calmer day starts here.</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Tasks, chores, calendars, plans and bills for the whole family in one simple space.</p>
          </div>
          <button onClick={() => navigate("/")} className="mt-4 flex min-h-10 items-center gap-2 text-xs font-bold text-slate-500 hover:text-violet-700"><ArrowLeft size={15} /> Back to A.R.I.S.E. Reader</button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-7 lg:px-9 lg:pt-10 xl:px-12">
        <div className="mx-auto max-w-[1250px]">
          {shown === "tasks" && <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div><p className="mb-2 text-xs font-extrabold uppercase tracking-[.2em] text-[#7869d7]">Your everyday organizer</p><h1 className="text-3xl font-black tracking-tight text-[#232139] sm:text-4xl">Make room for what matters<span className="text-[#7866e1]">.</span></h1><p className="mt-2 text-sm leading-6 text-slate-500">One place to stay on top of life, work, and everything in between.</p></div>
            <button onClick={openAdd} className="hidden min-h-11 items-center gap-2 rounded-xl bg-[#705de0] px-5 text-sm font-bold text-white shadow-[0_8px_24px_#705de02b] hover:bg-[#604bd4] lg:inline-flex"><Plus size={18} /> New task</button>
          </header>}

          <div className={`flex flex-wrap items-center gap-3 text-sm ${shown === "tasks" ? "" : "mb-6 justify-end"}`}>
            {(user.role === "teacher" || user.isAdmin) && <HubSwitch current="todo" night={night} />}
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 font-bold text-slate-600 ring-1 ring-slate-200"><Users size={15} /> {user.displayName || user.username}</span>
            <span role="status" className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${sync.view.kind === "saved" ? "bg-emerald-50 text-emerald-700" : sync.view.kind === "blocked" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{sync.view.kind === "saved" ? <Cloud size={15} /> : <RefreshCw size={15} />}{saveStatus}</span>
            <button onClick={toggleNight} aria-pressed={night} aria-label={night ? "Switch to day mode" : "Switch to night mode"} title={night ? "Day mode" : "Night mode"} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:text-violet-700">{night ? <Sun size={15} /> : <Moon size={15} />}<span className="hidden sm:inline">{night ? "Day mode" : "Night mode"}</span></button>
            <button onClick={() => void signOut()} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-slate-500 hover:bg-white hover:text-rose-600"><LogOut size={15} /> Sign out</button>
          </div>
          {sync.view.kind === "retrying" && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800"><CloudOff size={18} /> Connection interrupted. Your changes are kept on this device and will be retried. <button className="underline" onClick={sync.retry}>Retry now</button></div>}
          {sync.view.kind === "blocked" && <section className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800" role="alert">
            <div className="flex items-center gap-2"><AlertCircle size={18} /><strong>{sync.view.block === "conflict" ? "Tasks changed on another device" : "Cloud save needs attention"}</strong></div>
            <p className="mt-2 font-normal">{sync.view.message || "Your changes are not yet saved to the cloud."}</p>
            <div className="mt-3 flex flex-wrap gap-2">{sync.view.block === "conflict" ? <>
              <button onClick={() => void sync.useNewest().catch((e: Error) => setMessage(e.message))} className={buttonClass + " bg-white text-rose-800 ring-1 ring-rose-200"}>Use newest cloud copy</button>
              <button onClick={sync.keepMine} className={buttonClass + " bg-rose-700 text-white"}>Replace cloud copy with mine</button>
            </> : <button onClick={sync.retry} className={buttonClass + " bg-white text-rose-800 ring-1 ring-rose-200"}>Retry save</button>}</div>
          </section>}
          {sync.recovery && <section className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900" role="alert">
            <p className="font-black">Unsaved tasks found on this device</p><p className="mt-1">You have an older local draft that never finished syncing. Choose which copy to use.</p>
            <div className="mt-3 flex flex-wrap gap-2"><button onClick={sync.recoverMine} className={buttonClass + " bg-violet-700 text-white"}>Recover my local tasks</button><button onClick={sync.discardRecovery} className={buttonClass + " bg-white text-violet-700 ring-1 ring-violet-200"}>Use cloud tasks</button></div>
          </section>}
          {legacy && !skipLegacy && !sync.recovery && <section className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
            <p className="font-black">Move your old browser tasks to your account?</p><p className="mt-1">{legacy.tasks.length} tasks and {legacy.lists.length} lists were saved in this browser before account syncing. They won't be moved without your permission.</p>
            <div className="mt-3 flex flex-wrap gap-2"><button onClick={importOldTasks} className={buttonClass + " bg-indigo-700 text-white"}>Add old tasks to my account</button><button onClick={dismissLegacy} className={buttonClass + " bg-white text-indigo-700 ring-1 ring-indigo-200"}>Not now</button></div>
          </section>}

          {message && <div role="status" className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-[600] w-[min(92vw,440px)] -translate-x-1/2 rounded-2xl bg-[#292446] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_18px_40px_#16152a40]">{message}</div>}
          <div className="mt-4"><HubTrialNote trial={trial} which="life" upgradeHref="#/billing" onUpgrade={user.role === "parent" ? () => { setSection("reader"); window.setTimeout(() => document.getElementById("parent-plans")?.scrollIntoView({ behavior: "smooth" }), 600); } : undefined} /></div>
          {shown !== "tasks" && <div className="mt-2">{familyContent}</div>}
          {shown === "tasks" && <>

          <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Open tasks", count: active.length, icon: ListTodo, tint: "text-violet-600", bg: "bg-violet-50" },
              { label: "Due today", count: active.filter(task => task.due === currentDay).length, icon: Sun, tint: "text-amber-600", bg: "bg-amber-50" },
              { label: "Overdue", count: overdue.length, icon: Clock3, tint: "text-rose-600", bg: "bg-rose-50" },
              { label: "Completed", count: completed, icon: CheckCircle2, tint: "text-emerald-600", bg: "bg-emerald-50" },
            ].map(stat => { const Icon = stat.icon; return <div key={stat.label} className="rounded-2xl border border-[#e7e8ef] bg-white p-4 shadow-[0_3px_16px_#17152b08] sm:p-5"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-slate-500">{stat.label}</span><span className={`rounded-xl p-2 ${stat.bg} ${stat.tint}`}><Icon size={17} /></span></div><p className="text-3xl font-black text-[#242238]">{stat.count}</p></div>; })}
          </div>

          <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <section className="min-w-0 rounded-[1.5rem] border border-[#e7e8f0] bg-white p-4 shadow-[0_8px_28px_#17152b08] sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-violet-600">{selectedName}</p><h2 className="mt-1 text-xl font-black">{viewTabs.find(tab => tab.id === view)?.title}</h2></div>
                <div className="flex flex-wrap items-center gap-2"><ShareButton target={selectedList === "all" ? "tasks" : `tasks:${selectedList}`} title={selectedList === "all" ? "Our to-do lists" : selectedName} say={setMessage} label={selectedList === "all" ? "Share lists" : "Share list"} /><button onClick={openAdd} className={buttonClass + " bg-[#6e5ae0] text-white hover:bg-[#5948c8]"}><Plus size={17} /> Add task</button></div>
              </div>
              {members.length > 0 && <div className="mt-5 flex flex-wrap gap-1.5" role="group" aria-label="Show tasks for">
                <button onClick={() => setMemberFilter("")} aria-pressed={!memberFilter} className={`min-h-9 rounded-xl px-3 text-xs font-bold ring-1 ${!memberFilter ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-500 ring-slate-200"}`}>Everyone</button>
                {members.map(m => <button key={m.id} onClick={() => setMemberFilter(memberFilter === m.name ? "" : m.name)} aria-pressed={memberFilter === m.name} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold ring-1 bg-white text-slate-600 ring-slate-200" style={memberFilter === m.name ? { background: m.color, color: "#fff", boxShadow: `0 0 0 1px ${m.color}` } : undefined}><span>{m.emoji || "🙂"}</span>{m.name}<span className="opacity-70">{active.filter(t => t.assignee.trim().toLowerCase() === m.name.toLowerCase()).length}</span></button>)}
              </div>}
              <div className="relative mt-5"><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks, notes, or names" aria-label="Search tasks" className={inputClass + " pl-10"} /></div>
              <div className="mt-5 space-y-2">
                {filtered.map(task => {
                  const list = data.lists.find(row => row.id === task.listId);
                  const late = !task.done && !!task.due && task.due < currentDay;
                  return <div key={task.id} className="group flex min-w-0 items-start gap-3 rounded-2xl border border-[#ececf3] bg-white p-3 transition hover:border-violet-200 hover:bg-[#fcfbff] sm:p-4">
                    <button onClick={() => toggleDone(task)} aria-label={task.done ? `Reopen ${task.title}` : `Complete ${task.title}`} aria-pressed={task.done} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition ${task.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-violet-500"}`}><Check size={15} /></button>
                    <button onClick={() => setEditing({ ...task })} className="min-w-0 flex-1 text-left">
                      <p className={`break-words text-sm font-bold sm:text-base ${task.done ? "text-slate-400 line-through" : "text-slate-800"}`}>{task.title}</p>
                      {task.notes && <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-500">{task.notes}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                        {list && <span className="rounded-lg bg-slate-50 px-2 py-1 text-slate-500"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: list.color }} />{list.name}</span>}
                        {task.due && <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${late ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-500"}`}><CalendarDays size={12} /> {late ? "Overdue · " : ""}{prettyDate(task.due)}{task.time ? ` · ${task.time}` : ""}</span>}
                        {task.assignee && (() => { const m = memberByName(task.assignee); return m
                          ? <span className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5" style={{ background: m.color + "1f", color: m.color }}><Avatar member={m} size="sm" />{m.name}</span>
                          : <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-blue-600"><Users size={12} /> {task.assignee}</span>; })()}
                        {task.priority === "high" && <span className="rounded-lg bg-orange-50 px-2 py-1 text-orange-600">High priority</span>}
                        {task.repeat !== "none" && <span className="inline-flex items-center gap-1 text-slate-400"><Repeat2 size={12} /> {task.repeat}</span>}
                      </div>
                    </button>
                    <button onClick={() => setEditing({ ...task })} aria-label={`Edit ${task.title}`} className="rounded-lg p-2 text-slate-400 transition hover:bg-violet-50 hover:text-violet-700"><Pencil size={16} /></button>
                  </div>;
                })}
                {!filtered.length && <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center"><span className="rounded-2xl bg-violet-50 p-4 text-violet-600"><Sparkles size={26} /></span><p className="mt-4 text-lg font-extrabold">{search ? "No matching tasks" : view === "completed" ? "Nothing completed yet" : "A fresh start"}</p><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{search ? "Try another search." : view === "today" ? "No tasks due today or overdue. Enjoy the breathing room." : view === "upcoming" ? "Nothing scheduled ahead yet." : view === "completed" ? "Finished tasks will appear here." : "Add your first task and start planning your day."}</p><button onClick={openAdd} className={buttonClass + " mt-5 bg-violet-100 text-violet-700"}><Plus size={16} /> Add a task</button></div>}
              </div>
              {selectedList !== "all" && !DEFAULT_LISTS.some(list => list.id === selectedList) && <button onClick={() => { const list = data.lists.find(item => item.id === selectedList); if (list) removeList(list); }} className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-rose-500 hover:underline"><Trash2 size={14} /> Delete this custom list</button>}
            </section>

            <aside className="space-y-5">
              <section className="rounded-[1.5rem] bg-[#292446] p-5 text-white shadow-[0_12px_24px_#2924461f]">
                <div className="flex items-center gap-2 text-[#bcb2ff]"><Sparkles size={17} /><span className="text-[11px] font-extrabold uppercase tracking-[.14em]">Your progress</span></div>
                <p className="mt-5 text-3xl font-black">{data.tasks.length ? Math.round(completed / data.tasks.length * 100) : 0}%</p>
                <p className="mt-1 text-xs text-slate-300">of all tasks completed</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#a38cfa] transition-all" style={{ width: `${data.tasks.length ? completed / data.tasks.length * 100 : 0}%` }} /></div>
                <p className="mt-4 text-xs font-medium leading-5 text-slate-300">Every little step counts. Keep going at your own pace.</p>
              </section>
              <section className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5">
                <div className="flex items-center justify-between"><h3 className="text-sm font-extrabold">Coming up next</h3><CalendarDays size={17} className="text-violet-500" /></div>
                {upcoming.length ? <div className="mt-4 space-y-3">{upcoming.slice(0, 5).map(task => <button key={task.id} onClick={() => setEditing({ ...task })} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 pb-3 text-left last:border-b-0 last:pb-0"><span className="min-w-0 truncate text-xs font-semibold text-slate-700">{task.title}</span><span className="shrink-0 text-[11px] font-bold text-violet-600">{prettyDate(task.due)}</span></button>)}</div> : <p className="mt-3 text-xs leading-5 text-slate-500">Your calendar is clear for now.</p>}
              </section>
              <section className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5">
                <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-600" /><h3 className="text-sm font-extrabold">Your tasks, your account</h3></div>
                <p className="mt-2 text-xs leading-5 text-slate-500">Everything is saved to your signed-in A.R.I.S.E. account and syncs between your devices. A safety copy stays in this browser if your connection drops. Family members are names on your account, not separate logins.</p>
                <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={event => void importData(event)} aria-label="Restore LifeHub backup" />
                <div className="mt-4 flex flex-wrap gap-2"><button onClick={exportData} className={buttonClass + " border border-slate-200 bg-slate-50 text-slate-700"}><Download size={16} /> Back up</button><button onClick={() => fileInput.current?.click()} className={buttonClass + " border border-slate-200 bg-slate-50 text-slate-700"}><FileUp size={16} /> Restore</button></div>
              </section>
              <EmailForwardCard token={token} />
              <button onClick={() => navigate("/")} className="flex min-h-10 items-center gap-2 text-xs font-semibold text-slate-500 hover:text-violet-700 lg:hidden"><ArrowLeft size={14} /> A.R.I.S.E. Reader</button>
            </aside>
          </div>
          </>}
        </div>
      </main>
    </div>

    {editing && <div className="fixed inset-0 z-[500] flex items-end justify-center bg-[#16152a]/65 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="todo-modal-title" className="max-h-[94dvh] w-full overflow-y-auto rounded-t-[1.5rem] bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-[1.5rem] sm:p-7">
        <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-violet-600">Arise LifeHub</p><h2 id="todo-modal-title" className="mt-1 text-xl font-black">{data.tasks.some(item => item.id === editing.id) ? "Edit task" : "Add a new task"}</h2></div><button onClick={() => setEditing(null)} aria-label="Close task editor" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button></div>
        <form onSubmit={saveTask} className="space-y-4">
          <label className="block text-xs font-bold text-slate-600">Task name<input autoFocus required maxLength={200} value={editing.title} onChange={event => setEditing({ ...editing, title: event.target.value })} className={inputClass + " mt-1.5"} placeholder="What needs to get done?" /></label>
          <label className="block text-xs font-bold text-slate-600">Notes (optional)<textarea rows={3} maxLength={2000} value={editing.notes} onChange={event => setEditing({ ...editing, notes: event.target.value })} className={inputClass + " mt-1.5 py-3"} placeholder="Add more details..." /></label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-600">List<select className={inputClass + " mt-1.5"} value={editing.listId} onChange={event => setEditing({ ...editing, listId: event.target.value })}>{data.lists.map(list => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>
            <label className="block text-xs font-bold text-slate-600">Priority<select className={inputClass + " mt-1.5"} value={editing.priority} onChange={event => setEditing({ ...editing, priority: event.target.value as Priority })}><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></label>
            <label className="block text-xs font-bold text-slate-600">Due date<input type="date" className={inputClass + " mt-1.5"} value={editing.due} onChange={event => setEditing({ ...editing, due: event.target.value, repeat: event.target.value ? editing.repeat : "none" })} /></label>
            <label className="block text-xs font-bold text-slate-600">Time (optional)<input type="time" className={inputClass + " mt-1.5"} value={editing.time} onChange={event => setEditing({ ...editing, time: event.target.value })} /></label>
            <label className="block text-xs font-bold text-slate-600">Repeat<select className={inputClass + " mt-1.5"} disabled={!editing.due} value={editing.repeat} onChange={event => setEditing({ ...editing, repeat: event.target.value as Repeat })}><option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option></select></label>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600">Assigned to</p>
            {members.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setEditing({ ...editing, assignee: "" })} aria-pressed={!editing.assignee} className={`min-h-10 rounded-xl px-3 text-xs font-bold ring-1 ${!editing.assignee ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-500 ring-slate-200"}`}>Nobody</button>
              {members.map(m => { const on = editing.assignee.trim().toLowerCase() === m.name.toLowerCase(); return <button type="button" key={m.id} aria-pressed={on} onClick={() => setEditing({ ...editing, assignee: on ? "" : m.name })} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 pr-3 text-xs font-bold ring-1 bg-white text-slate-600 ring-slate-200" style={on ? { background: m.color, color: "#fff", boxShadow: `0 0 0 1px ${m.color}` } : undefined}><span className="text-base leading-none">{m.emoji || "🙂"}</span>{m.name}</button>; })}
            </div>}
            <input className={inputClass + " mt-2"} maxLength={100} value={editing.assignee} onChange={event => setEditing({ ...editing, assignee: event.target.value })} placeholder={members.length ? "…or type any name" : "Me, partner, kid's name…"} aria-label="Assigned to" />
            <p className="mt-1.5 text-xs leading-5 text-slate-500">{members.length ? "Tap a family member, or type someone else's name." : "Add your family in “Family & settings” to pick them with one tap."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <button type="submit" className={buttonClass + " flex-1 bg-[#6e5ce1] px-5 text-white hover:bg-[#5a48cb]"}><Check size={17} /> Save task</button>
            <button type="button" onClick={() => setEditing(null)} className={buttonClass + " border border-slate-200 bg-white text-slate-600"}>Cancel</button>
            {data.tasks.some(item => item.id === editing.id) && <button type="button" onClick={() => removeTask(editing)} title="Delete task" aria-label="Delete task" className={buttonClass + " border border-rose-100 bg-rose-50 text-rose-600"}><Trash2 size={17} /></button>}
          </div>
        </form>
      </div>
    </div>}
  </div>;
}
