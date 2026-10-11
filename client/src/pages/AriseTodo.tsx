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
  CalendarRange, Smile, Vote, Bell, BookOpen, Pill as PillIcon, Plane, Wallet, StickyNote, Settings2, Moon, Apple, Target, Droplets, SmilePlus, Newspaper,
  ChevronUp, ChevronDown, MoreHorizontal, Save, NotebookPen, Hourglass, ShoppingCart, Wind, BookMarked, Quote, History, TrendingUp, Shuffle, HeartHandshake, BookOpenText, Link2,
  ShoppingBag,
  Folder as Folder, ChevronRight as ChevronRight,
} from "lucide-react";
import Randomizer from "@/components/family-hub/Randomizer";
import Relationships from "@/components/family-hub/Relationships";
import Dictionary from "@/components/family-hub/Dictionary";
import LinkPage from "@/components/family-hub/LinkPage";
import StickyBoard from "@/components/family-hub/StickyBoard";
import KitPlugin from "@/components/plugin-kit/KitPlugin";
import { kitIcon } from "@/components/plugin-kit/kitIcons";
import { KIT_DEFS, isKitLifeId, kitDef, type KitLifeId } from "@shared/pluginKit";
import Allowance from "@/components/family-hub/Allowance";
import GiftCards from "@/components/family-hub/GiftCards";
import Ious from "@/components/family-hub/Ious";
import KitchenTimers from "@/components/family-hub/KitchenTimers";
import LoanCalculator from "@/components/family-hub/LoanCalculator";
import MedicalInfo from "@/components/family-hub/MedicalInfo";
import Mileage from "@/components/family-hub/Mileage";
import Milestones from "@/components/family-hub/Milestones";
import Routines from "@/components/family-hub/Routines";
import SleepLog from "@/components/family-hub/SleepLog";
import Warranties from "@/components/family-hub/Warranties";
import WorkoutLog from "@/components/family-hub/WorkoutLog";
import WorldClock from "@/components/family-hub/WorldClock";
import { Coins as CoinsNav2, CreditCard as CreditCardNav2, Dumbbell as DumbbellNav2, Gauge as GaugeNav2, Globe as GlobeNav2, GraduationCap as GraduationCapNav2, Hammer as HammerNav2, HandCoins as HandCoinsNav2, Handshake as HandshakeNav2, Heart as HeartNav2, HeartPulse as HeartPulseNav2, Landmark as LandmarkNav2, ListChecks as ListChecksNav2, Moon as MoonNav2, ShieldCheck as ShieldCheckNav2, Sparkles as SparklesNav2, Star as StarNav2, Stethoscope as StethoscopeNav2, Timer as TimerNav2, Utensils as UtensilsNav2 } from "lucide-react";
import Birthdays from "@/components/family-hub/Birthdays";
import CareTracker from "@/components/family-hub/CareTracker";
import Collection from "@/components/family-hub/Collection";
import Contacts from "@/components/family-hub/Contacts";
import Converter from "@/components/family-hub/Converter";
import Focus from "@/components/family-hub/Focus";
import Gratitude from "@/components/family-hub/Gratitude";
import Habits from "@/components/family-hub/Habits";
import MealPlanner from "@/components/family-hub/MealPlanner";
import Recipes from "@/components/family-hub/Recipes";
import SavingsJars from "@/components/family-hub/SavingsJars";
import Subscriptions from "@/components/family-hub/Subscriptions";
import TipCalculator from "@/components/family-hub/TipCalculator";
import Weather from "@/components/family-hub/Weather";
import { ArrowLeftRight as ArrowLeftRightNav, BookOpen as BookOpenNav, Cake as CakeNav, Calculator as CalculatorNav, Car as CarNav, ChefHat as ChefHatNav, CloudSun as CloudSunNav, CreditCard as CreditCardNav, Flower2 as Flower2Nav, Gift as GiftNav, Heart as HeartNav, Mountain as MountainNav, PawPrint as PawPrintNav, Phone as PhoneNav, PiggyBank as PiggyBankNav, Repeat as RepeatNav, Timer as TimerNav, Tv as TvNav, UtensilsCrossed as UtensilsCrossedNav, Wrench as WrenchNav } from "lucide-react";
import Journal from "@/components/family-hub/Journal";
import Countdowns from "@/components/family-hub/Countdowns";
import Grocery from "@/components/family-hub/Grocery";
import Meditate from "@/components/family-hub/Meditate";
import Bible from "@/components/family-hub/Bible";
import Quotes from "@/components/family-hub/Quotes";
import TodayInHistory from "@/components/family-hub/TodayInHistory";
import Trending from "@/components/family-hub/Trending";
import PluginStore from "@/components/plugin-store/PluginStore";
import { OPEN_STORE_KEY, lifeInstalled, pluginOpens, setLifePlugin, type Plugin } from "@shared/pluginStore";
import { cleanFamily, cleanSectionOrder, emptyFamily, FAMILY_SECTIONS, isCurrentFamily, isOn, orderedToggleable, TOGGLEABLE, type Family, type FamilySection } from "@shared/familyHub";
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
import Pills from "@/components/family-hub/Pills";
import { dosesOn } from "@shared/pills";
import Mood from "@/components/family-hub/Mood";
import News from "@/components/family-hub/News";
import NotificationSettings from "@/components/family-hub/NotificationSettings";
import { EmailForwardCard, useEmailInbox } from "@/components/family-hub/EmailForward";
import Members, { SECTION_INFO } from "@/components/family-hub/Members";
import { Avatar, Modal } from "@/components/family-hub/ui";
import { PhoneMenu, usePhoneMenu, type PhoneMenuItem } from "@/components/family-hub/PhoneMenu";
import { DeskSidePicker, FolderEditor } from "@/components/HubCustomizeExtras";
import { foldMenu } from "@shared/hubLayout";
import { HubSearch, HubSearchButton, type HubSearchEntry } from "@/components/HubSearch";
import { BriefButton, DailyBrief, useMorningBrief } from "@/components/DailyBrief";
import { buildLifeBrief } from "@shared/dailyBrief";
import { HubChat } from "@/components/HubChat";
import { HOME_SIZES, MENU_CLOSES, MENU_SIDES, moveSection, resizeSection, showSection, sizeOf } from "@shared/hubLayout";
import { LIFE_PARTS, cleanLifeLayout, type LifeLayout } from "@shared/lifeLayout";
import HubSwitch from "@/components/HubSwitch";
import HubMark from "@/components/HubMark";
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
  home: Home, tasks: ListTodo, chores: Sparkles, calendar: CalendarRange, behavior: Smile, health: Apple, goals: Target, cycle: Droplets, mood: SmilePlus, news: Newspaper, notifications: Bell, reader: BookOpen, pills: PillIcon,
  polls: Vote, trips: Plane, money: Wallet, notes: StickyNote, family: Settings2,
  journal: NotebookPen, countdowns: Hourglass, grocery: ShoppingCart, meditate: Wind, bible: BookMarked, quotes: Quote, history: History, trending: TrendingUp,
  randomizer: Shuffle, relationships: HeartHandshake, dictionary: BookOpenText, links: Link2,
  habits: RepeatNav, gratitude: HeartNav, focus: TimerNav, bucket: MountainNav, recipes: ChefHatNav, meals: UtensilsCrossedNav, upkeep: WrenchNav, plants: Flower2Nav, birthdays: CakeNav, gifts: GiftNav, pets: PawPrintNav, contacts: PhoneNav, subscriptions: CreditCardNav, jars: PiggyBankNav, tips: CalculatorNav, reading: BookOpenNav, watchlist: TvNav, weather: CloudSunNav, convert: ArrowLeftRightNav, car: CarNav,
  wishlist: HeartNav2, restaurants: UtensilsNav2, learning: GraduationCapNav2, projects: HammerNav2, loans: HandshakeNav2, cleaning: SparklesNav2, checkups: StethoscopeNav2, sleep: MoonNav2, workouts: DumbbellNav2, routines: ListChecksNav2, milestones: StarNav2, ious: HandCoinsNav2, allowance: CoinsNav2, giftcards: CreditCardNav2, warranties: ShieldCheckNav2, mileage: GaugeNav2, mortgage: LandmarkNav2, clocks: GlobeNav2, timers: TimerNav2, medical: HeartPulseNav2,
  ...(Object.fromEntries(KIT_DEFS.filter((d) => d.hub === "life").map((d) => [d.id, kitIcon(d.icon)])) as Record<KitLifeId, typeof Home>),
};
// Home, Reader, Tasks, Notifications and Family & settings stay put; everything between
// Tasks and Notifications is the family's own toggleable block, in the order they chose.
const sectionOrderFor = (family: Family): FamilySection[] => ["home", "reader", "tasks", ...orderedToggleable(family), "notifications", "family"];
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
    try { const saved = localStorage.getItem(SECTION_KEY) as FamilySection | null; return saved && (FAMILY_SECTIONS as readonly string[]).includes(saved) ? saved : first; } catch { return first; }
  });
  const [draggingSection, setDraggingSection] = useState<FamilySection | null>(null);
  // The Arise App Store. It opens straight away when the person switched here from WorkHub's store.
  const [store, setStore] = useState(() => { try { const on = sessionStorage.getItem(OPEN_STORE_KEY) === "1"; sessionStorage.removeItem(OPEN_STORE_KEY); return on; } catch { return false; } });
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
  const sections = sectionOrderFor(family).filter(id => isOn(id, family) && (id !== "reader" || user?.role === "parent"));
  // Dragging (or, on a phone, the arrows) a menu item reorders it right where it sits.
  // Home, Reader, Tasks, Notifications and Family & settings stay put.
  const moveSectionBy = (id: FamilySection, dir: -1 | 1) => setFamily((f) => {
    const current = cleanSectionOrder(f.sectionOrder);
    const at = current.indexOf(id);
    const to = at + dir;
    if (at < 0 || to < 0 || to >= current.length) return f;
    const next = [...current];
    [next[at], next[to]] = [next[to], next[at]];
    return { ...f, sectionOrder: next };
  });
  const moveSectionTo = (id: FamilySection, beforeId: FamilySection | null) => setFamily((f) => {
    const current = cleanSectionOrder(f.sectionOrder).filter((s) => s !== id);
    const at = beforeId && (TOGGLEABLE as readonly FamilySection[]).includes(beforeId) ? current.indexOf(beforeId) : current.length;
    if (at < 0) return f;
    current.splice(at, 0, id);
    return { ...f, sectionOrder: current };
  });
  const trial = useLifeHubTrial();
  const shown: FamilySection = sections.includes(section) ? section : "home";
  // Doses still to take today show on the Pills tab.
  const pillsDue = dosesOn(family, currentDay).filter((d) => !d.status).length;
  const badge = (id: FamilySection) => id === "tasks" ? dueToday.length : id === "pills" ? pillsDue : 0;
  // How the family arranged the hub (Customize): the phone menu and Home, the same choices as WorkHub.
  const layout = cleanLifeLayout(family.layout);
  const setLayout = (next: LifeLayout) => setFamily((f) => ({ ...f, layout: next }));
  const phone = usePhoneMenu(layout.menuSide, layout.menuClose);
  // The menu on a computer (Customize). Tasks keeps the full sidebar so its lists stay at hand.
  const dsk = shown === "tasks" ? "left" : layout.deskSide;
  const deskAside = dsk === "drawer" ? "lg:hidden"
    : dsk === "top" ? "lg:sticky lg:top-16 lg:z-30 lg:block lg:w-full"
    : dsk === "compact" ? "lg:sticky lg:top-16 lg:flex lg:h-[calc(100vh-4rem)] lg:w-[76px] lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-b-0 lg:border-r"
    : `lg:sticky lg:top-16 lg:flex lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-b-0 xl:w-72 ${dsk === "right" ? "lg:border-l" : "lg:border-r"}`;
  const [openFolders, setOpenFolders] = useState<string[]>([]);
  // Search everything in LifeHub (header button, Ctrl/⌘ K or "/") and the Daily Brief app.
  const [customizing, setCustomizing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [briefOpen, setBriefOpen] = useMorningBrief("life", currentDay, !!user);
  const goSection = (id: string) => { setSection(id as FamilySection); window.scrollTo({ top: 0 }); };
  const searchEntries = ((): HubSearchEntry[] => {
    if (!searching) return [];
    const out: HubSearchEntry[] = [], f = family;
    const dw = (d: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");
    for (const id of sections) out.push({ id: `s-${id}`, kind: "Section", title: SECTION_INFO[id].label, open: () => goSection(id) });
    out.push({ id: "brief", kind: "Section", title: "Daily brief", sub: "Today at a glance", keywords: "morning summary today", open: () => setBriefOpen(true) });
    out.push({ id: "customize", kind: "Section", title: "Customize", sub: "Menu, folders and Home", keywords: "settings layout", open: () => setCustomizing(true) });
    out.push({ id: "store", kind: "Section", title: "App Store", keywords: "add plugins apps store", open: () => setStore(true) });
    for (const t of data.tasks) out.push({ id: t.id, kind: "Tasks", title: t.title, sub: [t.done ? "Done" : "", t.due && `Due ${dw(t.due)}`].filter(Boolean).join(" · "), keywords: t.notes, open: () => goSection("tasks") });
    for (const e of f.events) out.push({ id: e.id, kind: "Calendar", title: e.title, sub: [dw(e.date), e.location].filter(Boolean).join(" · "), keywords: e.notes, open: () => goSection("calendar") });
    for (const n of f.notes) out.push({ id: n.id, kind: "Notes", title: n.title || n.body.slice(0, 60) || "Note", keywords: n.body.slice(0, 400), open: () => goSection("notes") });
    for (const m of f.members) out.push({ id: m.id, kind: "Family", title: m.name, sub: m.kind === "kid" ? "Kid" : "Adult", open: () => goSection("family") });
    for (const r of f.recipes) out.push({ id: r.id, kind: "Recipes", title: r.title, sub: r.tags, keywords: r.ingredients.join(" "), open: () => goSection("recipes") });
    for (const g of f.groceries) out.push({ id: g.id, kind: "Grocery list", title: g.name, sub: [g.qty, g.aisle, g.checked ? "In the cart" : ""].filter(Boolean).join(" · "), open: () => goSection("grocery") });
    for (const m of f.meals) out.push({ id: m.id, kind: "Meals", title: m.text || f.recipes.find((r) => r.id === m.recipeId)?.title || "Meal", sub: `${dw(m.date)} · ${m.slot}`, open: () => goSection("meals") });
    for (const c of f.contacts) out.push({ id: c.id, kind: "Contacts", title: c.name, sub: [c.role, c.phone].filter(Boolean).join(" · "), keywords: `${c.email} ${c.note}`, open: () => goSection("contacts") });
    for (const b of f.birthdays) out.push({ id: b.id, kind: "Birthdays", title: b.name, sub: `${b.month}/${b.day}`, open: () => goSection("birthdays") });
    for (const b of f.bills) out.push({ id: b.id, kind: "Bills", title: b.name, sub: `$${b.amount.toFixed(2)} · due the ${b.dueDay}`, keywords: b.category, open: () => goSection("money") });
    for (const c of f.chores) out.push({ id: c.id, kind: "Chores", title: c.title, open: () => goSection("chores") });
    for (const j of f.journal) out.push({ id: j.id, kind: "Journal", title: j.title || dw(j.date), sub: dw(j.date), keywords: j.body.slice(0, 300), open: () => goSection("journal") });
    for (const c of f.countdowns) out.push({ id: c.id, kind: "Countdowns", title: c.title, sub: dw(c.date), open: () => goSection("countdowns") });
    for (const t of f.trips) out.push({ id: t.id, kind: "Trips", title: t.name || "Trip", sub: [t.destination, dw(t.start)].filter(Boolean).join(" · "), open: () => goSection("trips") });
    return out;
  })();
  const [more, setMore] = useState(false);
  const phoneItems: PhoneMenuItem[] = [
    ...sections.map((id) => { const Icon = SECTION_ICONS[id]; return { id, label: SECTION_INFO[id].label, icon: <Icon />, active: shown === id, badge: badge(id), onClick: () => setSection(id) }; }),
    // The App Store sits in the phone menu and the app drawer, not tucked away in the ⋯ menu.
    { id: "app-store", label: "App Store", icon: <ShoppingBag />, active: false, color: "#6a55dc", onClick: () => setStore(true) },
  ];
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
    : shown === "pills" ? <Pills {...common} />
    : shown === "mood" ? <Mood {...common} />
    : shown === "news" ? <News {...common} />
    : shown === "notifications" ? <NotificationSettings {...common} />
    : shown === "reader" ? <Suspense fallback={<div className="grid min-h-[40vh] place-items-center"><RefreshCw className="animate-spin text-violet-600" size={30} /></div>}><Reader say={setMessage} night={night} /></Suspense>
    : shown === "polls" ? <Polls {...common} />
    : shown === "trips" ? <Trips {...common} />
    : shown === "money" ? <Money {...common} />
    : shown === "notes" ? <Notes {...common} />
    : shown === "journal" ? <Journal {...common} />
    : shown === "countdowns" ? <Countdowns {...common} />
    : shown === "grocery" ? <Grocery {...common} />
    : shown === "meditate" ? <Meditate {...common} />
    : shown === "bible" ? <Bible {...common} />
    : shown === "quotes" ? <Quotes {...common} />
    : shown === "history" ? <TodayInHistory {...common} />
    : shown === "trending" ? <Trending {...common} />
    : shown === "randomizer" ? <Randomizer {...common} />
    : shown === "relationships" ? <Relationships {...common} />
    : shown === "dictionary" ? <Dictionary {...common} />
    : shown === "links" ? <LinkPage {...common} />
    : shown === "habits" ? <Habits {...common} />
    : shown === "gratitude" ? <Gratitude {...common} />
    : shown === "focus" ? <Focus {...common} />
    : shown === "bucket" ? <Collection kind="bucket" {...common} />
    : shown === "recipes" ? <Recipes {...common} />
    : shown === "meals" ? <MealPlanner {...common} />
    : shown === "upkeep" ? <CareTracker kind="upkeep" {...common} />
    : shown === "plants" ? <CareTracker kind="plants" {...common} />
    : shown === "birthdays" ? <Birthdays {...common} />
    : shown === "gifts" ? <Collection kind="gifts" {...common} />
    : shown === "pets" ? <CareTracker kind="pets" {...common} />
    : shown === "contacts" ? <Contacts {...common} />
    : shown === "subscriptions" ? <Subscriptions {...common} />
    : shown === "jars" ? <SavingsJars {...common} />
    : shown === "tips" ? <TipCalculator {...common} />
    : shown === "reading" ? <Collection kind="reading" {...common} />
    : shown === "watchlist" ? <Collection kind="watchlist" {...common} />
    : shown === "weather" ? <Weather {...common} />
    : shown === "convert" ? <Converter {...common} />
    : shown === "car" ? <CareTracker kind="car" {...common} />
    : shown === "wishlist" ? <Collection kind="wishlist" {...common} />
    : shown === "restaurants" ? <Collection kind="restaurants" {...common} />
    : shown === "learning" ? <Collection kind="learning" {...common} />
    : shown === "projects" ? <Collection kind="projects" {...common} />
    : shown === "loans" ? <Collection kind="loans" {...common} />
    : shown === "cleaning" ? <CareTracker kind="cleaning" {...common} />
    : shown === "checkups" ? <CareTracker kind="checkups" {...common} />
    : shown === "sleep" ? <SleepLog {...common} />
    : shown === "workouts" ? <WorkoutLog {...common} />
    : shown === "routines" ? <Routines {...common} />
    : shown === "milestones" ? <Milestones {...common} />
    : shown === "ious" ? <Ious {...common} />
    : shown === "allowance" ? <Allowance {...common} />
    : shown === "giftcards" ? <GiftCards {...common} />
    : shown === "warranties" ? <Warranties {...common} />
    : shown === "mileage" ? <Mileage {...common} />
    : shown === "mortgage" ? <LoanCalculator {...common} />
    : shown === "clocks" ? <WorldClock {...common} />
    : shown === "timers" ? <KitchenTimers {...common} />
    : shown === "medical" ? <MedicalInfo {...common} />
    : shown === "family" ? <Members {...common} />
    : isKitLifeId(shown) && kitDef(shown) ? <KitPlugin key={shown} def={kitDef(shown)!} records={family.kit} setRecords={(update) => setFamily((f) => ({ ...f, kit: update(f.kit) }))} today={currentDay} makeId={makeId} say={setMessage} />
    : null;

  if (!user) return <AriseTodoSignIn />;
  if (!sync.loaded) return <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#f6f7fc] px-4 text-center text-slate-800">
    {sync.error ? <><CloudOff size={40} className="text-rose-500" /><h1 className="text-2xl font-black">We couldn't open your saved LifeHub lists.</h1><p className="max-w-md text-sm text-slate-600">{sync.error}</p><button onClick={sync.retry} className={buttonClass + " bg-violet-700 px-6 text-white"}><RefreshCw size={17} /> Try again</button><button onClick={() => void signOut()} className="text-sm font-bold text-slate-500">Switch account</button></> : <><RefreshCw className="animate-spin text-violet-600" size={34} /><p className="text-sm font-semibold text-slate-600">Opening your tasks from your account…</p></>}
  </div>;
  const saveStatus = sync.view.kind === "saved" ? "Saved to account" : sync.view.kind === "waiting" ? "Saving soon…" : sync.view.kind === "saving" ? "Saving to cloud…" : sync.view.kind === "retrying" ? "Waiting for connection…" : "Needs your attention";

  return <div className={`min-h-screen bg-[#f6f7fc] text-slate-900 ${night ? "todo-night" : ""}`}>
    {store && <PluginStore
      hub="life"
      night={night}
      teacher={user.role === "teacher" || !!user.isAdmin}
      isInstalled={(p: Plugin) => lifeInstalled(p, family)}
      onToggle={(p: Plugin, on: boolean) => {
        setFamily((f) => setLifePlugin(f, p, on));
        if (p.target.kind === "widget" && p.target.widget === "board" && on) setMessage("Widgets added to Home. Tap Add widget to pick your first one.");
      }}
      onOpen={(p: Plugin) => { const at = pluginOpens(p); if (at && "section" in at) setSection(at.section); setStore(false); if (p.target.kind === "assistant") setMessage("Tap the ✦ button at the bottom right to chat."); }}
      onClose={() => setStore(false)}
    />}
    {customizing && <Modal title="Customize" eyebrow="LifeHub" onClose={() => setCustomizing(false)} wide>
      <div className="space-y-6" data-testid="life-customize-panel">
        <section>
          <h3 className="text-sm font-black text-slate-900">Menu on your phone</h3>
          <p className="mb-3 mt-1 text-sm text-slate-500">Where it sits, and how it closes. The computer menu has its own choices below.</p>
          <div role="radiogroup" aria-label="Where the menu sits" className="mb-3 flex flex-wrap gap-2">
            {MENU_SIDES.map((o) => <button key={o.id} type="button" role="radio" aria-checked={layout.menuSide === o.id} onClick={() => { setLayout({ ...layout, menuSide: o.id }); phone.setRail(true); }} data-testid={`life-menu-side-${o.id}`}
              className={`min-h-11 rounded-full px-4 text-sm font-bold ring-1 ${layout.menuSide === o.id ? "bg-[#292446] text-white ring-[#292446]" : "bg-white text-slate-600 ring-slate-200"}`}>{o.label}</button>)}
          </div>
          {layout.menuSide === "drawer" ? <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">A round button at the bottom of the screen opens every section as app icons, with a search box. Swipe it up or tap it; swipe down or tap outside to close.</p>
            : <div role="radiogroup" aria-label="How the menu closes" className="grid gap-2">
              {MENU_CLOSES.map((o) => <button key={o.id} type="button" role="radio" aria-checked={layout.menuClose === o.id} onClick={() => { setLayout({ ...layout, menuClose: o.id }); phone.setRail(true); }} data-testid={`life-menu-close-${o.id}`}
                className={`flex min-h-11 items-start gap-3 rounded-xl border px-3 py-2 text-left text-sm ${layout.menuClose === o.id ? "border-[#292446] bg-slate-50" : "border-slate-200 bg-white"}`}>
                <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 rounded-full border-2 ${layout.menuClose === o.id ? "border-[5px] border-[#292446]" : "border-slate-300"}`} aria-hidden />
                <span><span className="block font-bold text-slate-900">{o.label}</span><span className="block text-xs text-slate-500">{o.detail}</span></span>
              </button>)}
            </div>}
        </section>
        <DeskSidePicker layout={layout} setLayout={setLayout} />
        <FolderEditor layout={layout} setLayout={setLayout} makeId={makeId} items={sections.filter((x) => x !== "home").map((x) => ({ id: x, label: SECTION_INFO[x].label }))} />
        <section>
          <h3 className="text-sm font-black text-slate-900">Home screen</h3>
          <p className="mb-3 mt-1 text-sm text-slate-500">Turn parts on or off, move them, and pick a size. You can also press and hold Home itself to drag things around.</p>
          <ul className="space-y-1.5" aria-label="Parts of Home">
            {layout.home.map((id, i) => {
              const on = !layout.homeHidden.includes(id), part = LIFE_PARTS.find((x) => x.id === id)!, sz = sizeOf(layout, id);
              return <li key={id} className={`flex min-h-11 flex-wrap items-center gap-2 rounded-xl border px-2 py-1 ${on ? "border-slate-200 bg-white" : "border-dashed border-slate-200 bg-slate-50"}`} data-testid={`life-home-part-${id}`}>
                <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 px-1 text-sm"><input type="checkbox" className="h-5 w-5 shrink-0" checked={on} onChange={(e) => setLayout(showSection(layout, id, e.target.checked))} /><span className={on ? "font-semibold text-slate-900" : "text-slate-500"}>{part.label}</span></label>
                <span className="flex rounded-full bg-slate-100 p-0.5" role="radiogroup" aria-label={`Size of ${part.label}`}>{HOME_SIZES.map((z) => <button key={z.id} type="button" role="radio" aria-checked={sz === z.id} aria-label={z.label} onClick={() => setLayout(resizeSection(layout, id, z.id))} className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${sz === z.id ? "bg-[#292446] text-white" : "text-slate-600"}`}>{z.short}</button>)}</span>
                <button type="button" onClick={() => setLayout(moveSection(layout, id, -1))} disabled={i === 0} aria-label={`Move ${part.label} up`} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronUp size={16} /></button>
                <button type="button" onClick={() => setLayout(moveSection(layout, id, 1))} disabled={i === layout.home.length - 1} aria-label={`Move ${part.label} down`} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronDown size={16} /></button>
              </li>;
            })}
          </ul>
          <button type="button" onClick={() => setLayout({ ...layout, home: LIFE_PARTS.map((x) => x.id), homeHidden: family.widgets.board ? [] : ["widgets"], homeSize: {} })} className="mt-2 min-h-11 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4">Reset Home to the usual layout</button>
        </section>
        <section className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={() => { setCustomizing(false); setStore(true); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#292446] px-4 text-sm font-bold text-white"><ShoppingBag size={16} /> App Store</button>
          <button type="button" onClick={() => { setCustomizing(false); setSection("family"); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-700 ring-1 ring-slate-200"><Settings2 size={16} /> Sections, family and settings</button>
        </section>
      </div>
    </Modal>}
    {/* The same header as WorkHub: the hub on the left, everything you do to it on the right. */}
    <header className="sticky top-0 z-40 h-16 border-b border-[#e4e6f0] bg-white/95 backdrop-blur" data-testid="life-header">
      <div className="flex h-full items-center justify-between gap-2 px-3 sm:gap-4 sm:px-5 lg:px-6">
        <button type="button" onClick={() => setSection("home")} className="flex min-w-0 items-center gap-2 rounded-xl" aria-label="LifeHub home">
          <span className="flex h-8 w-8 shrink-0 overflow-hidden rounded-xl shadow-[0_5px_14px_#6d5ce72b]"><HubMark tone="life" className="h-full w-full" /></span>
          <span className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">LifeHub</span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {(user.role === "teacher" || user.isAdmin) && <HubSwitch current="todo" night={night} />}
          <HubSearchButton onOpen={() => setSearching(true)} />
          <BriefButton onOpen={() => setBriefOpen(true)} className="hidden sm:inline-flex" />
          <span role="status" className={`hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-bold sm:inline-flex ${sync.view.kind === "saved" ? "bg-emerald-50 text-emerald-700" : sync.view.kind === "blocked" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{sync.view.kind === "saved" ? <Cloud size={14} /> : sync.view.kind === "blocked" ? <AlertCircle size={14} /> : <RefreshCw size={14} />}{saveStatus}</span>
          <button onClick={() => setSection("notifications")} aria-current={shown === "notifications" ? "page" : undefined} className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 ${shown === "notifications" ? "bg-[#292446] text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`} aria-label="Notification settings"><Bell size={17} /></button>
          <button onClick={toggleNight} aria-pressed={night} aria-label={night ? "Switch to day mode" : "Switch to night mode"} title={night ? "Day mode" : "Night mode"} className="hidden h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50 sm:inline-flex">{night ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button onClick={() => setStore(true)} aria-label="App Store" title="App Store" className="hidden h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex" data-testid="lifehub-plugin-store-header"><ShoppingBag size={16} /> <span className="hidden lg:inline">App Store</span></button>
          <button onClick={() => setCustomizing(true)} aria-label="Customize your LifeHub" className="hidden h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex" data-testid="life-customize"><Settings2 size={16} /> <span className="hidden lg:inline">Customize</span></button>
          <button onClick={() => void signOut()} aria-label="Sign out" title="Sign out" className="hidden h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50 sm:inline-flex"><LogOut size={16} /></button>
          <button onClick={openAdd} className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-[#6854cf] sm:hidden" aria-label="Add task"><Plus size={18} /></button>
          <div className="relative sm:hidden">
            <button type="button" onClick={() => setMore((v) => !v)} aria-label="More" aria-haspopup="menu" aria-expanded={more} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700" data-testid="life-more"><MoreHorizontal size={20} /></button>
            {more && <>
              <div className="fixed inset-0 z-40" onClick={() => setMore(false)} aria-hidden />
              <div role="menu" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                <div role="status" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600">{sync.view.kind === "saved" ? <CheckCircle2 size={16} className="text-emerald-600" /> : sync.view.kind === "blocked" ? <AlertCircle size={16} className="text-rose-600" /> : <Save size={16} />}{saveStatus}</div>
                <button type="button" role="menuitem" onClick={() => { toggleNight(); setMore(false); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">{night ? <Sun size={16} /> : <Moon size={16} />}{night ? "Day mode" : "Night mode"}</button>
                <button type="button" role="menuitem" onClick={() => { setCustomizing(true); setMore(false); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"><Settings2 size={16} />Customize</button>
                <button type="button" role="menuitem" onClick={() => void signOut()} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"><LogOut size={16} />Sign out</button>
              </div>
            </>}
          </div>
        </div>
      </div>
    </header>
    {family.widgets.chat && <HubChat hub="life" token={token} accent="bg-[#7968e5]" lift={layout.menuSide === "bottom"} />}
    {searching && <HubSearch entries={searchEntries} hubName="LifeHub" accent="bg-[#292446]" onClose={() => setSearching(false)} />}
    {briefOpen && <DailyBrief hub="life" brief={buildLifeBrief(family, data.tasks, currentDay, new Date().getHours(), (user.displayName || "").split(" ")[0])} onClose={() => setBriefOpen(false)} onOpen={goSection} />}
    <PhoneMenu items={phoneItems} side={layout.menuSide} close={layout.menuClose} open={phone.open} setRail={phone.setRail} afterPick={phone.afterPick} top={64} folders={layout.folders} deskDrawer={dsk === "drawer"} />
    <div className={`flex min-h-[calc(100vh-4rem)] w-full flex-col ${dsk === "top" ? "" : dsk === "right" ? "lg:flex-row-reverse" : "lg:flex-row"}`}>
      <aside className={`w-full border-b border-[#e4e6f0] bg-white lg:[&>*]:shrink-0 ${shown === "tasks" ? (layout.menuSide === "bottom" ? "" : phone.pad) : "max-lg:hidden"} ${deskAside}`}>
        <nav aria-label="Family Hub" className={`hidden gap-1 overflow-x-auto px-3 pb-2.5 pt-4 [scrollbar-width:none] sm:px-4 sm:pb-3 [&::-webkit-scrollbar]:hidden ${dsk === "top" ? "lg:flex lg:px-4 lg:py-2" : "lg:block lg:space-y-0.5 lg:px-3 lg:pb-0 lg:pt-6"}`}>
          {foldMenu(sections.map((id) => ({ id })), layout.folders).flatMap((entry) => {
            if (entry.kind === "item") return [entry.item.id];
            const f = entry.folder, here = entry.items.some((x) => x.id === shown), open = openFolders.includes(f.id) || here;
            return [<button key={`folder-${f.id}`} type="button" onClick={() => setOpenFolders((x) => (x.includes(f.id) ? x.filter((y) => y !== f.id) : [...x, f.id]))} aria-expanded={open} data-testid={`life-folder-${f.id}`}
              className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-[13px] font-bold transition sm:min-h-11 sm:gap-3 sm:px-4 sm:text-sm ${dsk === "top" ? "" : "lg:w-full"} ${dsk === "compact" ? "lg:justify-center lg:px-0" : ""} ${here ? "text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>
              <Folder className="h-4 w-4 sm:h-[18px] sm:w-[18px]" /><span className={`whitespace-nowrap ${dsk === "compact" ? "lg:sr-only" : ""}`}>{f.name}</span><ChevronRight className={`ml-auto h-4 w-4 transition ${open ? "rotate-90" : ""} ${dsk === "compact" ? "lg:hidden" : ""}`} />
            </button>, ...(open ? entry.items.map((x) => `nested:${x.id}`) : [])];
          }).map((raw, i) => {
            if (typeof raw !== "string") return raw;
            const nested = raw.startsWith("nested:"), id = (nested ? raw.slice(7) : raw) as FamilySection;
            const Icon = SECTION_ICONS[id];
            const movable = (TOGGLEABLE as readonly FamilySection[]).includes(id);
            const toggleableShown = sections.filter((s) => (TOGGLEABLE as readonly FamilySection[]).includes(s));
            const posInToggleable = toggleableShown.indexOf(id);
            return (
              <div
                key={id}
                draggable={movable}
                onDragStart={movable ? (e) => { setDraggingSection(id); e.dataTransfer.effectAllowed = "move"; } : undefined}
                onDragEnd={movable ? () => setDraggingSection(null) : undefined}
                onDragOver={movable && draggingSection && draggingSection !== id ? (e) => e.preventDefault() : undefined}
                onDrop={movable && draggingSection && draggingSection !== id ? (e) => { e.preventDefault(); moveSectionTo(draggingSection, id); setDraggingSection(null); } : undefined}
                className={`group/navitem flex shrink-0 items-stretch gap-0.5 rounded-xl transition ${dsk === "top" ? "" : "lg:w-full"} ${nested && dsk !== "top" && dsk !== "compact" ? "lg:pl-4" : ""} ${draggingSection === id ? "opacity-40" : ""}`}
              >
                <button
                  onClick={() => setSection(id)}
                  aria-current={shown === id ? "page" : undefined}
                  className={`flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-3 text-[13px] font-bold transition sm:min-h-11 sm:gap-3 sm:px-4 sm:text-sm ${dsk === "top" ? "" : "lg:w-full"} ${dsk === "compact" ? "lg:justify-center lg:px-0" : ""} ${movable ? "cursor-grab active:cursor-grabbing" : ""} ${shown === id ? "bg-[#292446] text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}
                >
                  <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" /><span className={`whitespace-nowrap ${dsk === "compact" ? "lg:sr-only" : ""}`}>{SECTION_INFO[id].label}</span>{badge(id) > 0 && <span className={`ml-auto rounded-lg px-1.5 text-xs font-semibold ${shown === id ? "text-white/70" : "opacity-65"}`}>{badge(id)}</span>}
                </button>
                {movable && (
                  <span className={`hidden shrink-0 flex-col justify-center opacity-0 transition group-hover/navitem:opacity-100 focus-within:opacity-100 ${dsk === "left" || dsk === "right" ? "lg:flex" : ""}`}>
                    <button type="button" onClick={() => moveSectionBy(id, -1)} disabled={posInToggleable <= 0} aria-label={`Move ${SECTION_INFO[id].label} up`} className="flex h-[18px] w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"><ChevronUp className="h-3 w-3" /></button>
                    <button type="button" onClick={() => moveSectionBy(id, 1)} disabled={posInToggleable >= toggleableShown.length - 1} aria-label={`Move ${SECTION_INFO[id].label} down`} className="flex h-[18px] w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"><ChevronDown className="h-3 w-3" /></button>
                  </span>
                )}
              </div>
            );
          })}
        </nav>
        <div className={`hidden px-3 pt-2 ${dsk === "left" || dsk === "right" ? "lg:block" : ""}`}><button type="button" onClick={() => setStore(true)} className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 text-sm font-bold text-slate-500 transition hover:border-violet-300 hover:bg-violet-50 hover:text-[#5f4dc8]" data-testid="lifehub-plugin-store"><ShoppingBag size={18} />App Store</button></div>
        {shown === "tasks" && <>
        <div className="hidden px-6 pb-3 pt-7 lg:block"><span className="text-[11px] font-black uppercase tracking-[.16em] text-slate-400">Tasks</span></div>
        <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 pb-4 pt-3 lg:block lg:space-y-1 lg:border-t-0 lg:px-3 lg:pb-0 lg:pt-0">
          {viewTabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} onClick={() => setView(tab.id)} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-[13px] font-bold transition sm:min-h-11 sm:gap-3 sm:px-4 sm:text-sm lg:w-full ${view === tab.id ? "bg-[#eeeafe] text-[#5f4dc8]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}><Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" /><span>{tab.title}</span><span className="ml-auto rounded-lg px-1.5 text-xs font-semibold opacity-65">{tab.count}</span></button>; })}
        </div>
        <div className="hidden px-6 pb-3 pt-8 lg:flex lg:items-center lg:justify-between"><span className="text-[11px] font-black uppercase tracking-[.16em] text-slate-400">My lists</span><button onClick={() => setAddingList(true)} className="rounded-lg p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-700" title="New list" aria-label="New list"><FolderPlus size={18} /></button></div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:space-y-0.5 lg:px-3">
          <button onClick={() => setSelectedList("all")} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold lg:flex lg:min-h-10 lg:w-full lg:items-center lg:gap-3 ${selectedList === "all" ? "bg-[#f4f2ff] text-[#6c5cce]" : "text-slate-500 hover:bg-slate-50"}`}><Circle size={12} className="hidden lg:block" />Everything</button>
          {data.lists.map(list => <button key={list.id} onClick={() => setSelectedList(list.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold lg:min-h-10 lg:w-full ${selectedList === list.id ? "bg-[#f4f2ff] text-[#6c5cce]" : "text-slate-500 hover:bg-slate-50"}`}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: list.color }} /><span className="max-w-32 truncate">{list.name}</span><span className="ml-auto hidden text-xs opacity-60 lg:inline">{countFor(list.id)}</span></button>)}
          <button onClick={() => setAddingList(true)} className="flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-500 lg:hidden"><Plus size={14} /> List</button>
        </div>
        {addingList && <form onSubmit={createList} className="mx-4 mb-4 flex gap-2 lg:mx-5"><input className={inputClass + " min-w-0"} value={newListName} autoFocus maxLength={60} onChange={e => setNewListName(e.target.value)} placeholder="List name" aria-label="New list name" /><button type="submit" className="rounded-xl bg-[#705ee2] px-3 text-white" aria-label="Save list"><Check size={18} /></button><button type="button" onClick={() => { setAddingList(false); setNewListName(""); }} className="rounded-xl bg-slate-100 px-2 text-slate-500" aria-label="Cancel list"><X size={18} /></button></form>}
        </>}
        <div className={`mt-auto hidden px-5 pb-7 pt-6 ${dsk === "left" || dsk === "right" ? "lg:block" : ""}`}>
          <div className="rounded-2xl bg-[#f4f1ff] p-4">
            <div className="mb-2 inline-flex rounded-xl bg-white p-2 text-[#715fe3]"><Heart size={18} /></div>
            <p className="text-sm font-extrabold text-[#2d2555]">A calmer day starts here.</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Tasks, chores, calendars, plans and bills for the whole family in one simple space.</p>
          </div>
          <button onClick={() => navigate("/")} className="mt-4 flex min-h-10 items-center gap-2 text-xs font-bold text-slate-500 hover:text-violet-700"><ArrowLeft size={15} /> Back to A.R.I.S.E. Reader</button>
        </div>
      </aside>

      <main className={`min-w-0 flex-1 px-3 pb-10 pt-4 sm:px-7 sm:pt-6 lg:px-9 lg:pt-10 xl:px-12 ${shown === "tasks" && layout.menuSide === "top" ? phone.pad.replace(/max-lg:pt-\S+/, "") : phone.pad}`}>
        <div className="mx-auto max-w-[1250px]">
          {shown === "tasks" && <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div><p className="mb-2 text-xs font-extrabold uppercase tracking-[.2em] text-[#7869d7]">Your everyday organizer</p><h1 className="text-3xl font-black tracking-tight text-[#232139] sm:text-4xl">Make room for what matters<span className="text-[#7866e1]">.</span></h1><p className="mt-2 text-sm leading-6 text-slate-500">One place to stay on top of life, work, and everything in between.</p></div>
            <button onClick={openAdd} className="hidden min-h-11 items-center gap-2 rounded-xl bg-[#705de0] px-5 text-sm font-bold text-white shadow-[0_8px_24px_#705de02b] hover:bg-[#604bd4] lg:inline-flex"><Plus size={18} /> New task</button>
          </header>}

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
          {shown !== "tasks" && <div className="mt-2">{shown === "home" && family.widgets.stickies ? <StickyBoard family={family} setFamily={setFamily} makeId={makeId}>{familyContent}</StickyBoard> : familyContent}</div>}
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
