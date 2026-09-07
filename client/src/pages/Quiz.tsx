import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { BookOpen, ArrowLeft, CheckCircle2, XCircle, Award, Lock, KeyRound, FileSearch, Sparkles } from "lucide-react";
import { generateCertificate } from "@/lib/certificate";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface SafeQuestion {
  id: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  questionOrder: number;
}

interface Book {
  id: number;
  title: string;
  author: string;
  coverUrl: string | null;
  description: string;
  ageGroup: string;
}

export default function Quiz() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [, navigate] = useLocation();
  const [book, setBook] = useState<Book | null>(null);
  const [questions, setQuestions] = useState<SafeQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [alreadyTaken, setAlreadyTaken] = useState<{ score: number; total: number; points?: number } | null>(null);
  const [proctorVerified, setProctorVerified] = useState(false);
  const [proctorPassword, setProctorPassword] = useState("");
  const [proctorError, setProctorError] = useState("");
  const [proctorLoading, setProctorLoading] = useState(false);
  const [showReviewRequest, setShowReviewRequest] = useState(false);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.isAdmin;
  const isSampleStudent = user?.username === 'sample';

  const handleRequestReview = async () => {
    if (!token || !result?.attemptId) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/quiz-review/${result.attemptId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reviewReason.trim() || undefined }),
      });
      if (res.ok) {
        setReviewSubmitted(true);
        setTimeout(() => {
          setShowReviewRequest(false);
          setReviewSubmitted(false);
          setReviewReason("");
        }, 3000);
      }
    } catch {} finally {
      setReviewSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!token || !id) return;
      try {
        const res = await fetch(`${API_BASE}/api/books/${id}/quiz`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.status === 403 && data.score !== undefined) {
          setAlreadyTaken({ score: data.score, total: data.total, points: data.points });
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError(data.message || "Failed to load quiz");
          setLoading(false);
          return;
        }
        setBook(data.book || null);
        const qs = Array.isArray(data.questions) ? data.questions : [];
        const sorted = qs.sort((a: SafeQuestion, b: SafeQuestion) => a.questionOrder - b.questionOrder);
        // Sample student: only show 3 questions
        setQuestions(isSampleStudent ? sorted.slice(0, 3) : sorted);
      } catch (err) {
        setError("Failed to load quiz");
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [token, id]);

  const handleAnswer = (questionId: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleProctorVerify = async () => {
    if (!token || !proctorPassword) return;
    setProctorLoading(true);
    setProctorError("");
    try {
      const res = await fetch(`${API_BASE}/api/verify-proctor`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: proctorPassword }),
      });
      const data = await res.json();
      if (res.ok && data.verified) {
        setProctorVerified(true);
      } else {
        setProctorError(data.message || "Incorrect password");
      }
    } catch {
      setProctorError("Failed to verify password");
    } finally {
      setProctorLoading(false);
    }
  };

  const allAnswered = questions.every(q => answers[String(q.id)]);

  const handleSubmit = async () => {
    if (!token || !id) return;
    // Sample student: don't submit to server, show sample result
    if (isSampleStudent) {
      let correct = 0;
      questions.forEach(q => {
        const ans = answers[String(q.id)];
        if (ans === 'A') correct++; // Just count A answers for sample
      });
      setResult({
        score: correct,
        total: questions.length,
        passed: true,
        points: 0,
        isSample: true,
      });
      setSubmitting(false);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/books/${id}/quiz`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to submit quiz");
        return;
      }
      setResult(data);
    } catch (err) {
      setError("Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  // Spectator mode: teachers/admins can view quizzes but not take them
  if (isTeacherOrAdmin && !loading && book && questions.length > 0) {
    return (
      <div className="min-h-screen p-4 bg-background">
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-xl mb-4">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-16 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {book.coverUrl ? <img src={book.coverUrl} alt="Cover" className="w-full h-full object-cover" /> : <BookOpen className="w-8 h-8 m-auto mt-6" />}
              </div>
              <div>
                <h1 className="text-xl font-bold">{book.title}</h1>
                <p className="text-sm text-muted-foreground">by {book.author}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold">Spectator Mode (Read-Only)</span>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <Card key={q.id} className="shadow-md">
                <CardContent className="p-4">
                  <p className="font-medium mb-3"><span className="text-primary font-bold">Q{i + 1}.</span> {q.questionText}</p>
                  <div className="space-y-2">
                    {['A', 'B', 'C', 'D'].map(opt => (
                      <div key={opt} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                        <span className="w-6 h-6 rounded-full bg-muted text-xs flex items-center justify-center font-bold">{opt}</span>
                        <span className="text-sm">{q[`option${opt}` as keyof SafeQuestion] as string}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/library")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Library
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (alreadyTaken) {
    const passed = alreadyTaken.score >= Math.ceil(alreadyTaken.total * 0.7);
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">You've already taken this quiz!</h2>
            <p className="text-muted-foreground mb-4">
              You scored {alreadyTaken.score} out of {alreadyTaken.total}.
            </p>
            {passed ? (
              <p className="text-sm text-green-400 font-semibold mb-4">You passed and earned {alreadyTaken.points ?? 0} points!</p>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">You needed {Math.ceil(alreadyTaken.total * 0.7)} correct to pass and earn points.</p>
            )}
            <Button onClick={() => navigate("/library")} data-testid="button-back-library">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Library
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result) {
    // Sample student: show special result screen
    if (result.isSample) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-md w-full shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Sample Quiz Complete!</h2>
              <p className="text-muted-foreground mb-6">{book?.title}</p>
              <div className="rounded-2xl p-6 mb-6 bg-amber-500/20">
                <div className="text-5xl font-bold text-amber-400">{result.score}/{result.total}</div>
                <div className="text-sm text-muted-foreground mt-1">questions correct</div>
              </div>
              <div className="rounded-xl border-2 border-primary/40 bg-primary/10 p-4 mb-6">
                <p className="text-sm font-bold text-primary mb-1">Want to earn real points?</p>
                <p className="text-xs text-muted-foreground">Create a free account to take the full 10-question quiz, earn points, climb the leaderboard, and win certificates!</p>
              </div>
              <Button onClick={() => navigate("/register")} className="w-full bg-primary mb-2" size="lg">
                <Sparkles className="w-4 h-4 mr-2" />Create Free Account
              </Button>
              <Button onClick={() => navigate("/library")} variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />Back to Library
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    const percentage = Math.round((result.score / result.total) * 100);
    const passed = result.passed !== undefined ? result.passed : result.score >= Math.ceil(result.total * 0.7);
    const passingScore = result.passingScore || Math.ceil(result.total * 0.7);
    const certDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8 text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg ${
              passed ? "bg-primary" : "bg-muted"
            }`}>
              {passed ? <CheckCircle2 className="w-10 h-10 text-white" /> : <XCircle className="w-10 h-10 text-white" />}
            </div>
            <h2 className="text-2xl font-bold mb-2">{passed ? "Passed!" : "Not Passed"}</h2>
            <p className="text-muted-foreground mb-6">{book?.title}</p>
            <div className={`rounded-2xl p-6 mb-6 ${
              passed ? "bg-primary text-white" : "bg-muted text-muted-foreground"
            }`}>
              <div className="text-5xl font-bold">{result.score}</div>
              <div className="text-sm opacity-80 mt-1">out of {result.total} correct</div>
              <div className="text-3xl font-bold mt-2">{percentage}%</div>
            </div>
            {passed ? (
              <div className="mb-6">
                <p className="text-lg font-bold text-primary">
                  You earned {result.points} {result.points === 1 ? "point" : "points"}!
                </p>
                {result.bookPoints && (
                  <p className="text-sm text-muted-foreground mt-1">
                    out of {result.bookPoints} possible
                  </p>
                )}
                <Button
                  onClick={() => generateCertificate(
                    result.studentName || user?.displayName || "Student",
                    result.bookTitle || book?.title || "Book",
                    result.points,
                    certDate
                  )}
                  className="w-full mt-4"
                  variant="default"
                  data-testid="button-certificate"
                >
                  <Award className="w-4 h-4 mr-2" />
                  Get Certificate
                </Button>
              </div>
            ) : (
              <div className="mb-6">
                <p className="text-sm text-muted-foreground">
                  You needed {passingScore} correct to pass and earn points.
                </p>
                <p className="text-sm font-semibold text-muted-foreground mt-2">
                  No points awarded. Better luck next time!
                </p>
              </div>
            )}
            <Button onClick={() => navigate("/library")} className="w-full" variant="outline" data-testid="button-back-library">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Library
            </Button>
            <Button
              onClick={() => setShowReviewRequest(true)}
              className="w-full mt-2"
              variant="ghost"
              data-testid="button-request-review"
            >
              <FileSearch className="w-4 h-4 mr-2" />
              Request Manual Review
            </Button>
            <Dialog open={showReviewRequest} onOpenChange={setShowReviewRequest}>
              <DialogContent className="max-w-md">
                {reviewSubmitted ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                    <p className="text-lg font-semibold">Review Request Sent!</p>
                    <p className="text-sm text-muted-foreground text-center">
                      Your teacher will review the quiz questions and update your score if needed.
                    </p>
                  </div>
                ) : (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <FileSearch className="w-5 h-5 text-primary" />
                        Request Manual Review
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Think something is wrong with the quiz grading? Describe the issue and your teacher will review the questions and your answers.
                      </p>
                      <Textarea
                        placeholder="Describe the issue (optional)..."
                        value={reviewReason}
                        onChange={(e) => setReviewReason(e.target.value)}
                        rows={4}
                        className="resize-none"
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowReviewRequest(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleRequestReview}
                        disabled={reviewSubmitting}
                      >
                        {reviewSubmitting ? "Sending..." : "Send Request"}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!proctorVerified && !isSampleStudent && !user?.isAdmin && !result && !alreadyTaken && book) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Proctor Required</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Ask your teacher or proctor to enter the password to start the quiz.
            </p>
            {proctorError && (
              <p className="text-sm text-red-400 mb-3">{proctorError}</p>
            )}
            <input
              type="password"
              placeholder="Proctor password"
              value={proctorPassword}
              onChange={(e) => { setProctorPassword(e.target.value); setProctorError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" && proctorPassword) handleProctorVerify(); }}
              className="w-full px-4 py-3 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary mb-3"
              data-testid="input-proctor-password"
            />
            <Button
              onClick={handleProctorVerify}
              disabled={!proctorPassword || proctorLoading}
              className="w-full"
              data-testid="button-verify-proctor"
            >
              {proctorLoading ? "Verifying..." : "Enter"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => navigate("/library")}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Library
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => navigate("/library")}>Back to Library</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-3xl mx-auto px-4 flex items-center gap-3 h-16">
          <Button variant="ghost" size="sm" onClick={() => navigate("/library")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-sm truncate">{book?.title}</h1>
            <p className="text-xs text-muted-foreground">{book?.author}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {isSampleStudent && (
          <div className="mb-6 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-4 text-center">
            <p className="text-sm font-bold text-amber-400">🎯 Sample Quiz Mode</p>
            <p className="text-xs text-muted-foreground mt-1">You're taking a 3-question sample quiz. Create a free account to take the full 10-question quiz and earn points!</p>
          </div>
        )}
        {/* Book cover and info */}
        <div className="flex gap-4 mb-8 items-start">
          <div className="w-24 sm:w-32 flex-shrink-0">
            {book?.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={`Cover of ${book.title}`}
                className="w-full rounded-lg shadow-lg"
              />
            ) : (
              <div className="w-full aspect-[2/3] rounded-lg shadow-lg bg-primary text-white flex items-center justify-center p-2 text-center">
                <span className="font-bold text-xs">{book?.title}</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-1">{book?.title}</h2>
            <p className="text-sm text-muted-foreground mb-2">by {book?.author}</p>
            <p className="text-sm text-muted-foreground">{book?.description}</p>
            <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold">
              <BookOpen className="w-3 h-3" />
              {questions.length} questions
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <Card key={q.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex gap-3 mb-4">
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <p className="font-medium text-base">{q.questionText}</p>
                </div>
                <RadioGroup
                  value={answers[String(q.id)] || ""}
                  onValueChange={(val) => handleAnswer(q.id, val)}
                  className="space-y-2"
                >
                  {(["A", "B", "C", "D"] as const).map((letter) => {
                    const text = q[`option${letter}` as keyof SafeQuestion] as string;
                    const isSelected = answers[String(q.id)] === letter;
                    return (
                      <Label
                        key={letter}
                        htmlFor={`q${q.id}-${letter}`}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                        }`}
                      >
                        <RadioGroupItem value={letter} id={`q${q.id}-${letter}`} />
                        <span className="text-sm">{text}</span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Submit */}
        <div className="mt-6 pb-12">
          <Button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="w-full"
            size="lg"
            data-testid="button-submit-quiz"
          >
            {submitting ? "Submitting..." : allAnswered ? "Submit Quiz" : `Answer all questions (${Object.keys(answers).length}/${questions.length})`}
          </Button>
        </div>
      </main>
    </div>
  );
}
