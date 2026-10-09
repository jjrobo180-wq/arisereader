// Calls for the Family Hub food diary's automatic calories (see server/foodLookup.ts).
import { API_BASE } from "@/lib/queryClient";
import type { FoundFood } from "@shared/foodLookup";

async function call<T>(token: string | null, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/arise-todo/food${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || "The food database can't be reached right now.");
  return body as T;
}

export const searchFoods = (token: string | null, q: string, signal?: AbortSignal) =>
  call<{ foods: FoundFood[] }>(token, `/search?q=${encodeURIComponent(q)}`, { signal }).then((b) => b.foods || []);
export const lookupBarcode = (token: string | null, code: string) =>
  call<{ food: FoundFood }>(token, `/barcode/${encodeURIComponent(code)}`).then((b) => b.food);
export const estimateMeal = (token: string | null, text: string, image: string | null) =>
  call<{ foods: FoundFood[] }>(token, "/estimate", { method: "POST", body: JSON.stringify({ text, image }) }).then((b) => b.foods || []);

/** Shrinks a photo on the phone (longest side 1024 px, JPEG) before it is sent. */
export function shrinkPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That photo couldn't be opened.")); };
    img.src = url;
  });
}

/** Barcode scanning with the camera works where the browser has BarcodeDetector (Chrome, Android, Edge). */
export const canScan = () => typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;
