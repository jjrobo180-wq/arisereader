import { useEffect, useState } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { defaultParentControls, fetchFamilySettings, pathAllowed, type ParentControls } from "@/lib/parentControls";

export default function EyeGazeAccessGate({ path, children }: { path: string; children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [controls, setControls] = useState<ParentControls | null>(null);
  const [failed, setFailed] = useState(false);

  const isChild = !!user && !!user.is_eye_gaze_user && user.role === "student" && !user.isAdmin;
  useEffect(() => {
    let active = true;
    if (!isChild) {
      setControls(defaultParentControls());
      return;
    }
    void fetchFamilySettings(token)
      .then(result => { if (active) setControls(result.settings); })
      .catch(() => { if (active) { setControls(defaultParentControls()); setFailed(true); } });
    return () => { active = false; };
  }, [isChild, token, user?.id]);

  if (!isChild) return <>{children}</>;
  if (!controls) return <div className="min-h-screen grid place-items-center bg-slate-50 font-black text-slate-700">Loading your learning plan…</div>;
  if (!pathAllowed(path, controls)) return <Redirect to="/eye-gaze-home" />;
  return <>{children}</>;
}
