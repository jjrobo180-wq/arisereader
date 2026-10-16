import EyeGazeCelebrations from "@/components/EyeGazeCelebrations";
import InstallAppPrompt from "@/components/InstallAppPrompt";
import WorkHubTour from "@/components/WorkHubTour";
import ForcePasswordChange from "@/components/ForcePasswordChange";
import { Switch, Route, Router, Redirect, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

/** Hash routing that ignores a "?..." after the page name when matching routes, so links like
 *  #/signin?as=student, #/lifehub?mode=signup and #/admin-handoff?code=... open their page instead of
 *  "We can't find that page". Pages read their own options from window.location.hash. */
const useHashPathLocation = ((options?: any) => {
  const [location, navigate] = (useHashLocation as any)(options);
  return [String(location).split("?")[0] || "/", navigate];
}) as unknown as typeof useHashLocation;
Object.assign(useHashPathLocation as any, { hrefs: (useHashLocation as any).hrefs });
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { lastKnownLocked, teacherLocked, usePlan } from "@/lib/plan";
import { useState, useEffect, lazy, Suspense, type ComponentType } from "react";
import { API_BASE } from "./lib/queryClient";
import ProfileSetupOverlay from "./components/ProfileSetupOverlay";
import EyeGazeSiteShell from "./components/EyeGazeSiteShell";
import { trackAuthenticatedNavigation } from "./lib/navigation";

const SESSION_COOKIE = "arise_session";
function getTokenFromCookie(): string | null {
  try {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const c = cookies[i].trim();
      if (c.startsWith(SESSION_COOKIE + "=")) {
        const raw = c.substring(SESSION_COOKIE.length + 1);
        const data = JSON.parse(atob(raw));
        return data.token || null;
      }
    }
  } catch {}
  return null;
}
import SignIn from "./pages/SignIn";
import Register from "./pages/Register";
import TeacherSignup from "./pages/TeacherSignup";
import ParentSignup from "./pages/ParentSignup";
import EyeGazeAccessGate from "./components/EyeGazeAccessGate";
import ParentConnectionBanner from "./components/ParentConnectionBanner";
import AssessmentPopup from "./components/AssessmentPopup";
import ClassTeachersPopup from "./components/ClassTeachersPopup";
import FypAnnouncementPopup from "./components/FypAnnouncementPopup";
import WelcomeGuide from "./components/WelcomeGuide";
import PointsSideTab from "./components/PointsSideTab";
import AvatarWorldSideTab from "./components/AvatarWorldSideTab";
import LeaderboardPopup from "./components/LeaderboardPopup";
import HalloreadWelcome from "./components/HalloreadWelcome";
import ClubPlayGate from "./components/ClubPlayGate";
import NotFound from "./pages/not-found";

