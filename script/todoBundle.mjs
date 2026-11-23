// What the Arise To Duo iPhone app's build leaves out (vite.todo.config.ts): the pages and parts of the
// other products that share this web code (Arise Reader's student side, the games, the eye-gaze and AAC
// apps, Arise Talk, Arise Undercover, admin). None of them can be opened in To Duo, so none of them goes
// into the app (App Review 2.5.19: no hidden or dormant features in the binary).
//
// A left-out file becomes a tiny stand-in: a component that shows nothing (or only what it wraps). They
// are imported only as whole components (their default export), so nothing To Duo uses goes missing;
// the build fails if a To Duo file asks a left-out file for anything else.

/** Folders left out whole (paths from the repository root). */
export const TODO_LEFT_OUT_DIRS = [
  "client/src/undercover/",
  "client/src/pages/talk/",
  "client/src/pages/arise-kids/",
  "client/src/pages/play/",
  "client/src/pages/news/",
  "client/src/pages/reads/",
  "client/src/pages/study/",
  "client/src/pages/present/",
];

/** Single files left out (without their .tsx/.ts ending). */
export const TODO_LEFT_OUT_FILES = [
  // Arise Reader's student side, its games and worlds. (WorkHub's Reader tools for teachers stay: they open
  // LiveQuiz, TeacherScenes and the student pages from inside WorkHub.)
  ...["AvatarWorld", "Games", "MeetingPoll", "LessonPlansPublic", "TvLink", "AriseCity", "ClubTheater", "HomeInterior",
    "BoardGameWorld", "MidnightMystery", "UltimateChess", "PaintballArena", "SkyboundSprint", "AuroraRally", "StandaloneGame",
    "QuizPermission", "TodoAdmin", "AmbientStandby", "AriseReader", "StudentSceneLive", "Library", "Quiz",
    "ReadBook", "Tutorial", "LeaderboardPage", "StudentProgress", "Competition", "TimedCompetition", "Polls", "EnglishExplorer",
    "Beginners", "CoursePage", "ReadingAssessment", "GrowthCheck", "ARISECityComingLater", "ReadingLevelUp", "QuizBuilder",
    "About", "FypPage", "FypSharePage",
    "FypMyBooksPage", "ReadingClub", "TeacherArise2", "ParentArise2", "Pricing", "Billing", "ReaderScholarship",
    "CustomEyeGazeQuiz"].map((p) => `client/src/pages/${p}`),
  // The eye-gaze and AAC apps (Arise AAC is its own app).
  ...["Account", "Buddy", "BuddyWorld", "CustomLesson", "FarmWorld", "FidgetLab", "Flashcards", "Games", "Home", "LearningZone",
    "Lessons", "LifeSkills", "MyWorld", "ParentControls", "ParentMode", "PhotoTalk", "PottyCoach", "Progress", "Quiz", "TV",
    "Talker", "Wren"].map((p) => `client/src/pages/EyeGaze${p}`),
  // Arise Reader's overlays and the eye-gaze and game wrappers.
  ...["EyeGazeCelebrations", "EyeGazeSiteShell", "EyeGazeAccessGate", "ClubPlayGate", "ReaderFirstRun", "AssessmentPopup",
    "PointsSideTab", "AvatarWorldSideTab", "AdvisoryChallenge"].map((p) => `client/src/components/${p}`),
];

/** Files inside a left-out folder that To Duo itself uses (the Plugin Gallery's Bookstore uses the reading fonts). */
export const TODO_KEPT = ["client/src/pages/reads/useReads"];

/** Is this file (an absolute path, or one from the repository root) left out of To Duo? */
export function todoLeavesOut(file, root) {
  const rel = (root && file.startsWith(root) ? file.slice(root.length).replace(/^\/+/, "") : file).replace(/\\/g, "/");
  const bare = rel.replace(/\.(tsx|ts|jsx|js)$/, "");
  if (TODO_KEPT.includes(bare)) return false;
  if (TODO_LEFT_OUT_DIRS.some((d) => rel.startsWith(d))) return true;
  return TODO_LEFT_OUT_FILES.includes(bare);
}

/** The stand-in a left-out file becomes. */
export const TODO_STAND_IN = "export default function LeftOutOfToDuo(props) { return props && props.children !== undefined ? props.children : null; }\n";

/** Words that must never be in the To Duo app: the build fails if any is (.github/scripts/prune_todo_bundle.sh). */
export const TODO_FORBIDDEN = ["UndercoverApp", "decoy chat", "Quick hide", "looks like texting", "CapacitorUpdater", "/api/ota/", "notifyAppReady"];
