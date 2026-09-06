import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Register() {
  const { register } = useAuth();
  const [, navigate] = useLocation();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEyeGaze, setIsEyeGaze] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [gradeBand, setGradeBand] = useState("");

  const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

  useEffect(() => {
    fetch(`${API_BASE}/api/schools`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSchools(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Fetch teachers when school and grade are selected
  useEffect(() => {
    if (selectedSchoolId && selectedGrade) {
      fetch(`${API_BASE}/api/teachers/by-school-grade?schoolId=${selectedSchoolId}&grade=${selectedGrade}`)
        .then(r => r.ok ? r.json() : [])
        .then(data => setTeachers(Array.isArray(data) ? data : []))
        .catch(() => setTeachers([]));
    } else {
      setTeachers([]);
      setSelectedTeacherId("");
    }
  }, [selectedSchoolId, selectedGrade]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    setLoading(true);
    try {
      sessionStorage.setItem('show_profile_setup', 'true');
      await register(username, password, displayName, isEyeGaze, selectedTeacherId ? parseInt(selectedTeacherId) : null, selectedSchoolId ? parseInt(selectedSchoolId) : null, selectedGrade);
      // Navigation is handled by AppRouter redirects based on isAdmin
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-wide">A.R.I.S.E<span className="text-primary"> Reader</span></h1>
          <p className="text-muted-foreground mt-2">Create your account to start earning points</p>
        </div>

        <Card className="shadow-xl bg-card">
          <CardHeader>
            <CardTitle className="text-white">Create Account</CardTitle>
            <CardDescription>Choose a username and password you'll remember</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Your Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="First name and last initial (e.g., Alex M.)"
                  required
                  className="bg-input text-white border-border"
                  data-testid="input-displayname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a unique username"
                  required
                  className="bg-input text-white border-border"
                  data-testid="input-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 4 characters"
                  required
                  className="bg-input text-white border-border"
                  data-testid="input-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Type your password again"
                  required
                  className="bg-input text-white border-border"
                  data-testid="input-confirm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="school">Select Your School</Label>
                <select
                  id="school"
                  value={selectedSchoolId}
                  onChange={(e) => { setSelectedSchoolId(e.target.value); setSelectedGrade(""); setSelectedTeacherId(""); }}
                  className="w-full p-2.5 rounded-lg bg-input text-white border border-border text-sm"
                  data-testid="select-school"
                >
                  <option value="">Choose your school...</option>
                  {schools.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">Select Your Grade</Label>
                {!selectedSchoolId ? (
                  <p className="text-xs text-muted-foreground italic">Please select your school first</p>
                ) : !gradeBand ? (
                  <div className="space-y-3" data-testid="grade-picker">
                    <p className="text-xs text-muted-foreground">First, pick your grade band:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setGradeBand("K-2")} className={`p-3 rounded-lg border-2 transition-colors text-left ${gradeBand === "K-2" ? "border-primary bg-primary/10" : "border-border hover:border-primary"}`} data-testid="band-K-2">
                        <p className="text-sm font-bold text-white">K-2 Band</p>
                        <p className="text-xs text-muted-foreground">Early Readers</p>
                      </button>
                      <button type="button" onClick={() => setGradeBand("3-5")} className={`p-3 rounded-lg border-2 transition-colors text-left ${gradeBand === "3-5" ? "border-primary bg-primary/10" : "border-border hover:border-primary"}`} data-testid="band-3-5">
                        <p className="text-sm font-bold text-white">3-5 Band</p>
                        <p className="text-xs text-muted-foreground">Elementary</p>
                      </button>
                      <button type="button" onClick={() => setGradeBand("6-8")} className={`p-3 rounded-lg border-2 transition-colors text-left ${gradeBand === "6-8" ? "border-primary bg-primary/10" : "border-border hover:border-primary"}`} data-testid="band-6-8">
                        <p className="text-sm font-bold text-white">6-8 Band</p>
                        <p className="text-xs text-muted-foreground">Middle School</p>
                      </button>
                      <button type="button" onClick={() => setGradeBand("9-12")} className={`p-3 rounded-lg border-2 transition-colors text-left ${gradeBand === "9-12" ? "border-primary bg-primary/10" : "border-border hover:border-primary"}`} data-testid="band-9-12">
                        <p className="text-sm font-bold text-white">9-12 Band</p>
                        <p className="text-xs text-muted-foreground">High School</p>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="grade-selected">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Your group: <span className="font-semibold text-primary">{gradeBand} Band</span></span>
                      <button type="button" onClick={() => { setGradeBand(""); setSelectedGrade(""); setSelectedTeacherId(""); }} className="text-xs text-primary hover:underline">Change Band</button>
                    </div>
                    <p className="text-xs text-muted-foreground">Now pick your grade:</p>
                    <div className="flex flex-wrap gap-2">
                      {GRADES.filter(g => {
                        if (gradeBand === "K-2") return ["K","1","2"].includes(g);
                        if (gradeBand === "3-5") return ["3","4","5"].includes(g);
                        if (gradeBand === "6-8") return ["6","7","8"].includes(g);
                        if (gradeBand === "9-12") return ["9","10","11","12"].includes(g);
                        return false;
                      }).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => { setSelectedGrade(g); setSelectedTeacherId(""); }}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            selectedGrade === g ? "bg-primary text-primary-foreground" : "bg-muted text-white hover:bg-muted/80"
                          }`}
                          data-testid={`grade-btn-${g}`}
                        >
                          Grade {g}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacher">Select Your Teacher (optional)</Label>
                <select
                  id="teacher"
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  disabled={!selectedSchoolId || !selectedGrade}
                  className="w-full p-2.5 rounded-lg bg-input text-white border border-border text-sm disabled:opacity-50"
                  data-testid="select-teacher"
                >
                  <option value="">{!selectedSchoolId || !selectedGrade ? "Select school and grade first..." : "No teacher selected"}</option>
                  {teachers.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.display_name}</option>
                  ))}
                </select>
                {selectedSchoolId && selectedGrade && teachers.length === 0 && (
                  <p className="text-xs text-amber-500 mt-1">No teachers found for this school and grade. You can still sign up without a teacher.</p>
                )}
                {selectedTeacherId && (
                  <p className="text-xs text-muted-foreground mt-1">You can start reading and taking quizzes right away. Your teacher will approve you to appear under their profile.</p>
                )}
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <input
                  type="checkbox"
                  id="eyeGaze"
                  checked={isEyeGaze}
                  onChange={(e) => setIsEyeGaze(e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-primary cursor-pointer"
                />
                <label htmlFor="eyeGaze" className="text-sm text-foreground cursor-pointer">
                  <span className="font-semibold">I am an eye gazer / non-verbal user</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">Shows accessible quizzes with large buttons and visual choices. Best on tablet or computer.</span>
                </label>
              </div>
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3" data-testid="text-error">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full bg-primary" disabled={loading} data-testid="button-register">
                {loading ? "Creating account..." : "Create Account"}
              </Button>
              <div className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="text-primary font-medium hover:underline"
                >
                  Log in
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Forgot your password? Ask your teacher to reset it.
        </p>
        <div className="text-center mt-3">
          <button
            type="button"
            onClick={() => navigate("/teacher-signup")}
            className="text-sm text-primary font-medium hover:underline"
          >
            Are you a teacher? Sign up here
          </button>
        </div>
        <div className="text-center mt-2">
          <button
            type="button"
            onClick={() => navigate("/parent-signup")}
            className="text-sm text-primary font-medium hover:underline"
          >
            Are you a parent? Sign up here
          </button>
        </div>
      </div>
    </div>
  );
}
