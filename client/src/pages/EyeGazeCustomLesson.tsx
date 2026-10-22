// A teacher-made quiz (#/custom-quiz/:id) for an Eye Gazer: the same lesson player as the
// built-in lessons, so it reads, looks and works the same way. Other accounts keep CustomEyeGazeQuiz.
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import LessonPlayer from "@/components/eye-gaze/LessonPlayer";
import { customQuestion, isPictureFile, lessonInfo } from "@/lib/eyeGazeLesson";
import { picturePath } from "@shared/eyegaze/lessonSteps";

function cookieToken(): string | null {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    return match ? JSON.parse(atob(match[1])).token || null : null;
  } catch {
    return null;
  }
}

export default function EyeGazeCustomLesson() {
  const { id } = useParams<{ id: string }>();
  const quizId = Number(id) || 0;
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [quiz, setQuiz] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = token || cookieToken();
    let active = true;
    setQuiz(null);
    setError("");
    fetch(`${API_BASE}/api/custom-quizzes/${quizId}`, { headers: t ? { Authorization: `Bearer ${t}` } : {}, cache: "no-store" })
      .then(async r => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (!active) return;
        if (ok) setQuiz(data);
        else setError(data?.message || "This quiz could not be found.");
      })
      .catch(() => { if (active) setError("This quiz could not load. Check the internet and try again."); });
    return () => { active = false; };
  }, [quizId, token]);

  const back = () => navigate("/eye-gaze-lessons");

  if (error) {
    return (
      <div className="grid min-h-[100dvh] place-items-center p-4">
        <div className="w-full max-w-lg rounded-[2rem] border-4 border-teal-100 bg-[#fffaf0] p-8 text-center shadow-sm" role="alert">
          <div className="text-6xl" aria-hidden="true">🙂</div>
          <p className="mt-3 text-2xl font-black text-teal-950">{error}</p>
          <button type="button" onClick={back} className="mt-6 inline-flex min-h-16 items-center gap-2 rounded-2xl bg-teal-700 px-6 text-xl font-black text-white"><ArrowLeft className="h-6 w-6" />Lessons</button>
        </div>
      </div>
    );
  }
  if (!quiz) return <div className="grid min-h-[100dvh] place-items-center text-2xl font-black text-teal-950" role="status">Loading the quiz…</div>;

  // A teacher's quiz has no learn cards; its first picture (if any) is its cover.
  const firstPicture = (quiz.questions || []).map((q: any) => q.question_image).find(isPictureFile);
  const info = lessonInfo({
    ...quiz,
    description: String(quiz.description || "").replace(/^AI-generated eye gaze quiz about\s+/i, "A quiz about ") || "A quiz from your teacher.",
    cover_visual: firstPicture || picturePath("teacher"),
    learn_cards: [],
  });
  return (
    <LessonPlayer
      key={quizId}
      info={info}
      source={{
        kind: "custom_eye_gaze",
        quizId,
        startPath: `/api/custom-quizzes/${quizId}/start`,
        attemptPath: attemptId => `/api/custom-quizzes/${attemptId}`,
        toQuestion: customQuestion,
      }}
      onExit={back}
    />
  );
}
