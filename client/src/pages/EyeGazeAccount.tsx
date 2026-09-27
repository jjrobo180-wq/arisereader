import { useEyeGazeBackground, DEFAULT_EYE_GAZE_BACKGROUND } from "@/lib/eyeGazeAppearance";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Camera, KeyRound, LogOut, Sparkles, Trash2, UserRound } from "lucide-react";

function getTokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    if (!match) return null;
    return JSON.parse(atob(match[1])).token || null;
  } catch {
    return null;
  }
}

export default function EyeGazeAccount() {
  const { user, token, logout, refreshUser } = useAuth();
  const [, navigate] = useLocation();
  const savedBackground = useEyeGazeBackground();
  const [background, setBackground] = useState(DEFAULT_EYE_GAZE_BACKGROUND);
  const [colorMessage, setColorMessage] = useState("");
  const [savingColor, setSavingColor] = useState(false);
  useEffect(()=>setBackground(savedBackground),[savedBackground]);
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
      .then(r => r.ok ? r.json() : null)
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
      setPhotoMsg(data.imageData ? "Profile picture updated!" : "Profile picture removed.");
      window.dispatchEvent(new CustomEvent("eye-gaze-profile-photo-updated", { detail: { imageData: data.imageData || null } }));
    } catch (error: any) {
      setPhotoMsg(error?.message || "Could not save picture.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const saveBackground = async () => {
    setSavingColor(true); setColorMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/eye-gaze/appearance`, {method:"POST",headers:{Authorization:`Bearer ${authToken}`,"Content-Type":"application/json"},body:JSON.stringify({background})});
      const data = await response.json();
      if(!response.ok)throw new Error(data.message || "Could not save color.");
      window.dispatchEvent(new CustomEvent("eye-gaze-appearance-updated",{detail:data.background}));
      setColorMessage("Background saved to your profile!");
    }catch(error:any){setColorMessage(error.message || "Could not save color.");}finally{setSavingColor(false);}
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
      setNameMsg("Name updated!");
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
    <main className="px-4 sm:px-6 py-6 max-w-5xl mx-auto space-y-5">
      <section className="rounded-[2rem] bg-gradient-to-r from-teal-100 via-emerald-50 to-amber-50 border-2 border-white shadow-sm p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative flex-shrink-0">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-28 h-28 rounded-[2rem] object-cover border-4 border-white shadow-md" />
            ) : (
              <div className="w-28 h-28 rounded-[2rem] bg-white flex items-center justify-center shadow-md">
                <UserRound className="w-14 h-14 text-violet-600" />
              </div>
            )}
            <label className="absolute -bottom-2 -right-2 w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center cursor-pointer shadow-md" aria-label="Change profile picture">
              <Camera className="w-5 h-5" />
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={photoBusy} onChange={e => choosePhoto(e.target.files?.[0])} />
            </label>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm font-black uppercase tracking-widest text-violet-600">Profile & Settings</p>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900">{user?.displayName || user?.username || "Reader"}</h1>
            <p className="text-slate-600 font-bold">@{user?.username}</p>
            <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
              <label className="min-h-[44px] rounded-2xl bg-white px-4 font-black text-blue-700 inline-flex items-center gap-2 cursor-pointer border border-blue-100">
                <Camera className="w-4 h-4" /> {profilePhoto ? "Change Picture" : "Add Picture"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={photoBusy} onChange={e => choosePhoto(e.target.files?.[0])} />
              </label>
              {profilePhoto && (
                <button type="button" disabled={photoBusy} onClick={() => savePhotoData(null)} className="min-h-[44px] rounded-2xl bg-rose-50 px-4 font-black text-rose-700 inline-flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Remove
                </button>
              )}
            </div>
            {photoMsg && <p className="mt-2 text-sm font-bold text-slate-600">{photoMsg}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white border-2 border-teal-200 p-5 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900">🎨 My background</h2>
        <p className="mt-2 font-bold text-slate-600">Pick a color for your Eye Gazer pages. Cards stay easy to read.</p>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {[DEFAULT_EYE_GAZE_BACKGROUND,"#fff4d6","#e4efff","#f6e6f3","#d4e9e2","#243c38"].map(color=><button key={color} aria-label={`Choose ${color}`} aria-pressed={background===color} onClick={()=>setBackground(color)} className="h-14 w-14 rounded-2xl border-4 border-slate-300 focus-visible:ring-4 focus-visible:ring-teal-500" style={{backgroundColor:color,outline:background===color?"3px solid #0f766e":"none"}}/>)}
          <label className="flex items-center gap-3 font-black text-slate-900">Custom color<input aria-label="Custom background color" type="color" value={background} onChange={e=>setBackground(e.target.value)} className="h-14 w-16 rounded-xl cursor-pointer"/></label>
        </div>
        <div className="mt-4 rounded-2xl border p-5" style={{backgroundColor:background}}><span className="inline-block rounded-xl bg-white text-slate-900 px-4 py-3 font-black">Your background preview ✨</span></div>
        <div className="flex flex-wrap gap-3 mt-4"><button onClick={saveBackground} disabled={savingColor} className="min-h-12 rounded-2xl bg-teal-800 text-white px-5 font-black disabled:opacity-50">{savingColor?"Saving…":"Save background"}</button><button onClick={()=>setBackground(DEFAULT_EYE_GAZE_BACKGROUND)} className="min-h-12 rounded-2xl bg-slate-100 text-slate-900 px-5 font-black">Default mint</button></div>
        {colorMessage&&<p role="status" className="mt-3 font-bold text-slate-700">{colorMessage}</p>}
      </section>
      <section className="rounded-3xl bg-white border-2 border-sky-200 p-5 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900">👁️ How I choose buttons</h2>
        <p className="mt-2 font-bold text-slate-600">Talker access settings live here so the Talk screen can stay simple.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <button type="button" onClick={()=>setDwell(true)} aria-pressed={dwell} className={`min-h-16 rounded-2xl border-2 font-black ${dwell ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-200 bg-white"}`}>👁 Look and wait</button>
          <button type="button" onClick={()=>setDwell(false)} aria-pressed={!dwell} className={`min-h-16 rounded-2xl border-2 font-black ${!dwell ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-200 bg-white"}`}>☝️ Tap or click</button>
        </div>
        {dwell && <label className="block mt-4 font-black text-slate-700">Look-and-wait time
          <select value={dwellMs} onChange={event=>setDwellMs(Number(event.target.value))} className="mt-2 w-full min-h-12 rounded-2xl border-2 border-sky-100 bg-white px-4 font-bold">
            <option value={1200}>1.2 seconds</option>
            <option value={1800}>1.8 seconds</option>
            <option value={2500}>2.5 seconds</option>
            <option value={3500}>3.5 seconds</option>
          </select>
        </label>}
        <div className="mt-5 pt-4 border-t border-sky-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-900">🧩 Sentence builder / My Words</h3>
              <p className="text-sm font-bold text-slate-600">Optional. Keep this off for a calmer My Talker screen. Turn it on to let the child collect words into a sentence.</p>
            </div>
            <button type="button" onClick={()=>setSentenceBuilder(value=>!value)} aria-pressed={sentenceBuilder} className={`min-h-14 min-w-32 rounded-2xl border-2 px-5 font-black ${sentenceBuilder ? "bg-emerald-600 border-emerald-600 text-white" : "bg-slate-100 border-slate-300 text-slate-700"}`}>{sentenceBuilder ? "ON ✓" : "OFF"}</button>
          </div>
        </div>
        <p className="mt-3 text-sm font-bold text-slate-500">Changes save automatically on this device.</p>
      </section>

      <section className="rounded-3xl bg-white border-2 border-amber-200 p-5 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900">👨‍👩‍👧 Parent controls</h2>
        <p className="mt-2 font-bold text-slate-600">Choose allowed activities, video channels, and daily video time. A grown-up check protects these controls.</p>
        <button onClick={()=>navigate("/eye-gaze-parent-controls")} className="mt-4 min-h-14 rounded-2xl bg-teal-800 text-white px-5 font-black">Open parent controls</button>
      </section>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="rounded-3xl bg-white border-2 border-sky-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-sky-500" />
            <h2 className="text-2xl font-black">My Name</h2>
          </div>
          <label className="block text-sm font-black text-slate-600 mb-2">Display name</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full min-h-[54px] rounded-2xl border-2 border-sky-100 px-4 text-lg font-bold outline-none focus:border-violet-400" />
          <button type="button" onClick={saveName} disabled={nameBusy} className="mt-3 w-full min-h-[54px] rounded-2xl bg-violet-600 text-white font-black text-lg disabled:opacity-50">
            {nameBusy ? "Saving..." : "Save My Name"}
          </button>
          {nameMsg && <p className="mt-2 font-bold text-slate-600">{nameMsg}</p>}
        </section>

        <section className="rounded-3xl bg-white border-2 border-violet-100 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <KeyRound className="w-6 h-6 text-violet-500" />
            <h2 className="text-2xl font-black">Password</h2>
          </div>
          <div className="space-y-2">
            <input type="password" placeholder="Current password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full min-h-[50px] rounded-2xl border-2 border-violet-100 px-4 font-bold outline-none focus:border-violet-400" />
            <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full min-h-[50px] rounded-2xl border-2 border-violet-100 px-4 font-bold outline-none focus:border-violet-400" />
            <input type="password" placeholder="Type new password again" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full min-h-[50px] rounded-2xl border-2 border-violet-100 px-4 font-bold outline-none focus:border-violet-400" />
          </div>
          <button type="button" onClick={savePassword} disabled={pwBusy} className="mt-3 w-full min-h-[54px] rounded-2xl bg-sky-600 text-white font-black text-lg disabled:opacity-50">
            {pwBusy ? "Saving..." : "Change Password"}
          </button>
          {pwMsg && <p className="mt-2 font-bold text-slate-600">{pwMsg}</p>}
        </section>
      </div>

      <section className="rounded-3xl bg-rose-50 border-2 border-rose-100 p-4">
        <button type="button" onClick={() => { logout(); navigate("/"); }} className="w-full sm:w-auto min-h-[54px] rounded-2xl bg-rose-600 text-white px-6 font-black flex items-center justify-center gap-2">
          <LogOut className="w-5 h-5" /> Log Out
        </button>
      </section>
    </main>
  );
}
