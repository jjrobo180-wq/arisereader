import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BarChart3, PlusCircle, X, CheckCircle2, Trash2, Clock, Users } from "lucide-react";
import { BrandText } from "@/components/BrandText";
import { NotificationBell } from "@/components/NotificationBell";

interface PollOption {
  id: string;
  text: string;
  count?: number;
  percentage?: number;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  isActive: boolean;
  endsAt: string;
  createdAt: string;
  hasVoted: boolean;
  selectedOptionId: string | null;
  totalVotes: number;
  showResults: boolean;
}

function getTokenFromCookie(): string | null {
  try {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const c = cookies[i].trim();
      if (c.startsWith("arise_session=")) {
        const raw = c.substring("arise_session=".length);
        const data = JSON.parse(atob(raw));
        return data.token || null;
      }
    }
  } catch {}
  return null;
}

export default function Polls() {
  const { user, token, logout } = useAuth();
  const [, navigate] = useLocation();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [voting, setVoting] = useState<string | null>(null);

  // Admin poll creation
  const [showCreate, setShowCreate] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [durationHours, setDurationHours] = useState("24");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const authToken = token || getTokenFromCookie();
  const isAdmin = user?.isAdmin === true;

  const fetchPolls = async () => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/polls`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPolls(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  const handleVote = async (pollId: string, optionId: string) => {
    setVoting(pollId);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ optionId }),
      });
      const data = await res.json();
      if (res.ok) {
        // Update the poll in state with results
        setPolls(prev => prev.map(p => {
          if (p.id === pollId) {
            return { ...data.poll };
          }
          return p;
        }));
      } else {
        setError(data.message || "Failed to vote");
      }
    } catch {
      setError("Network error");
    }
    setVoting(null);
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    const opts = pollOptions.map(o => o.trim()).filter(o => o);
    if (!pollQuestion.trim()) {
      setCreateError("Question is required");
      return;
    }
    if (opts.length < 2) {
      setCreateError("Provide at least 2 options");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/polls`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: pollQuestion,
          options: opts,
          durationHours: parseInt(durationHours) || 24,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPollQuestion("");
        setPollOptions(["", ""]);
        setDurationHours("24");
        setShowCreate(false);
        fetchPolls();
      } else {
        setCreateError(data.message || "Failed to create poll");
      }
    } catch {
      setCreateError("Network error");
    }
    setCreating(false);
  };

  const handleClosePoll = async (pollId: string) => {
    if (!confirm("Close this poll now? Results will be final.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/polls/${pollId}/close`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) fetchPolls();
    } catch {}
  };

  const handleDeletePoll = async (pollId: string) => {
    if (!confirm("Delete this poll? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/polls/${pollId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) fetchPolls();
    } catch {}
  };

  const formatEndDate = (endsAt: string) => {
    const d = new Date(endsAt);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff <= 0) return "Closed";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h left`;
    }
    if (hours > 0) return `${hours}h ${mins}m left`;
    return `${mins}m left`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BrandText />
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button variant="ghost" size="sm" onClick={() => navigate("/library")} className="text-xs">
              Library
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="text-xs">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Polls</h1>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowCreate(!showCreate)} size="sm">
              <PlusCircle className="w-4 h-4 mr-1" />
              {showCreate ? "Cancel" : "Create Poll"}
            </Button>
          )}
        </div>

        {/* Create Poll Form (Admin Only) */}
        {isAdmin && showCreate && (
          <Card className="mb-6 border-primary/30">
            <CardHeader>
              <CardTitle className="text-lg">Create a New Poll</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreatePoll} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="poll-question">Question</Label>
                  <Textarea
                    id="poll-question"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="e.g., What should this month's prize be for the winner?"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Options</Label>
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const next = [...pollOptions];
                          next[i] = e.target.value;
                          setPollOptions(next);
                        }}
                        placeholder={`Option ${i + 1}`}
                      />
                      {pollOptions.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 6 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPollOptions([...pollOptions, ""])}
                    >
                      <PlusCircle className="w-3 h-3 mr-1" />
                      Add Option
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (hours)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    max="720"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {durationHours && parseInt(durationHours) >= 24
                      ? `Poll will end in ${Math.floor(parseInt(durationHours) / 24)} day(s)`
                      : "Poll will end in " + durationHours + " hour(s)"}
                  </p>
                </div>
                {createError && <p className="text-sm text-red-500">{createError}</p>}
                <Button type="submit" disabled={creating} className="w-full">
                  {creating ? "Creating..." : "Create Poll"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : polls.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-center">
                {isAdmin
                  ? "No polls yet. Create one to gather feedback from your students!"
                  : "No active polls right now. Check back soon!"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {polls.map((poll) => (
              <Card key={poll.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{poll.question}</CardTitle>
                    {poll.isActive ? (
                      <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Active
                      </span>
                    ) : (
                      <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        Closed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatEndDate(poll.endsAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Voting options */}
                  {!poll.showResults ? (
                    <div className="space-y-2">
                      {poll.options.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => handleVote(poll.id, opt.id)}
                          disabled={voting === poll.id}
                          className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all disabled:opacity-50"
                        >
                          {opt.text}
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* Results */
                    <div className="space-y-3">
                      {poll.options.map((opt) => {
                        const isSelected = poll.selectedOptionId === opt.id;
                        return (
                          <div key={opt.id}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm flex items-center gap-1.5">
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                                {opt.text}
                              </span>
                              <span className="text-xs text-muted-foreground font-medium">
                                {opt.count} ({opt.percentage}%)
                              </span>
                            </div>
                            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isSelected ? "bg-primary" : "bg-muted-foreground/40"
                                }`}
                                style={{ width: `${opt.percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {!poll.isActive && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          This poll has ended.
                        </p>
                      )}
                      {poll.isActive && !poll.hasVoted && isAdmin && (
                        <p className="text-xs text-muted-foreground mt-2">
                          You can see results because you are an admin.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Admin controls */}
                  {isAdmin && (
                    <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                      {poll.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleClosePoll(poll.id)}
                          className="text-xs"
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          Close Now
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePoll(poll.id)}
                        className="text-xs text-red-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
