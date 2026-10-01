import EyeGazeCelebrations from "@/components/EyeGazeCelebrations";
import { Switch, Route, Router, Redirect, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useState, useEffect, lazy, Suspense } from "react";
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
import ClubPlayGate from "./components/ClubPlayGate";
import NotFound from "./pages/not-found";

// Keep the initial login/library bundle light. The 3D worlds load only when a student opens them.
const AvatarWorld = lazy(() => import("./pages/AvatarWorld"));
const ClubArise = lazy(() => import("./pages/ClubArise"));
const ClubTheater = lazy(() => import("./pages/ClubTheater"));
const Worlds = lazy(() => import("./pages/Worlds"));
const Neighborhood = lazy(() => import("./pages/Neighborhood"));
const HomeInterior = lazy(() => import("./pages/HomeInterior"));
const BoardGameWorld = lazy(() => import("./pages/BoardGameWorld"));
const UltimateChess = lazy(() => import("./pages/UltimateChess"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const Library = lazy(() => import("./pages/Library"));
const Quiz = lazy(() => import("./pages/Quiz"));
const ReadBook = lazy(() => import("./pages/ReadBook"));
const Profile = lazy(() => import("./pages/Profile"));
const Admin = lazy(() => import("./pages/Admin"));
const Tutorial = lazy(() => import("./pages/Tutorial"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const StudentProgress = lazy(() => import("./pages/StudentProgress"));
const Competition = lazy(() => import("./pages/Competition"));
const Polls = lazy(() => import("./pages/Polls"));
const CoursePage = lazy(() => import("./pages/CoursePage"));
const ReadingAssessment = lazy(() => import("./pages/ReadingAssessment"));
const GrowthCheck = lazy(() => import("./pages/GrowthCheck"));
const EyeGazeQuiz = lazy(() => import("./pages/EyeGazeQuiz"));
const EyeGazeGames = lazy(() => import("./pages/EyeGazeGames"));
const EyeGazeHome = lazy(() => import("./pages/EyeGazeHome"));
const EyeGazeLessons = lazy(() => import("./pages/EyeGazeLessons"));
const EyeGazeProgress = lazy(() => import("./pages/EyeGazeProgress"));
const EyeGazeAccount = lazy(() => import("./pages/EyeGazeAccount"));
const ARISECityComingLater = lazy(() => import("./pages/ARISECityComingLater"));
const ReadingLevelUp = lazy(() => import("./pages/ReadingLevelUp"));
const EyeGazeBuddyWorld = lazy(() => import("./pages/EyeGazeBuddyWorld"));
const EyeGazeMyWorld = lazy(() => import("./pages/EyeGazeMyWorld"));
const EyeGazeBuddy = lazy(() => import("./pages/EyeGazeBuddy"));
const EyeGazeTalker = lazy(() => import("./pages/EyeGazeTalker"));
const EyeGazeParentMode = lazy(() => import("./pages/EyeGazeParentMode"));
const EyeGazeTV = lazy(() => import("./pages/EyeGazeTV"));
const EyeGazeFlashcards = lazy(() => import("./pages/EyeGazeFlashcards"));
const EyeGazeFidgetLab = lazy(() => import("./pages/EyeGazeFidgetLab"));
const EyeGazeFarmWorld = lazy(() => import("./pages/EyeGazeFarmWorld"));
const EyeGazePottyCoach = lazy(() => import("./pages/EyeGazePottyCoach"));
const EyeGazeLifeSkills = lazy(() => import("./pages/EyeGazeLifeSkills"));
const EyeGazeParentControls = lazy(() => import("./pages/EyeGazeParentControls"));
const QuizBuilder = lazy(() => import("./pages/QuizBuilder"));
const LiveQuiz = lazy(() => import("./pages/LiveQuiz"));
const CustomEyeGazeQuiz = lazy(() => import("./pages/CustomEyeGazeQuiz"));
const StudentProfileView = lazy(() => import("./pages/StudentProfileView"));
const StudentMessages = lazy(() => import("./pages/StudentMessages"));
const StudentCertificates = lazy(() => import("./pages/StudentCertificates"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const About = lazy(() => import("./pages/About"));
const FypPage = lazy(() => import("./pages/FypPage"));
const FypSharePage = lazy(() => import("./pages/FypSharePage"));
const FypMyBooksPage = lazy(() => import("./pages/FypMyBooksPage"));
const ReadingClub = lazy(() => import("./pages/ReadingClub"));

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
          ? <ProtectedRoute><Redirect to="/worlds" replace /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/arise-arcade">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><ClubArise /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/club-arise/theater">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><ClubTheater /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/worlds">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><Worlds /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/neighborhood">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><Neighborhood /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/board-game-world">
        {!isEyeGazeStudent
          ? <ProtectedRoute><BoardGameWorld /></ProtectedRoute>
          : <Redirect to="/eye-gaze-home" replace />}
      </Route>
      <Route path="/ultimate-chess">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><UltimateChess /></ProtectedRoute>
          : <Redirect to="/" replace />}
      </Route>
      <Route path="/laser-royale">
        {user && !user.isAdmin && user.role === "student" && !user.is_eye_gaze_user
          ? <ProtectedRoute><Redirect to="/worlds" replace /></ProtectedRoute>
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

function AppInner() {
  const { user, realUser, adminPreviewMode } = useAuth();
  const isStudent = user && !user.isAdmin && user.role !== 'teacher' && user.role !== 'parent';
  const isEyeGazeStudent = !!isStudent && !!user?.is_eye_gaze_user;
  const isDemoStudent = !!isStudent && (
    !!user?.username?.startsWith('sample') || user?.username === 'tutorial-eye'
  );
  const isAdminPreview = !!realUser?.isAdmin && !!adminPreviewMode;

  return (
    <>
      {isStudent && !isEyeGazeStudent && <PointsSideTab />}
      {isStudent && !isEyeGazeStudent && <AvatarWorldSideTab />}
      {isStudent && !isEyeGazeStudent && !isAdminPreview && !isDemoStudent && <LeaderboardPopup onNavigate={(path) => { window.location.hash = path; }} />}
      {isStudent && !isEyeGazeStudent && !isAdminPreview && !isDemoStudent && <AssessmentPopup onNavigate={(path) => { window.location.hash = path; }} />}
      {isStudent && !isAdminPreview && !isDemoStudent && <ParentConnectionBanner />}
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
