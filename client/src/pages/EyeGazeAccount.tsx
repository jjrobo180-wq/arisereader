import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { UserRound, KeyRound, LogOut, Sparkles } from "lucide-react";

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
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [nameMsg, setNameMsg] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const authToken = token || getTokenFromCookie();

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
    <main className="px-4 sm:px-8 py-6 sm:py-10 max-w-5xl mx-auto">
      <div className="rounded-[2rem] bg-gradient-to-r from-sky-100 via-violet-100 to-amber-100 border-2 border-white shadow-sm p-6 sm:p-8 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center shadow-sm">
            <UserRound className="w-10 h-10 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-violet-600">My Profile</p>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900">{user?.displayName || user?.username || "Reader"}</h1>
            <p className="text-slate-600 font-bold">@{user?.username}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-3xl bg-white border-2 border-sky-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <Sparkles className="w-7 h-7 text-sky-500" />
            <h2 className="text-2xl font-black">My Name</h2>
          </div>
          <label className="block text-sm font-black text-slate-600 mb-2">Display name</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full min-h-[56px] rounded-2xl border-2 border-sky-100 px-4 text-lg font-bold outline-none focus:border-violet-400"
          />
          <button
            type="button"
            onClick={saveName}
            disabled={nameBusy}
            className="mt-4 w-full min-h-[56px] rounded-2xl bg-violet-600 text-white font-black text-lg disabled:opacity-50"
          >
            {nameBusy ? "Saving..." : "Save My Name"}
          </button>
          {nameMsg && <p className="mt-3 font-bold text-slate-600">{nameMsg}</p>}
        </section>

        <section className="rounded-3xl bg-white border-2 border-violet-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <KeyRound className="w-7 h-7 text-violet-500" />
            <h2 className="text-2xl font-black">Password</h2>
          </div>
          <div className="space-y-3">
            <input type="password" placeholder="Current password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full min-h-[54px] rounded-2xl border-2 border-violet-100 px-4 font-bold outline-none focus:border-violet-400" />
            <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full min-h-[54px] rounded-2xl border-2 border-violet-100 px-4 font-bold outline-none focus:border-violet-400" />
            <input type="password" placeholder="Type new password again" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full min-h-[54px] rounded-2xl border-2 border-violet-100 px-4 font-bold outline-none focus:border-violet-400" />
          </div>
          <button type="button" onClick={savePassword} disabled={pwBusy} className="mt-4 w-full min-h-[56px] rounded-2xl bg-sky-600 text-white font-black text-lg disabled:opacity-50">
            {pwBusy ? "Saving..." : "Change Password"}
          </button>
          {pwMsg && <p className="mt-3 font-bold text-slate-600">{pwMsg}</p>}
        </section>
      </div>

      <section className="mt-6 rounded-3xl bg-rose-50 border-2 border-rose-100 p-6">
        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/");
          }}
          className="w-full sm:w-auto min-h-[58px] rounded-2xl bg-rose-600 text-white px-7 font-black text-lg flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" /> Log Out
        </button>
      </section>
    </main>
  );
}
