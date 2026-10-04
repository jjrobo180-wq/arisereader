import { useEyeGazeBackground, DEFAULT_EYE_GAZE_BACKGROUND } from "@/lib/eyeGazeAppearance";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import {
  Camera,
  Check,
  ChevronRight,
  Eye,
  Hand,
  KeyRound,
  LogOut,
  MessageCircle,
  Palette,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";

function getTokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch {
    return null;
  }
}

const BACKGROUNDS = [
  { name: "Mint", value: DEFAULT_EYE_GAZE_BACKGROUND, emoji: "🌿" },
  { name: "Sunshine", value: "#fff4d6", emoji: "☀️" },
  { name: "Sky", value: "#e4efff", emoji: "☁️" },
  { name: "Lavender", value: "#f6e6f3", emoji: "💜" },
  { name: "Sage", value: "#d4e9e2", emoji: "🍃" },
  { name: "Night", value: "#243c38", emoji: "🌙" },
];

const DWELL_TIMES = [
  { label: "Fast", value: 1200, detail: "1.2 sec" },
  { label: "Easy", value: 1800, detail: "1.8 sec" },
  { label: "Slower", value: 2500, detail: "2.5 sec" },
  { label: "Extra time", value: 3500, detail: "3.5 sec" },
];

export default function EyeGazeAccount() {
  const { user, token, logout, refreshUser } = useAuth();
  const [, navigate] = useLocation();
  const savedBackground = useEyeGazeBackground();

  const [background, setBackground] = useState(DEFAULT_EYE_GAZE_BACKGROUND);
  const [colorMessage, setColorMessage] = useState("");
  const [savingColor, setSavingColor] = useState(false);
  useEffect(() => setBackground(savedBackground), [savedBackground]);

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [nameMsg, setNameMsg] = useState("");
  const [nameBusy, setNameBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [photoMsg, setPhotoMsg] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);

  const [dwell, setDwell] = useState(() => localStorage.getItem("eye-gaze-talker-dwell") !== "off");
  const [dwellMs, setDwellMs] = useState(() => Number(localStorage.getItem("eye-gaze-talker-time")) || 1800);
  const [sentenceBuilder, setSentenceBuilder] = useState(() => localStorage.getItem("eye-gaze-talker-sentence-builder") === "on");

  const authToken = token || getTokenFromCookie();
  const firstName = user?.displayName?.split(" ")[0] || user?.username || "Reader";

  useEffect(() => {
    localStorage.setItem("eye-gaze-talker-dwell", dwell ? "on" : "off");
    localStorage.setItem("eye-gaze-talker-time", String(dwellMs));
    localStorage.setItem("eye-gaze-talker-sentence-builder", sentenceBuilder ? "on" : "off");
  }, [dwell, dwellMs, sentenceBuilder]);

  useEffect(() => {
    if (!authToken) return;
    fetch(`${API_BASE}/api/eye-gaze/profile-photo`, {
      headers: { Authorization: `Bearer ${authToken}` },
      cache: "no-store",
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => setProfilePhoto(data?.imageData || null))
      .catch(() => {});
  }, [authToken, user?.id]);

  const savePhotoData = async (imageData: string | null) => {
    if (!authToken) return;
    setPhotoBusy(true);
    setPhotoMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/eye-gaze/profile-photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ imageData }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not save picture.");
      setProfilePhoto(data.imageData || null);
      setPhotoMsg(data.imageData ? "Picture saved!" : "Picture removed.");
      window.dispatchEvent(new CustomEvent("eye-gaze-profile-photo-updated", { detail: { imageData: data.imageData || null } }));
    } catch (error: any) {
      setPhotoMsg(error?.message || "Could not save picture.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const choosePhoto = (file?: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setPhotoMsg("Choose a PNG, JPG, or WEBP picture.");
      return;
    }
    if (file.size > 600_000) {
      setPhotoMsg("Choose a picture under about 600 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => savePhotoData(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const saveBackground = async () => {
    if (!authToken) return;
    setSavingColor(true);
    setColorMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/eye-gaze/appearance`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ background }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save color.");
      window.dispatchEvent(new CustomEvent("eye-gaze-appearance-updated", { detail: data.background }));
      setColorMessage("My color is saved!");
    } catch (error: any) {
      setColorMessage(error.message || "Could not save color.");
    } finally {
      setSavingColor(false);
    }
  };

  const saveName = async () => {
    if (!authToken || displayName.trim().length < 2) {
      setNameMsg("Enter at least 2 characters.");
      return;
    }
    setNameBusy(true);
    setNameMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/change-name`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not update name.");
      await refreshUser();
      setNameMsg("Name saved!");
    } catch (error: any) {
      setNameMsg(error?.message || "Could not update name.");
    } finally {
      setNameBusy(false);
    }
  };

  const savePassword = async () => {
    if (!authToken) return;
    if (newPassword.length < 4) {
      setPwMsg("New password must be at least 4 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg("The new passwords do not match.");
      return;
    }
    setPwBusy(true);
    setPwMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/change-password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not change password.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMsg("Password changed!");
    } catch (error: any) {
      setPwMsg(error?.message || "Could not change password.");
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7 pb-8 space-y-5">
      <section className="overflow-hidden rounded-[2rem] border border-teal-200 bg-[#fffaf0] shadow-sm">
        <div className="h-2 bg-gradient-to-r from-teal-500 via-cyan-400 to-amber-300" />
        <div className="p-5 sm:p-7 flex flex-col md:flex-row md:items-center gap-5">
          <div className="relative mx-auto md:mx-0 flex-shrink-0">
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt="Profile"
                className="w-32 h-32 sm:w-36 sm:h-36 rounded-[2rem] object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-[2rem] bg-gradient-to-br from-teal-100 to-sky-100 flex items-center justify-center border-4 border-white shadow-lg">
                <UserRound className="w-16 h-16 text-teal-700" />
              </div>
            )}
            <label
              className="absolute -bottom-2 -right-2 w-13 h-13 min-w-[52px] min-h-[52px] rounded-2xl bg-teal-700 text-white flex items-center justify-center cursor-pointer shadow-lg border-4 border-[#fffaf0] hover:bg-teal-800"
              aria-label="Change profile picture"
            >
              <Camera className="w-6 h-6" />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={photoBusy}
                onChange={e => choosePhoto(e.target.files?.[0])}
              />
            </label>
          </div>

          <div className="flex-1 min-w-0 text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-xs font-black uppercase tracking-[0.15em] text-teal-800">
              <Sparkles className="w-4 h-4" />
              My Profile
            </div>
            <h1 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight text-slate-950">
              This is {firstName}'s space
            </h1>
            <p className="mt-2 text-base sm:text-lg font-bold text-slate-600">
              Make A.R.I.S.E. feel comfortable, familiar, and easy to use.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
              <label className="min-h-[50px] rounded-2xl bg-white border-2 border-teal-100 px-4 font-black text-teal-800 inline-flex items-center gap-2 cursor-pointer hover:bg-teal-50">
                <Camera className="w-5 h-5" />
                {profilePhoto ? "Change picture" : "Add my picture"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={photoBusy}
                  onChange={e => choosePhoto(e.target.files?.[0])}
                />
              </label>
              {profilePhoto && (
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() => savePhotoData(null)}
                  className="min-h-[50px] rounded-2xl bg-rose-50 border-2 border-rose-100 px-4 font-black text-rose-700 inline-flex items-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Remove
                </button>
              )}
            </div>
            {photoMsg && <p role="status" className="mt-3 text-sm font-black text-slate-600">{photoMsg}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white/90 border border-teal-200 shadow-sm p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center flex-shrink-0">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">My look</p>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950">Pick my background</h2>
            <p className="mt-1 font-bold text-slate-600">Choose the color that feels best. The reading cards stay clear and bright.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
          {BACKGROUNDS.map(option => {
            const selected = background.toLowerCase() === option.value.toLowerCase();
            return (
              <button
                key={option.value}
                type="button"
                aria-label={`Choose ${option.value}`}
                aria-pressed={selected}
                onClick={() => setBackground(option.value)}
                className={`relative min-h-[118px] rounded-3xl border-3 p-3 text-left transition-all focus:outline-none focus:ring-4 focus:ring-teal-200 ${selected ? "border-teal-700 shadow-md -translate-y-0.5" : "border-slate-200 hover:border-teal-300"}`}
                style={{ backgroundColor: option.value }}
              >
                {selected && (
                  <span className="absolute top-2 right-2 w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center shadow">
                    <Check className="w-5 h-5" />
                  </span>
                )}
                <div className="text-3xl">{option.emoji}</div>
                <div className={`mt-5 text-sm font-black ${option.value === "#243c38" ? "text-white" : "text-slate-900"}`}>{option.name}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="flex-1 font-black text-slate-700">
            Or choose any color
            <div className="mt-2 min-h-[58px] rounded-2xl border-2 border-slate-200 bg-white px-3 flex items-center gap-3">
              <input
                aria-label="Custom background color"
                type="color"
                value={background}
                onChange={e => setBackground(e.target.value)}
                className="h-10 w-14 rounded-xl cursor-pointer border-0 bg-transparent"
              />
              <span className="font-mono text-sm text-slate-600">{background.toUpperCase()}</span>
            </div>
          </label>
          <button
            onClick={saveBackground}
            disabled={savingColor}
            className="min-h-[58px] rounded-2xl bg-teal-700 text-white px-6 font-black text-lg disabled:opacity-50 hover:bg-teal-800"
          >
            {savingColor ? "Saving…" : "Save my color"}
          </button>
        </div>
        {colorMessage && <p role="status" className="mt-3 font-black text-teal-800">{colorMessage}</p>}
      </section>

      <section className="rounded-[2rem] bg-white/90 border border-sky-200 shadow-sm p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">My Talker</p>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950">How I choose words</h2>
            <p className="mt-1 font-bold text-slate-600">Keep the Talker simple and choose the access style that works best.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-5">
          <button
            type="button"
            onClick={() => setDwell(true)}
            aria-pressed={dwell}
            className={`min-h-[150px] rounded-[1.75rem] border-3 p-5 text-left transition-all ${dwell ? "border-teal-700 bg-teal-50 shadow-sm" : "border-slate-200 bg-white hover:border-teal-300"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white text-teal-700 flex items-center justify-center shadow-sm"><Eye className="w-8 h-8" /></div>
              {dwell && <span className="rounded-full bg-teal-700 text-white px-3 py-1 text-xs font-black">MY CHOICE</span>}
            </div>
            <div className="mt-4 text-xl font-black text-slate-950">Look and wait</div>
            <div className="mt-1 font-bold text-slate-600">Look at a button and hold your eyes there to choose it.</div>
          </button>

          <button
            type="button"
            onClick={() => setDwell(false)}
            aria-pressed={!dwell}
            className={`min-h-[150px] rounded-[1.75rem] border-3 p-5 text-left transition-all ${!dwell ? "border-sky-700 bg-sky-50 shadow-sm" : "border-slate-200 bg-white hover:border-sky-300"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white text-sky-700 flex items-center justify-center shadow-sm"><Hand className="w-8 h-8" /></div>
              {!dwell && <span className="rounded-full bg-sky-700 text-white px-3 py-1 text-xs font-black">MY CHOICE</span>}
            </div>
            <div className="mt-4 text-xl font-black text-slate-950">Tap or click</div>
            <div className="mt-1 font-bold text-slate-600">Choose a button with a finger, switch, mouse, or touch screen.</div>
          </button>
        </div>

        {dwell && (
          <div className="mt-5 rounded-3xl bg-teal-50/70 border border-teal-100 p-4 sm:p-5">
            <h3 className="text-lg font-black text-slate-900">How long should I look?</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
              {DWELL_TIMES.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setDwellMs(option.value)}
                  aria-pressed={dwellMs === option.value}
                  className={`min-h-[72px] rounded-2xl border-2 px-3 text-left ${dwellMs === option.value ? "bg-teal-700 border-teal-700 text-white" : "bg-white border-teal-100 text-slate-800"}`}
                >
                  <div className="font-black">{option.label}</div>
                  <div className={`text-xs font-bold ${dwellMs === option.value ? "text-teal-50" : "text-slate-500"}`}>{option.detail}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 rounded-3xl border-2 border-amber-100 bg-amber-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">Optional</p>
            <h3 className="text-xl font-black text-slate-950">Sentence builder / My Words</h3>
            <p className="mt-1 font-bold text-slate-600">Leave this off for a calmer Talker. Turn it on when collecting words into a sentence is helpful.</p>
          </div>
          <button
            type="button"
            onClick={() => setSentenceBuilder(value => !value)}
            aria-pressed={sentenceBuilder}
            className={`min-h-[58px] min-w-[130px] rounded-2xl border-2 px-5 font-black text-lg ${sentenceBuilder ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-300 text-slate-700"}`}
          >
            {sentenceBuilder ? "ON ✓" : "OFF"}
          </button>
        </div>
        <p className="mt-3 text-sm font-bold text-slate-500">Talker choices save automatically on this device.</p>
      </section>

      <section className="rounded-[2rem] bg-[#fffaf0] border border-amber-200 shadow-sm p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Grown-ups</p>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950">Parent & guardian controls</h2>
            <p className="mt-1 font-bold text-slate-600">A grown-up can choose allowed activities, video channels, and video time without crowding the child's screens.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/eye-gaze-parent-controls")}
          className="mt-5 w-full sm:w-auto min-h-[60px] rounded-2xl bg-slate-950 text-white px-6 font-black text-lg inline-flex items-center justify-center gap-3"
        >
          Open grown-up controls
          <ChevronRight className="w-5 h-5" />
        </button>
      </section>

      <section className="rounded-[2rem] bg-white/90 border border-slate-200 shadow-sm p-5 sm:p-7">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
            <UserRound className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Account</p>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950">Name & sign-in</h2>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <div className="rounded-3xl bg-sky-50 border border-sky-100 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-sky-600" />
              <h3 className="text-xl font-black text-slate-950">My name</h3>
            </div>
            <label className="block text-sm font-black text-slate-600 mb-2">Display name</label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full min-h-[56px] rounded-2xl border-2 border-sky-100 bg-white px-4 text-lg font-bold outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={saveName}
              disabled={nameBusy}
              className="mt-3 w-full min-h-[56px] rounded-2xl bg-sky-700 text-white font-black text-lg disabled:opacity-50"
            >
              {nameBusy ? "Saving…" : "Save my name"}
            </button>
            {nameMsg && <p role="status" className="mt-2 font-black text-slate-600">{nameMsg}</p>}
          </div>

          <div className="rounded-3xl bg-slate-50 border border-slate-200 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-5 h-5 text-slate-600" />
              <h3 className="text-xl font-black text-slate-950">Password</h3>
            </div>
            <div className="space-y-2">
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full min-h-[52px] rounded-2xl border-2 border-slate-200 bg-white px-4 font-bold outline-none focus:border-teal-500"
              />
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full min-h-[52px] rounded-2xl border-2 border-slate-200 bg-white px-4 font-bold outline-none focus:border-teal-500"
              />
              <input
                type="password"
                placeholder="Type new password again"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full min-h-[52px] rounded-2xl border-2 border-slate-200 bg-white px-4 font-bold outline-none focus:border-teal-500"
              />
            </div>
            <button
              type="button"
              onClick={savePassword}
              disabled={pwBusy}
              className="mt-3 w-full min-h-[56px] rounded-2xl bg-slate-800 text-white font-black text-lg disabled:opacity-50"
            >
              {pwBusy ? "Saving…" : "Change password"}
            </button>
            {pwMsg && <p role="status" className="mt-2 font-black text-slate-600">{pwMsg}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] bg-rose-50 border border-rose-100 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => { logout(); navigate("/"); }}
          className="w-full sm:w-auto min-h-[56px] rounded-2xl bg-rose-600 text-white px-6 font-black text-lg flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Log out
        </button>
      </section>
    </main>
  );
}
