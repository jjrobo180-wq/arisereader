import { Switch, Route, Router, Redirect } from "wouter";
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
import Polls from "./pages/Polls";
import CoursePage from "./pages/CoursePage";
import ReadingAssessment from "./pages/ReadingAssessment";
import EyeGazeQuiz from "./pages/EyeGazeQuiz";
import QuizBuilder from "./pages/QuizBuilder";
import CustomEyeGazeQuiz from "./pages/CustomEyeGazeQuiz";
import StudentProfileView from "./pages/StudentProfileView";
import StudentMessages from "./pages/StudentMessages";
import StudentCertificates from "./pages/StudentCertificates";
import ParentDashboard from "./pages/ParentDashboard";
import ParentTutorialPopup from "./components/ParentTutorialPopup";
import GuidedTour from "./components/GuidedTour";
import AssessmentPopup from "./components/AssessmentPopup";
import FypAnnouncementPopup from "./components/FypAnnouncementPopup";
import FypSideTab from "./components/FypSideTab";
import PointsSideTab from "./components/PointsSideTab";
import LeaderboardPopup from "./components/LeaderboardPopup";
import About from "./pages/About";
import FypPage from "./pages/FypPage";
import FypSharePage from "./pages/FypSharePage";
import FypMyBooksPage from "./pages/FypMyBooksPage";
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
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-blue-50">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Redirect to="/" />;
  // Parents can only access the parent dashboard
  if (user.role === 'parent' && !user.isAdmin) {
    return <Redirect to="/parent-dashboard" />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();
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
        <ProtectedRoute><FypMyBooksPage /></ProtectedRoute>
      </Route>
      <Route path="/">
        {user ? (user.isAdmin ? <Redirect to="/admin" /> : user.role === 'teacher' ? <Redirect to="/teacher-dashboard" /> : user.role === 'parent' ? <Redirect to="/parent-dashboard" /> : <StudentSetupGate><Redirect to="/library" /></StudentSetupGate>) : <Login />}
      </Route>
      <Route path="/register">
        {user ? (user.isAdmin ? <Redirect to="/admin" /> : user.role === 'teacher' ? <Redirect to="/teacher-dashboard" /> : user.role === 'parent' ? <Redirect to="/parent-dashboard" /> : <StudentSetupGate><Redirect to="/library" /></StudentSetupGate>) : <Register />}
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
      <Route path="/leaderboard">
        <LeaderboardPage />
      </Route>
      <Route path="/about">
        <About />
      </Route>
      <Route path="/polls">
        <ProtectedRoute><Polls /></ProtectedRoute>
      </Route>
      <Route path="/library">
        <ProtectedRoute><Library /></ProtectedRoute>
      </Route>
      <Route path="/course/:id">
        <ProtectedRoute><CoursePage /></ProtectedRoute>
      </Route>
      <Route path="/quiz/:id">
        <ProtectedRoute><Quiz /></ProtectedRoute>
      </Route>
      <Route path="/read/:id">
        <ProtectedRoute><ReadBook /></ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute><Profile /></ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute><Admin /></ProtectedRoute>
      </Route>
      <Route path="/progress">
        <ProtectedRoute><ReadingAssessment /></ProtectedRoute>
      </Route>
      <Route path="/eye-gaze-quiz/:id">
        <ProtectedRoute><EyeGazeQuiz /></ProtectedRoute>
      </Route>
      <Route path="/quiz-builder">
        <ProtectedRoute><QuizBuilder /></ProtectedRoute>
      </Route>
      <Route path="/quiz-builder/:id">
        <ProtectedRoute><QuizBuilder /></ProtectedRoute>
      </Route>
      <Route path="/custom-quiz/:id">
        <ProtectedRoute><CustomEyeGazeQuiz /></ProtectedRoute>
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
        <ProtectedRoute><FypPage /></ProtectedRoute>
      </Route>
      <Route path="/fyp/share/:token">
        {(params) => <FypSharePage token={params.token} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppInner() {
  const { user } = useAuth();
  const isStudent = user && !user.isAdmin && user.role !== 'teacher' && user.role !== 'parent';
  const isParent = user && user.role === 'parent';
  const isSampleStudent = isStudent && user?.username === 'sample';
  const [sampleTourDone, setSampleTourDone] = useState(false);
  return (
    <>
      {/* Regular students get tutorial popup; sample student gets guided tour instead */}
      {isStudent && !isSampleStudent && <FypAnnouncementPopup onNavigate={(path) => { window.location.hash = path; }} />}
      {isStudent && <FypSideTab />}
      {isStudent && <PointsSideTab />}
      {/* Sample student: no leaderboard popup, guided tour only */}
      {isStudent && !isSampleStudent && <LeaderboardPopup onNavigate={(path) => { window.location.hash = path; }} />}
      {isStudent && <AssessmentPopup onNavigate={(path) => { window.location.hash = path; }} />}
      {isParent && <ParentTutorialPopup />}
      {isSampleStudent && <GuidedTour onComplete={() => setSampleTourDone(true)} />}
      <Router hook={useHashLocation}>
        <AppRoutes />
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
