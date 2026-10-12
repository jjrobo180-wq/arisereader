// The "Drive" app: upload photos from a camera roll or device to cloud storage, offered as its
// own Arise App Store install. Only the metadata below lives on the hub's own record (the same
// loose, bolted-on way Notes-app installs do, see shared/notesApp.ts); the actual image bytes
// live in Supabase Storage (bucket "life-drive-photos"), signed URLs only, same pattern as
// Eye Gazer's My World photos and Teacher Scenes (see server/routes.ts).

export type DriveFile = {
  id: string;
  /** Storage path within the bucket; never shown to the user. */
  path: string;
  name: string;
  /** Bytes, so storage used can be totaled against a family's plan. */
  size: number;
  contentType: string;
  uploadedAt: string;
};

const LIMIT = 2000;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const numPositive = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0; };

export function cleanDriveFiles(raw: unknown): DriveFile[] {
  if (!Array.isArray(raw)) return [];
  const out: DriveFile[] = [];
  for (const r of raw.slice(0, LIMIT)) {
    if (!r || typeof r !== "object") continue;
    const id = str((r as any).id, 60), path = str((r as any).path, 300);
    if (!id || !path) continue;
    // Drive holds documents as well as pictures, so a file with no recorded type is "some file",
    // not a JPEG — guessing image/jpeg made the screen try to draw a PDF as a photo.
    out.push({ id, path, name: str((r as any).name, 160) || "File", size: numPositive((r as any).size), contentType: str((r as any).contentType, 100) || "application/octet-stream", uploadedAt: str((r as any).uploadedAt, 40) });
    if (out.length >= LIMIT) break;
  }
  return out;
}

export const addDriveFile = (list: DriveFile[], file: DriveFile): DriveFile[] => [file, ...list].slice(0, LIMIT);
export const removeDriveFile = (list: DriveFile[], id: string): DriveFile[] => list.filter((f) => f.id !== id);
export const driveBytesUsed = (list: DriveFile[]): number => list.reduce((sum, f) => sum + f.size, 0);

/** Free-plan storage allowance before Drive asks the family to buy more space (see shared/plans.ts
 *  for the paid storage tiers). 500 MB keeps a few hundred phone photos without feeling tight. */
export const FREE_STORAGE_BYTES = 500 * 1024 * 1024;
