import { API_BASE } from "@/lib/queryClient";

export type FamilyVideo = { id: string; title: string; channel: string; topic: string };
export type ParentControls = {
  enabled: boolean;
  allowedPaths: string[];
  tvDailyMinutes: number;
  videos: FamilyVideo[];
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

export function defaultParentControls(): ParentControls {
  return { enabled: false, allowedPaths: CONTROLLED_FEATURES.map(item => item.path), tvDailyMinutes: 30, videos: [] };
}

export function pathAllowed(path: string, controls: ParentControls) {
  if (!controls.enabled) return true;
  if (path === "/eye-gaze-home" || path === "/eye-gaze-account" || path === "/eye-gaze-parent" || path === "/eye-gaze-parent-controls") return true;
  return controls.allowedPaths.some(allowed => path === allowed || path.startsWith(allowed + "/"));
}

async function request<T>(token: string | null | undefined, path: string, init?: RequestInit): Promise<T> {
  if (!token) throw new Error("Please sign in again.");
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "A.R.I.S.E. could not load that setting.");
  return data as T;
}

export async function fetchFamilySettings(token: string | null | undefined) {
  return request<{ student: { id: number; name: string }; settings: ParentControls }>(token, "/api/eye-gaze/family-settings");
}

export async function saveFamilySettings(token: string | null | undefined, settings: ParentControls, grownupToken?: string) {
  return request<{ student: { id: number; name: string }; settings: ParentControls }>(token, "/api/eye-gaze/family-settings", {
    method: "POST",
    headers: grownupToken ? { "X-Talker-Grownup-Token": grownupToken } : {},
    body: JSON.stringify(settings),
  });
}

export async function getTvUsage(token: string | null | undefined) {
  return request<{ seconds: number; minutes: number }>(token, "/api/eye-gaze/tv-usage");
}

export async function addTvUsage(token: string | null | undefined, seconds: number) {
  return request<{ seconds: number; minutes: number }>(token, "/api/eye-gaze/tv-usage", {
    method: "POST",
    body: JSON.stringify({ seconds }),
  });
}