// Keep the initial login/library bundle light. The 3D worlds load only when a student opens them.
const CHUNK_RELOAD_PREFIX = "arise_chunk_reload:";
function lazyPage(loader: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(async () => {
    const retryKey = typeof window !== "undefined" ? CHUNK_RELOAD_PREFIX + window.location.hash : "";
    try {
      const mod = await loader();
      if (retryKey) sessionStorage.removeItem(retryKey);
      return mod;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "");
      const staleChunk = /failed to fetch dynamically imported module|importing a module script failed|chunkloaderror|loading chunk|dynamically imported module/i.test(message);
      if (staleChunk && typeof window !== "undefined" && retryKey && sessionStorage.getItem(retryKey) !== "1") {
        sessionStorage.setItem(retryKey, "1");
        window.location.reload();
        return await new Promise<never>(() => {});
      }
      if (retryKey) sessionStorage.removeItem(retryKey);
      throw error;
    }
  });
}
const AvatarWorld = lazyPage(() => import("./pages/AvatarWorld"));
const Games = lazyPage(() => import("./pages/Games"));
const MeetingPoll = lazyPage(() => import("./pages/MeetingPoll"));
const TodoShare = lazyPage(() => import("./pages/TodoShare"));
const DropReceive = lazyPage(() => import("./pages/DropReceive"));
const AriseCity = lazyPage(() => import("./pages/AriseCity"));
const SmashRoom = lazyPage(() => import("./pages/play/SmashRoom"));
const BuildZone = lazyPage(() => import("./pages/play/BuildZone"));
const AriseNews = lazyPage(() => import("./pages/news/AriseNews"));
const NewsArticle = lazyPage(() => import("./pages/news/NewsArticle"));
const ReadHub = lazyPage(() => import("./pages/reads/ReadHub"));
const BookReader = lazyPage(() => import("./pages/reads/BookReader"));
const PoemReader = lazyPage(() => import("./pages/reads/PoemReader"));
const ClubTheater = lazyPage(() => import("./pages/ClubTheater"));
const StudySquad = lazyPage(() => import("./pages/study/StudySquad"));
const HomeInterior = lazyPage(() => import("./pages/HomeInterior"));
const BoardGameWorld = lazyPage(() => import("./pages/BoardGameWorld"));
const MidnightMystery = lazyPage(() => import("./pages/MidnightMystery"));
const UltimateChess = lazyPage(() => import("./pages/UltimateChess"));
const PaintballArena = lazyPage(() => import("./pages/PaintballArena"));
const SkyboundSprint = lazyPage(() => import("./pages/SkyboundSprint"));
const AuroraRally = lazyPage(() => import("./pages/AuroraRally"));
const StandaloneGame = lazyPage(() => import("./pages/StandaloneGame"));
const TeacherHub = lazyPage(() => import("./pages/TeacherHub"));
const AriseTodo = lazyPage(() => import("./pages/AriseTodo"));
const TodoAdmin = lazyPage(() => import("./pages/TodoAdmin"));
const AmbientStandby = lazyPage(() => import("./pages/AmbientStandby"));
const AriseOffice = lazyPage(() => import("./pages/AriseOffice"));
const PremiumStudio = lazyPage(() => import("./pages/PremiumStudio"));
const ProApps = lazyPage(() => import("./pages/ProApps"));
// A.R.I.S.E. Reader for teachers and parents, on its own page outside both hubs (pages/AriseReader.tsx).
const AriseReader = lazyPage(() => import("./pages/AriseReader"));
import TodoGate from "@/components/TodoGate";
import { ReaderAdminToTodoRedirect, ReaderToHubHandoff, TodoAdminHandoff } from "@/components/AdminDomainHandoff";
import { READER_APP, goToSignIn, hubPathFor, isHubAccount, isReaderPage } from "@/lib/hubs";
const TeacherScenes = lazyPage(() => import("./pages/TeacherScenes"));
const StudentSceneLive = lazyPage(() => import("./pages/StudentSceneLive"));
const Library = lazyPage(() => import("./pages/Library"));
const Quiz = lazyPage(() => import("./pages/Quiz"));
const ReadBook = lazyPage(() => import("./pages/ReadBook"));
const Profile = lazyPage(() => import("./pages/Profile"));
const Tutorial = lazyPage(() => import("./pages/Tutorial"));
const LeaderboardPage = lazyPage(() => import("./pages/LeaderboardPage"));
const StudentProgress = lazyPage(() => import("./pages/StudentProgress"));
const Competition = lazyPage(() => import("./pages/Competition"));
const TimedCompetition = lazyPage(() => import("./pages/TimedCompetition"));
const Polls = lazyPage(() => import("./pages/Polls"));
const CoursePage = lazyPage(() => import("./pages/CoursePage"));
const ReadingAssessment = lazyPage(() => import("./pages/ReadingAssessment"));
const GrowthCheck = lazyPage(() => import("./pages/GrowthCheck"));
const EyeGazeQuiz = lazyPage(() => import("./pages/EyeGazeQuiz"));
const EyeGazeGames = lazyPage(() => import("./pages/EyeGazeGames"));
const EyeGazeHome = lazyPage(() => import("./pages/EyeGazeHome"));
const EyeGazeLessons = lazyPage(() => import("./pages/EyeGazeLessons"));
const EyeGazeProgress = lazyPage(() => import("./pages/EyeGazeProgress"));
const EyeGazeAccount = lazyPage(() => import("./pages/EyeGazeAccount"));
const ARISECityComingLater = lazyPage(() => import("./pages/ARISECityComingLater"));
const ReadingLevelUp = lazyPage(() => import("./pages/ReadingLevelUp"));
const EyeGazeBuddyWorld = lazyPage(() => import("./pages/EyeGazeBuddyWorld"));
const EyeGazeMyWorld = lazyPage(() => import("./pages/EyeGazeMyWorld"));
const EyeGazeBuddy = lazyPage(() => import("./pages/EyeGazeBuddy"));
const EyeGazeTalker = lazyPage(() => import("./pages/EyeGazeTalker"));
const EyeGazeParentMode = lazyPage(() => import("./pages/EyeGazeParentMode"));
const EyeGazeTV = lazyPage(() => import("./pages/EyeGazeTV"));
const EyeGazeFlashcards = lazyPage(() => import("./pages/EyeGazeFlashcards"));
const EyeGazeFidgetLab = lazyPage(() => import("./pages/EyeGazeFidgetLab"));
const EyeGazeFarmWorld = lazyPage(() => import("./pages/EyeGazeFarmWorld"));
const EyeGazePottyCoach = lazyPage(() => import("./pages/EyeGazePottyCoach"));
const EyeGazeLifeSkills = lazyPage(() => import("./pages/EyeGazeLifeSkills"));
const EyeGazeParentControls = lazyPage(() => import("./pages/EyeGazeParentControls"));
const QuizBuilder = lazyPage(() => import("./pages/QuizBuilder"));
const LiveQuiz = lazyPage(() => import("./pages/LiveQuiz"));
const CustomEyeGazeQuiz = lazyPage(() => import("./pages/CustomEyeGazeQuiz"));
const StudentProfileView = lazyPage(() => import("./pages/StudentProfileView"));
const StudentMessages = lazyPage(() => import("./pages/StudentMessages"));
const StudentCertificates = lazyPage(() => import("./pages/StudentCertificates"));
const About = lazyPage(() => import("./pages/About"));
const FypPage = lazyPage(() => import("./pages/FypPage"));
const FypSharePage = lazyPage(() => import("./pages/FypSharePage"));
const FypMyBooksPage = lazyPage(() => import("./pages/FypMyBooksPage"));
const ReadingClub = lazyPage(() => import("./pages/ReadingClub"));
const TeacherArise2 = lazyPage(() => import("./pages/TeacherArise2"));
const ParentArise2 = lazyPage(() => import("./pages/ParentArise2"));
const Pricing = lazyPage(() => import("./pages/Pricing"));
const Billing = lazyPage(() => import("./pages/Billing"));

