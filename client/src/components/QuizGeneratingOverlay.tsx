import { useState, useEffect, useRef } from "react";
import { BrandText } from "@/components/BrandText";
import { BookOpen, Brain, ShieldCheck, GraduationCap, Sparkles, CheckCircle2 } from "lucide-react";

interface Props {
  bookTitle: string;
  author: string;
  onComplete: () => void;
}

interface Step {
  label: string;
  icon: typeof BookOpen;
  detail: string;
}

export default function QuizGeneratingOverlay({ bookTitle, author, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [stepComplete, setStepComplete] = useState<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps: Step[] = [
    { label: "Analyzing book content", icon: BookOpen, detail: `Reading "${bookTitle}" by ${author}` },
    { label: "Applying educator guidelines", icon: GraduationCap, detail: "Questions shaped by real teachers' standards" },
    { label: "Generating with premium AI", icon: Brain, detail: "Not ChatGPT or Google — a premium model trained by educators" },
    { label: "Checking responsible AI policies", icon: ShieldCheck, detail: "Following school AI responsibility guidelines" },
    { label: "Preparing for educator review", icon: Sparkles, detail: "Every quiz is eligible for review by a real educator" },
  ];

  useEffect(() => {
    const stepDuration = 2000; // ms per step
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
        setTimeout(() => onComplete(), 600);
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
              Generating quiz for "{bookTitle}"...
            </span>
            <span className="text-xs font-bold text-primary">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
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
                  <p className="text-xs text-muted-foreground truncate">
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

        {/* Footer message */}
        <div className="text-center mt-8">
          <p className="text-xs text-muted-foreground">
            A.R.I.S.E Reader uses premium AI technology — not ChatGPT or Google — trained by actual educators to create fair, accurate quizzes that follow responsible AI policies in schools.
          </p>
        </div>
      </div>
    </div>
  );
}
