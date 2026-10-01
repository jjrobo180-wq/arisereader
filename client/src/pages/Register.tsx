import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, BookOpen, GraduationCap, School, UserRound } from "lucide-react";

const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const BANDS = [
  { id: "K-2", label: "K–2", sub: "Early Readers", grades: ["K", "1", "2"] },
  { id: "3-5", label: "3–5", sub: "Elementary", grades: ["3", "4", "5"] },
  { id: "6-8", label: "6–8", sub: "Middle School", grades: ["6", "7", "8"] },
  { id: "9-12", label: "9–12", sub: "High School", grades: ["9", "10", "11", "12"] },
];

function isIndependentRoute() {
  try {
    const query = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : window.location.search.replace(/^\?/, "");
    return new URLSearchParams(query).get("independent") === "1";
  } catch { return false; }
}

export default function Register() {
  const { register } = useAuth();
  const [, navigate] = useLocation();
  const independentStudent = useMemo(() => isIndependentRoute(), []);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isEyeGaze, setIsEyeGaze] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [gradeBand, setGradeBand] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (independentStudent) return;
    fetch(`${API_BASE}/api/schools`).then(r => r.ok ? r.json() : []).then(data => setSchools(Array.isArray(data) ? data : [])).catch(() => {});
  }, [independentStudent]);

  useEffect(() => {
    if (!independentStudent && selectedSchoolId && selectedGrade) {
      fetch(`${API_BASE}/api/teachers/by-school-grade?schoolId=${selectedSchoolId}&grade=${selectedGrade}`)
        .then(r => r.ok ? r.json() : []).then(data => setTeachers(Array.isArray(data) ? data : [])).catch(() => setTeachers([]));
    } else { setTeachers([]); setSelectedTeacherId(""); }
  }, [selectedSchoolId, selectedGrade, independentStudent]);

  useEffect(() => {
    if (!usernameEdited && firstName && lastName) {
      setUsername((firstName + lastName).replace(/\s+/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""));
    }
  }, [firstName, lastName, usernameEdited]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!firstName.trim() || !lastName.trim()) return setError("Please enter your first and last name.");
    if (username.length < 3) return setError("Username must be at least 3 characters.");
    if (password.length < 4) return setError("Password must be at least 4 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    if (!selectedGrade) return setError("Please select your grade.");
    if (!independentStudent && !selectedSchoolId) return setError("Please select your school.");
    if (!independentStudent && !selectedTeacherId) return setError("Please select your teacher.");

    setLoading(true);
    try {
      sessionStorage.setItem("show_profile_setup", "true");
      await register(
        username,
        password,
        `${firstName.trim()} ${lastName.trim()}`,
        isEyeGaze,
        independentStudent ? null : Number(selectedTeacherId),
        independentStudent ? null : Number(selectedSchoolId),
        selectedGrade,
      );
    } catch (err: any) { setError(err.message || "Could not create account."); }
    finally { setLoading(false); }
  };

  const band = BANDS.find(item => item.id === gradeBand);

  return (
    <main className={`min-h-screen px-4 py-6 text-white sm:px-6 ${independentStudent ? "bg-[radial-gradient(circle_at_15%_0%,rgba(6,182,212,.24),transparent_32%),radial-gradient(circle_at_90%_10%,rgba(124,58,237,.2),transparent_30%),#090b18]" : "arise-page-bg"}`}>
      <div className="mx-auto w-full max-w-2xl">
        <button type="button" onClick={() => navigate("/")} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-black text-slate-200 hover:bg-white/10">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </button>

        <section className={`overflow-hidden rounded-[2rem] border shadow-2xl ${independentStudent ? "border-cyan-300/25 bg-[#111827]" : "border-violet-300/20 bg-[#151326]"}`}>
          <div className={`p-6 sm:p-8 ${independentStudent ? "bg-gradient-to-r from-cyan-500/14 via-violet-500/10 to-fuchsia-500/10" : "bg-gradient-to-r from-violet-500/12 via-fuchsia-500/8 to-cyan-500/8"}`}>
            <div className="flex items-start gap-4">
              <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${independentStudent ? "bg-cyan-400 text-slate-950" : "bg-violet-500 text-white"}`}>
                {independentStudent ? <UserRound className="h-7 w-7" /> : <School className="h-7 w-7" />}
              </div>
              <div>
                <p className={`text-xs font-black uppercase tracking-[.18em] ${independentStudent ? "text-cyan-300" : "text-violet-300"}`}>{independentStudent ? "Independent reader" : "School-connected student"}</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{independentStudent ? "Independent Student Signup" : "Student Signup"}</h1>
                <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-300">
                  {independentStudent ? "This account is not attached to a school or teacher. You can read, quiz, earn rewards, and connect a parent or guardian after signup." : "Connect your account to your school and teacher so your reading progress, quizzes, and rewards show in the right class."}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="firstName">First name</Label><Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Alex" required className="h-12 border-white/10 bg-[#0f0d1d] text-white" /></div>
              <div className="space-y-2"><Label htmlFor="lastName">Last name</Label><Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Martinez" required className="h-12 border-white/10 bg-[#0f0d1d] text-white" /></div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={e => { setUsername(e.target.value); setUsernameEdited(true); }} placeholder="Choose a username" required className="h-12 border-white/10 bg-[#0f0d1d] text-white" />
              {!usernameEdited && firstName && lastName && <p className="text-xs text-slate-400">Suggested from your name. You can change it.</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 4 characters" required className="h-12 border-white/10 bg-[#0f0d1d] text-white" /></div>
              <div className="space-y-2"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Type it again" required className="h-12 border-white/10 bg-[#0f0d1d] text-white" /></div>
            </div>

            {!independentStudent && <>
              <div className="space-y-2">
                <Label htmlFor="school">School</Label>
                <select id="school" value={selectedSchoolId} onChange={e => { setSelectedSchoolId(e.target.value); setGradeBand(""); setSelectedGrade(""); setSelectedTeacherId(""); }} className="min-h-12 w-full rounded-xl border border-white/10 bg-[#0f0d1d] p-3 text-sm text-white">
                  <option value="">Choose your school…</option>{schools.map((school: any) => <option key={school.id} value={school.id}>{school.name}</option>)}
                </select>
              </div>
            </>}

            <div className="space-y-3">
              <Label>Grade</Label>
              {!independentStudent && !selectedSchoolId ? <p className="rounded-xl bg-white/5 p-3 text-xs font-semibold text-slate-400">Select your school first.</p> : !gradeBand ? (
                <div className="grid grid-cols-2 gap-2">
                  {BANDS.map(item => <button key={item.id} type="button" onClick={() => { setGradeBand(item.id); setSelectedGrade(""); }} className="rounded-xl border border-white/10 bg-white/5 p-3 text-left hover:border-cyan-300/40 hover:bg-white/10"><span className="block font-black">{item.label}</span><span className="text-xs text-slate-400">{item.sub}</span></button>)}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3"><p className="text-sm font-black">{band?.label} · {band?.sub}</p><button type="button" onClick={() => { setGradeBand(""); setSelectedGrade(""); setSelectedTeacherId(""); }} className="text-xs font-black text-cyan-300">Change</button></div>
                  <div className="mt-3 flex flex-wrap gap-2">{GRADES.filter(g => band?.grades.includes(g)).map(g => <button key={g} type="button" onClick={() => { setSelectedGrade(g); setSelectedTeacherId(""); }} className={`min-h-10 rounded-xl px-4 text-sm font-black ${selectedGrade === g ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-white"}`}>Grade {g}</button>)}</div>
                </div>
              )}
            </div>

            {!independentStudent && <div className="space-y-2">
              <Label htmlFor="teacher">Teacher</Label>
              <select id="teacher" value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)} disabled={!selectedSchoolId || !selectedGrade} className="min-h-12 w-full rounded-xl border border-white/10 bg-[#0f0d1d] p-3 text-sm text-white disabled:opacity-40">
                <option value="">{!selectedGrade ? "Select school and grade first…" : "Choose your teacher…"}</option>{teachers.map((teacher: any) => <option key={teacher.id} value={teacher.id}>{teacher.display_name}</option>)}
              </select>
              {selectedSchoolId && selectedGrade && teachers.length === 0 && <p className="text-xs font-semibold text-fuchsia-300">No teacher is listed for that school and grade yet.</p>}
            </div>}

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-cyan-500/8 via-violet-500/8 to-fuchsia-500/8 p-4">
              <input type="checkbox" checked={isEyeGaze} onChange={e => setIsEyeGaze(e.target.checked)} className="mt-1 h-5 w-5 accent-cyan-400" />
              <span><strong className="block text-sm">Eye Gazer / non-verbal account</strong><span className="mt-1 block text-xs leading-5 text-slate-400">Use the dedicated accessible experience with large visual choices, My Talker, Eye Gazer games, Life Skills, and family personalization.</span></span>
            </label>

            {error && <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm font-bold text-red-200">{error}</div>}
            <Button type="submit" disabled={loading} className={`h-12 w-full rounded-xl font-black text-white ${independentStudent ? "bg-gradient-to-r from-cyan-500 via-violet-600 to-fuchsia-600" : "arise-gradient-button"}`}>{loading ? "Creating account…" : independentStudent ? "Create Independent Account" : "Create Student Account"}</Button>
          </form>
        </section>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {independentStudent ? <button type="button" onClick={() => navigate("/register")} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10"><School className="h-5 w-5 text-violet-300" /><p className="mt-2 font-black">Joining through a school?</p><p className="text-xs text-slate-400">Open the school-connected signup.</p></button> : <button type="button" onClick={() => navigate("/register?independent=1")} className="rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-4 text-left hover:bg-cyan-500/10"><UserRound className="h-5 w-5 text-cyan-300" /><p className="mt-2 font-black">Not joining through a school?</p><p className="text-xs text-slate-400">Use Independent Student Signup instead.</p></button>}
          <button type="button" onClick={() => navigate("/teacher-signup")} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10"><GraduationCap className="h-5 w-5 text-fuchsia-300" /><p className="mt-2 font-black">Are you a teacher?</p><p className="text-xs text-slate-400">Open teacher signup.</p></button>
        </div>
        <p className="mt-5 text-center text-xs font-semibold text-slate-500"><BookOpen className="mr-1 inline h-3.5 w-3.5" /> A.R.I.S.E. Reader · Read · Learn · Earn · Play · Grow</p>
      </div>
    </main>
  );
}