// Gate that shows profile setup overlay after student registration
function StudentSetupGate({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [showSetup, setShowSetup] = useState(false);
  const [bandInfo, setBandInfo] = useState<{ grade: string; band: string; bookCount: number } | null>(null);
  const [checked, setChecked] = useState(false);

  // Check sessionStorage synchronously on first render
  useEffect(() => {
    if (user && user.role === 'student' && !user.isAdmin) {
      const flag = sessionStorage.getItem('show_profile_setup');
      if (flag === 'true') {
        // Don't remove the flag yet - remove it when overlay completes
        const authToken = token || getTokenFromCookie();
        if (!authToken) {
          // No token yet, show overlay with default info
          setBandInfo({ grade: '0', band: 'K-2', bookCount: 0 });
          setShowSetup(true);
          setChecked(true);
          return;
        }
        // Fetch grade band info
        fetch(`${API_BASE}/api/grade-band-info`, {
          headers: { Authorization: `Bearer ${authToken}` }
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data && data.band) {
              setBandInfo({ grade: data.grade, band: data.band, bookCount: data.bookCount });
            } else {
              setBandInfo({ grade: '0', band: 'K-2', bookCount: 0 });
            }
            setShowSetup(true);
            setChecked(true);
          })
          .catch(() => {
            setBandInfo({ grade: '0', band: 'K-2', bookCount: 0 });
            setShowSetup(true);
            setChecked(true);
          });
        return;
      }
    }
    setChecked(true);
  }, [user, token]);

  // Show overlay
  if (showSetup && bandInfo) {
    return (
      <ProfileSetupOverlay
        grade={bandInfo.grade}
        band={bandInfo.band}
        bookCount={bandInfo.bookCount}
        onComplete={() => {
          sessionStorage.removeItem('show_profile_setup');
          setShowSetup(false);
          setBandInfo(null);
          setChecked(true);
        }}
      />
    );
  }

  // While checking, show a loading spinner (prevents redirect before overlay appears)
  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-blue-50">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, token } = useAuth();
  const [location] = useLocation();
  // A teacher account is part of Premium. Once the admin turns plan rules on, a
  // teacher without it is sent to the plan page, the one place they can still use.
  const isPlanTeacher = !!user && user.role === "teacher" && !user.isAdmin;
  const { plan, loading: planLoading } = usePlan(isPlanTeacher ? token : null);
  // The page shows straight away and the plan arrives behind it. Only a teacher who
  // was locked last time waits, so they don't see a dashboard flash before the plan page.
  if (isLoading || (isPlanTeacher && planLoading && lastKnownLocked())) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-blue-50">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Redirect to="/" replace />;
  if (isPlanTeacher && teacherLocked(plan) && location.split("?")[0] !== "/billing") return <Redirect to="/billing" replace />;
  // A linked parent can also open their child's talker and family tools.
  if (user.role === 'parent' && !user.isAdmin && !['/parent-dashboard', '/eye-gaze-parent', '/eye-gaze-parent-controls', '/eye-gaze-talker', '/my-world', '/eye-gaze-flashcards', '/eye-gaze-life-skills', '/eye-gaze-potty'].includes(location)) {
    return <Redirect to="/parent-dashboard" replace />;
  }
  return <>{children}</>;
}

function AdminPreviewBar() {
  const { realUser, adminPreviewMode, startAdminPreview, exitAdminPreview } = useAuth();
  const [location, navigate] = useLocation();

  // Previewing "as a student" has no meaning inside the admin console or Arise
  // WorkHub (the admin's own tools) — if preview mode was left on from an
  // earlier visit, drop it the moment the admin lands back here, so it can't
  // keep silently narrowing what they can see on these pages.
  useEffect(() => {
    if (!adminPreviewMode) return;
    if (location === "/admin" || location === "/workhub" || location === "/lifehub") exitAdminPreview();
  }, [location, adminPreviewMode, exitAdminPreview]);

  if (!realUser?.isAdmin || !adminPreviewMode) return null;

  const switchMode = (mode: "regular" | "eye-gaze") => {
    startAdminPreview(mode);
    navigate(mode === "eye-gaze" ? "/eye-gaze-home" : "/profile");
  };

  return (
    <div className="fixed left-1/2 top-2 z-[260] -translate-x-1/2 rounded-2xl border border-white/15 bg-slate-950/95 p-1.5 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-1">
        <span className="hidden px-2 text-[10px] font-black uppercase tracking-widest text-amber-300 sm:inline">Admin Preview</span>
        <button
          type="button"
          onClick={() => switchMode("regular")}
          className={`rounded-xl px-3 py-2 text-xs font-black transition ${adminPreviewMode === "regular" ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10"}`}
        >
          Non-Eye Gazer
        </button>
        <button
          type="button"
          onClick={() => switchMode("eye-gaze")}
          className={`rounded-xl px-3 py-2 text-xs font-black transition ${adminPreviewMode === "eye-gaze" ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-white/10"}`}
        >
          Eye Gazer
        </button>
        <button
          type="button"
          onClick={() => { exitAdminPreview(); navigate("/admin"); }}
          className="rounded-xl px-3 py-2 text-xs font-black text-amber-300 hover:bg-white/10"
        >
          Exit
        </button>
      </div>
    </div>
  );
}

