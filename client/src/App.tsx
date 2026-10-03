import EyeGazeCelebrations from "@/components/EyeGazeCelebrations";
import { Switch, Route, Router, Redirect, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "./context/AuthContext";
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
import Login from "./pages/Login";
import Register from "./pages/Register";
import TeacherSignup from "./pages/TeacherSignup";
import ParentSignup from "./pages/ParentSignup";
import EyeGazeAccessGate from "./components/EyeGazeAccessGate";
import ParentConnectionBanner from "./components/ParentConnectionBanner";
import AssessmentPopup from "./components/AssessmentPopup";
import FypAnnouncementPopup from "./components/FypAnnouncementPopup";
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
const AriseCity = lazyPage(() => import("./pages/AriseCity"));
const HomeInterior = lazyPage(() => import("./pages/HomeInterior"));
const BoardGameWorld = lazyPage(() => import("./pages/BoardGameWorld"));
const MidnightMystery = lazyPage(() => import("./pages/MidnightMystery"));
const UltimateChess = lazyPage(() => import("./pages/UltimateChess"));
const PaintballArena = lazyPage(() => import("./pages/PaintballArena"));
const SkyboundSprint = lazyPage(() => import("./pages/SkyboundSprint"));
const AuroraRally = lazyPage(() => import("./pages/AuroraRally"));
const TeacherDashboard = lazyPage(() => import("./pages/TeacherDashboard"));
const Library = lazyPage(() => import("./pages/Library"));
const Quiz = lazyPage(() => import("./pages/Quiz"));
const ReadBook = lazyPage(() => import("./pages/ReadBook"));
const Profile = lazyPage(() => import("./pages/Profile"));
const Admin = lazyPage(() => import("./pages/Admin"));
const Tutorial = lazyPage(() => import("./pages/Tutorial"));
const LeaderboardPage = lazyPage(() => import("./pages/LeaderboardPage"));
const StudentProgress = lazyPage(() => import("./pages/StudentProgress"));
const Competition = lazyPage(() => import("./pages/Competition"));
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
const ParentDashboard = lazyPage(() => import("./pages/ParentDashboard"));
const About = lazyPage(() => import("./pages/About"));
const FypPage = lazyPage(() => import("./pages/FypPage"));
const FypSharePage = lazyPage(() => import("./pages/FypSharePage"));
const FypMyBooksPage = lazyPage(() => import("./pages/FypMyBooksPage"));
const ReadingClub = lazyPage(() => import("./pages/ReadingClub"));
const TeacherArise2 = lazyPage(() => import("./pages/TeacherArise2"));
const ParentArise2 = lazyPage(() => import("./pages/ParentArise2"));

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
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-blue-50">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Redirect to="/" replace />;
  // A linked parent can also open their child's talker and family tools.
  if (user.role === 'parent' && !user.isAdmin && !['/parent-dashboard', '/eye-gaze-parent', '/eye-gaze-parent-controls', '/eye-gaze-talker', '/my-world', '/eye-gaze-flashcards', '/eye-gaze-life-skills', '/eye-gaze-potty'].includes(location)) {
    return <Redirect to="/parent-dashboard" replace />;
  }
  return <>{children}</>;
}

