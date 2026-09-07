import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, ChevronRight, ChevronLeft, CheckCircle2, Lock, Trophy, Clock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTokenFromCookie } from "@/lib/auth";

interface Lesson {
  title: string;
  content: string;
}

interface Course {
  title: string;
  lessons: Lesson[];
}

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

export default function CoursePage() {
  const { id: bookId } = useParams<{ id: string }>();
  const [location, navigate] = useLocation();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentLesson, setCurrentLesson] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  const fetchCourse = useCallback(async () => {
    if (!bookId) return;
    try {
      const res = await fetch(`${API_BASE}/api/iarise-course/${bookId}`);
      if (res.ok) {
        const data = await res.json();
        setCourse(data);
        // Load progress from localStorage (fallback to in-memory if blocked)
        try {
          const saved = localStorage.getItem(`iarise_progress_${bookId}`);
          if (saved) {
            const arr = JSON.parse(saved) as number[];
            setCompletedLessons(new Set(arr));
          }
        } catch {}
      } else {
        setError("Course not found");
      }
    } catch (err) {
      setError("Failed to load course");
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  const markLessonComplete = (lessonIndex: number) => {
    const newSet = new Set(completedLessons);
    newSet.add(lessonIndex);
    setCompletedLessons(newSet);
    if (bookId) {
      try {
        localStorage.setItem(`iarise_progress_${bookId}`, JSON.stringify([...newSet]));
      } catch {}
    }
  };

  const handleNext = () => {
    if (!course) return;
    markLessonComplete(currentLesson);
    if (currentLesson < course.lessons.length - 1) {
      setCurrentLesson(currentLesson + 1);
    }
  };

  const handlePrev = () => {
    if (currentLesson > 0) {
      setCurrentLesson(currentLesson - 1);
    }
  };

  const allLessonsComplete = course && completedLessons.size >= course.lessons.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-lg">Loading course...</div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || "Course not found"}</p>
          <Button onClick={() => navigate("/library")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Library
          </Button>
        </div>
      </div>
    );
  }

  const lesson = course.lessons[currentLesson];
  const totalLessons = course.lessons.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/library")}
            className="hover:bg-muted"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary shrink-0" />
              <h1 className="font-bold text-sm truncate">{course.title}</h1>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />5 min
              </span>
              <span className="flex items-center gap-1">
                <Trophy className="w-3 h-3" />2 pts
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-muted-foreground">
              Lesson {currentLesson + 1} of {totalLessons}
            </span>
            <span className="text-sm text-muted-foreground">
              {completedLessons.size}/{totalLessons} completed
            </span>
          </div>
          <div className="flex gap-1.5">
            {course.lessons.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentLesson(idx)}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  completedLessons.has(idx)
                    ? "bg-primary"
                    : idx === currentLesson
                    ? "bg-primary/50"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Lesson content */}
        <div className="bg-card border border-border rounded-xl p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/15 text-primary text-sm font-bold">
              {currentLesson + 1}
            </span>
            {completedLessons.has(currentLesson) && (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}
          </div>
          <h2 className="text-xl font-bold mb-4">{lesson.title}</h2>
          <div className="prose prose-sm sm:prose-base max-w-none">
            {lesson.content.split("\n").map((paragraph, i) => {
              const trimmed = paragraph.trim();
              if (!trimmed) return null;
              if (trimmed.startsWith("Key takeaway:")) {
                return (
                  <div key={i} className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-sm font-semibold text-primary m-0">{trimmed}</p>
                  </div>
                );
              }
              return <p key={i} className="text-sm sm:text-base text-foreground/90 leading-relaxed mb-3">{trimmed}</p>;
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentLesson === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>

          {currentLesson < totalLessons - 1 ? (
            <Button onClick={handleNext}>
              Next Lesson <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => markLessonComplete(currentLesson)}
              variant={allLessonsComplete ? "default" : "outline"}
              className={allLessonsComplete ? "" : ""}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {allLessonsComplete ? "All Lessons Complete!" : "Mark Complete"}
            </Button>
          )}
        </div>

        {/* Quiz unlock */}
        <div className="mt-8">
          {allLessonsComplete ? (
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <h3 className="font-bold text-lg mb-1">You're ready for the quiz!</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You've completed all {totalLessons} lessons. Take the quiz to earn 2 points.
              </p>
              <Button
                size="lg"
                onClick={() => navigate(`/quiz/${bookId}`)}
                className="gap-2"
              >
                <Trophy className="w-5 h-5" />
                Take Quiz
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
              <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Complete all {totalLessons} lessons to unlock the quiz
              </p>
              <div className="flex justify-center gap-1.5 mt-3">
                {course.lessons.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2.5 h-2.5 rounded-full ${
                      completedLessons.has(idx) ? "bg-green-500" : "bg-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
