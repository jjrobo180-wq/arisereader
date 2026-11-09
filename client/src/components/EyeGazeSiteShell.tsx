import { useEyeGazeBackground } from "@/lib/eyeGazeAppearance";
import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { BookOpen, Gamepad2, Home, LogOut, MessageCircle, UserRound } from "lucide-react";
import { cachedParentControls, fetchFamilySettings, pathAllowed, type ParentControls } from "@/lib/parentControls";

export default function EyeGazeSiteShell({ children }: { children: ReactNode }) {
  const background = useEyeGazeBackground();
  const { user, token, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [gameImmersive, setGameImmersive] = useState(false);
  const [parentControls, setParentControls] = useState<ParentControls>(cachedParentControls());

  const isEyeGazer = !!user && !!user.is_eye_gaze_user && !user.isAdmin && user.role !== "teacher" && user.role !== "parent";
  const immersiveRoute = location.startsWith("/eye-gaze-quiz/") || location.startsWith("/custom-quiz/") || location.startsWith("/read/") || location.startsWith("/arise-city") || location.startsWith("/buddy-world") || location.startsWith("/my-world") || location.startsWith("/eye-gaze-talker") || location.startsWith("/eye-gaze-wren") || location.startsWith("/eye-gaze-parent") || location.startsWith("/eye-gaze-tv") || location.startsWith("/eye-gaze-flashcards") || location.startsWith("/eye-gaze-fidgets") || location.startsWith("/eye-gaze-farm") || location.startsWith("/eye-gaze-potty") || location.startsWith("/eye-gaze-parent-controls");
  const immersive = immersiveRoute || (location === "/eye-gaze-games" && gameImmersive);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      setGameImmersive(!!detail?.active);
    };
    window.addEventListener("eye-gaze-game-immersive", handler);
    return () => window.removeEventListener("eye-gaze-game-immersive", handler);
  }, []);

  useEffect(() => {
    if (location !== "/eye-gaze-games") setGameImmersive(false);
  }, [location]);

  useEffect(() => {
    if (!isEyeGazer || !token) return;
    let active = true;
    void fetchFamilySettings(token).then(result => {
      if (active && result?.settings) setParentControls(result.settings);
    }).catch(() => {});
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ParentControls>).detail;
      if (detail) setParentControls(detail);
    };
    window.addEventListener("arise-parent-controls-updated", handler);
    return () => {
      active = false;
      window.removeEventListener("arise-parent-controls-updated", handler);
    };
  }, [isEyeGazer, token, user?.id]);

  useEffect(() => {
    if (!isEyeGazer || !token) return;
    fetch(`${API_BASE}/api/eye-gaze/profile-photo`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => setProfilePhoto(data?.imageData || null))
      .catch(() => {});
  }, [isEyeGazer, token, user?.id]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ imageData?: string | null }>).detail;
      setProfilePhoto(detail?.imageData || null);
    };
    window.addEventListener("eye-gaze-profile-photo-updated", handler);
    return () => window.removeEventListener("eye-gaze-profile-photo-updated", handler);
  }, []);

  if (!isEyeGazer || location === "/to-do" || location === "/lifehub") return <>{children}</>;

  // Five tabs, like an App Store app (Life Skills, My World and the rest are on Home). Grown-ups' choices decide
  // which ones a child sees.
  const nav = [
    { label: "Home", icon: Home, path: "/eye-gaze-home", tint: "#6d28d9" },
    { label: "Talk", icon: MessageCircle, path: "/eye-gaze-talker", tint: "#6d28d9" },
    { label: "Play", icon: Gamepad2, path: "/eye-gaze-games", tint: "#6d28d9" },
    { label: "Learn", icon: BookOpen, path: "/eye-gaze-lessons", tint: "#6d28d9" },
    { label: "Me", icon: UserRound, path: "/profile", tint: "#6d28d9" },
  ];
  const visibleNav = nav.filter(item =>
    item.path === "/eye-gaze-home"
    || (item.path === "/eye-gaze-games" && (pathAllowed("/eye-gaze-games", parentControls) || pathAllowed("/library", parentControls)))
    || (item.path === "/eye-gaze-lessons" && pathAllowed("/library", parentControls))
    || (item.path !== "/eye-gaze-games" && item.path !== "/eye-gaze-lessons" && pathAllowed(item.path, parentControls))
  );
  const here = nav.find(item => item.path === location);
  const firstName = user.displayName?.split(" ")[0] || "Friend";
  // Signing out is for grown-ups: it asks first, so a tap by mistake doesn't end the child's session.
  const signOut = () => { if (window.confirm("Grown-ups: sign out of Arise Eye Gazer?")) { logout(); navigate("/"); } };

  return (
    <div data-eye-gaze-shell className="eg-app min-h-screen touch-manipulation text-slate-900" style={{ backgroundColor: background }}>
      <style>{`
        [data-eye-gaze-shell] {
          --background: 233 100% 98%;
          --primary: 263 70% 50%;
          --primary-foreground: 0 0% 100%;
          --foreground: 235 35% 16%;
          --card: 0 0% 100%;
          --card-foreground: 222 30% 16%;
          --muted: 233 40% 96%;
          --muted-foreground: 220 10% 46%;
          --border: 230 30% 91%;
          font-family: "DM Sans", ui-rounded, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        }
        [data-eye-gaze-shell] .eye-gaze-page { background: transparent; color: #191b35; }
        [data-eye-gaze-shell] h1, [data-eye-gaze-shell] h2, [data-eye-gaze-shell] .eg-title { font-family: "Plus Jakarta Sans", "DM Sans", system-ui, sans-serif; }
        [data-eye-gaze-shell] .eye-gaze-page > div > header { display: none !important; }
        [data-eye-gaze-shell] .eye-gaze-page > div { min-height: 0 !important; background: transparent !important; }
        [data-eye-gaze-shell] .eye-gaze-page main { max-width: 100% !important; }
        .eg-press { transition: transform .12s ease, box-shadow .12s ease; -webkit-tap-highlight-color: transparent; }
        .eg-press:active { transform: scale(.97); }
        @media (prefers-reduced-motion: reduce) { .eg-press, .eg-press:active { transition: none; transform: none; } }
      `}</style>
      {!immersive && <header className="sticky top-0 z-[70] border-b border-[#e5e8f4] bg-white/85 backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
          <button type="button" onClick={() => navigate("/eye-gaze-home")} className="eg-press mr-auto flex min-w-0 items-center gap-3" aria-label="Home">
            <img src="/app-icons/eyegazer-1024.png" alt="" className="h-10 w-10 flex-shrink-0 rounded-[11px] shadow-[0_1px_3px_rgba(0,0,0,.18)]" />
            <div className="min-w-0 text-left leading-tight">
              <div className="eg-title truncate text-[19px] font-extrabold tracking-[-0.02em] text-[#191b35]">{here && here.path !== "/eye-gaze-home" ? here.label : <>Eye <span className="text-violet-700">Gazer</span></>}</div>
              <div className="truncate text-[12.5px] font-semibold text-slate-500">Hi, {firstName}</div>
            </div>
          </button>
          <button type="button" onClick={() => navigate("/profile")} className="eg-press flex items-center" aria-label="My profile">
            {profilePhoto ? <img src={profilePhoto} alt="" className="h-10 w-10 rounded-full border-2 border-white object-cover shadow" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700"><UserRound className="h-5 w-5" /></div>}
          </button>
          <button type="button" onClick={signOut} className="eg-press flex h-10 w-10 items-center justify-center rounded-full text-[#9aa0ad] hover:bg-black/[.04]" aria-label="Sign out (grown-ups)"><LogOut className="h-[18px] w-[18px]" /></button>
        </div>
      </header>}
      <div className={immersive ? "w-full min-w-0" : "mx-auto min-w-0 max-w-[1200px]"}>
        <div className={immersive ? "flex-1 min-w-0" : "eye-gaze-page min-w-0 pb-28"}>{children}</div>
      </div>
      {!immersive && <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-[70] border-t border-[#e5e8f4] bg-white/90 backdrop-blur-xl" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto grid max-w-[720px] gap-1 px-2 pt-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, visibleNav.length)}, minmax(0, 1fr))` }}>
          {visibleNav.map(item => {
            const Icon = item.icon; const active = location === item.path;
            return <button key={item.path} type="button" onClick={() => navigate(item.path)} aria-current={active ? "page" : undefined}
              className="eg-press flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl text-[12px] font-bold"
              style={{ color: active ? item.tint : "#7c8299", background: active ? "#f5f3ff" : "transparent" }}>
              <Icon className="h-[26px] w-[26px]" strokeWidth={active ? 2.4 : 2} />{item.label}
            </button>;
          })}
        </div>
      </nav>}
    </div>
  );
}
