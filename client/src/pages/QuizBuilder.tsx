import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, ImagePlus, Save, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

import { API_BASE } from "@/lib/queryClient";

function getTokenFromCookie(): string | null {
  try {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const c = cookies[i].trim();
      if (c.startsWith("arise_session=")) {
        const raw = c.substring("arise_session".length + 1);
        const data = JSON.parse(atob(raw));
        return data.token || null;
      }
    }
  } catch {}
  return null;
}

// Resize image to max 500px and convert to base64 JPEG
function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 500;
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

interface OptionData {
  text: string;
  image: string | null;
}

interface QuestionData {
  prompt: string;
  question_image: string | null;
  options: [OptionData, OptionData, OptionData, OptionData];
  correct_answer: string;
}

function emptyQuestion(): QuestionData {
  return {
    prompt: "",
    question_image: null,
    options: [
      { text: "", image: null },
      { text: "", image: null },
      { text: "", image: null },
      { text: "", image: null },
    ],
    correct_answer: "A",
  };
}

const LETTERS = ["A", "B", "C", "D"];

export default function QuizBuilder() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("Custom");
  const [quizType, setQuizType] = useState("eye_gaze");
  const [questions, setQuestions] = useState<QuestionData[]>([emptyQuestion()]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [editQuizId, setEditQuizId] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load existing quiz for editing
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/quiz-builder\/(\d+)/);
    if (match) {
      const quizId = parseInt(match[1]);
      setEditQuizId(quizId);
      const token = getTokenFromCookie();
      if (token) {
        fetch(`${API_BASE}/api/custom-quizzes/${quizId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(res => res.ok ? res.json() : null)
          .then(quiz => {
            if (quiz) {
              setTitle(quiz.title || "");
              setDescription(quiz.description || "");
              setLevel(quiz.level || "Custom");
              if (quiz.questions && Array.isArray(quiz.questions)) {
                setQuestions(quiz.questions.map((q: any) => ({
                  prompt: q.prompt || "",
                  question_image: q.question_image || null,
                  correct_answer: q.correct_answer || "A",
                  options: [
                    { text: q.option_a_text || "", image: q.option_a_image || null },
                    { text: q.option_b_text || "", image: q.option_b_image || null },
                    { text: q.option_c_text || "", image: q.option_c_image || null },
                    { text: q.option_d_text || "", image: q.option_d_image || null },
                  ],
                })));
              }
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  const handleImageUpload = async (file: File, key: string) => {
    try {
      setUploadingFor(key);
      const dataUrl = await processImageFile(file);
      if (key.startsWith("question-")) {
        const qIdx = parseInt(key.split("-")[1]);
        setQuestions((prev) => {
          const next = [...prev];
          next[qIdx] = { ...next[qIdx], question_image: dataUrl };
          return next;
        });
      } else {
        const [qIdx, optIdx] = key.split("-").map(Number);
        setQuestions((prev) => {
          const next = [...prev];
          const opts = [...next[qIdx].options];
          opts[optIdx] = { ...opts[optIdx], image: dataUrl };
          next[qIdx] = { ...next[qIdx], options: opts as [OptionData, OptionData, OptionData, OptionData] };
          return next;
        });
      }
    } catch {
      setError("Failed to process image. Please try a different file.");
    } finally {
      setUploadingFor(null);
    }
  };

  const updateQuestion = (idx: number, field: keyof QuestionData, value: any) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const updateOption = (qIdx: number, optIdx: number, field: keyof OptionData, value: any) => {
    setQuestions((prev) => {
      const next = [...prev];
      const opts = [...next[qIdx].options];
      opts[optIdx] = { ...opts[optIdx], [field]: value };
      next[qIdx] = { ...next[qIdx], options: opts as [OptionData, OptionData, OptionData, OptionData] };
      return next;
    });
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Please enter a quiz title");
      return;
    }
    const validQuestions = questions.filter((q) => {
      const hasPrompt = q.prompt.trim();
      const hasOptions = q.options.some((o) => o.text.trim() || o.image);
      return hasPrompt || hasOptions;
    });
    if (validQuestions.length === 0) {
      setError("Please add at least one question with a prompt and at least one answer option");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = getTokenFromCookie();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const payload = {
        title: title.trim(),
        description: description.trim(),
        level: level || "Custom",
        quizType,
        visibility: user?.isAdmin ? 'global' : 'teacher_students',
        questions: validQuestions.map((q) => ({
          prompt: q.prompt.trim(),
          question_image: q.question_image,
          option_a_text: q.options[0].text.trim(),
          option_a_image: q.options[0].image,
          option_b_text: q.options[1].text.trim(),
          option_b_image: q.options[1].image,
          option_c_text: q.options[2].text.trim(),
          option_c_image: q.options[2].image,
          option_d_text: q.options[3].text.trim(),
          option_d_image: q.options[3].image,
          correct_answer: q.correct_answer,
        })),
      };

      const res = editQuizId
        ? await fetch(`${API_BASE}/api/custom-quizzes/${editQuizId}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(payload),
          })
        : await fetch(`${API_BASE}/api/custom-quizzes`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save quiz");
      setSaved(true);
      setTimeout(() => navigate("/library"), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to save quiz");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
        <CheckCircle2 size={80} color="hsl(21 100% 50%)" />
        <h2 style={{ fontSize: "2rem", fontWeight: 800 }}>Quiz Saved!</h2>
        <p style={{ color: "hsl(0 0% 66%)", fontSize: "1.25rem" }}>Redirecting to Library...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "1rem", maxWidth: "900px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
        <button
          onClick={() => navigate("/library")}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", color: "hsl(0 0% 66%)", fontSize: "1rem", background: "none", border: "none", cursor: "pointer" }}
        >
          <ArrowLeft size={20} /> Back
        </button>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "hsl(21 100% 50%)" }}>
          {editQuizId ? "Edit Quiz" : "Create Quiz"}
        </h1>
      </div>

      {/* Quiz Info */}
      <div style={{ background: "hsl(0 0% 14%)", borderRadius: "1rem", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid hsl(0 0% 20%)" }}>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.875rem", color: "hsl(0 0% 66%)", marginBottom: "0.5rem", fontWeight: 600 }}>
            Quiz Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., What is the Weather?"
            style={{ width: "100%", padding: "0.75rem", background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: "0.5rem", color: "hsl(0 0% 100%)", fontSize: "1.1rem", outline: "none" }}
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.875rem", color: "hsl(0 0% 66%)", marginBottom: "0.5rem", fontWeight: 600 }}>
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Look at the picture and choose the right answer"
            style={{ width: "100%", padding: "0.75rem", background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: "0.5rem", color: "hsl(0 0% 100%)", fontSize: "1rem", outline: "none" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.875rem", color: "hsl(0 0% 66%)", marginBottom: "0.5rem", fontWeight: 600 }}>
            Quiz Type
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
n              type="button"
              onClick={() => setQuizType("eye_gaze")}
              style={{
                flex: 1,
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: quizType === "eye_gaze" ? "2px solid hsl(21 100% 50%)" : "1px solid hsl(0 0% 20%)",
                background: quizType === "eye_gaze" ? "hsl(21 100% 50% / 0.1)" : "hsl(0 0% 10%)",
                color: quizType === "eye_gaze" ? "hsl(21 100% 50%)" : "hsl(0 0% 66%)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
            >
              Eye Gazer &amp; Non-Verbal
            </button>
            {user?.isAdmin && (
              <button
                type="button"
                onClick={() => setQuizType("regular")}
                style={{
                  flex: 1,
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: quizType === "regular" ? "2px solid hsl(21 100% 50%)" : "1px solid hsl(0 0% 20%)",
                  background: quizType === "regular" ? "hsl(21 100% 50% / 0.1)" : "hsl(0 0% 10%)",
                  color: quizType === "regular" ? "hsl(21 100% 50%)" : "hsl(0 0% 66%)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
              >
                Regular Quiz
              </button>
            )}
          </div>
          {user?.role === 'teacher' && (
            <p style={{ fontSize: "0.75rem", color: "hsl(0 0% 50%)", marginTop: "0.5rem" }}>
              This quiz will only be visible to students under your profile.
            </p>
          )}
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.875rem", color: "hsl(0 0% 66%)", marginBottom: "0.5rem", fontWeight: 600 }}>
            Level Label
          </label>
          <input
            type="text"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            placeholder="e.g., Level 1, Custom, etc."
            style={{ width: "100%", padding: "0.75rem", background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: "0.5rem", color: "hsl(0 0% 100%)", fontSize: "1rem", outline: "none" }}
          />
        </div>
      </div>

      {/* Questions */}
      {questions.map((q, qIdx) => (
        <div
          key={qIdx}
          style={{ background: "hsl(0 0% 14%)", borderRadius: "1rem", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid hsl(0 0% 20%)" }}
        >
          {/* Question header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "hsl(21 100% 50%)" }}>
              Question {qIdx + 1}
            </h3>
            {questions.length > 1 && (
              <button
                onClick={() => removeQuestion(qIdx)}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "hsl(0 72% 51%)", background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem" }}
              >
                <Trash2 size={16} /> Remove
              </button>
            )}
          </div>

          {/* Question prompt */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.875rem", color: "hsl(0 0% 66%)", marginBottom: "0.5rem", fontWeight: 600 }}>
              Question Text
            </label>
            <input
              type="text"
              value={q.prompt}
              onChange={(e) => updateQuestion(qIdx, "prompt", e.target.value)}
              placeholder="e.g., What is the weather in this picture?"
              style={{ width: "100%", padding: "0.75rem", background: "hsl(0 0% 10%)", border: "1px solid hsl(0 0% 20%)", borderRadius: "0.5rem", color: "hsl(0 0% 100%)", fontSize: "1rem", outline: "none" }}
            />
          </div>

          {/* Question image upload */}
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontSize: "0.875rem", color: "hsl(0 0% 66%)", marginBottom: "0.5rem", fontWeight: 600 }}>
              Question Image (optional)
            </label>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              {q.question_image && (
                <div style={{ position: "relative" }}>
                  <img src={q.question_image} alt="Question" style={{ maxWidth: "200px", maxHeight: "200px", borderRadius: "0.5rem", border: "2px solid hsl(0 0% 20%)" }} />
                  <button
                    onClick={() => updateQuestion(qIdx, "question_image", null)}
                    style={{ position: "absolute", top: "-8px", right: "-8px", background: "hsl(0 72% 51%)", color: "white", border: "none", borderRadius: "50%", width: "24px", height: "24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem" }}
                  >
                    x
                  </button>
                </div>
              )}
              <input
                ref={(el) => { fileInputRefs.current[`question-${qIdx}`] = el; }}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, `question-${qIdx}`);
                }}
                style={{ display: "none" }}
              />
              <button
                onClick={() => fileInputRefs.current[`question-${qIdx}`]?.click()}
                disabled={uploadingFor === `question-${qIdx}`}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.25rem", background: "hsl(0 0% 10%)", border: "1px dashed hsl(0 0% 30%)", borderRadius: "0.5rem", color: "hsl(0 0% 66%)", cursor: "pointer", fontSize: "0.875rem" }}
              >
                <ImagePlus size={18} />
                {uploadingFor === `question-${qIdx}` ? "Processing..." : "Upload Image"}
              </button>
            </div>
          </div>

          {/* Answer options */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {q.options.map((opt, optIdx) => {
              const letter = LETTERS[optIdx];
              const isCorrect = q.correct_answer === letter;
              return (
                <div
                  key={optIdx}
                  style={{
                    background: "hsl(0 0% 10%)",
                    borderRadius: "0.75rem",
                    padding: "1rem",
                    border: isCorrect ? "2px solid hsl(21 100% 50%)" : "1px solid hsl(0 0% 20%)",
                    position: "relative",
                  }}
                >
                  {/* Correct answer badge */}
                  <button
                    onClick={() => updateQuestion(qIdx, "correct_answer", letter)}
                    style={{
                      position: "absolute",
                      top: "0.5rem",
                      right: "0.5rem",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      background: isCorrect ? "hsl(21 100% 50%)" : "hsl(0 0% 20%)",
                      color: isCorrect ? "hsl(0 0% 0%)" : "hsl(0 0% 66%)",
                    }}
                  >
                    {isCorrect ? "Correct" : "Set Correct"}
                  </button>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <span style={{ fontWeight: 700, color: "hsl(21 100% 50%)", fontSize: "1.25rem" }}>{letter}</span>
                  </div>

                  {/* Option text */}
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateOption(qIdx, optIdx, "text", e.target.value)}
                    placeholder={`Option ${letter} text`}
                    style={{ width: "100%", padding: "0.5rem", background: "hsl(0 0% 14%)", border: "1px solid hsl(0 0% 20%)", borderRadius: "0.375rem", color: "hsl(0 0% 100%)", fontSize: "0.9rem", outline: "none", marginBottom: "0.5rem" }}
                  />

                  {/* Option image */}
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    {opt.image && (
                      <div style={{ position: "relative" }}>
                        <img src={opt.image} alt={`Option ${letter}`} style={{ maxWidth: "80px", maxHeight: "80px", borderRadius: "0.375rem", border: "1px solid hsl(0 0% 20%)" }} />
                        <button
                          onClick={() => updateOption(qIdx, optIdx, "image", null)}
                          style={{ position: "absolute", top: "-4px", right: "-4px", background: "hsl(0 72% 51%)", color: "white", border: "none", borderRadius: "50%", width: "18px", height: "18px", cursor: "pointer", fontSize: "0.625rem" }}
                        >
                          x
                        </button>
                      </div>
                    )}
                    <input
                      ref={(el) => { fileInputRefs.current[`${qIdx}-${optIdx}`] = el; }}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, `${qIdx}-${optIdx}`);
                      }}
                      style={{ display: "none" }}
                    />
                    <button
                      onClick={() => fileInputRefs.current[`${qIdx}-${optIdx}`]?.click()}
                      disabled={uploadingFor === `${qIdx}-${optIdx}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.4rem 0.6rem", background: "hsl(0 0% 14%)", border: "1px dashed hsl(0 0% 30%)", borderRadius: "0.375rem", color: "hsl(0 0% 66%)", cursor: "pointer", fontSize: "0.75rem" }}
                    >
                      <ImagePlus size={14} />
                      {uploadingFor === `${qIdx}-${optIdx}` ? "..." : "Image"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Add question button */}
      <button
        onClick={addQuestion}
        style={{
          width: "100%",
          padding: "1rem",
          background: "hsl(0 0% 14%)",
          border: "2px dashed hsl(0 0% 30%)",
          borderRadius: "0.75rem",
          color: "hsl(0 0% 66%)",
          cursor: "pointer",
          fontSize: "1rem",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <Plus size={20} /> Add Question
      </button>

      {/* Error */}
      {error && (
        <div style={{ background: "hsl(0 72% 51% / 0.1)", border: "1px solid hsl(0 72% 51%)", borderRadius: "0.5rem", padding: "1rem", marginBottom: "1rem", color: "hsl(0 72% 60%)", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: "100%",
          padding: "1.25rem",
          background: saving ? "hsl(21 100% 30%)" : "hsl(21 100% 50%)",
          color: "hsl(0 0% 0%)",
          border: "none",
          borderRadius: "0.75rem",
          cursor: saving ? "wait" : "pointer",
          fontSize: "1.25rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}
      >
        <Save size={20} />
        {saving ? "Saving..." : "Save Quiz"}
      </button>

      <p style={{ textAlign: "center", color: "hsl(0 0% 50%)", fontSize: "0.75rem", marginTop: "1rem" }}>
        Images are resized to max 500px and stored securely. Quizzes appear in the Eye Gazer &amp; Non-Verbal section for students.
      </p>
    </div>
  );
}