function AuthenticatedNavigationTracker() {
  const { user, realUser, adminPreviewMode } = useAuth();
  const [location] = useLocation();

  useEffect(() => {
    if (!user || (adminPreviewMode && realUser?.isAdmin)) return;
    trackAuthenticatedNavigation(location, user);
  }, [location, user?.id, user?.role, user?.isAdmin, user?.is_eye_gaze_user, realUser?.isAdmin, adminPreviewMode]);

  return null;
}

/** Opens a hub on one of its tabs (the tab is passed through this tab's session storage; the hub reads it
 *  when it opens and whenever the address changes, so going back to an old address lands in the hub too). */
function OpenHubTab({ to, storageKey, value }: { to: string; storageKey: "workhub_tab" | "lifehub_tab"; value: string }) {
  try { sessionStorage.setItem(storageKey, value); } catch { /* opens on its usual first tab */ }
  return <Redirect to={to} replace />;
}

function ReaderToTodoRedirect() {
  useEffect(() => {
    window.location.replace("https://arisetodo.com/app#/lifehub");
  }, []);
  return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f7fc] p-6 text-center text-slate-900">
    <h1 className="text-2xl font-black">A.R.I.S.E. To-Do has its own home.</h1>
    <p className="max-w-md text-sm text-slate-600">Your LifeHub workspace is now available at arisetodo.com. You can sign in with your existing A.R.I.S.E. account.</p>
    <a href="https://arisetodo.com/app#/lifehub" className="rounded-xl bg-violet-700 px-5 py-3 font-bold text-white">Open A.R.I.S.E. To-Do</a>
  </main>;
}

/** A student who signed in on arisetodo.com: student accounts live on A.R.I.S.E. Reader. */
function StudentOnTodo() {
  const { logout } = useAuth();
  return <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#f6f7fc] p-6 text-center text-slate-900">
    <h1 className="text-2xl font-black">Student accounts open in A.R.I.S.E. Reader</h1>
    <p className="max-w-md text-sm text-slate-600">arisetodo.com is for teachers and families. Your books, quizzes and games are on arisereader.com.</p>
    <button type="button" onClick={() => { logout(); window.location.assign(`${READER_APP}#/signin?as=student`); }} className="rounded-xl bg-violet-700 px-5 py-3 font-bold text-white">Go to A.R.I.S.E. Reader</button>
  </main>;
}

/** Someone who is signed in reached the sign-in screen (or just signed in): open their place.
 *  Teachers, parents, LifeHub accounts and the administrator get their hub on arisetodo.com. */
function AfterSignIn({ onReaderDomain, onTodoDomain }: { onReaderDomain: boolean; onTodoDomain: boolean }) {
  const { user } = useAuth();
  if (!user) return null;
  if (isHubAccount(user)) {
    if (onReaderDomain) return <ReaderToHubHandoff />;
    // A new sign-in always opens the person's hub Home, with Reader available
    // from that hub's menu; saved subpages remain available after they enter.
    if (user.role === "teacher") return <OpenHubTab to="/workhub" storageKey="workhub_tab" value="overview" />;
    if (user.role === "parent") return <OpenHubTab to="/lifehub" storageKey="lifehub_tab" value="home" />;
    return <Redirect to={hubPathFor(user)} replace />;
  }
  if (onTodoDomain) return <StudentOnTodo />;
  return <Redirect to="/" replace />;
}

/** The retired dark To-Do marketing screen is no longer part of the app.
 * Visitors arriving at /app#/ are sent to the current white homepage,
 * while sign-in and authenticated Work/Life hubs keep their existing routes. */
