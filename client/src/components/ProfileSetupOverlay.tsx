import { useState, useEffect, useRef } from "react";
import { BrandText } from "@/components/BrandText";
import { GraduationCap, BookOpen, Trophy, Users, Sparkles, CheckCircle2 } from "lucide-react";

interface Props {
  grade: string;
  band: string;
  bookCount: number;
  onComplete: () => void;
}

interface Step {
  label: string;
  icon: typeof GraduationCap;
  detail: string;
}

export default function ProfileSetupOverlay({ grade, band, bookCount, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [stepComplete, setStepComplete] = useState<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const steps: Step[] = [
    { label: "Confirming your school", icon: CheckCircle2, detail: "Connecting to your school's network" },
    { label: `Placing you in Grade ${grade}`, icon: GraduationCap, detail: `You're in the ${band} grade band` },
    { label: "Building your grade-level library", icon: BookOpen, detail: `Found ${bookCount} books for your grade` },
    { label: "Preparing your leaderboard group", icon: Trophy, detail: `Competing with ${band} students only` },
    { label: "Loading your iArise courses", icon: Sparkles, detail: "2 courses ready for your grade" },
    { label: "Setting up your profile", icon: Users, detail: "Almost there..." },
  ];

  useEffect(() => {
    const stepDuration = 1600; // ms per step
    const totalDuration = steps.length * stepDuration;
    const startTime = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / totalDuration) * 100);
      setProgress(pct);

      const stepIdx = Math.min(steps.length - 1, Math.floor(elapsed / stepDuration));
      setCurrentStep(stepIdx);

      // Mark completed steps
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
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
      <div className="w-full max-w-md mx-auto px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <BrandText className="text-3xl font-extrabold" />
          <p className="text-sm text-muted-foreground mt-2">Read. Learn. Rise.</p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Setting up your profile...
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
            {band === "K-2" && "Your child will see books perfect for their reading level."}
            {band === "3-5" && "Books and quizzes tailored for elementary students."}
            {band === "6-8" && "Middle school books designed to challenge and engage."}
            {band === "9-12" && "High school level books to prepare for the future."}
          </p>
        </div>
      </div>
    </div>
  );
}
