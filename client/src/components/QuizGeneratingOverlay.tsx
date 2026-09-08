import { useState, useEffect, useRef } from "react";
import { BrandText } from "@/components/BrandText";
import { BookOpen, Brain, ShieldCheck, GraduationCap, Sparkles, CheckCircle2, ClipboardCheck, Eye } from "lucide-react";

interface Props {
  bookTitle: string;
  author: string;
  ready: boolean;
  onComplete: () => void;
  isEyeGaze?: boolean;
}

interface Step {
  label: string;
  icon: typeof BookOpen;
  detail: string;
}

export default function QuizGeneratingOverlay({ bookTitle, author, ready, onComplete, isEyeGaze }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [stepComplete, setStepComplete] = useState<number[]>([]);
  const [allStepsDone, setAllStepsDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps: Step[] = [
    { label: isEyeGaze ? "Analyzing topic" : "Analyzing book content", icon: BookOpen, detail: isEyeGaze ? `Creating visual quiz about "${bookTitle}"` : `Reading "${bookTitle}" by ${author}` },
    { label: "Applying educator guidelines", icon: GraduationCap, detail: "Questions shaped by standards set by real teachers in the admin panel" },
    { label: "Generating with premium AI", icon: Brain, detail: "Not ChatGPT or Google — a premium model trained by actual educators" },
    { label: "Checking responsible AI policies", icon: ShieldCheck, detail: "Following school AI responsibility guidelines set by your educators" },
    { label: "Verifying fairness and accuracy", icon: ClipboardCheck, detail: "Questions checked for grade-level appropriateness and clarity" },
    { label: "Queueing for educator review", icon: Eye, detail: "Educators can review quiz questions and adjust scoring after students complete quizzes" },
  ];

  useEffect(() => {
    const stepDuration = 4000; // 4 seconds per step = 24 seconds total
    const totalDuration = steps.length * stepDuration;
    const startTime = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / totalDuration) * 100);
      setProgress(pct);

      const stepIdx = Math.min(steps.length - 1, Math.floor(elapsed / stepDuration));
      setCurrentStep(stepIdx);

      setStepComplete(prev => {
        const completed = Array.from({ length: stepIdx }, (_, i) => i);
        return completed;
      });

      if (elapsed >= totalDuration) {
        if (timerRef.current) clearInterval(timerRef.current);
        setStepComplete(Array.from({ length: steps.length }, (_, i) => i));
        setAllStepsDone(true);
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Only complete when both the animation is done AND the API response is ready
  useEffect(() => {
    if (allStepsDone && ready) {
      const t = setTimeout(() => onComplete(), 800);
      return () => clearTimeout(t);
    }
  }, [allStepsDone, ready, onComplete]);

  return (
    <div className="fixed inset-0 z-[60] bg-background flex items-center justify-center">
      <div className="w-full max-w-md mx-auto px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <BrandText className="text-3xl font-extrabold" />
          <p className="text-sm text-muted-foreground mt-2">Creating your quiz</p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              {allStepsDone && !ready ? "Finalizing your quiz..." : `Generating quiz for "${bookTitle}"...`}
            </span>
            <span className="text-xs font-bold text-primary">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-100 ease-out"
              style={{ width: `${allStepsDone && !ready ? 100 : progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const isComplete = stepComplete.includes(idx);
            const isCurrent = currentStep === idx && !isComplete;
            const isPending = idx > currentStep;
            const Icon = step.icon;

            return (
              <div
                key={idx}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                  isComplete ? "bg-primary/5 opacity-60" :
                  isCurrent ? "bg-primary/10 border border-primary/20" :
                  "opacity-30"
                }`}
              >
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                  isComplete ? "bg-primary/20" :
                  isCurrent ? "bg-primary/20" :
                  "bg-muted"
                }`}>
                  {isComplete ? (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : isCurrent ? (
                    <Icon className="w-5 h-5 text-primary animate-pulse" />
                  ) : (
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isCurrent ? "text-primary" : "text-foreground"}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {step.detail}
                  </p>
                </div>
                {isCurrent && (
                  <div className="flex-shrink-0">
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer message — emphasize educator guidelines and review */}
        <div className="text-center mt-8 space-y-2">
          <p className="text-xs text-muted-foreground">
            Every quiz is created using premium AI technology — not ChatGPT or Google — with guidelines set by real educators in the admin panel before a single question is written.
          </p>
          <p className="text-xs font-medium text-primary">
            After students complete a quiz, educators review the questions, verify accuracy, and adjust scoring as needed. This is our commitment to responsible AI in schools.
          </p>
        </div>
      </div>
    </div>
  );
}