function AdminPreviewBar() {
  const { realUser, adminPreviewMode, startAdminPreview, exitAdminPreview } = useAuth();
  const [, navigate] = useLocation();
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

function AppRoutes() {
  const { user, isLoading } = useAuth();
  // Eye-gaze mode is only for non-privileged learner accounts. Admin,
  // teacher, and parent roles must always keep the standard site layout.
  const isEyeGazeStudent = !!user && !user.isAdmin && user.role !== 'teacher' && user.role !== 'parent' && !!user.is_eye_gaze_user;
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-blue-50">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
    <Switch>
      <Route path="/saved">
        {isEyeGazeStudent ? <Redirect to="/library" replace /> : <ProtectedRoute><FypMyBooksPage /></ProtectedRoute>}
      </Route>
      <Route path="/">
        {user ? (user.isAdmin ? <Redirect to="/admin" replace /> : user.role === 'teacher' ? <Redirect to="/teacher-dashboard" replace /> : user.role === 'parent' ? <Redirect to="/parent-dashboard" replace /> : isEyeGazeStudent ? <StudentSetupGate><Redirect to="/eye-gaze-home" replace /></StudentSetupGate> : <StudentSetupGate><Redirect to="/library" replace /></StudentSetupGate>) : <Login />}
      </Route>
      <Route path="/register">
        {user ? (user.isAdmin ? <Redirect to="/admin" replace /> : user.role === 'teacher' ? <Redirect to="/teacher-dashboard" replace /> : user.role === 'parent' ? <Redirect to="/parent-dashboard" replace /> : isEyeGazeStudent ? <StudentSetupGate><Redirect to="/eye-gaze-home" replace /></StudentSetupGate> : <StudentSetupGate><Redirect to="/library" replace /></StudentSetupGate>) : <Register />}
      </Route>
      <Route path="/register-independent">
        {user ? (user.isAdmin ? <Redirect to="/admin" replace /> : user.role === 'teacher' ? <Redirect to="/teacher-dashboard" replace /> : user.role === 'parent' ? <Redirect to="/parent-dashboard" replace /> : isEyeGazeStudent ? <StudentSetupGate><Redirect to="/eye-gaze-home" replace /></StudentSetupGate> : <StudentSetupGate><Redirect to="/library" replace /></StudentSetupGate>) : <Register independent />}
      </Route>
      <Route path="/teacher-signup">
        <TeacherSignup />
      </Route>
      <Route path="/parent-signup">
        <ParentSignup />
      </Route>
      <Route path="/parent-dashboard">
        <ProtectedRoute><ParentDashboard /></ProtectedRoute>
      </Route>
      <Route path="/teacher-dashboard">
        <ProtectedRoute><TeacherDashboard /></ProtectedRoute>
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
      {/* The Cinema and The Block are now part of Haven City. */}
      <Route path="/club-arise/theater">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><Redirect to="/city" replace /></ProtectedRoute>
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
      <Route path="/read/:id">
        <ProtectedRoute>{isEyeGazeStudent ? <EyeGazeAccessGate path="/library"><ReadBook /></EyeGazeAccessGate> : <ReadBook />}</ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute>
          {isEyeGazeStudent ? <Redirect to="/eye-gaze-account" replace /> : <Profile />}
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute><Admin /></ProtectedRoute>
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
const FULLSCREEN_GAME_ROUTES = ["/games", "/paintball-arena", "/aurora-rally", "/skybound-sprint"];
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
  const isStudent = user && !user.isAdmin && user.role !== 'teacher' && user.role !== 'parent';
  const isEyeGazeStudent = !!isStudent && !!user?.is_eye_gaze_user;
  const isDemoStudent = !!isStudent && (
    !!user?.username?.startsWith('sample') || user?.username === 'tutorial-eye'
  );
  const isAdminPreview = !!realUser?.isAdmin && !!adminPreviewMode;

  const overlays = !inGame;
  return (
    <>
      {overlays && isStudent && !isEyeGazeStudent && <PointsSideTab />}
      {overlays && isStudent && !isEyeGazeStudent && <AvatarWorldSideTab />}
      {overlays && isStudent && !isEyeGazeStudent && !isAdminPreview && <HalloreadWelcome />}
      {overlays && isStudent && !isEyeGazeStudent && !isAdminPreview && !isDemoStudent && <LeaderboardPopup onNavigate={(path) => { window.location.hash = path; }} />}
      {overlays && isStudent && !isEyeGazeStudent && !isAdminPreview && !isDemoStudent && <AssessmentPopup onNavigate={(path) => { window.location.hash = path; }} />}
      {overlays && isStudent && !isAdminPreview && !isDemoStudent && <ParentConnectionBanner />}
      <Router hook={useHashLocation}>
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
