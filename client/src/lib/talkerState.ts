import { API_BASE } from "@/lib/queryClient";

export type TalkerWord = { id: string; label: string; picture: string; sentence: string; imageData?: string | null };
export type WordProgress = {
  label: string;
  status: "known" | "learning";
  timesPracticed: number;
  correctCount?: number;
  attemptCount?: number;
  lastPracticedAt: string;
  knownAt?: string | null;
};
export type TalkerProgress = {
  words: Record<string, WordProgress>;
  history: Array<{ word: string; outcome: string; at: string; prompt?: number }>;
};
export type TalkerConfig = { alwaysHere: TalkerWord[] | null; pictures: Record<string, string> };
export type TalkerState = { student: { id: number; name: string }; config: TalkerConfig; progress: TalkerProgress };

export const defaultNeeds: TalkerWord[] = [
  { id: "need-i-want", label: "I want", picture: "🙋", sentence: "I want something." },
  { id: "need-more", label: "More", picture: "➕", sentence: "I want more." },
  { id: "need-help", label: "Help", picture: "🤝", sentence: "I need help." },
  { id: "need-stop", label: "Stop", picture: "✋", sentence: "Please stop." },
  { id: "need-yes", label: "Yes", picture: "👍", sentence: "Yes, please." },
  { id: "need-no", label: "No", picture: "👎", sentence: "No, thank you." },
  { id: "need-bathroom", label: "Bathroom", picture: "🚽", sentence: "I need the bathroom." },
  { id: "need-break", label: "Break", picture: "🧘", sentence: "I need a break." },
];

export function talkerPicture(word: { label: string; picture: string; imageData?: string | null }, pictures: Record<string, string>) {
  return word.imageData || pictures[word.label.trim().toLowerCase()] || null;
}

export async function talkerRequest<T>(token: string | null, path = "", method = "GET", body?: unknown): Promise<T> {
  if (!token) throw new Error("Please sign in to save your family's talker.");
  const response = await fetch(`${API_BASE}/api/eye-gaze/talker-state${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Couldn't save your changes.");
  return result as T;
}

// Resize locally before sending a child's photo. Only a small, raster image is
// stored in the child's private talker settings; no public image URL is made.
export async function resizeTalkerPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.size > 5_000_000) {
    throw new Error("Choose a JPG, PNG, or WEBP photo under 5 MB.");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This device couldn't prepare the picture.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", 0.7);
    if (result.length >= 90_000) throw new Error("That picture is still too large. Try another photo.");
    return result;
  } catch (error: any) {
    throw new Error(error?.message || "This picture could not be opened. Try a JPG, PNG, or WEBP.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
