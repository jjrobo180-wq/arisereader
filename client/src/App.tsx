import EyeGazeCelebrations from "@/components/EyeGazeCelebrations";
import { Switch, Route, Router, Redirect, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useState, useEffect } from "react";
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
import TeacherDashboard from "./pages/TeacherDashboard";
import Library from "./pages/Library";
import Quiz from "./pages/Quiz";
import ReadBook from "./pages/ReadBook";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Tutorial from "./pages/Tutorial";
import LeaderboardPage from "./pages/LeaderboardPage";
import StudentProgress from "./pages/StudentProgress";
import Competition from "./pages/Competition";
import Polls from "./pages/Polls";
import CoursePage from "./pages/CoursePage";
import ReadingAssessment from "./pages/ReadingAssessment";
import GrowthCheck from "./pages/GrowthCheck";
import EyeGazeQuiz from "./pages/EyeGazeQuiz";
import EyeGazeGames from "./pages/EyeGazeGames";
import EyeGazeHome from "./pages/EyeGazeHome";
import EyeGazeLessons from "./pages/EyeGazeLessons";
import EyeGazeProgress from "./pages/EyeGazeProgress";
import EyeGazeAccount from "./pages/EyeGazeAccount";
import ARISECityComingLater from "./pages/ARISECityComingLater";
import ReadingLevelUp from "./pages/ReadingLevelUp";
import EyeGazeBuddyWorld from "./pages/EyeGazeBuddyWorld";
import EyeGazeMyWorld from "./pages/EyeGazeMyWorld";
import EyeGazeBuddy from "./pages/EyeGazeBuddy";
import EyeGazeTalker from "./pages/EyeGazeTalker";
import EyeGazeParentMode from "./pages/EyeGazeParentMode";
import EyeGazeTV from "./pages/EyeGazeTV";
import EyeGazeFlashcards from "./pages/EyeGazeFlashcards";
import EyeGazeFidgetLab from "./pages/EyeGazeFidgetLab";
import EyeGazeFarmWorld from "./pages/EyeGazeFarmWorld";
import EyeGazePottyCoach from "./pages/EyeGazePottyCoach";
import EyeGazeLifeSkills from "./pages/EyeGazeLifeSkills";
import EyeGazeParentControls from "./pages/EyeGazeParentControls";
import EyeGazeAccessGate from "./components/EyeGazeAccessGate";
import QuizBuilder from "./pages/QuizBuilder";
import LiveQuiz from "./pages/LiveQuiz";
import CustomEyeGazeQuiz from "./pages/CustomEyeGazeQuiz";
import StudentProfileView from "./pages/StudentProfileView";
import StudentMessages from "./pages/StudentMessages";
import StudentCertificates from "./pages/StudentCertificates";
import ParentDashboard from "./pages/ParentDashboard";
import RoleFeatureTour from "./components/RoleFeatureTour";
import GuidedTour from "./components/GuidedTour";
import AssessmentPopup from "./components/AssessmentPopup";
import FypAnnouncementPopup from "./components/FypAnnouncementPopup";
import PointsSideTab from "./components/PointsSideTab";
import AvatarWorldSideTab from "./components/AvatarWorldSideTab";
import LeaderboardPopup from "./components/LeaderboardPopup";
import About from "./pages/About";
import FypPage from "./pages/FypPage";
import FypSharePage from "./pages/FypSharePage";
import FypMyBooksPage from "./pages/FypMyBooksPage";
import ReadingClub from "./pages/ReadingClub";
import TTSAudioBooks from "./pages/TTSAudioBooks";
import AvatarWorld from "./pages/AvatarWorld";
import ClubArise from "./pages/ClubArise";
import ClubPlayGate from "./components/ClubPlayGate";
import ClubTheater from "./pages/ClubTheater";
import Worlds from "./pages/Worlds";
import Neighborhood from "./pages/Neighborhood";
import HomeInterior from "./pages/HomeInterior";
import BoardGameWorld from "./pages/BoardGameWorld";
import NotFound from "./pages/not-found";

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
      <Route path="/tts-audiobooks">
        {isEyeGazeStudent ? <Redirect to="/library" replace /> : <TTSAudioBooks />}
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
  );
}

function AppInner() {
  const { user, realUser, adminPreviewMode, token } = useAuth();
  const isStudent = user && !user.isAdmin && user.role !== 'teacher' && user.role !== 'parent';
  const isParent = user && user.role === 'parent';
  const isEyeGazeStudent = !!isStudent && !!user?.is_eye_gaze_user;
  const isSampleStudent = isStudent && !!user?.username?.startsWith('sample');
  const isAdminPreview = !!realUser?.isAdmin && !!adminPreviewMode;
  const [sampleTourDone, setSampleTourDone] = useState(false);
  const [tourShown, setTourShown] = useState(false);
  const [tourActive, setTourActive] = useState(false);

  // Check server-side if tutorial was already shown for this student
  useEffect(() => {
    if (!isStudent || isSampleStudent) {
      setTourShown(false);
      return;
    }
    const checkTutorial = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/easter-eggs/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { setTourShown(false); return; }
        const data = await res.json();
        if (data.tutorialShown) {
          setTourShown(true);
        }
      } catch {
        setTourShown(false);
      }
    };
    checkTutorial();
  }, [user, token, isStudent, isSampleStudent]);

  const handleTourComplete = async () => {
    setSampleTourDone(true);
    setTourActive(false);
    setTourShown(true);
    // Mark tutorial as shown server-side for non-sample students
    if (!isSampleStudent && token) {
      try {
        await fetch(`${API_BASE}/api/tutorial/dismiss`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
      } catch {}
    }
  };

  return (
    <>
      {isStudent && !isEyeGazeStudent && !isAdminPreview && !tourShown && (
        <GuidedTour onComplete={handleTourComplete} onActiveChange={setTourActive} />
      )}
      {(!isStudent || isEyeGazeStudent) && <RoleFeatureTour />}
      {isStudent && !isEyeGazeStudent && <PointsSideTab />}
      {isStudent && !isEyeGazeStudent && <AvatarWorldSideTab />}
      {isStudent && !isEyeGazeStudent && !isAdminPreview && !isSampleStudent && tourShown && !tourActive && <LeaderboardPopup onNavigate={(path) => { window.location.hash = path; }} />}
      {isStudent && !isEyeGazeStudent && !isAdminPreview && !isSampleStudent && tourShown && !tourActive && <AssessmentPopup onNavigate={(path) => { window.location.hash = path; }} />}
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
