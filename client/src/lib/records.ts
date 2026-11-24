// Talking to the class records server (server/classRecords.ts) from the WorkHub plugins and the family page.
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/queryClient";

export type Requester = <T = any>(path: string, options?: { method?: string; body?: unknown; raw?: Blob }) => Promise<T>;

/** A request function for a signed-in user (token) or a family link (link). Errors carry the server's message. */
export function requester(token: string | null | undefined, link?: string | null): Requester {
  return async (path, options = {}) => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (link) headers["X-Family-Link"] = link;
    let body: BodyInit | undefined;
    if (options.raw) { body = options.raw; headers["Content-Type"] = options.raw.type || "image/jpeg"; }
    else if (options.body !== undefined) { body = JSON.stringify(options.body); headers["Content-Type"] = "application/json"; }
    const r = await fetch(`${API_BASE}${path}`, { method: options.method || (body ? "POST" : "GET"), headers, body, cache: "no-store" });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(out.message || "Something went wrong. Try again."), { status: r.status });
    return out;
  };
}

/** A wall photo as a picture the page can show (photos need the viewer's sign-in or link, so plain <img src> can't load them). */
export function usePhoto(teacherId: number, name: string, token: string | null | undefined, link?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true, made: string | null = null;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (link) headers["X-Family-Link"] = link;
    fetch(`${API_BASE}/api/records/photo/${teacherId}/${encodeURIComponent(name)}`, { headers })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => { if (alive && b) { made = URL.createObjectURL(b); setUrl(made); } })
      .catch(() => {});
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [teacherId, name, token, link]);
  return url;
}

/** Shrinks a photo on the device before upload: at most 1600 px on its long side, as a JPEG. */
export async function shrinkPhoto(file: File, max = 1600): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) throw new Error("That file isn't a picture.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) { if (file.size > 8 * 1024 * 1024) throw new Error("That picture is too big."); return file; }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that picture."))), "image/jpeg", 0.85));
}

/** "Nov 23" or "Nov 23, 3:15 PM". */
export const shortDay = (iso: string, withTime = false) => {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) });
};

/** A CSV file download from rows of cells. */
export function downloadCsv(name: string, rows: Array<Array<string | number | null | undefined>>) {
  const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob([rows.map((r) => r.map(cell).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
