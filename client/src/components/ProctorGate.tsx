import { useState } from "react";
import { ShieldCheck, Lock, AlertCircle, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

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

interface ProctorGateProps {
  quizTitle: string;
  onAuthorized: () => void;
}

export function ProctorGate({ quizTitle, onAuthorized }: ProctorGateProps) {
  const [step, setStep] = useState<"attestation" | "password">("attestation");
  const [agreed, setAgreed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleAttestationNext = () => {
    if (!agreed) {
      setError("You must check the attestation box to continue.");
      return;
    }
    setError("");
    setStep("password");
  };

  const handleVerify = async () => {
    if (!password.trim()) {
      setError("Please enter the proctor password.");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const token = getTokenFromCookie();
      const res = await fetch(`${API_BASE}/api/eye-gaze/verify-proctor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: password.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.verified) {
          onAuthorized();
          return;
        }
      }
      setError("Invalid proctor password. Please try again.");
    } catch {
      setError("Failed to verify password. Please try again.");
    }
    setVerifying(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Proctor Authorization Required</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {quizTitle}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-lg">
          {step === "attestation" ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <h2 className="font-semibold text-sm">Attestation of Eligibility</h2>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 mb-4">
                <p className="text-sm text-foreground/80 leading-relaxed">
                  This assessment is designated for students with documented
                  Individualized Education Programs (IEPs) or Section 504 Plans.
                  Under federal and state education guidelines, this assessment
                  and its associated point values are intended solely as an
                  accommodation for eligible students.
                </p>
                <p className="text-sm text-foreground/80 leading-relaxed mt-3">
                  By proceeding, the proctor attests that the student taking
                  this assessment has a current and active IEP or 504 Plan on
                  file, and that the proctor is authorized to administer
                  accommodations to this student.
                </p>
                <p className="text-xs text-muted-foreground mt-3 italic">
                  Misuse of this assessment may constitute a violation of
                  academic integrity policies.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border accent-primary shrink-0"
                />
                <span className="text-sm leading-relaxed">
                  I attest that the student taking this assessment has a
                  current IEP or 504 Plan on file, and I am authorized to
                  proctor this accommodation.
                </span>
              </label>

              {error && (
                <p className="text-sm text-destructive mb-3">{error}</p>
              )}

              <Button
                onClick={handleAttestationNext}
                className="w-full"
                disabled={!agreed}
              >
                Continue to Proctor Login
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-5 h-5 text-primary shrink-0" />
                <h2 className="font-semibold text-sm">Proctor Password</h2>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Enter the proctor password to unlock this assessment for the
                student.
              </p>

              <Input
                type="password"
                placeholder="Proctor password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                className="mb-4"
                autoFocus
              />

              {error && (
                <p className="text-sm text-destructive mb-3">{error}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("attestation");
                    setPassword("");
                    setError("");
                  }}
                  className="flex-1"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button
                  onClick={handleVerify}
                  disabled={verifying || !password.trim()}
                  className="flex-1"
                >
                  {verifying ? "Verifying..." : "Unlock Assessment"}
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          This authorization is required for each eye gaze assessment.
        </p>
      </div>
    </div>
  );
}