function TodoPublicHomeRedirect() {
  useEffect(() => {
    window.location.replace("/");
  }, []);
  return <main className="min-h-screen bg-[#f9fafc] p-8 text-center"><a href="/" className="font-semibold text-indigo-700 underline">Open the A.R.I.S.E. To-Do homepage</a></main>;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();
  // The routes below remount when the page changes. A page that redirects lands on another page that
  // often redirects too (a game → "/" → the hub); without a fresh mount React reused the first Redirect,
  // the next hop never ran, and the screen stayed blank.
  const [routePath] = useLocation();
  // Eye-gaze mode is only for non-privileged learner accounts. Admin,
  // teacher, and parent roles must always keep the standard site layout.
  const isEyeGazeStudent = !!user && !user.isAdmin && user.role !== 'teacher' && user.role !== 'parent' && !!user.is_eye_gaze_user;
  const domain = typeof window === "undefined" ? "" : window.location.hostname.toLowerCase();
  const onReaderDomain = domain === "arisereader.com" || domain === "www.arisereader.com";
  const onTodoDomain = domain === "arisetodo.com" || domain === "www.arisetodo.com";
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-blue-50">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  // A.R.I.S.E. Reader has its own address (/reader), so it is answered here, before the hash
  // router — a page of its own rather than a screen inside the To-Do app. Signing in is still the
  // hub's, so a signed-out visitor is sent to that screen.
  if (isReaderPage()) {
    if (!user) { goToSignIn(); return null; }
    return <AriseReader />;
  }
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
    <Switch key={routePath}>
      <Route path="/lifehub">
        {onReaderDomain && isHubAccount(user) ? <ReaderToHubHandoff /> : onReaderDomain && !user ? <Redirect to="/signin" replace /> : onReaderDomain ? <ReaderToTodoRedirect /> : <TodoGate><AriseTodo /></TodoGate>}
      </Route>
      <Route path="/to-do">
        {onReaderDomain && isHubAccount(user) ? <ReaderToHubHandoff /> : onReaderDomain && !user ? <Redirect to="/signin" replace /> : onReaderDomain ? <ReaderToTodoRedirect /> : <TodoGate><AriseTodo /></TodoGate>}
      </Route>
      <Route path="/todo-admin">
        {user?.isAdmin ? <ProtectedRoute><TodoAdmin /></ProtectedRoute> : user ? <Redirect to="/" replace /> : <Redirect to="/signin" replace />}
      </Route>
      <Route path="/admin-handoff">
        {onTodoDomain ? <TodoAdminHandoff /> : <Redirect to="/signin" replace />}
      </Route>
      <Route path="/saved">
        {isEyeGazeStudent ? <Redirect to="/library" replace /> : <ProtectedRoute><FypMyBooksPage /></ProtectedRoute>}
      </Route>
      <Route path="/signin">
        {user ? <AfterSignIn onReaderDomain={onReaderDomain} onTodoDomain={onTodoDomain} /> : <SignIn />}
      </Route>
      <Route path="/explore-reader">
        <Redirect to="/" replace />
      </Route>
      <Route path="/">
        {onTodoDomain ? (!user ? <TodoPublicHomeRedirect /> : <Redirect key="home-to-hub" to={hubPathFor(user)} replace />) : user ? (isHubAccount(user) ? <Redirect key="home-to-hub" to={hubPathFor(user)} replace /> : isEyeGazeStudent ? <StudentSetupGate><Redirect to="/eye-gaze-home" replace /></StudentSetupGate> : <StudentSetupGate><Redirect to="/library" replace /></StudentSetupGate>) : <iframe src="/reader-landing.html" title="A.R.I.S.E. Reader — discover reading" style={{width:"100%",height:"100dvh",border:0,display:"block"}} />}
      </Route>
      <Route path="/register">
        {user ? (isHubAccount(user) ? <Redirect to={hubPathFor(user)} replace /> : isEyeGazeStudent ? <StudentSetupGate><Redirect to="/eye-gaze-home" replace /></StudentSetupGate> : <StudentSetupGate><Redirect to="/library" replace /></StudentSetupGate>) : <Register />}
      </Route>
      <Route path="/register-independent">
        {user ? (isHubAccount(user) ? <Redirect to={hubPathFor(user)} replace /> : isEyeGazeStudent ? <StudentSetupGate><Redirect to="/eye-gaze-home" replace /></StudentSetupGate> : <StudentSetupGate><Redirect to="/library" replace /></StudentSetupGate>) : <Register independent />}
      </Route>
      <Route path="/meet/:token">
        <MeetingPoll />
      </Route>
      <Route path="/share/:token">
        <TodoShare />
      </Route>
      <Route path="/drop/:code">
        <DropReceive />
      </Route>
      <Route path="/teacher-signup">
        <TeacherSignup />
      </Route>
      <Route path="/parent-signup">
        <ParentSignup />
      </Route>
      {/* The parent portal and the teacher dashboard now live inside the hubs (Arise LifeHub and Arise WorkHub). */}
      <Route path="/parent-dashboard">
        <Redirect to="/reader" replace />
      </Route>
      <Route path="/teacher-dashboard">
        <Redirect to="/reader" replace />
      </Route>
      {/* A.R.I.S.E. Reader's teacher and parent tools, on their own page rather than inside a hub.
          Signing in still happens in the hub, so a signed-out visitor goes to the sign-in screen. */}
      <Route path="/reader">
        {!user ? <Redirect to="/signin" replace /> : <AriseReader />}
      </Route>
      {/* Office, the AI tools and the premium apps open from the hubs' App Store, so they let in
          whoever the hubs do: teachers, parents, personal accounts and admins. They don't use
          ProtectedRoute, which sends parents to the Reader and plan-less teachers to Billing. */}
      <Route path="/ai-apps">
        {!user ? <Redirect to="/signin" replace /> : isHubAccount(user) ? <PremiumStudio /> : <Redirect to="/" replace />}
      </Route>
      <Route path="/ambient">
        {!user ? <Redirect to="/signin" replace /> : isHubAccount(user) ? <AmbientStandby /> : <Redirect to="/" replace />}
      </Route>
      <Route path="/office">
        {!user ? <Redirect to="/signin" replace /> : isHubAccount(user) ? <AriseOffice /> : <Redirect to="/" replace />}
      </Route>
      <Route path="/pro">
        {!user ? <Redirect to="/signin" replace /> : isHubAccount(user) ? <ProApps /> : <Redirect to="/" replace />}
      </Route>
      <Route path="/workhub">
        {onReaderDomain && isHubAccount(user) ? <ReaderToHubHandoff /> : !user ? <Redirect to="/signin" replace /> : <TeacherHub />}
      </Route>
      <Route path="/teacher-hub">
        {onReaderDomain && isHubAccount(user) ? <ReaderToHubHandoff /> : !user ? <Redirect to="/signin" replace /> : <TeacherHub />}
      </Route>
      <Route path="/hub">
        <Redirect to="/workhub" replace />
      </Route>
      <Route path="/teacher-scenes">
        {user && (user.role === "teacher" || user.isAdmin)
          ? <ProtectedRoute><TeacherScenes /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/scene-live">
        {user && user.role === "student" && !user.isAdmin
          ? <ProtectedRoute><StudentSceneLive /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      {/* Public: shareable with teachers who don't have an account yet. */}
      <Route path="/teacher-arise-2">
        <TeacherArise2 />
      </Route>
      <Route path="/for-teachers">
        <TeacherArise2 />
      </Route>
      {/* Public: shareable with parents who don't have an account yet. */}
      <Route path="/for-parents">
        <ParentArise2 />
      </Route>
      {/* Public: plans and pricing. */}
      <Route path="/pricing">
        <Pricing />
      </Route>
      {/* A teacher's plan: what they have, and paying for Premium. */}
      <Route path="/billing">
        {user && (user.role === "teacher" || user.isAdmin) ? <ProtectedRoute><Billing /></ProtectedRoute> : <Redirect to="/" replace />}
      </Route>
      <Route path="/tutorial">
        <Tutorial />
      </Route>
      <Route path="/tutorial/student">
        <Tutorial />
      </Route>
      <Route path="/tutorial/teacher">
        <Tutorial />
      </Route>
      <Route path="/tutorial/eye-gaze">
        <Tutorial />
      </Route>
      <Route path="/tutorial/parent">
        <Tutorial />
      </Route>
      <Route path="/leaderboard">
        {isEyeGazeStudent
          ? <ProtectedRoute><EyeGazeAccessGate path="/leaderboard"><EyeGazeProgress /></EyeGazeAccessGate></ProtectedRoute>
          : user && !user.isAdmin && user.role !== 'teacher' && user.role !== 'parent'
            ? <ProtectedRoute><StudentProgress /></ProtectedRoute>
            : <LeaderboardPage />}
      </Route>
      {/* A short competition with its own leaderboard: www.arisereader.com/#/fall-break */}
      <Route path="/fall-break">
        <TimedCompetition slug="fall-break" />
      </Route>
      <Route path="/competition">
        {isEyeGazeStudent ? <Redirect to="/eye-gaze-games" replace /> : <Competition />}
      </Route>
      <Route path="/about">
        <About />
      </Route>
      <Route path="/reading-club">
        {isEyeGazeStudent ? <Redirect to="/library" replace /> : <ReadingClub />}
      </Route>
      <Route path="/polls">
        {isEyeGazeStudent ? <Redirect to="/eye-gaze-home" replace /> : <ProtectedRoute><Polls /></ProtectedRoute>}
      </Route>
      <Route path="/library">
        <ProtectedRoute>{isEyeGazeStudent ? <Redirect to="/eye-gaze-games?tab=lessons" replace /> : <Library />}</ProtectedRoute>
      </Route>
      <Route path="/avatar-world">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><AvatarWorld /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/my-home">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><HomeInterior /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/club-arise">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><Redirect to="/games" replace /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/arise-arcade">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><Redirect to="/games" replace /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/club-arise/theater">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><ClubTheater /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/city/smash">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><SmashRoom /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/city/build">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><BuildZone /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/city">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><AriseCity /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/games">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><Games /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      {/* Study Squad: students play, teachers and admins also come here to add study sets. */}
      <Route path="/study">
        {user && user.role !== "parent" && !user.is_eye_gaze_user
          ? <ProtectedRoute><StudySquad /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/worlds">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><Redirect to="/games" replace /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/neighborhood">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><Redirect to="/city" replace /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/board-game-world">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><BoardGameWorld /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/halloread-mystery">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><MidnightMystery halloread /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/ultimate-chess">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><UltimateChess /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/paintball-arena">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><PaintballArena /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/skybound-sprint">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><SkyboundSprint /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/aurora-rally">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><AuroraRally /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/twinlight-run">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><StandaloneGame key="twinlight-run" file="twinlight-run" title="Twinlight Run" /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/chime-of-aoren">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><StandaloneGame key="chime-of-aoren" file="chime-of-aoren" title="Chime of Aoren" /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/laser-royale">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><Redirect to="/games" replace /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/course/:id">
        <ProtectedRoute>{isEyeGazeStudent ? <EyeGazeAccessGate path="/library"><CoursePage /></EyeGazeAccessGate> : <CoursePage />}</ProtectedRoute>
      </Route>
      <Route path="/quiz/:id">
        <ProtectedRoute><Quiz /></ProtectedRoute>
      </Route>
      <Route path="/reads">
        <ProtectedRoute><ReadHub /></ProtectedRoute>
      </Route>
      <Route path="/reads/book/:id">
        <ProtectedRoute><BookReader /></ProtectedRoute>
      </Route>
      <Route path="/reads/poem/:slug">
        <ProtectedRoute><PoemReader /></ProtectedRoute>
      </Route>
      <Route path="/news">
        <ProtectedRoute><AriseNews /></ProtectedRoute>
      </Route>
      <Route path="/news/:slug">
        <ProtectedRoute><NewsArticle /></ProtectedRoute>
      </Route>
      <Route path="/read/:id">
        <ProtectedRoute>{isEyeGazeStudent ? <EyeGazeAccessGate path="/library"><ReadBook /></EyeGazeAccessGate> : <ReadBook />}</ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute><Profile /></ProtectedRoute>
      </Route>
      {/* The admin console lives in Arise WorkHub's A.R.I.S.E. Reader group. */}
      <Route path="/admin">
        {onReaderDomain && user?.isAdmin ? <ReaderAdminToTodoRedirect /> : <OpenHubTab to="/workhub" storageKey="workhub_tab" value="admin" />}
      </Route>
      <Route path="/progress">
        <ProtectedRoute>{isEyeGazeStudent ? <EyeGazeAccessGate path="/leaderboard"><EyeGazeProgress /></EyeGazeAccessGate> : <GrowthCheck />}</ProtectedRoute>
      </Route>
      <Route path="/eye-gaze-home">
        <ProtectedRoute><EyeGazeHome /></ProtectedRoute>
      </Route>
      <Route path="/eye-gaze-buddy">
        <ProtectedRoute><EyeGazeAccessGate path="/eye-gaze-buddy"><EyeGazeBuddy /></EyeGazeAccessGate></ProtectedRoute>
      </Route>
      <Route path="/eye-gaze-games">
        <ProtectedRoute><EyeGazeAccessGate path="/eye-gaze-games" anyOf={["/eye-gaze-games", "/library"]}><EyeGazeGames /></EyeGazeAccessGate></ProtectedRoute>
      </Route>
      <Route path="/eye-gaze-tv">
        <ProtectedRoute><EyeGazeAccessGate path="/eye-gaze-tv"><EyeGazeTV /></EyeGazeAccessGate></ProtectedRoute>
      </Route>
      <Route path="/eye-gaze-flashcards">
        <ProtectedRoute><EyeGazeAccessGate path="/eye-gaze-flashcards"><EyeGazeFlashcards /></EyeGazeAccessGate></ProtectedRoute>
      </Route>
      <Route path="/eye-gaze-fidgets">
        <ProtectedRoute><EyeGazeAccessGate path="/eye-gaze-games"><EyeGazeFidgetLab /></EyeGazeAccessGate></ProtectedRoute>
      </Route>
      <Route path="/eye-gaze-farm">
        <ProtectedRoute><EyeGazeAccessGate path="/eye-gaze-games"><EyeGazeFarmWorld /></EyeGazeAccessGate></ProtectedRoute>
      </Route>
      <Route path="/eye-gaze-life-skills">
        {isEyeGazeStudent || user?.role === 'parent' ? <ProtectedRoute><EyeGazeAccessGate path="/eye-gaze-life-skills"><EyeGazeLifeSkills /></EyeGazeAccessGate></ProtectedRoute> : <Redirect to="/" replace />}
      </Route>
      <Route path="/eye-gaze-potty">
        {isEyeGazeStudent || user?.role === 'parent' ? <ProtectedRoute><EyeGazeAccessGate path="/eye-gaze-life-skills"><EyeGazePottyCoach /></EyeGazeAccessGate></ProtectedRoute> : <Redirect to="/" replace />}
      </Route>
      <Route path="/eye-gaze-account">
        <ProtectedRoute><EyeGazeAccount /></ProtectedRoute>
      </Route>
      <Route path="/arise-city">
        <ProtectedRoute><EyeGazeAccessGate path="/eye-gaze-games"><ARISECityComingLater /></EyeGazeAccessGate></ProtectedRoute>
      </Route>
      <Route path="/reading-level-up">
        <ProtectedRoute><EyeGazeAccessGate path="/eye-gaze-games"><ReadingLevelUp /></EyeGazeAccessGate></ProtectedRoute>
      </Route>
      <Route path="/buddy-world">
        <Redirect to="/my-world" replace />
      </Route>
      <Route path="/my-world">
        {isEyeGazeStudent || user?.role === 'parent' ? <ProtectedRoute><EyeGazeAccessGate path="/my-world"><EyeGazeMyWorld /></EyeGazeAccessGate></ProtectedRoute> : <Redirect to="/" replace />}
      </Route>
      <Route path="/eye-gaze-talker">
        {isEyeGazeStudent || user?.role === 'parent' ? <ProtectedRoute><EyeGazeAccessGate path="/eye-gaze-talker"><EyeGazeTalker /></EyeGazeAccessGate></ProtectedRoute> : <Redirect to="/" replace />}
      </Route>
      <Route path="/eye-gaze-parent">
        {isEyeGazeStudent || user?.role === 'parent' ? <ProtectedRoute><EyeGazeParentMode /></ProtectedRoute> : <Redirect to="/" replace />}
      </Route>
      <Route path="/eye-gaze-parent-controls">
        {isEyeGazeStudent || user?.role === 'parent' ? <ProtectedRoute><EyeGazeParentControls /></ProtectedRoute> : <Redirect to="/" replace />}
      </Route>
      <Route path="/eye-gaze-quiz/:id">
        <ProtectedRoute><EyeGazeAccessGate path="/library"><EyeGazeQuiz /></EyeGazeAccessGate></ProtectedRoute>
      </Route>
      <Route path="/quiz-builder">
        <ProtectedRoute><QuizBuilder /></ProtectedRoute>
      </Route>
      <Route path="/live-quiz">
        <ProtectedRoute><LiveQuiz /></ProtectedRoute>
      </Route>
      <Route path="/live-quiz/:id">
        <ProtectedRoute><LiveQuiz /></ProtectedRoute>
      </Route>
      <Route path="/quiz-builder/:id">
        <ProtectedRoute><QuizBuilder /></ProtectedRoute>
      </Route>
      <Route path="/custom-quiz/:id">
        <ProtectedRoute>{isEyeGazeStudent ? <EyeGazeAccessGate path="/library"><CustomEyeGazeQuiz /></EyeGazeAccessGate> : <CustomEyeGazeQuiz />}</ProtectedRoute>
      </Route>
      <Route path="/student-profile/:id">
        <ProtectedRoute><StudentProfileView /></ProtectedRoute>
      </Route>
      <Route path="/messages/:id">
        <ProtectedRoute><StudentMessages /></ProtectedRoute>
      </Route>
      <Route path="/student-certificates/:id">
        <ProtectedRoute><StudentCertificates /></ProtectedRoute>
      </Route>
      <Route path="/fyp">
        {isEyeGazeStudent ? <Redirect to="/eye-gaze-home" replace /> : <ProtectedRoute><FypPage /></ProtectedRoute>}
      </Route>
      <Route path="/fyp/share/:token">
        {(params) => <FypSharePage token={params.token} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

// Full-screen games need the whole screen: site tabs, banners and popups would cover their controls.
const FULLSCREEN_GAME_ROUTES = ["/to-do", "/lifehub", "/games", "/study", "/paintball-arena", "/aurora-rally", "/skybound-sprint", "/twinlight-run", "/chime-of-aoren"];
function useFullscreenGameRoute() {
  const read = () => FULLSCREEN_GAME_ROUTES.includes(window.location.hash.replace(/^#/, "").split("?")[0]);
  const [inGame, setInGame] = useState(read);
  useEffect(() => {
    const update = () => setInGame(read());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return inGame;
}


function AppInner() {
  const { user, realUser, adminPreviewMode } = useAuth();
  const inGame = useFullscreenGameRoute();
  const isStudent = user && !user.isAdmin && user.role !== 'teacher' && user.role !== 'parent' && user.role !== 'todo';
  const isEyeGazeStudent = !!isStudent && !!user?.is_eye_gaze_user;
  const isDemoStudent = !!isStudent && (
    !!user?.username?.startsWith('sample') || user?.username === 'tutorial-eye'
  );
  const isAdminPreview = !!realUser?.isAdmin && !!adminPreviewMode;

  // A student a teacher just bulk-added signs in with a default password (their
  // student number) and must replace it before doing anything else in the app.
  if (user?.mustChangePassword) return <ForcePasswordChange />;

  const overlays = !inGame;
  return (
    <>
      {overlays && isStudent && !isEyeGazeStudent && <PointsSideTab />}
      {overlays && isStudent && !isEyeGazeStudent && <AvatarWorldSideTab />}
      {overlays && isStudent && !isEyeGazeStudent && !isAdminPreview && <HalloreadWelcome />}
      {overlays && isStudent && !isEyeGazeStudent && !isAdminPreview && !isDemoStudent && <LeaderboardPopup onNavigate={(path) => { window.location.hash = path; }} />}
      {overlays && isStudent && !isEyeGazeStudent && !isAdminPreview && !isDemoStudent && <AssessmentPopup onNavigate={(path) => { window.location.hash = path; }} />}
      {overlays && isStudent && !isEyeGazeStudent && !isAdminPreview && !isDemoStudent && <ClassTeachersPopup />}
      {overlays && isStudent && !isAdminPreview && !isDemoStudent && <ParentConnectionBanner />}
      {overlays && !isAdminPreview && !isDemoStudent && !isEyeGazeStudent && <WelcomeGuide />}
      {overlays && !isAdminPreview && <InstallAppPrompt />}
      {overlays && !isAdminPreview && (user?.role === "teacher" || user?.role === "parent" || user?.role === "todo" || user?.isAdmin) && <WorkHubTour />}
      <Router hook={useHashPathLocation}>
        <AuthenticatedNavigationTracker />
        <AdminPreviewBar />
        <EyeGazeSiteShell>
          <ClubPlayGate><AppRoutes /></ClubPlayGate>
          <EyeGazeCelebrations />
        </EyeGazeSiteShell>
      </Router>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <ErrorBoundary>
            <AppInner />
          </ErrorBoundary>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
