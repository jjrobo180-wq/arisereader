import { EmailWords, ForwardingCard, OPEN_EMAIL_EVENT, openHubEmail, useHubInbox } from "@/components/teacher-hub/HubInbox";
import { markEmailRead } from "@shared/hubInbox";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { DeskSidePicker, FolderEditor, ThemePicker } from "@/components/HubCustomizeExtras";
import { hubThemeOf } from "@shared/appThemes";
import { HubSearch, HubSearchButton, type HubSearchEntry } from "@/components/HubSearch";
import { DailyBrief, useMorningBrief } from "@/components/DailyBrief";
import { buildWorkBrief } from "@shared/dailyBrief";
import { foldMenu, type MenuEntry, type MenuFolder } from "@shared/hubLayout";
import {
  AlertTriangle,
  ArrowLeft,
  BookHeart,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Check,
  CheckSquare,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Home,
  ImagePlus,
  Link2,
  ListChecks,
  LogOut,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Settings2,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
  Flag,
  Target,
  Timer,
  Moon,
  Sun,
  Repeat,
  Users,
  WandSparkles,
  X,
  MoreHorizontal,
  ChevronLeft as RailHide, ChevronRight as RailShow, LayoutGrid as AppsIcon, Search as AppsSearch,
  Trophy, Clapperboard, ShoppingBag, Folder as FolderIcon, ChevronRight as FolderChevron,
  Table, FolderOpen, QrCode,
  type LucideIcon,
} from "lucide-react";
import PluginStore from "@/components/plugin-store/PluginStore";
import SheetsApp from "@/components/family-hub/SheetsApp";
import DriveApp from "@/components/family-hub/DriveApp";
import DropApp from "@/components/family-hub/DropApp";
import { cleanSpreadsheets, type Spreadsheet } from "@shared/sheetsApp";
import { cleanDriveFiles } from "@shared/driveApp";
import { OPEN_STORE_KEY, driveAppPlugin, dropAppPlugin, isAddable, notesAppPlugin, pluginOpens, pluginsFor, setKitInstalled, setWorkKit, setWorkNotesApp, setWorkPlugin, setWorkSheetsApp, sheetsAppPlugin, workInstalled, type Plugin } from "@shared/pluginStore";
import { cleanNotesApp } from "@shared/notesApp";
import { cleanKit, kitDef, type KitRecord } from "@shared/pluginKit";
import KitPlugin from "@/components/plugin-kit/KitPlugin";
import NotesKitApp from "@/components/plugin-kit/NotesKitApp";
import { HubChat } from "@/components/HubChat";
import WidgetBoard from "@/components/widgets/WidgetBoard";
import { cleanWidgets } from "@shared/widgets";
import { kitIcon } from "@/components/plugin-kit/kitIcons";
import { useAuth } from "@/context/AuthContext";
import { Redirect, useLocation } from "wouter";
import { goToSignIn } from "@/lib/hubs";
import { PLANS, usd } from "@shared/plans";
import { addDays, dueState, friendlyDate, relativeDays, type DueState } from "@shared/hubDates";
import { TASK_SORTS, arrangeTasks, clearDone, restoreTasks, saveTask, taskCounts, undoTask, type TaskFilter, type TaskSort } from "@shared/hubTasks";
import { cleanSenderName } from "@shared/hubMeetings";
import { deadlineLabel, meetingDeadline } from "@shared/meetingDeadline";
import { cleanGroupOrder, HUB_GROUPS, SUB_LABELS, groupLabel, groupOf, groupTabs, openGroup, visibleGroups, type HubGroupId } from "@shared/hubTabGroups";
import "@/components/teacher-hub/hubNight.css";
import "./hubThemes.css";
import "@/components/teacher-hub/hubPaper.css";
import { GoalsTab, MinutesTab } from "@/components/teacher-hub/HubProgress";
import WorkspaceBanner from "@/components/teacher-hub/HubBanner";
import { HomeParts, WORK_PARTS, type HomePart } from "@/components/teacher-hub/HubHomeEdit";
import { HOME_SECTIONS, MENU_CLOSES, MENU_SIDES, cleanLayout, isPinId, moveSection, pinId, showSection, unpinId, type HomeSection, type HubLayout } from "@shared/hubLayout";
import { HubModal } from "@/components/teacher-hub/HubModal";
import {
  HUB_IMPORT, HUB_IMPORT_KINDS, clock12, cleanHubImport, describeHubAdded, mergeHubImport, updateStudent,
  type AttendanceEntry, type HubImportItems, type HubTab, type Student, type Task, type Workspace,
} from "@shared/teacherHub";
import { addStudentWithTeam, draftHasAnyone, emptyTeamDraft, teamDraft, teamMembers, updateStudentWithTeam, type StudentDetails, type TeamDraft } from "@shared/hubStudentTeam";
import { StudentTeamFields, StudentTeamSummary } from "@/components/teacher-hub/HubStudentTeam";
import { deleteRow, deleteStudentRecords, studentRecordCount, undoDelete, type Deleted } from "@shared/hubDelete";
import { BottomStack, useToasts, type ToastAction } from "@/components/teacher-hub/HubToast";
import { ConflictDialog, HubDataPanel, SaveBadge, SaveNotice, SizeNotice, downloadHubCopy } from "@/components/teacher-hub/HubSaveUI";
import { useHubWorkspace } from "@/components/teacher-hub/useHubWorkspace";
import HubSetupBanner from "@/components/teacher-hub/HubSetupBanner";
import { Card, Empty, Field, GhostButton, Labeled, PrimaryButton, Select, TextArea } from "@/components/teacher-hub/ui";
import HubMeetingPolls, { type PollStart } from "@/components/teacher-hub/HubMeetingPoll";
import type { WizardState } from "@/components/teacher-hub/HubMeetingSteps";
import { STEP_COUNT, firstOpen, stepsDone } from "@shared/meetingSteps";
import HubNotifications from "@/components/teacher-hub/HubNotifications";
import HubImport, { localDay } from "@/components/teacher-hub/HubImport";
import { RecentlyDone, TaskModal, taskChecker } from "@/components/teacher-hub/HubTaskEdit";
import HubNotes from "@/components/teacher-hub/HubNotes";
import StudentProfileView from "@/components/teacher-hub/HubStudentProfile";
import HubDayHead from "@/components/teacher-hub/HubDayHead";
import HubAgenda from "@/components/teacher-hub/HubAgenda";
import HubPageHead from "@/components/teacher-hub/HubPageHead";
import { weekStart, weeklyMinutes } from "@shared/hubProgress";

/** A wash behind a student's initials, keyed by the area their goals are in. */
const AREA_TINT: Record<string, { bg: string; ink: string }> = {
  Reading: { bg: "#efebff", ink: "#4a2fc2" },
  Math: { bg: "#e4f4f7", ink: "#0e6b7a" },
  Writing: { bg: "#fbeae1", ink: "#9a3412" },
  Behavior: { bg: "#e6f2e8", ink: "#166534" },
  Communication: { bg: "#fdf0e3", ink: "#92400e" },
};
const tintFor = (area: string) => AREA_TINT[area] || { bg: "#f1f0f4", ink: "#4d4859" };
import { HUB_ACCENTS, DEFAULT_ACCENT, cleanAccent, deepenAccent } from "@shared/hubAccent";
import { textOn } from "@shared/hubPins";
import AppleRemindersCard, { useAppleInbox } from "@/components/teacher-hub/HubApple";
import HubPollBell from "@/components/teacher-hub/HubPollBell";
import HubCalendarTab, { AddEventModal, CalendarPanel, useCalendarRefresh } from "@/components/teacher-hub/HubCalendar";
import { addQuickItems, quickAddedMessage, type QuickItems } from "@shared/hubQuickAdd";
import { addEmailToTasks, arrangeEmails, emailCounts, emailTask, toggleEmailFlag, type EmailFilter } from "@shared/hubEmails";
import PinBanners, { PinButton } from "@/components/teacher-hub/HubPins";
import HubSwitch from "@/components/HubSwitch";
import HubMark from "@/components/HubMark";
import { AdminTab } from "@/components/teacher-hub/HubReader";
import { LEARNING_APPS, LearningIcon, openLearning, useLearningAccess } from "@/components/hub-pieces/LearningApps";
import { PlanCard, UpgradeHost, appsBlocked, appsFull, openUpgrade, useTodoPlan } from "@/components/hub-pieces/TodoPlan";
import { appsIn, countsAsApp } from "@shared/todoPlan";
import { ADMIN_SECTIONS, SETTINGS_SECTIONS, adminSectionLabel, settingsSectionLabel, type AdminSection, type SettingsSection } from "@/lib/adminSections";
import HubBehavior from "@/components/teacher-hub/HubBehavior";
import ReaderTools, { READER_TABS, isReaderTab, type ReaderTab } from "@/components/teacher-hub/HubReaderTools";
import { HubEndedNote, HubTrialNote, useHubTrial } from "@/components/HubTrialNote";

// Today where the teacher is (not in London: an evening in Denver is already tomorrow there).
const TODAY = () => localDay();
const id = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const TAB_META: Array<{ id: HubTab; label: string; icon: ReactNode }> = [
  { id: "overview", label: "Home", icon: <Home className="h-4 w-4" /> },
  { id: "calendar", label: "Calendar", icon: <Calendar className="h-4 w-4" /> },
  { id: "caseload", label: "Caseload", icon: <Users className="h-4 w-4" /> },
  { id: "goals", label: "Goals", icon: <Target className="h-4 w-4" /> },
  { id: "minutes", label: "Minutes", icon: <Timer className="h-4 w-4" /> },
  { id: "iep", label: "IEP & Meetings", icon: <CalendarDays className="h-4 w-4" /> },
  { id: "lessons", label: "Lessons", icon: <BookOpen className="h-4 w-4" /> },
  { id: "tasks", label: "Tasks", icon: <CheckSquare className="h-4 w-4" /> },
  { id: "notes", label: "Notes", icon: <StickyNote className="h-4 w-4" /> },
  { id: "reader", label: "Overview", icon: <BookHeart className="h-4 w-4" /> },
  { id: "readerLive", label: "Live quiz", icon: <Trophy className="h-4 w-4" /> },
  { id: "readerScenes", label: "Scenes", icon: <Clapperboard className="h-4 w-4" /> },
  { id: "readerStudents", label: "Students", icon: <Users className="h-4 w-4" /> },
  { id: "readerApprovals", label: "Approvals", icon: <CheckCircle2 className="h-4 w-4" /> },
  { id: "readerParents", label: "Parents", icon: <MessageSquare className="h-4 w-4" /> },
  { id: "readerQuizzes", label: "Quizzes & grading", icon: <ClipboardCheck className="h-4 w-4" /> },
  { id: "readerGames", label: "Game time", icon: <Timer className="h-4 w-4" /> },
  { id: "readerPrizes", label: "Prizes", icon: <Sparkles className="h-4 w-4" /> },
  { id: "arise", label: "Reading records", icon: <BookHeart className="h-4 w-4" /> },
  { id: "admin", label: "Admin console", icon: <Settings2 className="h-4 w-4" /> },
  { id: "behavior", label: "Behavior", icon: <Sparkles className="h-4 w-4" /> },
  { id: "attendance", label: "Attendance", icon: <ClipboardCheck className="h-4 w-4" /> },
  { id: "gradebook", label: "Gradebook", icon: <GraduationCap className="h-4 w-4" /> },
  { id: "parents", label: "Parents", icon: <MessageSquare className="h-4 w-4" /> },
  { id: "schedules", label: "Schedules", icon: <Clock3 className="h-4 w-4" /> },
  { id: "email", label: "Email", icon: <Mail className="h-4 w-4" /> },
];

/** The icon for each place in the menu (see shared/hubTabGroups.ts for which tabs share a place). */
const GROUP_ICON: Record<HubGroupId, ReactNode> = {
  schedules: <Clock3 className="h-4 w-4" />, goals: <Target className="h-4 w-4" />, minutes: <Timer className="h-4 w-4" />,
  notes: <StickyNote className="h-4 w-4" />, lessons: <BookOpen className="h-4 w-4" />, gradebook: <GraduationCap className="h-4 w-4" />,
  attendance: <ClipboardCheck className="h-4 w-4" />, parents: <MessageSquare className="h-4 w-4" />, email: <Mail className="h-4 w-4" />,
  home: <Home className="h-4 w-4" />, calendar: <Calendar className="h-4 w-4" />, caseload: <Users className="h-4 w-4" />,
  iep: <CalendarDays className="h-4 w-4" />, tasks: <CheckSquare className="h-4 w-4" />,
  behavior: <Sparkles className="h-4 w-4" />,
  arise: <BookHeart className="h-4 w-4" />,
};
const tabIcon = (tab: HubTab) => TAB_META.find((t) => t.id === tab)?.icon;

