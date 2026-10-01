import { normalizeYoutubeChannels } from "@shared/youtubeChannels";
import { API_BASE } from "@/lib/queryClient";

export type FamilyVideo = { id: string; title: string; channel: string; topic: string };
export type ParentControls = {
  version?: number;
  enabled: boolean;
  allowedPaths: string[];
  tvDailyMinutes: number;
  gameDailyMinutes: number;
  tvAgeRange: "2-4" | "5-7" | "8-10" | "11-13";
  tvTopics: string[];
  tvChannels: string[];
  videos: FamilyVideo[];
};

export const CONTROLLED_FEATURES = [
  { path: "/eye-gaze-talker", label: "My Talker", emoji: "🗣️" },
  { path: "/my-world", label: "My World", emoji: "🏠" },
  { path: "/library", label: "Lessons & books (inside Games)", emoji: "📚" },
  { path: "/eye-gaze-games", label: "Games (inside Games menu)", emoji: "🎮" },
  { path: "/eye-gaze-life-skills", label: "Life Skills", emoji: "🌟" },
  { path: "/eye-gaze-tv", label: "A.R.I.S.E. TV", emoji: "📺" },
  { path: "/eye-gaze-flashcards", label: "Flash Cards", emoji: "🃏" },
  { path: "/eye-gaze-buddy", label: "My Buddy", emoji: "🐶" },
  { path: "/leaderboard", label: "My Progress", emoji: "⭐" },
];

export function defaultParentControls(): ParentControls {
  return {
    version: 2,
    enabled: false,
    allowedPaths: CONTROLLED_FEATURES.map(item => item.path),
    tvDailyMinutes: 0,
    gameDailyMinutes: 0,
    tvAgeRange: "2-4",
    tvTopics: ["animals", "numbers", "letters", "feelings"],
    tvChannels: normalizeYoutubeChannels(undefined),
    videos: [],
  };
}

const CACHE_KEY = "arise-eye-gaze-family-settings-cache";
export function cachedParentControls(): ParentControls {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!raw || typeof raw !== "object") return defaultParentControls();
    return {
      version: Number(raw.version) || 1,
      enabled: !!raw.enabled,
      allowedPaths: Array.isArray(raw.allowedPaths) ? raw.allowedPaths : defaultParentControls().allowedPaths,
      tvDailyMinutes: Math.max(0, Math.min(240, Number(raw.tvDailyMinutes ?? 0) || 0)),
      gameDailyMinutes: Math.max(0, Math.min(240, Number(raw.gameDailyMinutes ?? 0) || 0)),
      tvAgeRange: ["2-4","5-7","8-10","11-13"].includes(raw.tvAgeRange) ? raw.tvAgeRange : "2-4",
      tvTopics: Array.isArray(raw.tvTopics) && raw.tvTopics.length ? raw.tvTopics : ["animals","numbers","letters","feelings"],
      tvChannels: normalizeYoutubeChannels(raw.tvChannels),
      videos: Array.isArray(raw.videos) ? raw.videos : [],
    };
  } catch { return defaultParentControls(); }
}

function cache(settings: ParentControls) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(settings)); } catch {}
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

export async function fetchFamilySettings(token: string | null | undefined, studentId?: number) {
  const path = "/api/eye-gaze/family-settings" + (studentId ? `?studentId=${studentId}` : "");
  const result = await request<{ student: { id: number; name: string }; settings: ParentControls }>(token, path);
  cache(result.settings);
  return result;
}

export async function saveFamilySettings(token: string | null | undefined, settings: ParentControls, grownupToken?: string, studentId?: number) {
  const path = "/api/eye-gaze/family-settings" + (studentId ? `?studentId=${studentId}` : "");
  const result = await request<{ student: { id: number; name: string }; settings: ParentControls }>(token, path, {
    method: "POST",
    headers: grownupToken ? { "X-Talker-Grownup-Token": grownupToken } : {},
    body: JSON.stringify(settings),
  });
  cache(result.settings);
  return result;
}

export async function getGameUsage(token: string | null | undefined) {
  return request<{ seconds: number; minutes: number }>(token, "/api/eye-gaze/game-usage");
}

export async function addGameUsage(token: string | null | undefined, seconds: number) {
  return request<{ seconds: number; minutes: number }>(token, "/api/eye-gaze/game-usage", {
    method: "POST",
    body: JSON.stringify({ seconds }),
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
