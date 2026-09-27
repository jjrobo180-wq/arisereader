export type ParentControls = {
  enabled: boolean;
  allowedPaths: string[];
  tvDailyMinutes: number;
};

export const CONTROLLED_FEATURES = [
  { path: "/eye-gaze-talker", label: "My Talker", emoji: "🗣️" },
  { path: "/my-world", label: "My World", emoji: "🏠" },
  { path: "/library", label: "Lessons", emoji: "📚" },
  { path: "/eye-gaze-games", label: "Games", emoji: "🎮" },
  { path: "/eye-gaze-tv", label: "A.R.I.S.E. TV", emoji: "📺" },
  { path: "/eye-gaze-flashcards", label: "Flash Cards", emoji: "🃏" },
  { path: "/eye-gaze-buddy", label: "My Buddy", emoji: "🐶" },
  { path: "/leaderboard", label: "My Progress", emoji: "⭐" },
];

const key = (studentId?: number | string) => `arise-parent-controls-${studentId || "default"}`;

export function defaultParentControls(): ParentControls {
  return { enabled: false, allowedPaths: CONTROLLED_FEATURES.map(item => item.path), tvDailyMinutes: 30 };
}

export function loadParentControls(studentId?: number | string): ParentControls {
  try {
    const saved = JSON.parse(localStorage.getItem(key(studentId)) || "null");
    if (!saved) return defaultParentControls();
    return {
      enabled: !!saved.enabled,
      allowedPaths: Array.isArray(saved.allowedPaths) ? saved.allowedPaths : defaultParentControls().allowedPaths,
      tvDailyMinutes: Math.max(0, Math.min(240, Number(saved.tvDailyMinutes ?? 30))),
    };
  } catch { return defaultParentControls(); }
}

export function saveParentControls(studentId: number | string | undefined, controls: ParentControls) {
  localStorage.setItem(key(studentId), JSON.stringify(controls));
  window.dispatchEvent(new CustomEvent("arise-parent-controls-updated", { detail: controls }));
}

export function pathAllowed(path: string, controls: ParentControls) {
  if (!controls.enabled) return true;
  if (path === "/eye-gaze-home" || path === "/eye-gaze-account" || path === "/eye-gaze-parent") return true;
  return controls.allowedPaths.some(allowed => path === allowed || path.startsWith(allowed + "/"));
}
