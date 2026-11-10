import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, GraduationCap, School, UserRound } from "lucide-react";
import { SignupShell } from "@/components/SignupShell";
import { SchoolPicker, schoolFields, siteSchoolId, type SchoolChoice } from "@/components/SchoolPicker";

const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const NOT_LISTED = "__not_listed__";
const BANDS = [
  { id: "K-2", label: "K–2", sub: "Early Readers", grades: ["K", "1", "2"] },
  { id: "3-5", label: "3–5", sub: "Elementary", grades: ["3", "4", "5"] },
  { id: "6-8", label: "6–8", sub: "Middle School", grades: ["6", "7", "8"] },
  { id: "9-12", label: "9–12", sub: "High School", grades: ["9", "10", "11", "12"] },
];

export default function Register({ independent = false }: { independent?: boolean }) {
  const { register } = useAuth();
  const [, navigate] = useLocation();
  const independentStudent = independent;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Arriving from the Eye Gazer home page (/eyegaze/) the box starts ticked: #/register?eye=1
  const [isEyeGaze, setIsEyeGaze] = useState(() => typeof window !== "undefined" && /[?&]eye=1(?:&|$)/.test(window.location.hash));
  const [school, setSchool] = useState<SchoolChoice | null>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [gradeBand, setGradeBand] = useState("");
  const [unlistedTeacherName, setUnlistedTeacherName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // The school's id on the site. A school picked from the US list for the first time doesn't have one yet.
  const selectedSchoolId = siteSchoolId(school);
  const schoolNotListed = school?.kind === "unlisted";
  const schoolNewToSite = !!school && !schoolNotListed && !selectedSchoolId;
  // If the school isn't on the site yet, its teachers can't be either.
  const selectedTeacher = teachers.find((t) => String(t.id) === selectedTeacherId);
  const directoryTeacher = !!selectedTeacher?.directory;
  const teacherNotListed = schoolNotListed || schoolNewToSite || selectedTeacherId === NOT_LISTED;
  // A school with advisories (Conservatory Green MS) asks for the student's advisory instead of a teacher.
  const [advisories, setAdvisories] = useState<Array<{ id: string; name: string; label: string; grade: string; room: string }>>([]);
  const byAdvisory = !independentStudent && advisories.length > 0;
  const gradeAdvisories = advisories.filter((a) => !a.grade || a.grade === selectedGrade);
  useEffect(() => {
    if (independentStudent || !selectedSchoolId) { setAdvisories([]); return; }
    let alive = true;
    fetch(`${API_BASE}/api/public/schools/${selectedSchoolId}/advisories`).then(r => r.ok ? r.json() : []).then(d => { if (alive) setAdvisories(Array.isArray(d) ? d : []); }).catch(() => { if (alive) setAdvisories([]); });
    return () => { alive = false; };
  }, [selectedSchoolId, independentStudent]);
  const advisoryPicked = byAdvisory && selectedTeacherId.startsWith("advisory:");

  useEffect(() => {
    if (!independentStudent && selectedSchoolId && selectedGrade) {
      fetch(`${API_BASE}/api/teachers/by-school-grade?schoolId=${selectedSchoolId}&grade=${selectedGrade}`)
        .then(r => r.ok ? r.json() : []).then(data => setTeachers(Array.isArray(data) ? data : [])).catch(() => setTeachers([]));
    } else { setTeachers([]); setSelectedTeacherId(prev => prev === NOT_LISTED ? prev : ""); }
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
    if (!independentStudent && !school) return setError("Please pick your school. Type its name in the School box, or tap \"My school isn't listed\".");
    if (!independentStudent && !teacherNotListed && !selectedTeacherId) return setError(byAdvisory ? "Please choose your advisory, or tap \"My advisory isn't listed\"." : "Please select your teacher, or tap \"My teacher isn't listed\".");
    if (!independentStudent && teacherNotListed && unlistedTeacherName.trim().length < 2) return setError(byAdvisory ? "Please type your advisory teachers' names." : "Please type your teacher's name.");

    setLoading(true);
    try {
      sessionStorage.setItem("show_profile_setup", "true");
      await register(
        username,
        password,
        `${firstName.trim()} ${lastName.trim()}`,
        isEyeGaze,
        independentStudent || teacherNotListed || directoryTeacher || advisoryPicked ? null : Number(selectedTeacherId),
        independentStudent ? null : selectedSchoolId,
        selectedGrade,
        independentStudent ? { independent: true } : {
          schoolName: schoolFields(school).unlistedSchoolName,
          directorySchool: schoolFields(school).directorySchool,
          teacherName: teacherNotListed ? unlistedTeacherName.trim() : undefined,
          directoryTeacherId: directoryTeacher ? selectedTeacherId : undefined,
          advisoryId: advisoryPicked ? selectedTeacherId.slice("advisory:".length) : undefined,
        },
      );
    } catch (err: any) { setError(err.message || "Could not create account."); }
    finally { setLoading(false); }
  };

  const band = BANDS.find(item => item.id === gradeBand);
  // Arrived from the Eye Gazer home page: say so at the top.
  const [eyeEntry] = useState(() => typeof window !== "undefined" && /[?&]eye=1(?:&|$)/.test(window.location.hash));
  const eyebrow = eyeEntry ? "Eye Gazer account" : independentStudent ? "Independent reader" : "School-connected student";
  const title = eyeEntry ? <>Eye Gazer <span className="text-violet-700">Signup</span></> : independentStudent ? <>Independent Student <span className="text-violet-700">Signup</span></> : <>Student <span className="text-violet-700">Signup</span></>;
  const intro = eyeEntry
    ? "An accessible account with large visual choices, My Talker, Eye Gazer games and Life Skills."
    : independentStudent ? "This account is not attached to a school or teacher. You can read, quiz, earn rewards, and connect a parent or guardian after signup." : "Connect your account to your school and teacher so your reading progress, quizzes, and rewards show in the right class.";

  return (
    <SignupShell eyebrow={eyebrow} title={title} intro={intro} below={
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {independentStudent ? <button type="button" onClick={() => navigate("/register")} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-violet-300"><School className="h-5 w-5 text-violet-700" /><p className="mt-2 font-black">Joining through a school?</p><p className="text-xs text-slate-500">Open the school-connected signup.</p></button> : <button type="button" onClick={() => navigate("/parent-signup")} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-violet-300"><UserRound className="h-5 w-5 text-violet-700" /><p className="mt-2 font-black">Not joining through a school?</p><p className="text-xs text-slate-500">A parent creates the account first, then adds you.</p></button>}
        <button type="button" onClick={() => navigate("/teacher-signup")} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-violet-300"><GraduationCap className="h-5 w-5 text-emerald-700" /><p className="mt-2 font-black">Are you a teacher?</p><p className="text-xs text-slate-500">Open teacher signup.</p></button>
      </div>
    }>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="firstName" className="font-bold text-[#191b35]">First name</Label><Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Alex" required className="h-12 rounded-xl border-[#dfe2ee] bg-white text-[#191b35] placeholder:text-slate-400 focus-visible:ring-violet-600" /></div>
              <div className="space-y-2"><Label htmlFor="lastName" className="font-bold text-[#191b35]">Last name</Label><Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Martinez" required className="h-12 rounded-xl border-[#dfe2ee] bg-white text-[#191b35] placeholder:text-slate-400 focus-visible:ring-violet-600" /></div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="font-bold text-[#191b35]">Username</Label>
              <Input id="username" value={username} onChange={e => { setUsername(e.target.value); setUsernameEdited(true); }} placeholder="Choose a username" required className="h-12 rounded-xl border-[#dfe2ee] bg-white text-[#191b35] placeholder:text-slate-400 focus-visible:ring-violet-600" />
              {!usernameEdited && firstName && lastName && <p className="text-xs text-slate-500">Suggested from your name. You can change it.</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="password" className="font-bold text-[#191b35]">Password</Label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 4 characters" required className="h-12 rounded-xl border-[#dfe2ee] bg-white text-[#191b35] placeholder:text-slate-400 focus-visible:ring-violet-600" /></div>
              <div className="space-y-2"><Label htmlFor="confirm" className="font-bold text-[#191b35]">Confirm password</Label><Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Type it again" required className="h-12 rounded-xl border-[#dfe2ee] bg-white text-[#191b35] placeholder:text-slate-400 focus-visible:ring-violet-600" /></div>
            </div>

            {!independentStudent && <>
              <div className="space-y-2">
                <Label className="font-bold text-[#191b35]">School</Label>
                <SchoolPicker who="student" value={school} onChange={(choice) => { setSchool(choice); setGradeBand(""); setSelectedGrade(""); setSelectedTeacherId(""); }} />
              </div>
            </>}

            <div className="space-y-3">
              <Label className="font-bold text-[#191b35]">Grade</Label>
              {!independentStudent && !school ? <p className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">Select your school first.</p> : !gradeBand ? (
                <div className="grid grid-cols-2 gap-2">
                  {BANDS.map(item => <button key={item.id} type="button" onClick={() => { setGradeBand(item.id); setSelectedGrade(""); }} className="rounded-xl border border-[#dfe2ee] bg-white p-3 text-left hover:border-violet-400 hover:bg-violet-50"><span className="block font-black">{item.label}</span><span className="text-xs text-slate-500">{item.sub}</span></button>)}
                </div>
              ) : (
                <div className="rounded-2xl border border-[#dfe2ee] bg-[#fafaff] p-4">
                  <div className="flex items-center justify-between gap-3"><p className="text-sm font-black">{band?.label} · {band?.sub}</p><button type="button" onClick={() => { setGradeBand(""); setSelectedGrade(""); setSelectedTeacherId(""); }} className="text-xs font-black text-violet-700">Change</button></div>
                  <div className="mt-3 flex flex-wrap gap-2">{GRADES.filter(g => band?.grades.includes(g)).map(g => <button key={g} type="button" onClick={() => { setSelectedGrade(g); setSelectedTeacherId(""); }} className={`min-h-10 rounded-xl px-4 text-sm font-black ${selectedGrade === g ? "bg-violet-700 text-white" : "border border-[#dfe2ee] bg-white text-slate-700"}`}>Grade {g}</button>)}</div>
                </div>
              )}
            </div>

            {!independentStudent && <div className="space-y-2">
              <Label htmlFor="teacher" className="font-bold text-[#191b35]">{byAdvisory ? "Advisory" : "Teacher"}</Label>
              {byAdvisory && !teacherNotListed && <select id="teacher" value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)} disabled={!selectedGrade} className="min-h-12 w-full rounded-xl border border-[#dfe2ee] bg-white p-3 text-sm text-[#191b35] disabled:opacity-50" data-testid="signup-advisory">
                <option value="">{!selectedGrade ? "Select your grade first…" : "Choose your advisory…"}</option>
                {gradeAdvisories.map((a) => <option key={a.id} value={`advisory:${a.id}`}>{a.name}{a.room ? ` · Room ${a.room}` : ""}</option>)}
              </select>}
              {byAdvisory && !teacherNotListed && selectedGrade && <button type="button" onClick={() => setSelectedTeacherId(NOT_LISTED)} className="w-full rounded-xl border border-[#dfe2ee] bg-white p-3 text-sm font-bold text-slate-700 hover:border-violet-400 hover:text-violet-700">My advisory isn't listed</button>}
              {byAdvisory && teacherNotListed && <Input id="teacher" value={unlistedTeacherName} onChange={e => setUnlistedTeacherName(e.target.value)} maxLength={120} placeholder="Type your advisory teachers' names (example: Chase & Shuster)" className="h-12 rounded-xl border-[#dfe2ee] bg-white text-[#191b35] placeholder:text-slate-400 focus-visible:ring-violet-600" />}
              {byAdvisory && teacherNotListed && <p className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs font-semibold leading-5 text-slate-700">No problem. You'll get full access right away. We'll put you in your advisory for you.</p>}
              {!byAdvisory && <>
              {!schoolNotListed && !schoolNewToSite && <select id="teacher" value={selectedTeacherId} onChange={e => setSelectedTeacherId(e.target.value)} disabled={!selectedSchoolId || !selectedGrade} className="min-h-12 w-full rounded-xl border border-[#dfe2ee] bg-white p-3 text-sm text-[#191b35] disabled:opacity-50">
                <option value="">{!selectedGrade ? "Select school and grade first…" : "Choose your teacher…"}</option>{teachers.map((teacher: any) => <option key={teacher.id} value={teacher.id}>{teacher.display_name}</option>)}
                {selectedGrade && <option value={NOT_LISTED}>My teacher isn't listed</option>}
              </select>}
              {teacherNotListed
                ? <Input id={schoolNotListed || schoolNewToSite ? "teacher" : undefined} value={unlistedTeacherName} onChange={e => setUnlistedTeacherName(e.target.value)} maxLength={120} placeholder="Type your teacher's name (example: Mrs. Lopez)" className="h-12 rounded-xl border-[#dfe2ee] bg-white text-[#191b35] placeholder:text-slate-400 focus-visible:ring-violet-600" />
                : selectedSchoolId && selectedGrade && <button type="button" onClick={() => setSelectedTeacherId(NOT_LISTED)} className={`w-full rounded-xl border p-3 text-sm font-bold transition ${teachers.length === 0 ? "border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100" : "border-[#dfe2ee] bg-white text-slate-700 hover:border-violet-400 hover:text-violet-700"}`}>
                    {teachers.length === 0 ? "No teachers listed yet — tap here: Teacher not listed" : "Teacher not listed?"}
                  </button>}
              {directoryTeacher && <p className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs font-semibold leading-5 text-slate-700">This teacher is listed for your school but does not have a linked A.R.I.S.E. Reader account yet. You can sign up and read right away. An administrator can link you to their class when the teacher joins.</p>}
              {teacherNotListed && <p className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs font-semibold leading-5 text-slate-700">{schoolNewToSite ? "No teachers from this school are on A.R.I.S.E. yet. " : "No problem. "}You'll get full access right away. We'll connect you to your {schoolNotListed ? "school and teacher" : "teacher"} for you.</p>}
              </>}
            </div>}

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <input type="checkbox" checked={isEyeGaze} onChange={e => setIsEyeGaze(e.target.checked)} className="mt-1 h-5 w-5 accent-violet-700" />
              <span><strong className="flex items-center gap-1.5 text-sm"><Eye className="h-4 w-4 text-violet-700" aria-hidden="true" /> Eye Gazer / non-verbal account</strong><span className="mt-1 block text-xs leading-5 text-slate-600">Use the dedicated accessible experience with large visual choices, My Talker, Eye Gazer games, Life Skills, and family personalization.</span></span>
            </label>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
            <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-violet-700 font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-800">{loading ? "Creating account…" : independentStudent ? "Create Independent Account" : "Create Student Account"}</Button>
            <p className="text-center text-sm text-slate-600">Already have an account? <button type="button" onClick={() => navigate("/signin")} className="font-bold text-violet-700 underline underline-offset-2">Sign in</button></p>
          </form>
    </SignupShell>
  );
}