function dateValue(date: string) {
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

// Signed-out visitors get the shared sign-in screen (pages/SignIn.tsx); see AppRoutes.

/** Shown to a teacher without a Arise WorkHub plan. */
function HubPaywall({ isAdmin, embedded = false }: { isAdmin: boolean; embedded?: boolean }) {
  const H = PLANS.hub;
  const features = [
    "Caseloads with accommodations, IEP and reevaluation dates",
    "IEP and meeting timelines",
    "Lesson plans, reminders and to-dos",
    "Check-ins, concerns and meeting notes",
    "Attendance with CSV export, a gradebook and behavior points",
    "Parent contact logs, weekly schedules and an email organizer",
    "Add with AI: paste a list, snap a screenshot, or upload Excel, Word or PDF",
    "Connect your Google, Outlook or Apple calendar",
  ];
  return (
    <div className={embedded ? "" : "min-h-screen bg-slate-100 px-3 py-6 sm:px-5 sm:py-12"}>
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl sm:rounded-[2rem] md:grid-cols-[1.05fr_.95fr]">
        <div className="bg-slate-950 p-6 text-white sm:p-8 md:p-12">
          <div className="mb-6 flex flex-wrap items-center gap-3 md:mb-12">
            <span className="text-xs font-semibold uppercase tracking-[.28em] text-slate-400">A.R.I.S.E.</span>
            <span className="rounded-full border border-teal-300/50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-teal-200">Add-on</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Arise WorkHub</h1>
          <p className="mt-4 text-base leading-7 text-slate-300">Your private teacher workspace, saved to your account and waiting on any device.</p>
          <ul className="mt-6 space-y-3 text-sm leading-6 text-slate-200">
            {features.map((f) => (
              <li key={f} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />{f}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-5 p-6 sm:p-8 md:p-12">
          <div>
            <p className="text-sm font-semibold text-slate-500">Arise WorkHub is a paid add-on</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Get Arise WorkHub</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4">
              <div><div className="font-semibold text-slate-950">One teacher</div><div className="mt-1 text-sm text-slate-600">Up to {H.studentsPerBlock} students. Add {usd(H.monthlyCents)} a month for each extra {H.studentsPerBlock}.</div></div>
              <div className="shrink-0 text-right"><div className="text-xl font-bold text-slate-950">{usd(H.monthlyCents)}</div><div className="text-xs text-slate-500">a month</div></div>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 p-4">
              <div><div className="font-semibold text-slate-950">Whole school</div><div className="mt-1 text-sm text-slate-600">Every teacher gets their own Hub, up to {H.schoolStudentCap.toLocaleString("en-US")} students.</div></div>
              <div className="shrink-0 text-right"><div className="text-xl font-bold text-slate-950">{usd(H.schoolYearlyCents)}</div><div className="text-xs text-slate-500">a year</div></div>
            </div>
          </div>
          <p className="text-sm text-slate-600">Arise WorkHub is sold on its own, and isn't included with A.R.I.S.E. Premium or a free school account. Everything you saved is kept if you add it later.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {!isAdmin && <a href="#/billing" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-slate-950 px-5 text-base font-semibold text-white hover:bg-slate-800" data-testid="hub-get">Get Arise WorkHub</a>}
            {!embedded && <a href="#/workhub" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-200 px-5 text-base font-semibold text-slate-700 hover:bg-slate-50">Back to WorkHub</a>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** WorkHub once the free month is over: the A.R.I.S.E. Reader tools stay, everything else is locked. */
/** Which A.R.I.S.E. Reader tab an old teacher-dashboard link means ("comprehension", "parents"...). */
function readerTabFor(old: string | null): ReaderTab {
  try { sessionStorage.removeItem("teacher_dashboard_tab"); } catch { /* fine */ }
  const map: Record<string, ReaderTab> = {
    students: "readerStudents", "all-students": "readerStudents", pending: "readerApprovals", "book-requests": "readerApprovals", "grade-changes": "readerApprovals",
    parents: "readerParents", proctor: "readerQuizzes", "camera-quizzes": "readerQuizzes", comprehension: "readerQuizzes", "growth-check": "readerQuizzes",
    "club-controls": "readerGames", prizes: "readerPrizes",
  };
  return (old && map[old]) || "reader";
}

/** WorkHub once the free month is over: the A.R.I.S.E. Reader tabs stay, everything else is locked. */
function ReaderOnly({ signOut, isAdmin }: { signOut: () => void; isAdmin: boolean }) {
  const [plans, setPlans] = useState(false);
  const [tab, setTab] = useState<ReaderTab>(() => { try { return readerTabFor(sessionStorage.getItem("teacher_dashboard_tab")); } catch { return "reader"; } });
  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-clip bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="min-w-0"><div className="text-xs font-bold uppercase tracking-[.22em] text-slate-400">Arise</div><div className="truncate text-lg font-bold tracking-tight sm:text-xl">WorkHub</div></div>
          <div className="flex shrink-0 items-center gap-2">
            <HubSwitch current="hub" />
            <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] space-y-4 px-4 py-4 pb-[max(5rem,env(safe-area-inset-bottom))] md:px-6" data-testid="workhub-reader-only">
        <HubEndedNote which="work" upgradeHref="#/billing">
          <button type="button" onClick={() => setPlans((v) => !v)} aria-expanded={plans} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">{plans ? "Hide plans" : "See plans"}</button>
        </HubEndedNote>
        {plans && <div className="-mx-3 sm:mx-0"><HubPaywall isAdmin={isAdmin} embedded /></div>}
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="A.R.I.S.E. Reader">
          {READER_TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`flex min-h-11 flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition ${tab === t ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}>
              {tabIcon(t)} {SUB_LABELS[t] ?? t}
            </button>
          ))}
        </div>
        <ReaderTools tab={tab} openTab={(t) => { if (isReaderTab(t)) setTab(t); }} night={false} />
      </main>
    </div>
  );
}

export default function TeacherHub() {
  const { user } = useAuth();
  // Signing in as someone else starts with a clean page, so one teacher's Hub is never shown to the next.
  return <TeacherHubPage key={user?.id ?? "signed-out"} />;
}

function TeacherHubPage() {
  const { user, token, logout } = useAuth();
  // Coming back from connecting a mailbox lands on the meetings tab, where the polls are.
  // The old teacher dashboard address opens the A.R.I.S.E. Reader tab (see OpenHubTab in App.tsx).
  // Which tab is showing is remembered per account (sessionStorage key below), so a
  // browser refresh lands back where the teacher/parent actually was instead of
  // always resetting to Overview.
  const lastTabKey = `workhub_last_tab_${user?.id ?? "x"}`;
  const [tab, setTabState] = useState<HubTab>(() => {
    if (/[?&]mailbox=/.test(window.location.search)) return "iep";
    try {
      const asked = sessionStorage.getItem("workhub_tab");
      sessionStorage.removeItem("workhub_tab");
      if (asked === "admin") return asked;
      if (asked === "reader") return readerTabFor(sessionStorage.getItem("teacher_dashboard_tab"));
      const remembered = sessionStorage.getItem(lastTabKey);
      if (remembered) return remembered as HubTab;
    } catch { /* Home */ }
    return "overview";
  });
  const setTab = useCallback((next: HubTab | ((prev: HubTab) => HubTab)) => {
    setTabState((prev) => {
      const value = typeof next === "function" ? (next as (prev: HubTab) => HubTab)(prev) : next;
      try { sessionStorage.setItem(lastTabKey, value); } catch { /* not remembered */ }
      return value;
    });
  }, [lastTabKey]);
  // Going to an old address (the old dashboard, #/admin, or back to one) while WorkHub is open picks the tab here.
  const [location] = useLocation();
  useEffect(() => {
    try {
      const asked = sessionStorage.getItem("workhub_tab");
      if (!asked) return;
      sessionStorage.removeItem("workhub_tab");
      if (asked === "admin") setTab("admin");
      else if (asked === "reader") setTab(readerTabFor(sessionStorage.getItem("teacher_dashboard_tab")));
    } catch { /* stays where it is */ }
  }, [location]);
  const [customize, setCustomize] = useState(false);
  // The Arise App Store. It opens straight away when the person switched here from LifeHub's store.
  const [store, setStore] = useState(() => { try { const on = sessionStorage.getItem(OPEN_STORE_KEY) === "1"; sessionStorage.removeItem(OPEN_STORE_KEY); return on; } catch { return false; } });
  // On a phone the header keeps the essentials, and the rest sits under "More".
  const [more, setMore] = useState(false);
  /** The menu strip down the left side on a phone: shown, or tucked away behind a small tab. Remembered on this device. */
  const [rail, setRailState] = useState(() => { try { return localStorage.getItem("arise-hub-rail") !== "closed"; } catch { return true; } });
  /** A WorkHub plugin (from the Plugin Kit) open as its own page. Picking any tab closes it. */
  const [kitOpen, setKitOpen] = useState<string | null>(null);
  /** A Notes-app install (see shared/notesApp.ts) open full-page, by its App Store plugin id. */
  const [notesAppOpen, setNotesAppOpen] = useState<string | null>(null);
  /** Sheets, Drive and Drop: built for LifeHub, offered here too (App Store). Each opens full-page
   *  the same way a Kit plugin or a Notes-app install does. */
  const [sheetsAppOpen, setSheetsAppOpen] = useState<string | null>(null);
  const [driveOpen, setDriveOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  /** The app drawer is open (the "App drawer" menu choice). */
  const [apps, setApps] = useState(false);
  const [appsQuery, setAppsQuery] = useState("");
  /** The folder opened in the app drawer's grid (drilled into by tapping it). Closed drawer or a search clears it. */
  const [hubGridFolder, setHubGridFolder] = useState<string | null>(null);
  useEffect(() => {
    if (!apps) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setApps(false); };
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = overflow; setAppsQuery(""); setHubGridFolder(null); };
  }, [apps]);
  const appsSwipe = useRef<number | null>(null);
  const setRail = (open: boolean) => { setRailState(open); try { localStorage.setItem("arise-hub-rail", open ? "open" : "closed"); } catch { /* not remembered */ } };
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!more) return;
    const close = (e: Event) => { if (!moreRef.current?.contains(e.target as Node)) setMore(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMore(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [more]);
  // Night mode: the choice is remembered on this phone or computer.
  const [night, setNight] = useState(() => { try { return localStorage.getItem("arise-hub-night") === "1"; } catch { return false; } });
  function toggleNight() {
    setNight((v) => { try { localStorage.setItem("arise-hub-night", v ? "0" : "1"); } catch { /* the choice just isn't remembered */ } return !v; });
  }
  // "Add with AI": the panel that reads pasted text, photos and files into the Hub.
  const [adding, setAdding] = useState<{ start?: "photo" | "file" } | null>(null);
  const [added, setAdded] = useState<{ words: string; tab: HubTab | null } | null>(null);
  // The tab used last in each group, so tapping the group opens it again.
  const [lastInGroup, setLastInGroup] = useState<Partial<Record<HubGroupId, HubTab>>>({});
  // Which menu item is being dragged. Must stay with the other hooks: anything
  // below the early returns changes the hook count between renders and React throws.
  const [draggingGroup, setDraggingGroup] = useState<HubGroupId | null>(null);
  // The group's categories dropdown (replaces a second row of sub-tabs). Hooks stay up here:
  // anything below the early returns changes the hook count between renders and React throws.
  const [subMenu, setSubMenu] = useState(false);
  // The quick-add menu: one button for anything that can be added to the Hub.
  const [addMenu, setAddMenu] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  // Which admin-console section the Reader menu has open (the console no longer has its own menu).
  const [adminSection, setAdminSection] = useState<AdminSection>("overview");
  const [adminSettings, setAdminSettings] = useState<SettingsSection>("alerts");
  const subRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!addMenu) return;
    const close = (e: Event) => { if (!addRef.current?.contains(e.target as Node)) setAddMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAddMenu(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [addMenu]);
  useEffect(() => {
    if (!subMenu) return;
    const close = (e: Event) => { if (!subRef.current?.contains(e.target as Node)) setSubMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setSubMenu(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [subMenu]);
  useEffect(() => { setLastInGroup((prev) => (prev[groupOf(tab).id] === tab ? prev : { ...prev, [groupOf(tab).id]: tab })); }, [tab]);

  const canUseHub = !!user && (user.role === "teacher" || user.role === "parent" || user.isAdmin);
  // Opening the Hub and keeping it saved (see useHubWorkspace).
  const sync = useHubWorkspace({ enabled: canUseHub, token, userId: user?.id });
  const { workspace, setWorkspace: setWorkspaceRaw, loaded, loadError, needsPlan, seats, view, bytes } = sync;
  // A.R.I.S.E. To-Do Free: up to 3 App Store apps across WorkHub and LifeHub (shared/todoPlan.ts). A
  // change that would add a 4th is held back here (so a save never fails over it), and the
  // upgrade box opens, at most once every ten minutes so a background refresh can't keep popping it.
  const todoPlan = useTodoPlan();
  const todoPlanRef = useRef(todoPlan);
  todoPlanRef.current = todoPlan;
  const upgradeShownAt = useRef(0);
  const setWorkspace = useCallback((next: Workspace | ((prev: Workspace) => Workspace)) => setWorkspaceRaw((prev) => {
    const value = typeof next === "function" ? next(prev) : next;
    const plan = todoPlanRef.current;
    if (value === prev || !plan || plan.unlimited) return value;
    if (!appsBlocked(plan, "work", appsIn("work", prev), appsIn("work", value))) return value;
    if (Date.now() - upgradeShownAt.current > 10 * 60_000) { upgradeShownAt.current = Date.now(); queueMicrotask(() => openUpgrade("apps")); }
    return prev;
  }), [setWorkspaceRaw]);
  /** "Add with AI" is part of Unlimited: on Free it opens the upgrade box instead. */
  const startAdding = (x: { start?: any }) => { if (todoPlan && !todoPlan.unlimited) openUpgrade("ai"); else setAdding(x); };
  // The teacher's accent, handed to the stylesheet as a pair of custom properties.
  const accent = cleanAccent(workspace.profile.accent) || DEFAULT_ACCENT;
  const trial = useHubTrial(token, "work", canUseHub && !user?.isAdmin);
  const toasts = useToasts();
  const latest = useRef(workspace);
  latest.current = workspace;

  // The "added" message belongs to the screen it appeared on.
  // Picking any tab leaves whichever full-page app was open. It used to clear only the Kit view,
  // so tapping a tab while a Notes app, Sheets, Drive or Drop was open left the screen on that app.
  useEffect(() => { setAdded(null); closeApps(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Connected calendars are read again when the Hub opens.
  useCalendarRefresh(loaded && !loadError && !needsPlan && canUseHub, token, workspace.calendars, setWorkspace, id);
  // Reminders sent from the Apple Reminders app (by an iPhone Shortcut) become to-dos.
  const checkApple = useAppleInbox(loaded && !loadError && !needsPlan && canUseHub, token, TODAY, workspace, setWorkspace, id, (text) => { toasts.show(text, []); });
  // Work emails forwarded to the teacher's Hub address land in Emails, flagged, and on the to-do list.
  useHubInbox(loaded && !loadError && !needsPlan && canUseHub, token, workspace, setWorkspace, id, TODAY, (n) => toasts.show(n === 1 ? "A forwarded email was added to your to-do list." : `${n} forwarded emails were added to your to-do list.`, [{ label: "View", run: () => setTab("tasks") }]));

  // "Open email" on a to-do: go to Emails with that email open, and it is no longer new.
  const [openEmailId, setOpenEmailId] = useState<string | null>(null);
  useEffect(() => {
    const open = (event: Event) => {
      const emailId = String((event as CustomEvent).detail || "");
      if (!emailId) return;
      setWorkspace((p) => markEmailRead(p, emailId));
      setOpenEmailId(emailId);
      setTab("email");
    };
    window.addEventListener(OPEN_EMAIL_EVENT, open);
    return () => window.removeEventListener(OPEN_EMAIL_EVENT, open);
  }, []);

  const [quickEvent, setQuickEvent] = useState(false);
  /** The student whose profile is open on the Caseload tab. It stays open while the teacher looks at another tab and comes back. */
  const [profileStudent, setProfileStudent] = useState<string | null>(null);
  /** Checks a to-do off (or back on) and offers Undo for a few seconds. It can also be undone from "Done in the last day". */
  const checkTask = taskChecker(() => workspace.tasks, setWorkspace, (text, actions) => { toasts.show(text, actions); });
  const undoCheck = (taskId: string) => setWorkspace((p) => ({ ...p, tasks: undoTask(p.tasks, taskId, Date.now()) }));
  /** The to-do being changed from the To do card on Home. */
  const [homeTask, setHomeTask] = useState<string | null>(null);
  const [homeQuick, setHomeQuick] = useState("");
  const openTasks = workspace.tasks.filter((t) => !t.done).length;
  /** The WorkHub apps this teacher added from the App Store, in the order they were added. They get their own place in the menu. */
  const myKits = ((workspace as any).kitInstalled as string[] | undefined ?? []).map((k) => kitDef(k)).filter((d): d is NonNullable<ReturnType<typeof kitDef>> => !!d && d.hub === "work");
  const kitRecords = cleanKit((workspace as any).kitRecords, 8000);
  const setKitRecords = (update: (all: KitRecord[]) => KitRecord[]) => setWorkspace((prev) => ({ ...prev, kitRecords: cleanKit(update(cleanKit((prev as any).kitRecords, 8000)), 8000) }));
  const openKit = (k: string | null) => { setKitOpen(k); if (k) window.scrollTo({ top: 0 }); };
  /** Notes-app plugins (LifeHub Notes, installed here from the Store) this teacher added, same idea as myKits. */
  const myNotesApps = ((workspace as any).notesInstalled as string[] | undefined ?? []).map((id) => notesAppPlugin("work", id)).filter((p): p is Plugin => !!p);
  const notesAppRecords = Object.fromEntries(Object.entries((workspace as any).notesApps ?? {}).map(([pid, list]) => [pid, cleanNotesApp(list)])) as Record<string, ReturnType<typeof cleanNotesApp>>;
  const setNotesAppRecords = (pid: string, update: (all: ReturnType<typeof cleanNotesApp>) => ReturnType<typeof cleanNotesApp>) =>
    setWorkspace((prev) => ({ ...prev, notesApps: { ...(prev as any).notesApps, [pid]: update(cleanNotesApp(((prev as any).notesApps ?? {})[pid])) } }));
  const openNotesApp = (k: string | null) => { setNotesAppOpen(k); if (k) window.scrollTo({ top: 0 }); };
  const mySheetsApps = ((workspace as any).sheetsInstalled as string[] | undefined ?? []).map((id) => sheetsAppPlugin("work", id)).filter((p): p is Plugin => !!p);
  const drivePlugin = (workspace as any).driveInstalled ? driveAppPlugin("work") : undefined;
  const dropPlugin = (workspace as any).dropInstalled ? dropAppPlugin("work") : undefined;
  const hubSheets = cleanSpreadsheets(((workspace as any).sheets ?? {})["work-sheets"]);
  const setHubSheets = (update: (all: Spreadsheet[]) => Spreadsheet[]) =>
    setWorkspace((prev) => ({ ...prev, sheets: { ...((prev as any).sheets ?? {}), "work-sheets": update(cleanSpreadsheets(((prev as any).sheets ?? {})["work-sheets"])) } }));
  const hubDrive = cleanDriveFiles((workspace as any).drive);
  const setHubDrive = (update: (all: ReturnType<typeof cleanDriveFiles>) => ReturnType<typeof cleanDriveFiles>) =>
    setWorkspace((prev) => ({ ...prev, drive: update(cleanDriveFiles((prev as any).drive)) }));
  /** Leaves whichever full-page app is open, so opening one never leaves another behind it. */
  const closeApps = () => { setKitOpen(null); setNotesAppOpen(null); setSheetsAppOpen(null); setDriveOpen(false); setDropOpen(false); };
  // How the teacher arranged the Hub (Customize): where the phone menu sits, how it closes, and what Home shows.
  // Every added Kit plugin and Notes app may be pinned to Home as its own tile (myKits/myNotesApps, just above).
  const pinnableApps = [...myKits.map((d) => d.id), ...myNotesApps.map((p) => p.id)];
  const layout = cleanLayout(workspace.layout, pinnableApps);
  const setLayout = (next: HubLayout) => setWorkspace((p) => ({ ...p, layout: next }));
  const side = layout.menuSide;
  /** The menu runs across the screen (top or bottom) instead of down a side. */
  const across = side === "top" || side === "bottom";
  /** The app drawer: no menu on screen, just a button that opens every section as app icons. */
  const drawerMenu = side === "drawer";
  const menuOpen = layout.menuClose === "always" || rail;
  const canHide = layout.menuClose !== "always";
  /** On a phone the menu may close by itself once a section is picked. */
  const afterPick = () => { if (layout.menuClose === "auto" && typeof window !== "undefined" && window.innerWidth < 768) setRail(false); };
  const pagePad = drawerMenu ? "px-3 sm:px-4" : side === "top" ? `px-3 sm:px-4 ${menuOpen ? "!pt-[84px] md:!pt-4" : "!pt-9 md:!pt-4"}` : side === "bottom" ? "px-3 sm:px-4" : side === "right" ? `pl-3 sm:pl-4 ${menuOpen ? "pr-[80px] sm:pr-[84px]" : "pr-9 sm:pr-10"}` : `pr-3 sm:pr-4 ${menuOpen ? "pl-[80px] sm:pl-[84px]" : "pl-9 sm:pl-10"}`;
  const asidePhone = drawerMenu ? "hidden md:block" : side === "top"
    ? `inset-x-0 top-[65px] border-b px-2 pt-1.5 ${menuOpen ? "translate-y-0" : "-translate-y-full"}`
    : side === "bottom"
    ? `inset-x-0 bottom-0 border-t px-2 pt-1.5 ${menuOpen ? "translate-y-0" : "translate-y-full"}`
    : `bottom-0 top-[65px] w-[72px] ${side === "right" ? "right-0 border-l pr-[env(safe-area-inset-right)]" : "left-0 border-r pl-[env(safe-area-inset-left)]"} ${menuOpen ? "translate-x-0" : side === "right" ? "translate-x-full" : "-translate-x-full"}`;
  // Where the menu sits on a computer (Customize): sidebar left or right, icons only, a top bar, or the app drawer.
  const desk = layout.deskSide;
  const deskDrawer = desk === "drawer", deskTop = desk === "top", deskCompact = desk === "compact";
  const deskGrid = deskDrawer || deskTop ? "md:grid-cols-[minmax(0,1fr)]" : deskCompact ? "md:grid-cols-[76px_minmax(0,1fr)]" : desk === "right" ? "md:grid-cols-[minmax(0,1fr)_220px]" : "md:grid-cols-[220px_minmax(0,1fr)]";
  const deskAside = deskDrawer ? "md:hidden" : deskTop ? "md:top-[65px] md:h-auto md:self-auto" : `md:top-[73px] md:h-[calc(100vh-90px)] md:self-start ${desk === "right" ? "md:order-2" : ""}`;
  const deskList = deskTop ? "md:h-auto md:flex-row md:items-center md:gap-1 md:overflow-x-auto md:rounded-2xl md:border md:border-slate-200 md:bg-white md:p-1.5 md:shadow-sm" : "md:h-full md:flex-col md:gap-2 md:overflow-y-auto md:rounded-2xl md:border md:border-slate-200 md:bg-white md:p-2 md:shadow-sm";
  const [openFolders, setOpenFolders] = useState<string[]>([]);
  /** Whether "A.R.I.S.E. Reader" is expanded in the sidebar to show its tabs (Live quiz, Scenes, Students...) nested underneath, folder-style. */
  const [ariseOpen, setAriseOpen] = useState(false);
  const learningAccess = useLearningAccess(token);
  // The guided tour (WorkHubTour) opens real sections as it goes, so a step can point at the
  // actual screen instead of describing it. It asks with this event; the menu is shown too, so
  // the item it highlights is on screen even when the phone menu was tucked away.
  useEffect(() => {
    const open = (e: Event) => {
      const want = (e as CustomEvent<{ tab?: string }>).detail?.tab;
      if (!want || !TAB_META.some((m) => m.id === want)) return;
      closeApps();
      setCustomize(false);
      setTab(want as HubTab);
      if (groupOf(want as HubTab).id === "arise") setAriseOpen(true);
      setRail(true);
    };
    window.addEventListener("arise-tour:open", open);
    return () => window.removeEventListener("arise-tour:open", open);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const [searching, setSearching] = useState(false);
  const [briefOpen, setBriefOpen] = useMorningBrief("work", TODAY(), loaded && !loadError && !needsPlan && !(workspace as any).briefOff);
  const listPhone = across ? "snap-x gap-1 overflow-x-auto" : "h-full touch-pan-y flex-col gap-1 overflow-y-auto overscroll-contain px-1 py-1.5";
  /** A reminder added from the pop-up lands on another screen, so say where it went. */
  const reminderAdded = (items: QuickItems) => { toasts.show(quickAddedMessage(items), tab === "tasks" ? [] : [{ label: "View", run: () => setTab("tasks") }]); };

  /** Adds what the teacher checked in "Add with AI", and says what happened. */
  function addFound(items: HubImportItems) {
    const safe = cleanHubImport(items, TODAY());
    const result = mergeHubImport(workspace, safe, id, seats);
    setWorkspace((prev) => mergeHubImport(prev, safe, id, seats).workspace);
    const most = HUB_IMPORT_KINDS.filter((kind) => result.added[kind]).sort((a, b) => (result.added[b] || 0) - (result.added[a] || 0))[0];
    setAdded({ words: describeHubAdded(result), tab: most ? HUB_IMPORT[most].tab : null });
    setAdding(null);
  }

  const upcomingMeetings = useMemo(
    () => workspace.meetings.filter((m) => !m.done).sort((a, b) => dateValue(a.date) - dateValue(b.date)).slice(0, 5),
    [workspace.meetings],
  );

  const dueTasks = useMemo(
    () => workspace.tasks.filter((t) => !t.done).sort((a, b) => dateValue(a.dueDate) - dateValue(b.dueDate)).slice(0, 6),
    [workspace.tasks],
  );

  const behaviorTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const entry of workspace.behavior) totals[entry.student] = (totals[entry.student] || 0) + Number(entry.points || 0);
    return totals;
  }, [workspace.behavior]);

  const scheduleWarnings = useMemo(() => {
    const warnings: string[] = [];
    const entries = [...workspace.schedules];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (a.student !== b.student || a.day !== b.day) continue;
        if (a.start < b.end && b.start < a.end) warnings.push(`${a.student}: ${a.day} ${a.label} overlaps ${b.label}`);
      }
    }
    return [...new Set(warnings)];
  }, [workspace.schedules]);

  function update<K extends keyof Workspace>(key: K, value: Workspace[K]) {
    setWorkspace((prev) => ({ ...prev, [key]: value }));
  }

  /** Deletes a row and says so with an Undo button, so one wrong tap costs nothing. */
  function remove<K extends keyof Workspace>(key: K, rowId: string) {
    const result = deleteRow(workspace, key, rowId);
    if (!result) return;
    setWorkspace((prev) => deleteRow(prev, key, rowId)?.workspace ?? prev);
    const actions: ToastAction[] = [{ label: "Undo", run: () => setWorkspace((prev) => undoDelete(prev, result.deleted)) }];
    let text = result.deleted.label;
    let records = 0;
    if (key === "students") {
      const name = String((result.deleted.parts[0].rows[0].row as Student).name);
      records = studentRecordCount(result.workspace, name);
      // Their notes, grades and the rest stay until the teacher says to clear them.
      if (records) {
        text += ` · ${records} ${records === 1 ? "record" : "records"} in your other tabs kept`;
        actions.push({ label: records === 1 ? "Delete it too" : "Delete them too", run: () => clearStudentRecords(name, result.deleted) });
      }
    }
    toasts.show(text, actions, records ? 15_000 : 10_000);
  }

  /** Clears what the other tabs kept under a deleted student's name. One Undo brings back the student and all of it. */
  function clearStudentRecords(name: string, studentDeleted: Deleted) {
    const result = deleteStudentRecords(latest.current, name);
    if (!result) return;
    setWorkspace((prev) => deleteStudentRecords(prev, name)?.workspace ?? prev);
    const count = result.deleted.parts.reduce((total, part) => total + part.rows.length, 0);
    const both: Deleted = { label: `Deleted ${name} and ${count} ${count === 1 ? "record" : "records"}`, parts: [...studentDeleted.parts, ...result.deleted.parts] };
    toasts.show(both.label, [{ label: "Undo", run: () => setWorkspace((prev) => undoDelete(prev, both)) }]);
  }

  function studentOptions(includeAll = false) {
    return (
      <>
        <option value="">Choose student</option>
        {includeAll && <option value="Whole group">Whole group</option>}
        {workspace.students.map((student) => (
          <option key={student.id} value={student.name}>{student.name}</option>
        ))}
      </>
    );
  }

  function exportAttendance() {
    const rows = [["Date", "Student", "Class", "Status"], ...workspace.attendance.map((a) => [a.date, a.student, a.className, a.status])];
    const csv = rows.map((row) => row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "teacher-hub-attendance.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /** Anything still waiting is saved before the sign-out. */
  async function signOut() {
    await sync.flush();
    logout();
    goToSignIn();
  }

  if (!user) return <Redirect to="/signin" replace />;

  if (!canUseHub) {
    return (
      <div className="min-h-screen bg-slate-100 px-5 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-2xl font-bold text-slate-950">Teacher accounts only</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Sign in with an approved teacher account to open the Arise WorkHub.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <GhostButton onClick={() => { logout(); goToSignIn(); }}><LogOut className="h-4 w-4" /> Sign out</GhostButton>
            <a href="#/teacher-signup" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Create teacher account</a>
          </div>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-slate-100 px-5 py-16">
        <div className="mx-auto flex max-w-xl items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          <span className="text-sm font-medium text-slate-700">Opening your Arise WorkHub…</span>
        </div>
      </div>
    );
  }

  // After the free month: only the A.R.I.S.E. Reader tools stay (the rest of WorkHub is kept, but locked).
  if (needsPlan) return <ReaderOnly signOut={signOut} isAdmin={!!user.isAdmin} />;

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-100 px-5 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
          <h1 className="mt-4 text-2xl font-bold text-slate-950">Arise WorkHub could not open</h1>
          <p className="mt-2 text-sm text-slate-600">{loadError}</p>
          <button className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white" onClick={sync.reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  // The admin console shows for admins only.
  const visible = { ...workspace.visibleTabs, admin: !!user.isAdmin };
  const menu = visibleGroups(visible, workspace.groupOrder);
  // Search everything in the Hub (header button, Ctrl/⌘ K or "/") and the Daily Brief app.
  const goTab = (t: HubTab) => { setTab(t); closeApps(); window.scrollTo({ top: 0 }); };
  const searchEntries = ((): HubSearchEntry[] => {
    if (!searching) return [];
    const out: HubSearchEntry[] = [];
    const dateWord = (d: string) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");
    for (const g of menu) for (const t of groupTabs(g.id, visible)) out.push({ id: `tab-${t}`, kind: "Section", title: TAB_META.find((m) => m.id === t)?.label || t, sub: groupLabel(g.id, visible), open: () => goTab(t) });
    // Only when the Daily Brief app is added (App Store), so searching can't open something removed.
    if (!(workspace as any).briefOff) out.push({ id: "brief", kind: "Section", title: "Daily Brief", sub: "Today at a glance", keywords: "morning summary today brief", open: () => setBriefOpen(true) });
    out.push({ id: "customize", kind: "Section", title: "Customize", sub: "Menu, folders and Home", keywords: "settings layout", open: () => setCustomize(true) });
    out.push({ id: "store", kind: "Section", title: "App Store", keywords: "add plugins apps store", open: () => setStore(true) });
    for (const d of myKits) out.push({ id: `kit-${d.id}`, kind: "Plugins", title: d.name, open: () => openKit(d.id) });
    for (const p of myNotesApps) out.push({ id: `notes-app-${p.id}`, kind: "Plugins", title: p.name, open: () => openNotesApp(p.id) });
    for (const st of workspace.students) out.push({ id: st.id, kind: "Students", title: st.name, sub: [st.grade && `Grade ${st.grade}`, st.iepDate && `IEP ${dateWord(st.iepDate)}`].filter(Boolean).join(" · "), keywords: `${st.disability1 || ""} ${st.disability2 || ""}`, open: () => goTab("caseload") });
    for (const t of workspace.tasks) out.push({ id: t.id, kind: "To-dos", title: t.title, sub: [t.done ? "Done" : "", t.dueDate && `Due ${dateWord(t.dueDate)}`].filter(Boolean).join(" · "), keywords: t.notes || "", open: () => goTab("tasks") });
    for (const m of workspace.meetings) out.push({ id: m.id, kind: "Meetings", title: `${m.type}: ${m.student}`, sub: [m.date && dateWord(m.date), m.room].filter(Boolean).join(" · "), keywords: m.notes, open: () => goTab("iep") });
    for (const e of workspace.events) out.push({ id: e.id, kind: "Calendar", title: e.title, sub: [dateWord(e.date), e.location].filter(Boolean).join(" · "), keywords: e.notes, open: () => goTab("calendar") });
    for (const n of workspace.notes) out.push({ id: n.id, kind: "Notes", title: n.title || (n.body || "").slice(0, 60) || "Note", sub: [n.student, dateWord(n.date)].filter(Boolean).join(" · "), keywords: n.body.slice(0, 400), open: () => goTab("notes") });
    for (const l of workspace.lessons) out.push({ id: l.id, kind: "Lessons", title: l.title, sub: [l.subject, l.group, dateWord(l.date)].filter(Boolean).join(" · "), keywords: `${l.objective} ${l.materials}`, open: () => goTab("lessons") });
    for (const g of workspace.goals) out.push({ id: g.id, kind: "Goals", title: `${g.student}: ${g.area}`, sub: g.text.slice(0, 90), keywords: g.text, open: () => goTab("goals") });
    for (const em of workspace.emails) out.push({ id: em.id, kind: "Email", title: em.subject || "(no subject)", sub: em.from, keywords: em.body.slice(0, 300), open: () => goTab("email") });
    return out;
  })();
  const group = groupOf(tab);
  // Dragging (or, on a phone, the arrows) a menu item reorders it right where it sits. Home never moves.
  const moveGroupBy = (id: HubGroupId, dir: -1 | 1) => setWorkspace((prev) => {
    const current = cleanGroupOrder(prev.groupOrder);
    const at = current.indexOf(id);
    const to = at + dir;
    if (at < 0 || to < 0 || to >= current.length) return prev;
    const next = [...current];
    [next[at], next[to]] = [next[to], next[at]];
    return { ...prev, groupOrder: next };
  });
  const moveGroupTo = (id: HubGroupId, beforeId: HubGroupId | null) => setWorkspace((prev) => {
    const current = cleanGroupOrder(prev.groupOrder).filter((g) => g !== id);
    const at = beforeId ? current.indexOf(beforeId) : current.length;
    if (at < 0) return prev;
    current.splice(at, 0, id);
    return { ...prev, groupOrder: current };
  });
  const subTabs = groupTabs(group.id, visible);

  return (
    <div className={`hub-paper min-h-screen w-full max-w-[100vw] overflow-x-clip bg-slate-100 text-slate-950 ${night ? "hub-night" : ""} ${layout.theme && layout.theme !== "classic" ? `hub-theme-${layout.theme}` : ""}`}
      style={{ "--hub-accent": accent, "--hub-accent-deep": deepenAccent(accent) } as React.CSSProperties}>
      <UpgradeHost hub="work" />
      {store && canUseHub && loaded && !loadError && !needsPlan && <PluginStore
        hub="work"
        night={night}
        accent={accent}
        teacher
        isInstalled={(p: Plugin) => workInstalled(p, workspace.visibleTabs, (workspace as any).kitInstalled, !!(workspace as any).aiChat, !!(workspace as any).widgetsOn, (workspace as any).notesInstalled, !!(workspace as any).briefOff, (workspace as any).sheetsInstalled, !!(workspace as any).driveInstalled, !!(workspace as any).dropInstalled)}
        onToggle={(p: Plugin, on: boolean) => {
          // Free has room for 3 App Store apps (across both hubs): a 4th opens the upgrade box instead.
          if (on && countsAsApp("work", p) && appsFull(todoPlan, "work", appsIn("work", workspace))) { openUpgrade("apps"); return; }
          // The Widgets board is a part of Home: adding it shows that part, removing it hides it again.
          setWorkspace((prev) => (p.target.kind === "brief" ? { ...prev, briefOff: !on }
            : p.target.kind === "sheetsApp" ? { ...prev, sheetsInstalled: setWorkSheetsApp((prev as any).sheetsInstalled, p, on) }
            : p.target.kind === "driveApp" ? { ...prev, driveInstalled: on }
            : p.target.kind === "dropApp" ? { ...prev, dropInstalled: on }
            : p.target.kind === "widget" ? { ...prev, widgetsOn: on, layout: showSection(cleanLayout(prev.layout), "widgets", on) } : p.target.kind === "assistant" ? { ...prev, aiChat: on } : p.target.kind === "kit"
            ? { ...prev, kitInstalled: setWorkKit((prev as any).kitInstalled, p, on) } : p.target.kind === "notesApp"
            ? { ...prev, notesInstalled: setWorkNotesApp((prev as any).notesInstalled, p, on) }
            : { ...prev, visibleTabs: setWorkPlugin(prev.visibleTabs, p, on) }));
          if (p.target.kind === "assistant" && on) toasts.show("AI assistant added. Tap the ✦ button at the bottom right to chat.", []);
          if (p.target.kind === "widget" && on) toasts.show("Widgets added to Home. Tap Add widget to pick your first one.", []);
          if (p.target.kind === "kit") { if (on) toasts.show(`${p.name} added. Find it in your menu.`, []); else if (kitOpen === p.target.id) setKitOpen(null); }
          if (p.target.kind === "notesApp" && on) toasts.show(`${p.name} added. Find it in your menu.`, []);
          if (p.target.kind === "sheetsApp" || p.target.kind === "driveApp" || p.target.kind === "dropApp") {
            if (on) toasts.show(`${p.name} added. Find it in your menu.`, []); else closeApps();
          }
        }}
        kit={{
          records: kitRecords,
          setRecords: setKitRecords,
          today: TODAY(),
          makeId: id,
        }}
        notesApp={{
          notes: notesAppRecords,
          setNotes: setNotesAppRecords,
          makeId: id,
        }}
        onOpen={(p: Plugin) => { const at = pluginOpens(p); if (at && "tab" in at) setTab(at.tab); if (p.target.kind === "widget") setTab("overview"); if (p.target.kind === "brief") setBriefOpen(true); if (p.target.kind === "sheetsApp") { closeApps(); setSheetsAppOpen(p.target.id); } if (p.target.kind === "driveApp") { closeApps(); setDriveOpen(true); } if (p.target.kind === "dropApp") { closeApps(); setDropOpen(true); } setStore(false); if (p.target.kind === "assistant") toasts.show("Tap the ✦ button at the bottom right to chat.", []); if (p.target.kind === "assistantPro") window.location.hash = "#/billing"; }}
        onClose={() => setStore(false)}
      />}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3 md:px-6">
          <a href="#/workhub" onClick={(e) => { e.preventDefault(); setTab("overview"); }} className="flex min-w-0 items-center gap-2 rounded-xl" aria-label="WorkHub home" title="WorkHub home">
            <span className="flex h-7 w-7 shrink-0 overflow-hidden rounded-lg sm:h-8 sm:w-8"><HubMark tone="work" className="h-full w-full" /></span>
            <span className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">WorkHub</span>
          </a>
          <div className="flex shrink-0 items-center gap-2">
            <HubSwitch current="hub" night={night} />
            <HubSearchButton onOpen={() => setSearching(true)} />
            <span className="hidden sm:contents"><SaveBadge view={view} /></span>
            <HubPollBell token={token} userId={user?.id} enabled={canUseHub && loaded && !loadError && !needsPlan} onOpenMeetings={() => setTab("iep")} />
            <button type="button" onClick={toggleNight} aria-pressed={night} aria-label={night ? "Switch to day mode" : "Switch to night mode"} title={night ? "Day mode" : "Night mode"} className="hidden min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-slate-700 transition hover:bg-slate-50 sm:inline-flex" data-testid="hub-night-toggle">{night ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
            {/* On a phone this lives in the floating add button instead, so the header stays clear. */}
            <button type="button" onClick={() => startAdding({})} className="hidden min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 sm:inline-flex sm:px-4" data-testid="hub-add-with-ai">
              <WandSparkles className="h-4 w-4" /> <span>Add<span className="hidden sm:inline"> with AI</span></span>
            </button>
            <button type="button" onClick={() => setStore(true)} aria-label="App Store" title="App Store" className="hidden min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:inline-flex" data-testid="hub-plugin-store"><ShoppingBag className="h-4 w-4" /> <span className="hidden lg:inline">App Store</span></button>
            <button type="button" onClick={() => setCustomize((v) => !v)} aria-label="Customize your Hub" aria-expanded={customize} data-tour="customize" className="hidden min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:inline-flex"><Settings2 className="h-4 w-4" /> <span className="hidden lg:inline">Customize</span></button>
            <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out" className="hidden min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:inline-flex"><LogOut className="h-4 w-4" /></button>
            <div ref={moreRef} className="relative sm:hidden">
              <button type="button" onClick={() => setMore((v) => !v)} aria-label="More" aria-haspopup="menu" aria-expanded={more} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50" data-testid="hub-more"><MoreHorizontal className="h-5 w-5" /></button>
              {more && (
                <div role="menu" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl" data-testid="hub-more-menu">
                  <div role="status" data-testid="hub-more-save" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600">
                    {view.kind === "retrying" || view.kind === "blocked"
                      ? <><AlertTriangle className="h-4 w-4 text-red-600" /><span className="font-semibold text-red-700">Not saved</span></>
                      : view.kind === "waiting" || view.kind === "saving"
                        ? <><Save className="h-4 w-4" />Saving…</>
                        : <><CheckCircle2 className="h-4 w-4 text-emerald-600" />Saved</>}
                  </div>
                  <button type="button" role="menuitem" onClick={() => { toggleNight(); setMore(false); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">{night ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{night ? "Day mode" : "Night mode"}</button>
                  <button type="button" role="menuitem" onClick={() => { setCustomize((v) => !v); setMore(false); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"><Settings2 className="h-4 w-4" />Customize</button>
                  <button type="button" role="menuitem" onClick={signOut} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"><LogOut className="h-4 w-4" />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className={`mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)] gap-3 py-3 transition-[padding] duration-200 sm:gap-4 sm:py-4 ${pagePad} ${deskGrid} md:px-6`}>
        {!menuOpen && !drawerMenu && <button type="button" onClick={() => setRail(true)} aria-label="Show menu" data-testid="hub-rail-show"
          className={`fixed z-30 inline-flex items-center justify-center border border-slate-200 bg-white text-slate-600 shadow-md md:hidden ${side === "top" ? "left-1/2 top-[65px] h-7 w-14 -translate-x-1/2 rounded-b-xl border-t-0" : side === "bottom" ? "bottom-0 left-1/2 h-7 w-14 -translate-x-1/2 rounded-t-xl border-b-0 pb-[env(safe-area-inset-bottom)]" : side === "right" ? "right-0 top-[77px] h-14 w-7 rounded-l-xl border-r-0" : "left-0 top-[77px] h-14 w-7 rounded-r-xl border-l-0"}`}>
          {side === "top" ? <ChevronDown className="h-5 w-5" /> : side === "bottom" ? <ChevronUp className="h-5 w-5" /> : side === "right" ? <RailHide className="h-5 w-5" /> : <RailShow className="h-5 w-5" />}</button>}
        {(drawerMenu || deskDrawer) && !apps && (
          <button type="button" onClick={() => setApps(true)} aria-label="Open all sections" data-testid="hub-apps-open"
            onTouchStart={(e) => { appsSwipe.current = e.touches[0].clientY; }} onTouchMove={(e) => { if (appsSwipe.current !== null && appsSwipe.current - e.touches[0].clientY > 30) { appsSwipe.current = null; setApps(true); } }}
            className={`fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-40 h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-slate-950 text-white shadow-xl transition active:scale-90 ${drawerMenu ? "inline-flex" : "hidden"} ${deskDrawer ? "md:inline-flex" : "md:hidden"}`}>
            <AppsIcon className="h-6 w-6" />
          </button>
        )}
        {(drawerMenu || deskDrawer) && (
          <div className={`fixed inset-0 z-[70] ${drawerMenu ? "" : "max-md:hidden"} ${deskDrawer ? "" : "md:hidden"} ${apps ? "" : "pointer-events-none"}`} aria-hidden={!apps}>
            <div className={`absolute inset-0 bg-slate-950/30 transition-opacity duration-200 ${apps ? "opacity-100" : "opacity-0"}`} onClick={() => setApps(false)} />
            <div role="dialog" aria-modal="true" aria-label="All sections" data-testid="hub-apps"
              className={`absolute inset-x-0 bottom-0 top-[max(2.5rem,env(safe-area-inset-top))] mx-auto flex max-w-3xl flex-col rounded-t-[2rem] md:top-16 bg-white shadow-2xl transition-transform duration-300 ease-out ${apps ? "translate-y-0" : "translate-y-full"}`}
              onTouchStart={(e) => { appsSwipe.current = e.touches[0].clientY; }}
              onTouchEnd={(e) => { const from = appsSwipe.current; appsSwipe.current = null; const list = document.getElementById("hub-apps-list"); if (from !== null && e.changedTouches[0].clientY - from > 90 && (!list || list.scrollTop <= 0)) setApps(false); }}>
              <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300" aria-hidden />
              {(() => {
                const hubSearching = appsQuery.trim().length > 0;
                const hubOpenFolder: MenuFolder | null = !hubSearching && hubGridFolder ? layout.folders.find((f) => f.id === hubGridFolder) ?? null : null;
                // Searching looks across every group, folders included (flattened), so nothing tucked away becomes unfindable.
                // Not searching, at the top level: a folder collapses to one tile, via foldMenu, until tapped open.
                // Inside a folder: just its own groups.
                const hubEntries: MenuEntry<(typeof menu)[number]>[] = hubSearching
                  ? menu.filter((item) => groupLabel(item.id, visible).toLowerCase().includes(appsQuery.trim().toLowerCase())).map((item) => ({ kind: "item" as const, item }))
                  : hubOpenFolder
                  ? hubOpenFolder.items.map((id) => menu.find((m) => m.id === id)).filter((m): m is (typeof menu)[number] => !!m).map((item) => ({ kind: "item" as const, item }))
                  : foldMenu(menu, layout.folders);
                return (<>
                  <div className="flex items-center gap-2 px-4 pb-3 pt-3">
                    {hubOpenFolder && <button type="button" onClick={() => setHubGridFolder(null)} aria-label="Back to all sections" tabIndex={apps ? 0 : -1} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" data-testid="hub-apps-back"><ArrowLeft className="h-5 w-5" /></button>}
                    <label className="flex min-h-11 flex-1 items-center gap-2 rounded-2xl bg-slate-100 px-3">
                      <AppsSearch className="h-4 w-4 shrink-0 text-slate-500" />
                      <input value={appsQuery} onChange={(e) => setAppsQuery(e.target.value)} placeholder={hubOpenFolder ? `Search ${hubOpenFolder.name}` : "Search"} aria-label="Search sections" tabIndex={apps ? 0 : -1} className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-500" />
                    </label>
                    <button type="button" onClick={() => setApps(false)} aria-label="Close" tabIndex={apps ? 0 : -1} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                  </div>
                  {hubOpenFolder && <p className="-mt-1 px-4 pb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{hubOpenFolder.name}</p>}
                  <ul id="hub-apps-list" className="grid flex-1 grid-cols-4 content-start sm:grid-cols-6 gap-x-2 gap-y-5 overflow-y-auto overscroll-contain px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1">
                    {!hubOpenFolder && LEARNING_APPS.filter((a) => a.label.toLowerCase().includes(appsQuery.trim().toLowerCase())).map((a) => { const Icon = a.icon; const has = learningAccess[a.id]; return (
                      <li key={`learn-${a.id}`}>
                        <button type="button" tabIndex={apps ? 0 : -1} onClick={() => { setApps(false); openLearning(a.id, has); }} data-testid={`hub-app-learning-${a.id}`}
                          className="flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 text-center transition active:scale-90">
                          <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-[1.1rem] text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${a.color}, ${a.color}cc)` }}><Icon className="h-7 w-7" />{!has && <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 text-[9px] font-bold shadow" style={{ color: a.color }}>Add</span>}</span>
                          <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-800">{a.label}</span>
                        </button>
                      </li>
                    ); })}
                    {!hubOpenFolder && "app store".includes(appsQuery.trim().toLowerCase()) && (
                      <li>
                        <button type="button" tabIndex={apps ? 0 : -1} onClick={() => { setApps(false); setStore(true); }} data-testid="hub-app-store"
                          className="flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 text-center transition active:scale-90">
                          <span className="inline-flex h-14 w-14 items-center justify-center rounded-[1.1rem] text-white shadow-sm" style={{ backgroundColor: "var(--hub-accent, #5b3be0)" }}><ShoppingBag className="h-7 w-7" /></span>
                          <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-800">App Store</span>
                        </button>
                      </li>
                    )}
                    {!hubOpenFolder && myKits.filter((d) => d.name.toLowerCase().includes(appsQuery.trim().toLowerCase())).map((d) => { const Icon = kitIcon(d.icon); return (
                      <li key={`kit-${d.id}`} className="order-last">
                        <button type="button" tabIndex={apps ? 0 : -1} onClick={() => { openKit(d.id); setApps(false); }} data-testid={`hub-app-kit-${d.id}`} className="flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 text-center transition active:scale-90">
                          <span className="inline-flex h-14 w-14 items-center justify-center rounded-[1.1rem] text-white shadow-sm" style={{ backgroundColor: d.color }}><Icon className="h-7 w-7" /></span>
                          <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-800">{d.name}</span>
                        </button>
                      </li>
                    ); })}
                    {!hubOpenFolder && myNotesApps.filter((p) => p.name.toLowerCase().includes(appsQuery.trim().toLowerCase())).map((p) => (
                      <li key={`notes-app-${p.id}`} className="order-last">
                        <button type="button" tabIndex={apps ? 0 : -1} onClick={() => { openNotesApp(p.id); setApps(false); }} data-testid={`hub-app-notes-app-${p.id}`} className="flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 text-center transition active:scale-90">
                          <span className="inline-flex h-14 w-14 items-center justify-center rounded-[1.1rem] text-white shadow-sm" style={{ backgroundColor: p.color }}><StickyNote className="h-7 w-7" /></span>
                          <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-800">{p.name}</span>
                        </button>
                      </li>
                    ))}
                    {hubEntries.map((entry) => entry.kind === "item" ? (
                      <li key={entry.item.id}>
                        <button type="button" tabIndex={apps ? 0 : -1} onClick={() => { setTab(openGroup(entry.item.id, visible, lastInGroup)); closeApps(); setApps(false); }} data-testid={`hub-app-${entry.item.id}`}
                          className="flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 text-center transition active:scale-90">
                          <span className={`inline-flex h-14 w-14 items-center justify-center rounded-[1.1rem] shadow-sm [&_svg]:h-7 [&_svg]:w-7 ${group.id === entry.item.id ? "bg-teal-700 text-white" : "bg-slate-950 text-white"}`}>{GROUP_ICON[entry.item.id]}</span>
                          <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-800">{groupLabel(entry.item.id, visible)}</span>
                        </button>
                      </li>
                    ) : (
                      <li key={`folder-${entry.folder.id}`}>
                        <button type="button" tabIndex={apps ? 0 : -1} onClick={() => setHubGridFolder(entry.folder.id)} data-testid={`hub-app-folder-${entry.folder.id}`} aria-label={`Open folder ${entry.folder.name}`} className="relative flex w-full flex-col items-center gap-1.5 rounded-2xl p-1 text-center transition active:scale-90">
                          <span className="grid h-14 w-14 grid-cols-2 gap-0.5 rounded-[1.1rem] bg-slate-200 p-2 shadow-sm">{Array.from({ length: 4 }, (_, i) => <span key={i} className="flex items-center justify-center rounded-[5px] bg-white text-slate-400 [&_svg]:h-3 [&_svg]:w-3">{entry.items[i] ? GROUP_ICON[entry.items[i].id] : null}</span>)}</span>
                          <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-800"><FolderIcon className="mr-0.5 -mt-0.5 inline h-2.5 w-2.5 text-slate-400" />{entry.folder.name}</span>
                        </button>
                      </li>
                    ))}
                    {!hubEntries.length && hubOpenFolder && <li className="col-span-full py-10 text-center text-sm text-slate-400">This folder is empty.</li>}
                  </ul>
                </>);
              })()}
            </div>
          </div>
        )}
        <aside data-tour="hub-menu" className={`fixed z-30 min-w-0 transition-transform duration-200 ${asidePhone} border-slate-200 bg-white/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:sticky md:left-auto md:right-auto md:w-auto md:translate-x-0 md:translate-y-0 md:border-0 md:px-0 md:pt-0 md:inset-x-auto md:bottom-auto md:z-30 md:border-0 md:bg-transparent md:p-0 ${deskAside}`} aria-hidden={menuOpen ? undefined : true}>
          <div className={`flex ${listPhone} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${deskList}`}>
            {canHide && <button type="button" onClick={() => setRail(false)} aria-label="Hide menu" className={`flex min-h-11 ${across ? "min-w-11 px-2" : "w-full"} shrink-0 flex-col items-center justify-center rounded-xl text-[10px] font-semibold text-slate-500 hover:bg-slate-100 md:hidden`} data-testid="hub-rail-hide">{side === "top" ? <ChevronUp className="h-5 w-5" /> : side === "bottom" ? <ChevronDown className="h-5 w-5" /> : side === "right" ? <RailShow className="h-5 w-5" /> : <RailHide className="h-5 w-5" />}Hide</button>}
            <div className={`hidden px-3 py-3 ${deskTop || deskCompact ? "" : "md:block"}`}>
              <p className="truncate text-sm font-semibold text-slate-900">{user.displayName}</p>
              <p className="truncate text-xs text-slate-500">@{user.username}</p>
            </div>
            {(() => {
              const navItem = (item: (typeof menu)[number], i: number, nested = false) => {
              const movable = item.id !== "home";
              return (
                <div
                  key={item.id}
                  draggable={movable}
                  onDragStart={movable ? (e) => { setDraggingGroup(item.id); e.dataTransfer.effectAllowed = "move"; } : undefined}
                  onDragEnd={movable ? () => setDraggingGroup(null) : undefined}
                  onDragOver={movable && draggingGroup && draggingGroup !== item.id ? (e) => e.preventDefault() : undefined}
                  onDrop={movable && draggingGroup && draggingGroup !== item.id ? (e) => { e.preventDefault(); moveGroupTo(draggingGroup, item.id); setDraggingGroup(null); } : undefined}
                  className={`group/navitem flex ${across ? "snap-start" : "w-full"} shrink-0 items-stretch ${deskTop ? "md:w-auto" : "md:w-full"} ${nested && !deskTop && !deskCompact ? "md:pl-4" : ""} gap-0.5 rounded-xl transition ${draggingGroup === item.id ? "opacity-40" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => { setTab(openGroup(item.id, visible, lastInGroup)); closeApps(); afterPick(); }}
                    aria-current={group.id === item.id && !kitOpen ? "page" : undefined}
                    data-testid={`hub-menu-${item.id}`}
                    data-hub-nav
                    className={`flex min-h-[52px] min-w-0 flex-1 cursor-grab flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-center text-[10px] font-semibold transition active:cursor-grabbing md:min-h-11 md:flex-row ${deskCompact ? "md:justify-center" : "md:justify-start"} md:gap-2 md:px-3 md:py-2 md:text-left md:text-sm md:font-medium ${group.id === item.id && !kitOpen ? "" : "text-slate-500 hover:text-slate-950 md:hover:bg-slate-100"}`}
                  >
                    {GROUP_ICON[item.id]}
                    <span className={`${across ? "max-w-[72px]" : "max-w-[62px]"} truncate whitespace-nowrap md:max-w-none md:whitespace-normal ${deskCompact ? "md:sr-only" : ""}`}>{groupLabel(item.id, visible)}</span>
                  </button>
                  {movable && (
                    <span className={`hidden shrink-0 flex-col justify-center opacity-0 transition group-hover/navitem:opacity-100 focus-within:opacity-100 ${deskTop || deskCompact || nested ? "" : "md:flex"}`}>
                      <button type="button" onClick={() => moveGroupBy(item.id, -1)} disabled={i <= 1} aria-label={`Move ${groupLabel(item.id, visible)} up`} className="flex h-[18px] w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"><ChevronUp className="h-3 w-3" /></button>
                      <button type="button" onClick={() => moveGroupBy(item.id, 1)} disabled={i >= menu.length - 1} aria-label={`Move ${groupLabel(item.id, visible)} down`} className="flex h-[18px] w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"><ChevronDown className="h-3 w-3" /></button>
                    </span>
                  )}
                </div>
              );
              };
              /** A.R.I.S.E. Reader's own row: one sub-item, folder-style, for each of its tabs. */
              const subItem = (t: HubTab, nested: boolean) => (
                <div key={t} className={`flex ${across ? "snap-start" : "w-full"} shrink-0 ${deskTop ? "md:w-auto" : "md:w-full"} ${nested && !deskTop && !deskCompact ? "md:pl-4" : ""}`}>
                  <button type="button" onClick={() => { setTab(t); closeApps(); afterPick(); }} aria-current={tab === t && !kitOpen ? "page" : undefined} data-testid={`hub-menu-${t}`} data-hub-nav
                    className={`flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-center text-[10px] font-semibold transition md:min-h-11 md:flex-row ${deskCompact ? "md:justify-center" : "md:justify-start"} md:gap-2 md:px-3 md:py-2 md:text-left md:text-sm md:font-medium ${tab === t && !kitOpen ? "" : "text-slate-500 hover:text-slate-950 md:hover:bg-slate-100"}`}>
                    {tabIcon(t)}
                    <span className={`${across ? "max-w-[72px]" : "max-w-[62px]"} truncate whitespace-nowrap md:max-w-none md:whitespace-normal ${deskCompact ? "md:sr-only" : ""}`}>{SUB_LABELS[t] ?? TAB_META.find((m) => m.id === t)?.label ?? t}</span>
                  </button>
                </div>
              );
              /** One of the admin console's sections (depth 2) or one of Settings' parts (depth 3), nested under Admin console. Desktop only. */
              const adminItem = (s: { id: string; label: string; icon: LucideIcon }, depth: 2 | 3, on: boolean, pick: () => void, testId: string) => (
                <div key={testId} className={`hidden ${deskTop ? "md:w-auto" : "md:w-full"} shrink-0 md:flex ${deskTop || deskCompact ? "" : depth === 2 ? "md:pl-8" : "md:pl-12"}`}>
                  <button type="button" onClick={() => { pick(); closeApps(); afterPick(); }} aria-current={on ? "page" : undefined} title={s.label} data-testid={testId} data-hub-nav
                    className={`flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-1.5 text-left text-sm transition ${deskCompact ? "justify-center" : "justify-start"} ${depth === 3 ? "text-[13px]" : ""} ${on ? "font-semibold" : "font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-950"}`}>
                    <s.icon className={`${depth === 3 ? "h-3.5 w-3.5" : "h-4 w-4"} shrink-0`} />
                    <span className={`truncate ${deskCompact ? "sr-only" : ""}`}>{s.label}</span>
                  </button>
                </div>
              );
              /** "Arise Learning": Math, History and Connect, each in its own color, right under A.R.I.S.E. Reader. */
              const readerBlock = (() => {
                  const tabs = groupTabs("arise", visible);
                  const here = group.id === "arise" && !kitOpen;
                  const open = ariseOpen || here;
                  return <Fragment key="group-arise">
                    <div className={`flex ${across ? "snap-start" : "w-full"} shrink-0 ${deskTop ? "md:w-auto" : "md:w-full"}`}>
                      {/* Same style as the other Arise Learning programs (a colored icon tile). Pressing it
                          jumps straight to the Reader Overview, so a teacher always lands somewhere. */}
                      <button type="button" onClick={() => { setTab("reader"); setAriseOpen(true); closeApps(); afterPick(); }} aria-expanded={open} aria-current={here ? "page" : undefined} data-testid="hub-menu-arise" data-hub-nav
                        className={`flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-center text-[10px] font-semibold transition md:min-h-11 md:flex-row ${deskCompact ? "md:justify-center" : "md:justify-start"} md:gap-2.5 md:px-3 md:py-1.5 md:text-left md:text-sm ${here ? "bg-violet-50 text-violet-900 md:font-bold" : "text-slate-700 hover:text-slate-950 md:hover:bg-slate-100"}`}>
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm" style={{ background: "linear-gradient(135deg, #6d28d9, #6d28d9cc)" }}>{GROUP_ICON.arise}</span>
                        <span className={`${across ? "max-w-[72px]" : "max-w-[62px]"} truncate whitespace-nowrap md:hidden`}>Reader</span>
                        <span className={`hidden truncate md:inline ${deskCompact ? "md:sr-only" : ""}`}>A.R.I.S.E. Reader</span>
                        <FolderChevron
                          onClick={(e) => { e.stopPropagation(); setAriseOpen((v) => !v); }}
                          role="button" aria-label={`${open ? "Collapse" : "Expand"} A.R.I.S.E. Reader tabs`}
                          className={`hidden h-3.5 w-3.5 shrink-0 text-slate-400 transition md:ml-auto ${deskCompact || deskTop ? "" : "md:block"} ${open ? "rotate-90" : ""}`} />
                      </button>
                    </div>
                    {open && tabs.map((t) => <Fragment key={t}>
                      {subItem(t, true)}
                      {/* The admin console's sections (and Settings' own parts) open up right under
                          Admin console here, so on desktop they sit with the rest of the Reader's
                          items instead of in a bar across the top of the page. Phones keep the bar,
                          since their menu is a strip along the edge with no room to nest. */}
                      {t === "admin" && tab === "admin" && ADMIN_SECTIONS.map((s) => <Fragment key={`admin-${s.id}`}>
                        {adminItem(s, 2, tab === "admin" && adminSection === s.id && !kitOpen, () => { setAdminSection(s.id); setTab("admin"); }, s.id === "overview" ? "hub-menu-admin-overview" : `hub-menu-admin-${s.id}`)}
                        {s.id === "settings" && adminSection === "settings" && SETTINGS_SECTIONS.map((p) => adminItem(p, 3, adminSettings === p.id && !kitOpen, () => { setAdminSettings(p.id); setAdminSection("settings"); setTab("admin"); }, `hub-menu-admin-settings-${p.id}`))}
                      </Fragment>)}
                    </Fragment>)}
                  </Fragment>;
              })();
              const learning = <Fragment key="learning">
                <div className={`hidden items-center gap-2 px-3 pb-1 pt-4 ${deskTop || deskCompact ? "" : "md:flex"}`} data-testid="hub-learning-heading">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Arise Learning</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-sky-300 via-amber-300 to-pink-300" aria-hidden />
                </div>
                {readerBlock}
                {LEARNING_APPS.map((a) => {
                  const has = learningAccess[a.id];
                  return (
                    <div key={`learn-${a.id}`} className={`flex ${across ? "snap-start" : "w-full"} shrink-0 ${deskTop ? "md:w-auto" : "md:w-full"}`}>
                      <button type="button" onClick={() => { afterPick(); openLearning(a.id, has); }} data-testid={`hub-learning-${a.id}`} data-hub-nav
                        title={has ? `Open ${a.label}` : `${a.label}: add it from your plan page`}
                        className={`flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-center text-[10px] font-semibold text-slate-700 transition hover:text-slate-950 md:min-h-11 md:flex-row ${deskCompact ? "md:justify-center" : "md:justify-start"} md:gap-2.5 md:px-3 md:py-1.5 md:text-left md:text-sm md:hover:bg-slate-100`}>
                        <LearningIcon id={a.id} />
                        <span className={`${across ? "max-w-[72px]" : "max-w-[62px]"} truncate whitespace-nowrap md:hidden`}>{a.short}</span>
                        <span className={`hidden truncate md:inline ${deskCompact ? "md:sr-only" : ""}`}>{a.label}</span>
                        {!has && <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold md:ml-auto ${deskCompact || deskTop ? "" : "md:inline"}`} style={{ background: a.soft, color: a.color }}>Add-on</span>}
                      </button>
                    </div>
                  );
                })}
              </Fragment>;
              return foldMenu(menu, layout.folders).map((entry) => {
                // A.R.I.S.E. Reader lives in the Arise Learning section, right below Home.
                if (entry.kind === "item" && entry.item.id === "arise") return null;
                if (entry.kind === "item" && entry.item.id === "home") return <Fragment key="home-and-learning">{navItem(entry.item, menu.indexOf(entry.item))}{learning}</Fragment>;
                if (entry.kind === "item") return navItem(entry.item, menu.indexOf(entry.item));
                const f = entry.folder, here = entry.items.some((x) => x.id === group.id) && !kitOpen;
                const open = openFolders.includes(f.id) || here;
                return <Fragment key={`folder-${f.id}`}>
                  <div className={`flex ${across ? "snap-start" : "w-full"} shrink-0 ${deskTop ? "md:w-auto" : "md:w-full"}`}>
                    <button type="button" onClick={() => setOpenFolders((x) => (x.includes(f.id) ? x.filter((y) => y !== f.id) : [...x, f.id]))} aria-expanded={open} data-testid={`hub-folder-${f.id}`} data-hub-nav
                      className={`flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-center text-[10px] font-semibold transition md:min-h-11 md:flex-row ${deskCompact ? "md:justify-center" : "md:justify-start"} md:gap-2 md:px-3 md:py-2 md:text-left md:text-sm md:font-medium ${here ? "text-slate-950" : "text-slate-500 hover:text-slate-950 md:hover:bg-slate-100"}`}>
                      <FolderIcon className="h-4 w-4" />
                      <span className={`${across ? "max-w-[72px]" : "max-w-[62px]"} truncate whitespace-nowrap md:max-w-none ${deskCompact ? "md:sr-only" : ""}`}>{f.name}</span>
                      <FolderChevron className={`hidden h-3.5 w-3.5 shrink-0 transition md:ml-auto ${deskCompact || deskTop ? "" : "md:block"} ${open ? "rotate-90" : ""}`} />
                    </button>
                  </div>
                  {open && entry.items.filter((item) => item.id !== "arise").map((item) => navItem(item, menu.indexOf(item), true))}
                </Fragment>;
              });
            })()}
            {(myKits.length > 0 || myNotesApps.length > 0 || mySheetsApps.length > 0 || drivePlugin || dropPlugin) && <p className={`hidden px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 ${deskTop || deskCompact ? "" : "md:block"}`}>My apps</p>}
            {myKits.map((d) => {
              const Icon = kitIcon(d.icon);
              return (
                <div key={`kit-${d.id}`} className={`flex ${across ? "snap-start" : "w-full"} shrink-0 ${deskTop ? "md:w-auto" : "md:w-full"}`}>
                  <button type="button" onClick={() => { closeApps(); openKit(d.id); afterPick(); }} aria-current={kitOpen === d.id ? "page" : undefined} data-testid={`hub-kit-${d.id}`} data-hub-nav
                    className={`flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-center text-[10px] font-semibold transition md:min-h-11 md:flex-row md:justify-start md:gap-2 md:px-3 md:py-2 md:text-left md:text-sm md:font-medium ${kitOpen === d.id ? "" : "text-slate-500 hover:text-slate-950 md:hover:bg-slate-100"}`}>
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: d.color }}><Icon className="h-3.5 w-3.5" /></span>
                    <span className={`${across ? "max-w-[72px]" : "max-w-[62px]"} truncate whitespace-nowrap md:max-w-none md:whitespace-normal ${deskCompact ? "md:sr-only" : ""}`}>{d.name}</span>
                  </button>
                </div>
              );
            })}
            {myNotesApps.map((p) => (
              <div key={`notes-app-${p.id}`} className={`flex ${across ? "snap-start" : "w-full"} shrink-0 ${deskTop ? "md:w-auto" : "md:w-full"}`}>
                <button type="button" onClick={() => { closeApps(); openNotesApp(p.id); afterPick(); }} aria-current={notesAppOpen === p.id ? "page" : undefined} data-testid={`hub-notes-app-${p.id}`} data-hub-nav
                  className={`flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-center text-[10px] font-semibold transition md:min-h-11 md:flex-row md:justify-start md:gap-2 md:px-3 md:py-2 md:text-left md:text-sm md:font-medium ${notesAppOpen === p.id ? "" : "text-slate-500 hover:text-slate-950 md:hover:bg-slate-100"}`}>
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: p.color }}><StickyNote className="h-3.5 w-3.5" /></span>
                  <span className={`${across ? "max-w-[72px]" : "max-w-[62px]"} truncate whitespace-nowrap md:max-w-none md:whitespace-normal ${deskCompact ? "md:sr-only" : ""}`}>{p.name}</span>
                </button>
              </div>
            ))}
            {mySheetsApps.map((a) => (
              <div key={`sheets-app-${a.id}`} className={`flex ${across ? "snap-start" : "w-full"} shrink-0 ${deskTop ? "md:w-auto" : "md:w-full"}`}>
                <button type="button" onClick={() => { closeApps(); setSheetsAppOpen(a.id); afterPick(); }} aria-current={sheetsAppOpen === a.id ? "page" : undefined} data-testid={`hub-sheets-app-${a.id}`} data-hub-nav
                  className={`flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-center text-[10px] font-semibold transition md:min-h-11 md:flex-row md:justify-start md:gap-2 md:px-3 md:py-2 md:text-left md:text-sm md:font-medium ${sheetsAppOpen === a.id ? "" : "text-slate-500 hover:text-slate-950 md:hover:bg-slate-100"}`}>
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: a.color }}><Table className="h-3.5 w-3.5" /></span>
                  <span className={`${across ? "max-w-[72px]" : "max-w-[62px]"} truncate whitespace-nowrap md:max-w-none md:whitespace-normal ${deskCompact ? "md:sr-only" : ""}`}>{a.name}</span>
                </button>
              </div>
            ))}
            {drivePlugin && (
              <div key={"drive-app"} className={`flex ${across ? "snap-start" : "w-full"} shrink-0 ${deskTop ? "md:w-auto" : "md:w-full"}`}>
                <button type="button" onClick={() => { closeApps(); setDriveOpen(true); afterPick(); }} aria-current={driveOpen ? "page" : undefined} data-testid={"hub-drive-app"} data-hub-nav
                  className={`flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-center text-[10px] font-semibold transition md:min-h-11 md:flex-row md:justify-start md:gap-2 md:px-3 md:py-2 md:text-left md:text-sm md:font-medium ${driveOpen ? "" : "text-slate-500 hover:text-slate-950 md:hover:bg-slate-100"}`}>
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: drivePlugin.color }}><FolderOpen className="h-3.5 w-3.5" /></span>
                  <span className={`${across ? "max-w-[72px]" : "max-w-[62px]"} truncate whitespace-nowrap md:max-w-none md:whitespace-normal ${deskCompact ? "md:sr-only" : ""}`}>{drivePlugin.name}</span>
                </button>
              </div>
            )}
            {dropPlugin && (
              <div key={"drop-app"} className={`flex ${across ? "snap-start" : "w-full"} shrink-0 ${deskTop ? "md:w-auto" : "md:w-full"}`}>
                <button type="button" onClick={() => { closeApps(); setDropOpen(true); afterPick(); }} aria-current={dropOpen ? "page" : undefined} data-testid={"hub-drop-app"} data-hub-nav
                  className={`flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-center text-[10px] font-semibold transition md:min-h-11 md:flex-row md:justify-start md:gap-2 md:px-3 md:py-2 md:text-left md:text-sm md:font-medium ${dropOpen ? "" : "text-slate-500 hover:text-slate-950 md:hover:bg-slate-100"}`}>
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: dropPlugin.color }}><QrCode className="h-3.5 w-3.5" /></span>
                  <span className={`${across ? "max-w-[72px]" : "max-w-[62px]"} truncate whitespace-nowrap md:max-w-none md:whitespace-normal ${deskCompact ? "md:sr-only" : ""}`}>{dropPlugin.name}</span>
                </button>
              </div>
            )}
            <div className={`flex ${across ? "snap-start" : "w-full"} shrink-0 md:mt-2 md:w-full md:border-t md:border-slate-100 md:pt-2`}>
              <button type="button" onClick={() => { setStore(true); afterPick(); }} data-testid="hub-menu-app-store" data-hub-store
                className="flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-center text-[10px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 md:min-h-11 md:flex-row md:justify-start md:gap-2 md:px-3 md:py-2 md:text-left md:text-sm md:font-medium">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: "var(--hub-accent, #5b3be0)" }}><ShoppingBag className="h-3.5 w-3.5" /></span>
                <span className={`${across ? "max-w-[72px]" : "max-w-[62px]"} truncate whitespace-nowrap md:max-w-none md:whitespace-normal`}>App Store</span>
              </button>
            </div>
          </div>
        </aside>

        <main data-tour="hub-content" className={`min-w-0 space-y-7 pb-[max(5rem,env(safe-area-inset-bottom))] sm:space-y-9 ${(kitOpen && kitDef(kitOpen)) || (notesAppOpen && notesAppPlugin("work", notesAppOpen)) || sheetsAppOpen || driveOpen || dropOpen ? "[&>*:not([data-kit-view])]:hidden" : ""}`}>
          {kitOpen && kitDef(kitOpen) && (
            <div data-kit-view className="space-y-3" data-testid="hub-kit-view">
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setKitOpen(null)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><RailHide className="h-4 w-4" /> Back</button>
                <button type="button" onClick={() => setStore(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"><ShoppingBag className="h-4 w-4" /> App Store</button>
              </div>
              <KitPlugin key={kitOpen} def={kitDef(kitOpen)!} records={kitRecords} setRecords={setKitRecords} today={TODAY()} makeId={id} say={(m) => toasts.show(m, [])} />
            </div>
          )}
          {notesAppOpen && notesAppPlugin("work", notesAppOpen) && (
            <div data-kit-view className="space-y-3" data-testid="hub-notes-app-view">
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setNotesAppOpen(null)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><RailHide className="h-4 w-4" /> Back</button>
                <button type="button" onClick={() => setStore(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"><ShoppingBag className="h-4 w-4" /> App Store</button>
              </div>
              <NotesKitApp key={notesAppOpen} name={notesAppPlugin("work", notesAppOpen)!.name} blurb={notesAppPlugin("work", notesAppOpen)!.description}
                notes={notesAppRecords[notesAppOpen] ?? []} setNotes={(update) => setNotesAppRecords(notesAppOpen, update)} makeId={id} say={(m) => toasts.show(m, [])} />
            </div>
          )}
          {sheetsAppOpen && (
            <div data-kit-view className="space-y-3" data-testid="hub-sheets-app-view">
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={closeApps} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><RailHide className="h-4 w-4" /> Back</button>
                <button type="button" onClick={() => setStore(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"><ShoppingBag className="h-4 w-4" /> App Store</button>
              </div>
              <SheetsApp name="Sheets" blurb="A real spreadsheet: text or number cells, and formulas like SUM and AVERAGE." sheets={hubSheets} setSheets={setHubSheets} makeId={id} say={(m) => toasts.show(m, [])} />
            </div>
          )}
          {driveOpen && (
            <div data-kit-view className="space-y-3" data-testid="hub-drive-app-view">
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={closeApps} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><RailHide className="h-4 w-4" /> Back</button>
                <button type="button" onClick={() => setStore(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"><ShoppingBag className="h-4 w-4" /> App Store</button>
              </div>
              <DriveApp files={hubDrive} setFiles={setHubDrive} say={(m) => toasts.show(m, [])} token={token} />
            </div>
          )}
          {dropOpen && (
            <div data-kit-view className="space-y-3" data-testid="hub-drop-app-view">
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={closeApps} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><RailHide className="h-4 w-4" /> Back</button>
                <button type="button" onClick={() => setStore(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"><ShoppingBag className="h-4 w-4" /> App Store</button>
              </div>
              <DropApp say={(m) => toasts.show(m, [])} token={token} />
            </div>
          )}
          <HubTrialNote trial={trial} which="work" upgradeHref="#/billing" />
          <HubSetupBanner token={token} isAdmin={!!user.isAdmin} />
          <PinBanners workspace={workspace} setWorkspace={setWorkspace} />
          <SizeNotice bytes={bytes} onDownload={() => downloadHubCopy(workspace)} />
          {added && (
            <div className="flex flex-col gap-2 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950 sm:flex-row sm:items-center sm:justify-between" role="status" data-testid="hub-added">
              <span>{added.words}</span>
              <span className="flex shrink-0 items-center gap-2">
                {added.tab && added.tab !== tab && (
                  <button type="button" onClick={() => { setTab(added.tab!); setAdded(null); }} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
                    Open {TAB_META.find((t) => t.id === added.tab)?.label}
                  </button>
                )}
                <button type="button" onClick={() => setAdded(null)} aria-label="Dismiss" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-teal-900 hover:bg-teal-100"><X className="h-4 w-4" /></button>
              </span>
            </div>
          )}
          {customize && (
            <Card title="Customize" right={<button onClick={() => setCustomize(false)} className="min-h-11 text-sm font-medium text-slate-500">Close</button>}>
              <PlanCard hub="work" hubApps={appsIn("work", workspace)} />
              <button type="button" onClick={() => { setCustomize(false); window.dispatchEvent(new Event("arise-tour:start")); }} className="mb-3 flex w-full items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-left text-sm font-semibold text-violet-900 hover:bg-violet-100" data-testid="hub-take-tour"><Sparkles className="h-4 w-4 shrink-0" /> Take the tour: see where everything is in your WorkHub</button>
              <button type="button" onClick={() => { setStore(true); setCustomize(false); }} className="mb-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3 text-left text-sm text-slate-600 hover:bg-slate-50" data-testid="customize-plugin-store"><ShoppingBag className="h-5 w-5 shrink-0 text-slate-500" /><span><span className="block font-semibold text-slate-900">Browse the App Store</span>Add apps, tabs and connections to your WorkHub, or switch over to LifeHub's.</span></button>
              <div className="mb-6 grid gap-5 lg:grid-cols-2" data-testid="customize-layout">
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-slate-900">Menu on your phone</h3>
                  <p className="mb-3 text-sm text-slate-600">Where it sits, and how it closes. The computer menu has its own choices below.</p>
                  <div role="radiogroup" aria-label="Where the menu sits" className="mb-3 flex flex-wrap gap-2">
                    {MENU_SIDES.map((o) => <button key={o.id} type="button" role="radio" aria-checked={layout.menuSide === o.id} onClick={() => { setLayout({ ...layout, menuSide: o.id }); setRail(true); }} data-testid={`menu-side-${o.id}`}
                      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${layout.menuSide === o.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{o.label}</button>)}
                  </div>
                  {layout.menuSide === "drawer" ? <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">A round button at the bottom of the screen opens every section as app icons, with a search box. Swipe it up or tap it; swipe down or tap outside to close.</p> : <div role="radiogroup" aria-label="How the menu closes" className="grid gap-2">
                    {MENU_CLOSES.map((o) => <button key={o.id} type="button" role="radio" aria-checked={layout.menuClose === o.id} onClick={() => { setLayout({ ...layout, menuClose: o.id }); setRail(true); }} data-testid={`menu-close-${o.id}`}
                      className={`flex min-h-11 items-start gap-3 rounded-xl border px-3 py-2 text-left text-sm ${layout.menuClose === o.id ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                      <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 rounded-full border-2 ${layout.menuClose === o.id ? "border-[5px] border-slate-950" : "border-slate-300"}`} aria-hidden />
                      <span><span className="block font-semibold text-slate-900">{o.label}</span><span className="block text-xs text-slate-500">{o.detail}</span></span>
                    </button>)}
                  </div>}
                </div>
                <div className="space-y-6">
                  <DeskSidePicker layout={layout} setLayout={setLayout} dark="#020617" />
                  <ThemePicker layout={layout} setLayout={setLayout} dark="#020617" />
                  <FolderEditor layout={layout} setLayout={setLayout} makeId={id} items={menu.filter((m) => m.id !== "home").map((m) => ({ id: m.id, label: groupLabel(m.id, visible) }))} />
                </div>
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-slate-900">Home screen</h3>
                  <p className="mb-3 text-sm text-slate-600">Turn parts on or off and move them up or down. The picture box shows a photo of your choice; tap Style on it to add one.</p>
                  <ul className="space-y-1.5" aria-label="Parts of Home">
                    {layout.home.map((id, i) => {
                      const on = !layout.homeHidden.includes(id);
                      // A pinned App Store app (pin:<id>) is listed by its own name; it is not one of the built-in parts.
                      const label = HOME_SECTIONS.find((x) => x.id === id)?.label ?? (isPinId(id) ? (myKits.find((d) => d.id === unpinId(id))?.name ?? myNotesApps.find((p) => p.id === unpinId(id))?.name) : undefined) ?? id;
                      return (
                        <li key={id} className={`flex min-h-11 items-center gap-2 rounded-xl border px-2 ${on ? "border-slate-200 bg-white" : "border-dashed border-slate-200 bg-slate-50"}`} data-testid={`home-part-${id}`}>
                          <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 px-1 text-sm">
                            <input type="checkbox" className="h-5 w-5 shrink-0" checked={on} onChange={(e) => setLayout(showSection(layout, id, e.target.checked))} />
                            <span className={on ? "font-medium text-slate-900" : "text-slate-500"}>{label}</span>
                          </label>
                          <button type="button" onClick={() => setLayout(moveSection(layout, id, -1))} disabled={i === 0} aria-label={`Move ${label} up`} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                          <button type="button" onClick={() => setLayout(moveSection(layout, id, 1))} disabled={i === layout.home.length - 1} aria-label={`Move ${label} down`} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                        </li>
                      );
                    })}
                  </ul>
                  <button type="button" onClick={() => setLayout({ ...layout, home: HOME_SECTIONS.map((x) => x.id), homeHidden: (workspace as any).widgetsOn ? ["picture"] : ["picture", "widgets"], homeSize: {} })} className="mt-2 min-h-11 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4">Reset Home to the usual layout</button>
                </div>
              </div>
              <div className="mb-5">
                <h3 className="mb-1 text-sm font-semibold text-slate-900">Accent colour</h3>
                <p className="mb-3 text-sm text-slate-600">The one colour the Hub is tinted with: buttons, links, today's bar and anything chosen.</p>
                <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap items-center gap-2">
                  {HUB_ACCENTS.map((c) => (
                    <button key={c.hex} type="button" role="radio" aria-checked={accent === c.hex} aria-label={c.name} title={c.name}
                      onClick={() => setWorkspace((p) => ({ ...p, profile: { ...p.profile, accent: c.hex } }))}
                      data-testid={`hub-accent-${c.name.toLowerCase()}`}
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border-2 ${accent === c.hex ? "border-slate-900" : "border-white ring-1 ring-slate-300"}`}
                      style={{ backgroundColor: c.hex }}>
                      {accent === c.hex && <Check className="h-4 w-4" style={{ color: textOn(c.hex) }} />}
                    </button>
                  ))}
                  <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">Any colour
                    <input type="color" value={accent} aria-label="Pick any accent colour" data-testid="hub-accent-any"
                      onChange={(e) => setWorkspace((p) => ({ ...p, profile: { ...p.profile, accent: e.target.value } }))}
                      className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" />
                  </label>
                </div>
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-900">Tabs</h3>
              <p className="mb-4 text-sm text-slate-600">Hide anything you do not use. Hiding a tab does not delete its records. Tabs that go together share one place in the menu. To reorder the menu, drag an item in it (or use its arrows on hover).</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {cleanGroupOrder(workspace.groupOrder).map((id) => HUB_GROUPS.find((g) => g.id === id)!)
                  .map((g) => ({ ...g, tabs: g.tabs.filter((t) => !isReaderTab(t) && t !== "admin") })).filter((g) => g.tabs.length)
                  .map((g) => {
                    return (
                      <div key={g.id} className="rounded-xl border border-slate-200 p-2" data-testid={`customize-${g.id}`}>
                        {g.tabs.length > 1 && <div className="flex items-center gap-2 px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{GROUP_ICON[g.id]}{g.label}</div>}
                        {g.tabs.map((t) => (
                          <label key={t} className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg px-1 text-sm">
                            <span className="flex items-center gap-2">{g.tabs.length > 1 ? tabIcon(t) : GROUP_ICON[g.id]}{g.tabs.length > 1 ? SUB_LABELS[t] : g.label}</span>
                            <input
                              type="checkbox" className="h-5 w-5 shrink-0"
                              checked={workspace.visibleTabs[t] !== false}
                              onChange={(e) => setWorkspace((prev) => ({
                                ...prev,
                                visibleTabs: { ...prev.visibleTabs, [t]: e.target.checked },
                              }))}
                            />
                          </label>
                        ))}
                      </div>
                    );
                  })}
              </div>
              <HubDataPanel workspace={workspace} bytes={bytes} token={token} onAdopt={sync.adopt} />
            </Card>
          )}

          {subTabs.length > 1 && (
            // On desktop the sidebar lists every A.R.I.S.E. Reader sub-tab, and under Admin console
            // its sections and Settings' parts, so this dropdown would only repeat them there. It
            // earns its keep on phones, and on desktop only in the drawer layout, which has no
            // sidebar showing.
            <div ref={subRef} className={`relative ${deskDrawer ? "" : "md:hidden"}`} data-testid="hub-subtabs">
              <button type="button" onClick={() => setSubMenu((v) => !v)} aria-haspopup="menu" aria-expanded={subMenu} aria-label={`${group.label} categories`} data-testid="hub-subtabs-button"
                className="flex min-h-11 w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-left text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 sm:px-4">
                {tabIcon(tab)}
                <span className="min-w-0 flex-1 truncate">{tab === "admin" ? `Admin console · ${adminSectionLabel(adminSection)}${adminSection === "settings" ? ` · ${settingsSectionLabel(adminSettings)}` : ""}` : SUB_LABELS[tab] ?? group.label}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${subMenu ? "rotate-180" : ""}`} />
              </button>
              {subMenu && (
                <div role="menu" aria-label={group.label} data-testid="hub-subtabs-menu"
                  className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  {subTabs.filter((t) => t !== "admin").map((t) => (
                    <button key={t} type="button" role="menuitem" aria-current={tab === t ? "page" : undefined} onClick={() => { setTab(t); setSubMenu(false); }} data-testid={`hub-subtab-${t}`}
                      className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition ${tab === t ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-50"}`}>
                      {tabIcon(t)} {SUB_LABELS[t] ?? t}
                    </button>
                  ))}
                  {subTabs.includes("admin") && (
                    <>
                      <div className="mt-1 border-t border-slate-100 px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Admin console</div>
                      {ADMIN_SECTIONS.map((s) => {
                        const on = tab === "admin" && adminSection === s.id;
                        return (
                          <button key={s.id} type="button" role="menuitem" aria-current={on ? "page" : undefined}
                            onClick={() => { setAdminSection(s.id); setTab("admin"); setSubMenu(false); }}
                            data-testid={s.id === "overview" ? "hub-subtab-admin" : `hub-subtab-admin-${s.id}`}
                            className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold transition ${on ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-50"}`}>
                            <s.icon className="h-4 w-4 shrink-0" /> {s.label}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "overview" && (
            <>
              {(() => {
                // Home in the teacher's order. Press and hold (or Edit Home) to arrange it right here; Customize sets the same order.
                // Widened past Record<HomeSection, ...> below so a pinned Kit plugin or Notes app (see pinId) can add its own entry.
                const part: Record<string, ReactNode> = {
                  day: (
              <HubDayHead workspace={workspace} firstName={user.displayName.split(" ")[0]} onOpenCalendar={() => setTab("calendar")} />
                  ),
                  picture: (
              <WorkspaceBanner workspace={workspace} setWorkspace={setWorkspace} firstName={user.displayName.split(" ")[0]} stats={[{ label: "Students", value: workspace.students.length }, { label: "Open to-dos", value: openTasks }, { label: "Meetings ahead", value: upcomingMeetings.length }]} />
                  ),
                  agenda: (
              <HubAgenda workspace={workspace} onOpenCalendar={() => setTab("calendar")} onOpenMeetings={() => setTab("iep")} />
                  ),
                  add: (
              <Card title="Add things fast" collapseKey="home-add">
                <p className="mb-4 text-sm text-slate-600">Skip the typing. AI reads what you give it and sorts it into your Hub, and you check it before anything is saved.</p>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <QuickAdd icon={<WandSparkles className="h-5 w-5" />} title="Paste or ask" detail="A list, notes, an email, or “plan my week”" onClick={() => startAdding({})} />
                  <QuickAdd icon={<ImagePlus className="h-5 w-5" />} title="Photo or screenshot" detail="Reminders, notes or a calendar" onClick={() => startAdding({ start: "photo" })} />
                  <QuickAdd icon={<Upload className="h-5 w-5" />} title="Upload a file" detail="Excel, Word, PDF or CSV" onClick={() => startAdding({ start: "file" })} />
                  <QuickAdd icon={<Link2 className="h-5 w-5" />} title="Connect a calendar" detail="Google, Outlook or Apple" onClick={() => setTab("calendar")} />
                </div>
              </Card>
                  ),
                  calendar: (
              <CalendarPanel workspace={workspace} setWorkspace={setWorkspace} token={token} makeId={id} title="Your calendar" onReminderAdded={reminderAdded} agendaToday collapseKey="home-calendar" />
                  ),
                  meetings: (
              <Card title="Upcoming IEP / reevaluation meetings" collapseKey="home-meetings">
                {upcomingMeetings.length ? (
                  <div className="space-y-2">
                    {upcomingMeetings.map((m) => (
                      <button key={m.id} onClick={() => setTab("iep")} className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-3 text-left hover:bg-slate-100">
                        <div className="min-w-0 flex-1"><div className="break-words font-medium">{m.student || "Student"}</div><div className="text-xs text-slate-500">{m.type}</div></div>
                        <div className="max-w-[50%] text-right text-sm font-semibold text-slate-700">{m.date ? friendlyDate(m.date, TODAY()) : "No date"}{m.time ? ` · ${clock12(m.time)}` : ""}</div>
                      </button>
                    ))}
                  </div>
                ) : <Empty>No upcoming meetings yet.</Empty>}
              </Card>
                  ),
                  todo: (
              <Card title="To do" collapseKey="home-todo" right={<button type="button" onClick={() => setTab("tasks")} className="min-h-11 shrink-0 text-sm font-medium text-teal-800 underline decoration-teal-200 underline-offset-4" data-testid="home-tasks-all">See all{openTasks > dueTasks.length ? ` ${openTasks}` : ""}</button>}>
                <form onSubmit={(e) => { e.preventDefault(); const title = homeQuick.trim(); if (!title) return; setWorkspace((p) => ({ ...p, tasks: saveTask(p.tasks, null, { title, dueDate: "", recurring: "", priority: false }, id) })); setHomeQuick(""); }} className="mb-3 flex gap-2" data-testid="home-task-add">
                  <Field placeholder="Add a to-do and press Enter" aria-label="Quick add a to-do" value={homeQuick} onChange={(e) => setHomeQuick(e.target.value)} maxLength={200} />
                  <PrimaryButton type="submit" disabled={!homeQuick.trim()}>Add</PrimaryButton>
                </form>
                {dueTasks.length ? (
                  <ul className="space-y-2">
                    {dueTasks.map((task) => <TaskRow key={task.id} task={task} today={TODAY()} workspace={workspace} setWorkspace={setWorkspace} makeId={id} onToggle={checkTask} onEdit={(t) => setHomeTask(t.id)} onDelete={(t) => remove("tasks", t.id)} />)}
                  </ul>
                ) : <Empty>Nothing due right now.</Empty>}
                <RecentlyDone tasks={workspace.tasks} onUndo={undoCheck} limit={4} />
              </Card>
                  ),
                  widgets: (workspace as any).widgetsOn ? (
              <WidgetBoard items={(workspace as any).widgetItems} makeId={id} accent="bg-slate-950"
                setItems={(update) => setWorkspace((prev) => ({ ...prev, widgetItems: update(cleanWidgets((prev as any).widgetItems)) }))} />
                  ) : null,
                  notifications: (
              <HubNotifications token={token} />
                  ),
                  profile: (
              <Card title="Workspace profile" collapseKey="home-profile">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field placeholder="School" value={workspace.profile.school} onChange={(e) => setWorkspace((p) => ({ ...p, profile: { ...p.profile, school: e.target.value } }))} />
                  <Field placeholder="Grade / band" value={workspace.profile.gradeBand} onChange={(e) => setWorkspace((p) => ({ ...p, profile: { ...p.profile, gradeBand: e.target.value } }))} />
                  <Field placeholder="Subject / role" value={workspace.profile.subject} onChange={(e) => setWorkspace((p) => ({ ...p, profile: { ...p.profile, subject: e.target.value } }))} />
                </div>
              </Card>
                  ),
                };
                // Any added Kit plugin or Notes app can be pinned to Home too (see pinnableApps, above):
                // a small tile that opens straight into it, same as tapping it in the menu or app drawer.
                const pinTile = (Icon: typeof StickyNote, color: string, title: string, tagline: string, onClick: () => void) => (
                  <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: color }} aria-hidden><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-900">{title}</span><span className="block truncate text-sm text-slate-500">{tagline}</span></span>
                  </button>
                );
                const pinnedCatalog: HomePart[] = [
                  ...myKits.map((d) => ({ id: pinId(d.id), label: d.name, icon: kitIcon(d.icon) })),
                  ...myNotesApps.map((p) => ({ id: pinId(p.id), label: p.name, icon: StickyNote })),
                ];
                for (const d of myKits) part[pinId(d.id)] = pinTile(kitIcon(d.icon), d.color, d.name, d.tagline, () => openKit(d.id));
                for (const p of myNotesApps) part[pinId(p.id)] = pinTile(StickyNote, p.color, p.name, p.tagline, () => openNotesApp(p.id));
                const quick = pluginsFor("work", { teacher: true }).filter((p) => isAddable(p) && (p.target.kind === "tab" || p.target.kind === "kit" || p.target.kind === "assistant" || p.target.kind === "widget") && !workInstalled(p, workspace.visibleTabs, (workspace as any).kitInstalled, !!(workspace as any).aiChat, !!(workspace as any).widgetsOn))
                  .map((plugin) => ({ plugin, onAdd: () => {
                    setWorkspace((prev) => (plugin.target.kind === "widget" ? { ...prev, widgetsOn: true, layout: showSection(cleanLayout(prev.layout), "widgets", true) } : plugin.target.kind === "assistant" ? { ...prev, aiChat: true } : plugin.target.kind === "kit" ? { ...prev, kitInstalled: setWorkKit((prev as any).kitInstalled, plugin, true) } : { ...prev, visibleTabs: setWorkPlugin(prev.visibleTabs, plugin, true) }));
                    toasts.show(plugin.target.kind === "widget" ? "Widgets added to Home." : `${plugin.name} added to your menu.`, []);
                  } }));
                return <HomeParts parts={part} layout={layout} onChange={setLayout} plugins={quick} onOpenStore={() => setStore(true)} catalog={[...WORK_PARTS, ...pinnedCatalog]} homeLayout={hubThemeOf(layout.theme).homeLayout} />;
              })()}
            </>
          )}

          {tab !== "overview" && tab !== "caseload" && !isReaderTab(tab) && tab !== "admin" && (
            <HubPageHead tab={tab} title={TAB_META.find((m) => m.id === tab)?.label ?? groupLabel(group.id, visible)} workspace={workspace} />
          )}

          {tab === "calendar" && <HubCalendarTab workspace={workspace} setWorkspace={setWorkspace} token={token} makeId={id} onReminderAdded={reminderAdded} />}
          {tab === "caseload" && <Caseload workspace={workspace} setWorkspace={setWorkspace} remove={remove} seats={seats} profileId={profileStudent} setProfileId={setProfileStudent} openTab={setTab} />}
          {tab === "goals" && <GoalsTab workspace={workspace} setWorkspace={setWorkspace} remove={remove} makeId={id} today={TODAY()} />}
          {tab === "minutes" && <MinutesTab workspace={workspace} setWorkspace={setWorkspace} remove={remove} makeId={id} today={TODAY()} token={token} />}
          {tab === "iep" && <Meetings workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} token={token} makeId={id} account={{ name: cleanSenderName(String((user as any)?.displayName || (user as any)?.username || "")), email: String((user as any)?.email || "") }} />}
          {tab === "lessons" && <Lessons workspace={workspace} setWorkspace={setWorkspace} remove={remove} />}
          {tab === "tasks" && <><Tasks workspace={workspace} setWorkspace={setWorkspace} remove={remove} makeId={id} toast={(text, actions) => { toasts.show(text, actions); }} /><AppleRemindersCard token={token} check={checkApple} /></>}
          {tab === "notes" && <HubNotes workspace={workspace} setWorkspace={setWorkspace} remove={remove} makeId={id} />}
          {isReaderTab(tab) && <ReaderTools tab={tab} openTab={setTab} night={night} />}
          {tab === "admin" && user.isAdmin && <AdminTab night={night} section={adminSection} onSection={setAdminSection} settingsPart={adminSettings} onSettingsPart={setAdminSettings} settingsInSidebar={!deskDrawer} />}
          {tab === "arise" && <Arise workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} />}
          {tab === "behavior" && <HubBehavior legacy={<Behavior workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} totals={behaviorTotals} />} />}
          {tab === "attendance" && <Attendance workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} exportAttendance={exportAttendance} />}
          {tab === "gradebook" && <Gradebook workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} />}
          {tab === "parents" && <Parents workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} />}
          {tab === "schedules" && <Schedules workspace={workspace} setWorkspace={setWorkspace} remove={remove} studentOptions={studentOptions} warnings={scheduleWarnings} />}
          {tab === "email" && <ForwardingCard token={token} isAdmin={!!user?.isAdmin} />}
          {tab === "email" && <Emails workspace={workspace} setWorkspace={setWorkspace} remove={remove} toast={(text, actions) => { toasts.show(text, actions); }} onViewTasks={() => setTab("tasks")} openId={openEmailId} />}
        </main>
      </div>
      {canUseHub && loaded && !loadError && !needsPlan && (workspace as any).aiChat && <HubChat hub="work" token={token} accent="bg-teal-700" lift raiseRem={side === "bottom" && menuOpen ? 4.9 : 0} />}
      {searching && <HubSearch entries={searchEntries} hubName="WorkHub" accent="bg-teal-700" onClose={() => setSearching(false)} />}
      {briefOpen && canUseHub && loaded && !loadError && <DailyBrief hub="work" brief={buildWorkBrief(workspace, TODAY(), new Date().getHours(), (user.displayName || "").split(" ")[0])} onClose={() => setBriefOpen(false)} onOpen={(t) => goTab(t as HubTab)} tint="from-teal-900 via-teal-700 to-amber-500" />}
      {canUseHub && loaded && !loadError && !needsPlan && (
        <div ref={addRef} className={`fixed z-50 md:bottom-[max(1.25rem,env(safe-area-inset-bottom))] md:right-4 ${side === "bottom" && menuOpen ? "bottom-[calc(env(safe-area-inset-bottom,0px)+4.9rem)]" : "bottom-[max(1.25rem,env(safe-area-inset-bottom))]"} ${side === "right" && menuOpen ? "right-[88px]" : "right-4"}`}>
          {addMenu && (
            <div role="menu" aria-label="Add to your Hub" data-testid="quick-add-menu"
              className="absolute bottom-[calc(100%+0.6rem)] right-0 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
              {[
                { key: "ai", label: "With AI", detail: "Paste, photo or file", icon: <WandSparkles className="h-4 w-4" />, go: () => startAdding({}) },
                { key: "event", label: "Event or reminder", detail: "", icon: <Calendar className="h-4 w-4" />, go: () => setQuickEvent(true) },
                { key: "task", label: "To-do", detail: "", icon: <CheckSquare className="h-4 w-4" />, go: () => setTab("tasks"), tab: "tasks" as HubTab },
                { key: "student", label: "Student", detail: "", icon: <Users className="h-4 w-4" />, go: () => setTab("caseload"), tab: "caseload" as HubTab },
                { key: "minutes", label: "Service minutes", detail: "", icon: <Timer className="h-4 w-4" />, go: () => setTab("minutes"), tab: "minutes" as HubTab },
                { key: "meeting", label: "Meeting", detail: "", icon: <CalendarDays className="h-4 w-4" />, go: () => setTab("iep"), tab: "iep" as HubTab },
                { key: "goal", label: "Goal", detail: "", icon: <Target className="h-4 w-4" />, go: () => setTab("goals"), tab: "goals" as HubTab },
                { key: "note", label: "Note", detail: "", icon: <StickyNote className="h-4 w-4" />, go: () => setTab("notes"), tab: "notes" as HubTab },
              ].filter((item) => !item.tab || visible[item.tab] !== false).map((item) => (
                <button key={item.key} type="button" role="menuitem" data-testid={`quick-add-${item.key}`}
                  onClick={() => { setAddMenu(false); item.go(); }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <span className="text-slate-500">{item.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate">{item.label}</span>
                    {item.detail && <span className="block truncate text-xs text-slate-500">{item.detail}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => setAddMenu((v) => !v)} aria-haspopup="menu" aria-expanded={addMenu}
            aria-label="Add to your Hub" data-testid="quick-add-event"
            className="inline-flex h-14 items-center gap-2 rounded-full bg-teal-600 px-5 text-base font-semibold text-white shadow-lg hover:bg-teal-700">
            <Plus className={`h-5 w-5 transition-transform ${addMenu ? "rotate-45" : ""}`} /> Add
          </button>
        </div>
      )}
      {quickEvent && <AddEventModal onClose={() => setQuickEvent(false)} onAdd={(items) => { setWorkspace((p) => addQuickItems(p, items, id)); if (items.task) reminderAdded(items); }} />}
      {homeTask && workspace.tasks.some((t) => t.id === homeTask) && <TaskModal task={workspace.tasks.find((t) => t.id === homeTask) || null} today={TODAY()}
        onSave={(fields) => setWorkspace((p) => ({ ...p, tasks: saveTask(p.tasks, homeTask, fields, id) }))} onClose={() => setHomeTask(null)} onDelete={() => remove("tasks", homeTask)} />}
      {adding && <HubImport token={token} students={workspace.students.map((s) => s.name)} start={adding.start} onAdd={addFound} onClose={() => setAdding(null)} />}
      {view.kind === "blocked" && view.block === "conflict" && <ConflictDialog onUseNewest={sync.useNewest} onKeepMine={sync.keepMine} onDownload={() => downloadHubCopy(workspace)} />}
      <BottomStack toasts={toasts}><SaveNotice view={view} onRetry={sync.retryNow} onDownload={() => downloadHubCopy(workspace)} /></BottomStack>
    </div>
  );
}

/** One to-do, the same on every screen: check it off, tap it to change it, pin it, delete it. */
function TaskRow({ task, today, workspace, setWorkspace, makeId, onToggle, onEdit, onDelete }: { task: Task; today: string; workspace: Workspace; setWorkspace: SectionProps["setWorkspace"]; makeId: () => string; onToggle: (task: Task) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void }) {
  const email = task.emailId ? workspace.emails.find((e) => e.id === task.emailId) : undefined;
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 p-3 sm:gap-y-2" data-testid="task-row">
      <input type="checkbox" className="h-6 w-6 shrink-0" aria-label={`Done: ${task.title}`} checked={task.done} onChange={() => onToggle(task)} />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`} data-testid="task-edit">
        <div className={task.done ? "text-slate-400 line-through [overflow-wrap:anywhere]" : "font-medium [overflow-wrap:anywhere]"}>{email?.unread && !task.done && <NewChip />}{task.priority === "high" && <Flag className="mr-1 inline h-4 w-4 text-red-500" aria-label="Important" />}{task.title}</div>
        {email?.message && !task.done ? (
          <>
            <p className="mt-0.5 text-xs font-medium text-slate-600 [overflow-wrap:anywhere]" data-testid="task-email-from">{[email.from && `From ${email.from}`, email.sent && `Sent ${email.sent}`].filter(Boolean).join(" · ")}</p>
            <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-slate-500 [overflow-wrap:anywhere] sm:line-clamp-3" data-testid="task-email-message">{email.message.replace(/<https?:\/\/[^\s<>]+>/g, "").replace(/\n{2,}/g, "\n").trim()}</p>
          </>
        ) : task.notes && <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-slate-500 [overflow-wrap:anywhere]" data-testid="task-notes">{task.notes}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          {!task.done && <DueChip date={task.dueDate} today={today} />}
          {task.done && task.dueDate && <span>Was due {friendlyDate(task.dueDate, today)}</span>}
          {!task.dueDate && !task.done && <span>No due date</span>}
          {task.recurring && <span className="inline-flex items-center gap-1"><Repeat className="h-3.5 w-3.5" />{task.recurring}</span>}
          {task.emailId && <span className="inline-flex items-center gap-1" data-testid="task-from-email"><Mail className="h-3.5 w-3.5" />From an email</span>}
          {task.lastDone && <span>Last done {friendlyDate(task.lastDone, today)}</span>}
          <span className="inline-flex items-center gap-1 font-medium text-teal-700"><Pencil className="h-3.5 w-3.5" />Edit</span>
        </div>
      </button>
      {/* On a phone these sit on their own line under the to-do, so the words get the full width. */}
      <div className={email ? "flex basis-full items-center gap-3 pl-9 sm:contents" : "contents"}>
        {email && (
          <div className="min-w-0 sm:order-last sm:basis-full sm:pl-9">
            <button type="button" onClick={() => openHubEmail(email.id)} aria-label={`Open the email: ${email.subject || task.title}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-800 hover:bg-teal-100" data-testid="task-open-email"><Mail className="h-4 w-4" />Open the email</button>
          </div>
        )}
        <span className="ml-auto sm:hidden" aria-hidden="true" />
        <PinButton workspace={workspace} setWorkspace={setWorkspace} kind="task" refId={task.id} title={task.title} makeId={makeId} />
        <button type="button" aria-label={`Delete ${task.title}`} className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => onDelete(task)}><Trash2 className="h-4 w-4" /></button>
      </div>
    </li>
  );
}

/** Marks a forwarded email that hasn't been opened yet. */
function NewChip() {
  return <span className="mr-1.5 inline-flex items-center rounded-full bg-teal-600 px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wide text-white" data-testid="email-new">New</span>;
}

function QuickAdd({ icon, title, detail, onClick }: { icon: ReactNode; title: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-teal-300 hover:bg-teal-50">
      <span className="shrink-0 text-teal-700">{icon}</span>
      <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{title}</span><span className="block text-xs text-slate-500">{detail}</span></span>
    </button>
  );
}

type SectionProps = {
  workspace: Workspace;
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>;
  remove: <K extends keyof Workspace>(key: K, rowId: string) => void;
};

const NO_DETAILS: StudentDetails = { name: "", grade: "", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "", disability1: "", disability2: "" };

function Caseload({ workspace, setWorkspace, remove, seats, profileId, setProfileId, openTab }: SectionProps & { seats: number | null; profileId: string | null; setProfileId: (studentId: string | null) => void; openTab: (tab: HubTab) => void }) {
  const [form, setForm] = useState<StudentDetails>({ ...NO_DETAILS });
  // The student whose details are showing. The caseload is a list of names; one opens at a time.
  const [openId, setOpenId] = useState<string | null>(null);
  // Which service area the list is filtered to, or "all".
  const [area, setArea] = useState("all");
  // The add form opens over the list instead of sitting on it.
  const [addOpen, setAddOpen] = useState(false);
  // The new student's IEP team. It is typed in the same form and saved with the student, by the one "Add student" button.
  const [formTeam, setFormTeam] = useState<TeamDraft>(emptyTeamDraft);
  // The disabilities and team part of the add form stays folded away until it is asked for, or has something in it.
  const [more, setMore] = useState(false);
  const moreFilled = !!form.disability1 || !!form.disability2 || draftHasAnyone(formTeam);
  const moreOpen = more || moreFilled;
  // The plan covers this many students; the caseload can't grow past it.
  const full = seats !== null && workspace.students.length >= seats;
  // The reason a student could not be added (a name already on the caseload, say).
  const [addError, setAddError] = useState("");
  function add(e: FormEvent) {
    e.preventDefault();
    if (full) return;
    const result = addStudentWithTeam(workspace, form, formTeam, id, seats);
    if (!result.ok) { setAddError(result.message); return; }
    setWorkspace((p) => { const next = addStudentWithTeam(p, form, formTeam, id, seats); return next.ok ? next.workspace : p; });
    setForm({ ...NO_DETAILS });
    setFormTeam(emptyTeamDraft());
    setMore(false);
    setAddError("");
    setAddOpen(false);
  }

  // The student being changed and what has been typed so far. One at a time.
  const [editing, setEditing] = useState<{ id: string; form: StudentDetails; team: TeamDraft; error: string; /** Where typing starts: the name, or the disabilities and team. */ start: "name" | "team" } | null>(null);
  function startEdit(student: Student, start: "name" | "team" = "name") {
    const { id: studentId, team: _team, ...saved } = student;
    // A student saved long ago, or read in from a file, may be missing a field.
    setEditing({ id: studentId, form: { ...NO_DETAILS, ...saved }, team: teamDraft(workspace, student.name), error: "", start });
  }
  function typed(change: Partial<StudentDetails>) {
    setEditing((now) => (now ? { ...now, form: { ...now.form, ...change }, error: "" } : now));
  }
  function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const result = updateStudentWithTeam(workspace, editing.id, editing.form, editing.team, id);
    if (!result.ok) { setEditing({ ...editing, error: result.message }); return; }
    setWorkspace((p) => { const saved = updateStudentWithTeam(p, editing.id, editing.form, editing.team, id); return saved.ok ? saved.workspace : p; });
    setEditing(null);
  }
  // A new name is carried to the student's meetings, notes, grades and the rest; say so before it is saved.
  const preview = editing ? updateStudent(workspace, editing.id, editing.form) : null;
  const following = preview && preview.ok ? preview.moved : 0;

  // Each row carries this week's service minutes against what the IEPs ask for, and the area the
  // student's goals sit in — read from the teacher's own plans, logs and goals, not made up.
  const weekFrom = weekStart(TODAY());
  const weekTo = (() => { const d = new Date(`${weekFrom}T12:00:00`); d.setDate(d.getDate() + 6); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"); })();
  const metrics = new Map(workspace.students.map((s) => {
    const owed = workspace.services.filter((p) => p.student === s.name).reduce((n, p) => n + weeklyMinutes(p), 0);
    const met = workspace.serviceLogs
      .filter((l) => l.student === s.name && l.date >= weekFrom && l.date <= weekTo && !l.notMet)
      .reduce((n, l) => n + (Number(l.minutes) || 0), 0);
    return [s.name, { owed, met, area: workspace.goals.find((g) => g.student === s.name)?.area || "", pct: owed ? Math.min(100, Math.round((met / owed) * 100)) : 0, short: owed > 0 && met / owed < 0.7 }] as const;
  }));
  const mOf = (name: string) => metrics.get(name) ?? { owed: 0, met: 0, area: "", pct: 0, short: false };
  const areas = Array.from(new Set(workspace.students.map((s) => mOf(s.name).area).filter(Boolean))).sort();
  const roster = workspace.students.filter((s) => area === "all" || mOf(s.name).area === area);
  const pill = (on: boolean) => `inline-flex min-h-[34px] items-center rounded-full border px-3.5 text-xs font-semibold transition ${on ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-900 hover:bg-slate-50"}`;

  // One student's whole picture takes the place of the list until the teacher goes back.
  if (profileId && workspace.students.some((s) => s.id === profileId)) {
    return <StudentProfileView workspace={workspace} setWorkspace={setWorkspace} studentId={profileId} today={TODAY()} makeId={id} onBack={() => setProfileId(null)} onPick={setProfileId} onOpenTab={openTab}
      onEdit={(studentId) => { const student = workspace.students.find((s) => s.id === studentId); setProfileId(null); if (student) startEdit(student); }} />;
  }

  return (
    <>
      <section className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex items-baseline gap-3">
            <h1 className="hub-figure text-[40px] leading-none sm:text-[46px]">Caseload</h1>
            <span className="hub-figure text-[20px] text-slate-500">{workspace.students.length}</span>
          </div>
          <div className="flex items-center gap-3 pb-1">
            {seats !== null && <span className="text-xs font-medium text-slate-500">{workspace.students.length} of {seats.toLocaleString("en-US")} seats</span>}
            <button type="button" onClick={() => setAddOpen(true)} disabled={full} data-testid="caseload-add-open"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-teal-600 px-4 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus className="h-4 w-4" /> Add student
            </button>
          </div>
        </div>
        {areas.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter by area">
            <button type="button" onClick={() => setArea("all")} aria-pressed={area === "all"} className={pill(area === "all")}>All {workspace.students.length}</button>
            {areas.map((a) => (
              <button key={a} type="button" onClick={() => setArea(a)} aria-pressed={area === a} className={pill(area === a)}>{a}</button>
            ))}
          </div>
        )}
      </section>
      {addOpen && (
        <HubModal title="Add a student" size="lg" closeOnBackdrop onClose={() => setAddOpen(false)}>
        {full && (
          <div className="mb-4 flex flex-col gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <span>Your plan covers {seats!.toLocaleString("en-US")} students, and your caseload is full.</span>
            <a href="#/billing" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">Add {PLANS.hub.studentsPerBlock} more</a>
          </div>
        )}
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          <Field placeholder="Student name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setAddError(""); }} required aria-label="Student name" aria-invalid={!!addError} />
          <Field placeholder="Grade" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
          <Field placeholder="Reading level" value={form.readingLevel} onChange={(e) => setForm({ ...form, readingLevel: e.target.value })} />
          <Field placeholder="Math level" value={form.mathLevel} onChange={(e) => setForm({ ...form, mathLevel: e.target.value })} />
          <Labeled label="IEP deadline"><Field type="date" value={form.iepDate} onChange={(e) => setForm({ ...form, iepDate: e.target.value })} /></Labeled>
          <Labeled label="Reevaluation deadline"><Field type="date" value={form.reevalDate} onChange={(e) => setForm({ ...form, reevalDate: e.target.value })} /></Labeled>
          <Field placeholder="Accommodations" value={form.accommodations} onChange={(e) => setForm({ ...form, accommodations: e.target.value })} className="md:col-span-2" />
          <TextArea placeholder="Quick notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="md:col-span-4" />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 md:col-span-4" data-testid="hub-student-more">
            {/* Once something is typed in it, it stays open, so nothing is saved that can't be seen. */}
            <button type="button" aria-expanded={moreOpen} disabled={moreFilled} onClick={() => setMore(!more)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left text-sm font-semibold text-slate-800 sm:px-4" data-testid="hub-student-more-toggle">
              <span>Disabilities and IEP team <span className="font-normal text-slate-500">(optional)</span></span>
              {!moreFilled && <span className="shrink-0 font-medium text-teal-800 underline decoration-teal-200 underline-offset-4">{moreOpen ? "Hide" : "Add"}</span>}
            </button>
            {moreOpen && <div className="border-t border-slate-200 p-3 sm:p-4"><StudentTeamFields details={form} onDetails={(change) => { setForm((p) => ({ ...p, ...change })); setAddError(""); }} draft={formTeam} onDraft={(draft) => { setFormTeam(draft); setAddError(""); }} contacts={workspace.spedContacts} /></div>}
          </div>
          {addError && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-4" role="alert">{addError}</div>}
          <div className="md:col-span-4"><PrimaryButton type="submit"><Plus className="h-4 w-4" /> Add student</PrimaryButton></div>
        </form>
        </HubModal>
      )}
      <div className="min-w-0">
        {roster.length ? roster.map((s) => editing?.id === s.id ? (
          <Card key={s.id} title={`Edit ${s.name}`}>
            <form onSubmit={saveEdit} onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }} className="grid gap-3 sm:grid-cols-2" data-testid="hub-student-edit-form">
              <Labeled label="Student name"><Field value={editing.form.name} onChange={(e) => typed({ name: e.target.value })} required autoFocus={editing.start === "name"} /></Labeled>
              <Labeled label="Grade"><Field value={editing.form.grade} onChange={(e) => typed({ grade: e.target.value })} /></Labeled>
              <Labeled label="Reading level"><Field value={editing.form.readingLevel} onChange={(e) => typed({ readingLevel: e.target.value })} /></Labeled>
              <Labeled label="Math level"><Field value={editing.form.mathLevel} onChange={(e) => typed({ mathLevel: e.target.value })} /></Labeled>
              <Labeled label="IEP deadline"><Field type="date" value={editing.form.iepDate} onChange={(e) => typed({ iepDate: e.target.value })} /></Labeled>
              <Labeled label="Reevaluation deadline"><Field type="date" value={editing.form.reevalDate} onChange={(e) => typed({ reevalDate: e.target.value })} /></Labeled>
              <Labeled label="Accommodations" className="sm:col-span-2"><Field value={editing.form.accommodations} onChange={(e) => typed({ accommodations: e.target.value })} /></Labeled>
              <Labeled label="Quick notes" className="sm:col-span-2"><TextArea value={editing.form.notes} onChange={(e) => typed({ notes: e.target.value })} /></Labeled>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2 sm:p-4">
                <div className="mb-3 text-sm font-semibold text-slate-800">Disabilities and IEP team <span className="font-normal text-slate-500">(optional)</span></div>
                <StudentTeamFields details={editing.form} onDetails={typed} draft={editing.team} onDraft={(team) => setEditing((now) => (now ? { ...now, team, error: "" } : now))} contacts={workspace.spedContacts} autoFocus={editing.start === "team"} />
              </div>
              {following > 0 && (
                <p className="text-sm text-slate-600 sm:col-span-2">
                  {following === 1 ? "1 record" : `${following} records`} for {s.name} in your other tabs will show the new name too.
                </p>
              )}
              {editing.error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2" role="alert">{editing.error}</div>}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <PrimaryButton type="submit"><Save className="h-4 w-4" /> Save changes</PrimaryButton>
                <GhostButton onClick={() => setEditing(null)}>Cancel</GhostButton>
              </div>
            </form>
          </Card>
        ) : (
          <div key={s.id} className="border-b border-slate-100">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setOpenId(openId === s.id ? null : s.id)} aria-expanded={openId === s.id}
                data-testid={`hub-student-row-${s.id}`}
                className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2 text-left">
                <span aria-hidden="true" className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12.5px] font-bold"
                  style={{ background: tintFor(mOf(s.name).area).bg, color: tintFor(mOf(s.name).area).ink }}>
                  {s.name.split(/\s+/).map((part) => part[0] || "").join("").slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-slate-900">{s.name}</span>
                  <span className="block truncate text-[12.5px] text-slate-600">
                    {[s.grade && `Grade ${s.grade}`, mOf(s.name).area, mOf(s.name).owed > 0 ? `${mOf(s.name).owed}/wk` : ""].filter(Boolean).join(" · ") || "No details yet"}
                  </span>
                </span>
                {mOf(s.name).owed > 0 && (
                  <span className="w-[66px] flex-none text-right">
                    <span className={`hub-figure block text-[13px] ${mOf(s.name).short ? "text-[#9a3412]" : "text-slate-900"}`}>{mOf(s.name).met}/{mOf(s.name).owed}</span>
                    <span className="mt-1.5 block h-[4px] overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full" style={{ width: `${mOf(s.name).pct}%`, background: mOf(s.name).short ? "#c2410c" : "var(--hub-accent, #5b3be0)" }} />
                    </span>
                  </span>
                )}
                <ChevronDown className={`h-4 w-4 flex-none text-slate-400 transition-transform ${openId === s.id ? "" : "-rotate-90"}`} />
              </button>
            </div>
            {openId === s.id && (
            <div className="pb-4">
            <div className="-mt-1 mb-3 flex items-center gap-1">
              <button type="button" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950" onClick={() => startEdit(s)} data-testid="hub-student-edit"><Pencil className="h-4 w-4" /> Edit</button>
              <button type="button" aria-label="Delete" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("students", s.id)}><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <Info label="Grade" value={s.grade || "—"} />
              <Info label="Reading" value={s.readingLevel || "—"} />
              <Info label="Math" value={s.mathLevel || "—"} />
              <Info label="IEP deadline" value={s.iepDate || "—"} />
              <Info label="Reeval deadline" value={s.reevalDate || "—"} />
              <Info label="Accommodations" value={s.accommodations || "—"} />
              {s.disability1 && <Info label="Disability 1" value={s.disability1} />}
              {s.disability2 && <Info label="Disability 2" value={s.disability2} />}
            </div>
            <StudentTeamSummary workspace={workspace} student={s.name} />
            {!s.disability1 && !s.disability2 && teamMembers(workspace, s.name).length === 0 && (
              <button type="button" onClick={() => startEdit(s, "team")} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50" data-testid="hub-student-add-team"><Plus className="h-4 w-4" /> Add disabilities and IEP team</button>
            )}
            {s.notes && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{s.notes}</div>}
            <button type="button" onClick={() => setProfileId(s.id)} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-teal-900 hover:bg-teal-100" data-testid="hub-student-profile"><Users className="h-4 w-4" /> See everything for {s.name.split(/\s+/)[0]}</button>
            </div>
            )}
          </div>
        )) : <Empty>Add students to start your caseload.</Empty>}
      </div>
    </>
  );
}

/** A heading with a button beside it; the form it holds opens over the page rather than
 *  sitting open on it. The form closes the pop-up when it is submitted. */
function AddCard({ title, label, children }: { title: string; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
          <h2 className="hub-card-title font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={() => setOpen(true)} data-testid={`add-card-${label.toLowerCase().replace(/\s+/g, "-")}`}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-teal-600 px-4 text-sm font-semibold text-white transition hover:bg-teal-700">
            <Plus className="h-4 w-4" /> {label}
          </button>
        </div>
      </section>
      {open && (
        <HubModal title={title} size="lg" closeOnBackdrop onClose={() => setOpen(false)}>
          <div onSubmit={() => setOpen(false)}>{children}</div>
        </HubModal>
      )}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-slate-700">{value}</div></div>;
}

function Meetings({ workspace, setWorkspace, remove, studentOptions, token, makeId, account }: SectionProps & { studentOptions: () => ReactNode; token: string | null; makeId: () => string; account: { name: string; email: string } }) {
  const [pollStart, setPollStart] = useState<PollStart>(null);
  const [wizard, setWizard] = useState<WizardState | null>(null);
  return (
    <>
      <Card title="IEP, reevaluation & meeting timeline" right={<PrimaryButton onClick={() => setWizard({ step: 1, meetingId: null })}><Plus className="h-4 w-4" /> Add meeting</PrimaryButton>}>
        <p className="text-sm text-slate-600">Tap “Add meeting”. A short guide walks you through the steps, from picking a time with everyone to sending the final copy. You can skip any step and come back to it.</p>
      </Card>
      <Card title="Timeline">
        {workspace.meetings.length ? <div className="space-y-2">{[...workspace.meetings].sort((a,b)=>Number(a.done)-Number(b.done)||dateValue(a.date)-dateValue(b.date)).map((m) => (
          <div key={m.id} className="flex items-start gap-3 border-b border-slate-100 py-4 sm:items-center">
            <div className="w-11 flex-none text-center">
              <div className={`hub-figure text-[20px] leading-none ${m.done ? "text-slate-400" : "text-slate-900"}`}>{m.date ? Number(m.date.slice(8, 10)) : "—"}</div>
              <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">
                {m.date ? new Date(`${m.date}T12:00:00`).toLocaleDateString(undefined, { month: "short" }) : ""}
              </div>
            </div>
            <span aria-hidden="true" className="w-[3px] flex-none self-stretch rounded-full" style={{ background: m.done ? "#e4e0ef" : m.date && m.date <= TODAY() ? "#c2410c" : "var(--hub-accent, #5b3be0)" }} />
            <input type="checkbox" className="h-5 w-5 shrink-0" checked={m.done} onChange={() => setWorkspace((p) => ({ ...p, meetings: p.meetings.map((x) => x.id === m.id ? { ...x, done: !x.done } : x) }))} />
            <div className="min-w-0 flex-1">
              <div className={`font-semibold ${m.done ? "text-slate-400 line-through" : ""}`}>{m.student} · {m.type}</div>
              <div className="mt-1 text-sm text-slate-500">{m.date ? `${friendlyDate(m.date, TODAY())}${m.date >= TODAY() ? ` (${relativeDays(m.date, TODAY())})` : ""}` : "No meeting date yet"}{m.time ? ` · ${clock12(m.time)}` : ""}{m.room ? ` · ${m.room}` : ""}{m.notes ? ` · ${m.notes}` : ""}</div>
              {meetingDeadline(workspace, m) && <div className="mt-0.5 text-xs font-medium text-slate-600" data-testid="meeting-deadline">{deadlineLabel(m.type).replace(/ date$/, "")}: {friendlyDate(meetingDeadline(workspace, m), TODAY())}{!m.done && meetingDeadline(workspace, m) >= TODAY() ? ` (${relativeDays(meetingDeadline(workspace, m), TODAY())})` : ""}</div>}
              <button type="button" onClick={() => setWizard({ step: firstOpen(m.plan), meetingId: m.id })} className="mt-1 mr-4 min-h-11 text-sm font-medium text-teal-800 underline decoration-teal-200 underline-offset-4" data-testid="open-steps">{stepsDone(m.plan) ? `Steps: ${stepsDone(m.plan)} of ${STEP_COUNT} done` : "Start the steps"}</button>
              {!m.done && <button type="button" onClick={() => setPollStart({ meetingId: m.id, title: `${m.type}${m.student ? ` for ${m.student.split(" ")[0]}` : ""}` })} className="mt-1 min-h-11 text-sm font-medium text-teal-800 underline decoration-teal-200 underline-offset-4">Find a time with everyone</button>}
            </div>
            <PinButton workspace={workspace} setWorkspace={setWorkspace} kind="meeting" refId={m.id} title={`${m.student} ${m.type}`} makeId={makeId} />
            <button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("meetings", m.id)}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}</div> : <Empty>No meetings added.</Empty>}
      </Card>
      <HubMeetingPolls token={token} workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} start={pollStart} onStarted={() => setPollStart(null)} account={account} wizard={wizard} setWizard={setWizard} studentOptions={studentOptions} />
    </>
  );
}

function Lessons({ workspace, setWorkspace, remove }: SectionProps) {
  const [form, setForm] = useState({ title: "", subject: "Math", group: "", date: TODAY(), objective: "", materials: "" });
  function add(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setWorkspace((p) => ({ ...p, lessons: [{ id: id(), ...form }, ...p.lessons] }));
    setForm({ title: "", subject: "Math", group: "", date: TODAY(), objective: "", materials: "" });
  }
  return (
    <>
      <AddCard title="Lesson planning" label="Add lesson">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          <Field placeholder="Lesson title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <Select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}><option>Math</option><option>Reading</option><option>Writing</option><option>Push-in</option><option>Pull-out</option><option>Other</option></Select>
          <Field placeholder="Group / class" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} />
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <TextArea placeholder="Objective / skill" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} className="md:col-span-2" />
          <TextArea placeholder="Materials / worksheet notes" value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} className="md:col-span-2" />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Save lesson</PrimaryButton>
        </form>
      </AddCard>
      <div className="grid gap-4 lg:grid-cols-2">
        {workspace.lessons.length ? workspace.lessons.map((lesson) => (
          <Card key={lesson.id} title={lesson.title} right={<button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("lessons", lesson.id)}><Trash2 className="h-4 w-4" /></button>}>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{lesson.subject} · {lesson.group || "No group"} · {lesson.date || "No date"}</div>
            {lesson.objective && <p className="mt-3 text-sm text-slate-700">{lesson.objective}</p>}
            {lesson.materials && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{lesson.materials}</div>}
          </Card>
        )) : <div className="lg:col-span-2"><Empty>No lessons saved yet.</Empty></div>}
      </div>
    </>
  );
}

const DUE_STYLE: Record<DueState, string> = { none: "bg-slate-100 text-slate-500", overdue: "bg-red-100 text-red-700", today: "bg-amber-100 text-amber-800", soon: "bg-sky-100 text-sky-800", later: "bg-slate-100 text-slate-600" };

function DueChip({ date, today }: { date: string; today: string }) {
  if (!date) return null;
  const state = dueState(date, today);
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${DUE_STYLE[state]}`}>{state === "overdue" ? "Overdue · " : ""}{friendlyDate(date, today)}</span>;
}

function Tasks({ workspace, setWorkspace, remove, makeId, toast }: SectionProps & { makeId: () => string; toast: (text: string, actions?: ToastAction[]) => void }) {
  const today = TODAY();
  const [filter, setFilter] = useState<TaskFilter>("open");
  const [sort, setSort] = useState<TaskSort>("due");
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState("");
  /** The to-do open in the pop-up: `id: null` is a new one. */
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const counts = taskCounts(workspace.tasks, today);
  const shown = useMemo(() => arrangeTasks(workspace.tasks, filter, sort, search), [workspace.tasks, filter, sort, search]);

  function quickAdd(e: FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    setWorkspace((p) => ({ ...p, tasks: [...p.tasks, { id: id(), title, dueDate: "", recurring: "", done: false }] }));
    setQuick("");
  }
  const toggle = taskChecker(() => workspace.tasks, setWorkspace, toast);
  /** Takes every finished to-do off the list, with Undo. */
  function clearFinished() {
    const { cleared } = clearDone(workspace.tasks);
    if (!cleared.length) return;
    setWorkspace((p) => ({ ...p, tasks: clearDone(p.tasks).tasks }));
    toast(`Cleared ${cleared.length} finished ${cleared.length === 1 ? "to-do" : "to-dos"}.`, [{ label: "Undo", run: () => setWorkspace((p) => ({ ...p, tasks: restoreTasks(p.tasks, cleared) })) }]);
  }
  const chip = (active: boolean) => `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;

  return (
    <>
      <Card title="Reminders & to-dos" right={<PrimaryButton onClick={() => setEditing({ id: null })}><Plus className="h-4 w-4" /> New task</PrimaryButton>}>
        <form onSubmit={quickAdd} className="flex gap-2">
          <Field placeholder="Add a to-do and press Enter" aria-label="Quick add a to-do" value={quick} onChange={(e) => setQuick(e.target.value)} />
          <PrimaryButton type="submit" disabled={!quick.trim()}>Add</PrimaryButton>
        </form>
        {(counts.overdue > 0 || counts.today > 0) && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm" data-testid="task-alerts">
            {counts.overdue > 0 && <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700">{counts.overdue} overdue</span>}
            {counts.today > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">{counts.today} due today</span>}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Show">
          <button type="button" className={chip(filter === "open")} aria-pressed={filter === "open"} onClick={() => setFilter("open")}>To do <span className="opacity-70">{counts.open}</span></button>
          <button type="button" className={chip(filter === "done")} aria-pressed={filter === "done"} onClick={() => setFilter("done")}>Done <span className="opacity-70">{counts.done}</span></button>
          <button type="button" className={chip(filter === "all")} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <Field type="search" placeholder="Search to-dos" aria-label="Search to-dos" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select aria-label="Sort to-dos" value={sort} onChange={(e) => setSort(e.target.value as TaskSort)}>{TASK_SORTS.map((o) => <option key={o.id} value={o.id}>Sort: {o.label}</option>)}</Select>
        </div>
      </Card>
      <Card>
        {shown.length ? <ul className="space-y-2">{shown.map((task) => (
          <TaskRow key={task.id} task={task} today={today} workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} onToggle={toggle} onEdit={(t) => setEditing({ id: t.id })} onDelete={(t) => remove("tasks", t.id)} />
        ))}</ul> : <Empty>{workspace.tasks.length ? (filter === "open" ? "Nothing left to do. Nice work." : "No to-dos match.") : "No tasks yet. Type one above and press Enter."}</Empty>}
        {filter === "done" && counts.done > 0 && !search.trim() && (
          <div className="mt-3 text-center"><button type="button" onClick={clearFinished} className="min-h-11 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4" data-testid="clear-done">Clear all {counts.done} finished</button></div>
        )}
        {filter === "open" && !search.trim() && <RecentlyDone tasks={workspace.tasks} onUndo={(taskId) => setWorkspace((p) => ({ ...p, tasks: undoTask(p.tasks, taskId, Date.now()) }))} />}
      </Card>
      {editing && <TaskModal task={editing.id ? workspace.tasks.find((t) => t.id === editing.id) || null : null} startTitle={quick} today={today}
        onSave={(fields) => setWorkspace((p) => ({ ...p, tasks: saveTask(p.tasks, editing.id, fields, id) }))} onClose={() => setEditing(null)} onDelete={editing.id ? () => remove("tasks", editing.id!) : undefined} />}
    </>
  );
}

function Arise({ workspace, setWorkspace, remove, studentOptions }: SectionProps & { studentOptions: () => ReactNode }) {
  const [form, setForm] = useState({ student: "", book: "", score: "", points: "", date: TODAY() });
  function add(e: FormEvent) {
    e.preventDefault();
    setWorkspace((p) => ({ ...p, ariseRecords: [{ id: id(), ...form }, ...p.ariseRecords] }));
    setForm({ student: "", book: "", score: "", points: "", date: TODAY() });
  }
  return (
    <>
      <AddCard title="A.R.I.S.E. reading records" label="Add record">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-6">
          <Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required>{studentOptions()}</Select>
          <Field placeholder="Book / text" value={form.book} onChange={(e) => setForm({ ...form, book: e.target.value })} className="md:col-span-2" required />
          <Field placeholder="Score" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
          <Field placeholder="Points" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} />
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Add record</PrimaryButton>
        </form>
      </AddCard>
      <Card title="Reading history">
        {workspace.ariseRecords.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-xs uppercase text-slate-400"><tr><th className="pb-2">Student</th><th>Book</th><th>Score</th><th>Points</th><th>Date</th><th /></tr></thead><tbody>{workspace.ariseRecords.map((r) => <tr key={r.id} className="border-t border-slate-100"><td className="py-3 font-medium">{r.student}</td><td>{r.book}</td><td>{r.score}</td><td>{r.points}</td><td>{r.date}</td><td><button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("ariseRecords", r.id)}><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div> : <Empty>No A.R.I.S.E. records yet.</Empty>}
      </Card>
    </>
  );
}

function Behavior({ workspace, setWorkspace, remove, studentOptions, totals }: SectionProps & { studentOptions: (all?: boolean) => ReactNode; totals: Record<string, number> }) {
  const [form, setForm] = useState({ student: "", points: 1, reason: "", date: TODAY() });
  function add(e: FormEvent) {
    e.preventDefault();
    setWorkspace((p) => ({ ...p, behavior: [{ id: id(), ...form, points: Number(form.points) || 0 }, ...p.behavior] }));
    setForm({ student: "", points: 1, reason: "", date: TODAY() });
  }
  return (
    <>
      <AddCard title="Behavior points" label="Record points">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-5">
          <Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required>{studentOptions(true)}</Select>
          <Field type="number" value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} />
          <Field placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="md:col-span-2" />
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Record points</PrimaryButton>
        </form>
      </AddCard>
      <div className="grid gap-4 lg:grid-cols-[.7fr_1.3fr]">
        <Card title="Totals">
          {Object.keys(totals).length ? <div className="space-y-2">{Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([name,total]) => <div key={name} className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"><span>{name}</span><strong>{total > 0 ? "+" : ""}{total}</strong></div>)}</div> : <Empty>No points yet.</Empty>}
        </Card>
        <Card title="Point history">
          {workspace.behavior.length ? <div className="space-y-2">{workspace.behavior.map((b) => <div key={b.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><div className={`w-12 text-center text-lg font-bold ${b.points >= 0 ? "text-emerald-600" : "text-red-600"}`}>{b.points >= 0 ? "+" : ""}{b.points}</div><div className="min-w-0 flex-1"><div className="font-medium">{b.student}</div><div className="text-xs text-slate-500">{b.reason || "No reason"} · {b.date}</div></div><button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("behavior", b.id)}><Trash2 className="h-4 w-4" /></button></div>)}</div> : <Empty>No behavior points yet.</Empty>}
        </Card>
      </div>
    </>
  );
}

function Attendance({ workspace, setWorkspace, remove, studentOptions, exportAttendance }: SectionProps & { studentOptions: () => ReactNode; exportAttendance: () => void }) {
  const [form, setForm] = useState<{ student: string; date: string; status: AttendanceEntry["status"]; className: string }>({ student: "", date: TODAY(), status: "Present", className: "" });
  function add(e: FormEvent) {
    e.preventDefault();
    setWorkspace((p) => ({ ...p, attendance: [{ id: id(), ...form }, ...p.attendance] }));
  }
  return (
    <>
      <Card title="Attendance" right={<GhostButton onClick={exportAttendance}>Export CSV</GhostButton>}>
        <form onSubmit={add} className="grid gap-3 md:grid-cols-5">
          <Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required>{studentOptions()}</Select>
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Field placeholder="Class / block" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} />
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AttendanceEntry["status"] })}><option>Present</option><option>Absent</option><option>Tardy</option><option>Excused</option></Select>
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Mark</PrimaryButton>
        </form>
      </Card>
      <Card title="Attendance log">
        {workspace.attendance.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-xs uppercase text-slate-400"><tr><th className="pb-2">Date</th><th>Student</th><th>Class</th><th>Status</th><th /></tr></thead><tbody>{workspace.attendance.map((a) => <tr key={a.id} className="border-t border-slate-100"><td className="py-3">{a.date}</td><td className="font-medium">{a.student}</td><td>{a.className}</td><td>{a.status}</td><td><button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("attendance", a.id)}><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div> : <Empty>No attendance entries yet.</Empty>}
      </Card>
    </>
  );
}

function Gradebook({ workspace, setWorkspace, remove, studentOptions }: SectionProps & { studentOptions: () => ReactNode }) {
  const [assignment, setAssignment] = useState({ title: "", category: "Classwork", points: 10, date: TODAY() });
  const [score, setScore] = useState({ assignmentId: "", student: "", score: "", missing: false, excused: false });
  function addAssignment(e: FormEvent) {
    e.preventDefault();
    if (!assignment.title.trim()) return;
    setWorkspace((p) => ({ ...p, assignments: [...p.assignments, { id: id(), ...assignment, points: Number(assignment.points) || 0 }] }));
    setAssignment({ title: "", category: "Classwork", points: 10, date: TODAY() });
  }
  function addScore(e: FormEvent) {
    e.preventDefault();
    if (!score.assignmentId || !score.student) return;
    setWorkspace((p) => ({ ...p, gradeScores: [...p.gradeScores, { id: id(), assignmentId: score.assignmentId, student: score.student, score: score.score === "" ? null : Number(score.score), missing: score.missing, excused: score.excused }] }));
    setScore({ assignmentId: "", student: "", score: "", missing: false, excused: false });
  }
  const averages = workspace.students.map((student) => {
    const rows = workspace.gradeScores.filter((g) => g.student === student.name && !g.excused && !g.missing && g.score != null);
    let earned = 0, possible = 0;
    for (const row of rows) {
      const a = workspace.assignments.find((x) => x.id === row.assignmentId);
      if (!a) continue;
      earned += Number(row.score || 0); possible += Number(a.points || 0);
    }
    return { student: student.name, average: possible ? Math.round((earned / possible) * 100) : null };
  });
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Assignments">
          <form onSubmit={addAssignment} className="grid gap-3 sm:grid-cols-2">
            <Field placeholder="Assignment" value={assignment.title} onChange={(e) => setAssignment({ ...assignment, title: e.target.value })} required />
            <Select value={assignment.category} onChange={(e) => setAssignment({ ...assignment, category: e.target.value })}><option>Classwork</option><option>Quiz</option><option>Test</option><option>Homework</option><option>Project</option></Select>
            <Field type="number" min="0" value={assignment.points} onChange={(e) => setAssignment({ ...assignment, points: Number(e.target.value) })} />
            <Field type="date" value={assignment.date} onChange={(e) => setAssignment({ ...assignment, date: e.target.value })} />
            <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Add assignment</PrimaryButton>
          </form>
          <div className="mt-4 space-y-2">{workspace.assignments.map((a) => <div key={a.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><div><div className="font-medium">{a.title}</div><div className="text-xs text-slate-500">{a.category} · {a.points} pts · {a.date}</div></div><button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("assignments", a.id)}><Trash2 className="h-4 w-4" /></button></div>)}</div>
        </Card>
        <Card title="Enter score">
          <form onSubmit={addScore} className="grid gap-3 sm:grid-cols-2">
            <Select value={score.assignmentId} onChange={(e) => setScore({ ...score, assignmentId: e.target.value })} required><option value="">Choose assignment</option>{workspace.assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</Select>
            <Select value={score.student} onChange={(e) => setScore({ ...score, student: e.target.value })} required>{studentOptions()}</Select>
            <Field type="number" placeholder="Points earned" value={score.score} onChange={(e) => setScore({ ...score, score: e.target.value })} />
            <div className="flex min-h-11 flex-wrap items-center gap-4 rounded-xl border border-slate-200 px-3 py-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 shrink-0" checked={score.missing} onChange={(e) => setScore({ ...score, missing: e.target.checked })} /> Missing</label><label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 shrink-0" checked={score.excused} onChange={(e) => setScore({ ...score, excused: e.target.checked })} /> Excused</label></div>
            <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Save score</PrimaryButton>
          </form>
        </Card>
      </div>
      <Card title="Student averages">
        {averages.length ? <div className="grid gap-2 md:grid-cols-3">{averages.map((a) => <div key={a.student} className="rounded-xl bg-slate-50 p-4"><div className="font-medium">{a.student}</div><div className="mt-1 text-2xl font-bold">{a.average == null ? "—" : `${a.average}%`}</div></div>)}</div> : <Empty>Add students to see grade averages.</Empty>}
      </Card>
    </>
  );
}

function Parents({ workspace, setWorkspace, remove, studentOptions }: SectionProps & { studentOptions: () => ReactNode }) {
  const [form, setForm] = useState({ student: "", guardian: "", message: "", status: "Sent", date: TODAY() });
  function add(e: FormEvent) {
    e.preventDefault();
    if (!form.message.trim()) return;
    setWorkspace((p) => ({ ...p, parentLogs: [{ id: id(), ...form }, ...p.parentLogs] }));
    setForm({ student: "", guardian: "", message: "", status: "Sent", date: TODAY() });
  }
  return (
    <>
      <AddCard title="Parent communication" label="Log contact">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          <Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })}>{studentOptions()}</Select>
          <Field placeholder="Parent / guardian" value={form.guardian} onChange={(e) => setForm({ ...form, guardian: e.target.value })} />
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option>Sent</option><option>Called</option><option>Left voicemail</option><option>Replied</option><option>Acknowledged</option><option>Needs follow-up</option></Select>
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <TextArea placeholder="Message / class feed post / contact note" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="md:col-span-4" />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Save contact log</PrimaryButton>
        </form>
      </AddCard>
      <Card title="Contact log">
        {workspace.parentLogs.length ? <div className="space-y-3">{workspace.parentLogs.map((p) => <div key={p.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><div className="font-semibold">{p.student || "General"} · {p.guardian || "Guardian"}</div><div className="text-xs text-slate-500">{p.status} · {p.date}</div></div><button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("parentLogs", p.id)}><Trash2 className="h-4 w-4" /></button></div><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{p.message}</p></div>)}</div> : <Empty>No parent communication saved yet.</Empty>}
      </Card>
    </>
  );
}

function Schedules({ workspace, setWorkspace, remove, studentOptions, warnings }: SectionProps & { studentOptions: () => ReactNode; warnings: string[] }) {
  const [form, setForm] = useState({ student: "", day: "Monday", start: "08:00", end: "08:30", label: "" });
  function add(e: FormEvent) {
    e.preventDefault();
    setWorkspace((p) => ({ ...p, schedules: [...p.schedules, { id: id(), ...form }] }));
    setForm({ student: "", day: "Monday", start: "08:00", end: "08:30", label: "" });
  }
  return (
    <>
      <AddCard title="Weekly student schedules" label="Add schedule">
        <form onSubmit={add} className="grid gap-3 md:grid-cols-6">
          <Select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} required>{studentOptions()}</Select>
          <Select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></Select>
          <Field type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          <Field type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          <Field placeholder="Class / service" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Add block</PrimaryButton>
        </form>
      </AddCard>
      {warnings.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-2 font-semibold text-amber-900"><AlertTriangle className="h-5 w-5" /> Schedule overlap</div><div className="mt-2 space-y-1 text-sm text-amber-800">{warnings.map((w) => <div key={w}>{w}</div>)}</div></div>}
      <Card title="Schedule blocks">
        {workspace.schedules.length ? <div className="grid gap-3 lg:grid-cols-2">{workspace.schedules.map((s) => <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><div className="font-medium">{s.student} · {s.label || "Schedule block"}</div><div className="text-xs text-slate-500">{s.day} · {s.start}–{s.end}</div></div><button aria-label="Delete" className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("schedules", s.id)}><Trash2 className="h-4 w-4" /></button></div>)}</div> : <Empty>No schedule blocks yet.</Empty>}
      </Card>
    </>
  );
}

function Emails({ workspace, setWorkspace, remove, toast, onViewTasks, openId }: SectionProps & { toast: (text: string, actions?: ToastAction[]) => void; onViewTasks: () => void; openId?: string | null }) {
  // The email opened from a to-do is shown and scrolled to.
  useEffect(() => {
    if (!openId) return;
    const timer = window.setTimeout(() => document.querySelector(`[data-email-id="${CSS.escape(openId)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    return () => window.clearTimeout(timer);
  }, [openId]);
  const [form, setForm] = useState({ from: "", subject: "", body: "", action: "", draft: "", date: TODAY() });
  // What to do with a new email as it is saved.
  const [also, setAlso] = useState({ todo: false, flag: false });
  const [filter, setFilter] = useState<EmailFilter>("all");
  const counts = emailCounts(workspace);
  const shown = arrangeEmails(workspace, filter);
  const added = (text: string) => toast(text, [{ label: "View", run: onViewTasks }]);
  function add(e: FormEvent) {
    e.preventDefault();
    if (!form.body.trim() && !form.subject.trim()) return;
    const emailId = id(), taskId = id();
    const email = { id: emailId, ...form, ...(also.flag ? { flagged: true } : {}) };
    setWorkspace((p) => {
      const saved = { ...p, emails: [email, ...p.emails] };
      return also.todo ? addEmailToTasks(saved, emailId, () => taskId).workspace : saved;
    });
    if (also.todo) added("Saved, and added to Reminders & to-dos.");
    setForm({ from: "", subject: "", body: "", action: "", draft: "", date: TODAY() });
    setAlso({ todo: false, flag: false });
  }
  /** Puts a saved email on the to-do list (once: an email already waiting there is not added again). */
  function toTodo(emailId: string) {
    const result = addEmailToTasks(workspace, emailId, id);
    if (!result.added) return;
    setWorkspace((p) => addEmailToTasks(p, emailId, () => result.taskId!).workspace);
    added("Added to Reminders & to-dos.");
  }
  const chip = (active: boolean) => `inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
  const act = "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  return (
    <>
      <Card title="Email organizer">
        <p className="mb-4 text-sm text-slate-600">Paste important school emails here, pull out the action you need to take, and keep a reply draft beside it. Flag the ones that matter, or put them on your to-do list.</p>
        <form onSubmit={add} className="grid gap-3 md:grid-cols-4">
          <Field placeholder="From" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
          <Field placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="md:col-span-2" />
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <TextArea placeholder="Paste email here" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="md:col-span-2" />
          <TextArea placeholder="Action item / what I need to do" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />
          <TextArea placeholder="Reply draft" value={form.draft} onChange={(e) => setForm({ ...form, draft: e.target.value })} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 md:col-span-4">
            <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5 shrink-0" checked={also.todo} onChange={(e) => setAlso({ ...also, todo: e.target.checked })} data-testid="email-also-todo" /> Add it to my to-dos</label>
            <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5 shrink-0" checked={also.flag} onChange={(e) => setAlso({ ...also, flag: e.target.checked })} data-testid="email-also-flag" /> Flag it</label>
          </div>
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Save email</PrimaryButton>
        </form>
      </Card>
      <Card title="Saved emails">
        {workspace.emails.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Show">
            <button type="button" className={chip(filter === "all")} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All <span className="opacity-70">{counts.all}</span></button>
            <button type="button" className={chip(filter === "flagged")} aria-pressed={filter === "flagged"} onClick={() => setFilter("flagged")}><Flag className="h-3.5 w-3.5" />Flagged <span className="opacity-70">{counts.flagged}</span></button>
            <button type="button" className={chip(filter === "todo")} aria-pressed={filter === "todo"} onClick={() => setFilter("todo")}><CheckSquare className="h-3.5 w-3.5" />On my to-do list <span className="opacity-70">{counts.todo}</span></button>
          </div>
        )}
        {shown.length ? (
          <div className="space-y-3">
            {shown.map((e) => {
              const task = emailTask(workspace, e.id);
              return (
                <div key={e.id} className={`scroll-mt-24 rounded-2xl border p-4 ${openId === e.id ? "border-teal-400 ring-2 ring-teal-200" : e.flagged ? "border-amber-300 bg-amber-50/60" : "border-slate-200"}`} data-testid="email-row" data-email-id={e.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><div className="break-words font-semibold">{e.unread && <NewChip />}{e.flagged && <Flag className="mr-1 inline h-4 w-4 text-amber-600" aria-label="Flagged" />}{e.subject || "Untitled email"}</div><div className="text-xs text-slate-500">{e.from || "Unknown sender"} · {e.sent ? <>Sent {e.sent}</> : e.date}</div></div>
                    <button type="button" aria-label={`Delete ${e.subject || "email"}`} className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove("emails", e.id)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {e.action && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><strong>Action:</strong> {e.action}</div>}
                  {e.message ? (
                    <>
                      <details className="mt-3 text-sm text-slate-700" open={openId === e.id} onToggle={(ev) => { if ((ev.currentTarget as HTMLDetailsElement).open && e.unread) setWorkspace((p) => markEmailRead(p, e.id)); }} data-testid="email-message">
                        <summary className="cursor-pointer font-medium text-slate-700">Message</summary>
                        <EmailWords text={e.message} className="mt-2 leading-6" />
                      </details>
                      {e.body && e.body !== e.message && <details className="mt-2 text-sm text-slate-600"><summary className="cursor-pointer font-medium text-slate-500">Whole email, with the forwarding notes</summary><EmailWords text={e.body} className="mt-2 leading-6" /></details>}
                    </>
                  ) : e.body && <details className="mt-3 text-sm text-slate-600" open={openId === e.id} onToggle={(ev) => { if ((ev.currentTarget as HTMLDetailsElement).open && e.unread) setWorkspace((p) => markEmailRead(p, e.id)); }}><summary className="cursor-pointer font-medium text-slate-700">Original email</summary><EmailWords text={e.body} className="mt-2 leading-6" /></details>}
                  {e.draft && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><strong>Reply draft</strong><p className="mt-1 whitespace-pre-wrap">{e.draft}</p></div>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" aria-pressed={!!e.flagged} aria-label={`${e.flagged ? "Take the flag off" : "Flag"} ${e.subject || "this email"}`} onClick={() => setWorkspace((p) => toggleEmailFlag(p, e.id))} className={act} data-testid="email-flag"><Flag className={`h-4 w-4 ${e.flagged ? "text-amber-600" : ""}`} />{e.flagged ? "Flagged" : "Flag"}</button>
                    {task && !task.done
                      ? <span className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-teal-50 px-3 text-sm font-semibold text-teal-800" data-testid="email-on-list"><CheckSquare className="h-4 w-4" />On your to-do list</span>
                      : <button type="button" aria-label={`Add ${e.subject || "this email"} to my to-dos`} onClick={() => toTodo(e.id)} className={act} data-testid="email-to-todo"><Plus className="h-4 w-4" />{task ? "Add to my to-dos again" : "Add to my to-dos"}</button>}
                    {task?.done && <span className="text-xs font-medium text-slate-500" data-testid="email-done">Done on your to-do list</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <Empty>{workspace.emails.length ? (filter === "flagged" ? "No flagged emails." : "No emails are waiting on your to-do list.") : "No emails saved yet."}</Empty>}
      </Card>
    </>
  );
}
