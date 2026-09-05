import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { AlertCircle, Send, CheckCircle2 } from "lucide-react";

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

interface ReportProblemButtonProps {
  variant?: "ghost" | "outline" | "default";
  size?: "sm" | "default" | "lg";
}

export function ReportProblemButton({ variant = "ghost", size = "sm" }: ReportProblemButtonProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    const authToken = token || getTokenFromCookie();
    if (!authToken) {
      setSubmitting(false);
      return;
    }
    try {
      const categoryLabel = {
        bug: "Bug/Error",
        content: "Wrong Quiz Content",
        suggestion: "Suggestion",
        other: "Other",
      }[category] || category;

      const reportText = `[REPORT A PROBLEM - ${categoryLabel}]\n${message.trim()}`;

      await fetch(`${API_BASE}/api/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageText: reportText }),
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
        setMessage("");
        setCategory("bug");
      }, 2000);
    } catch (e) {
      console.error("Failed to submit report:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className="text-destructive hover:text-destructive"
        title="Report a Problem"
      >
        <AlertCircle className="w-4 h-4" />
        <span className="hidden sm:inline">Report</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <p className="text-lg font-semibold">Report Sent!</p>
              <p className="text-sm text-muted-foreground text-center">
                Your report has been sent to the admin. Thank you for helping improve A.R.I.S.E Reader.
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  Report a Problem
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Issue Type</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bug">Bug or Error</SelectItem>
                      <SelectItem value="content">Wrong Quiz Content</SelectItem>
                      <SelectItem value="suggestion">Suggestion</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Describe the Problem</Label>
                  <Textarea
                    id="message"
                    placeholder="Describe what happened, what you were doing, or what needs fixing..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!message.trim() || submitting}
                >
                  <Send className="w-4 h-4 mr-1" />
                  {submitting ? "Sending..." : "Send Report"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
