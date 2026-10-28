// Made sound kept in Supabase Storage (the private "voice-cache" bucket), so AI voices that cost
// money to make (audiobook narration, the Learning Buddy, the announcer, Sleep stories) are made
// once and survive restarts, instead of filling the small server's memory. Failures are quiet: the
// caller just makes the sound again.
import { createHash } from "node:crypto";

export interface BlobStore {
  get(key: string): Promise<{ data: Buffer; type: string } | null>;
  put(key: string, data: Buffer, type: string): Promise<void>;
}

export const BLOB_BUCKET = "voice-cache";
/** A safe file name for any key (keys hold book ids, voices and spoken text). */
export const blobPath = (key: string) => {
  const h = createHash("sha256").update(key).digest("hex");
  return `${h.slice(0, 2)}/${h}`;
};

export function supabaseBlobs(getDb: () => any, bucket = BLOB_BUCKET): BlobStore {
  let off = false;
  const quiet = (what: string, e: any) => {
    const m = String(e?.message || e || "");
    // No bucket here (a local or test database): stop trying.
    if (/bucket not found|not found.*bucket/i.test(m)) off = true;
    else if (!/not found|object not found|404/i.test(m)) console.warn(`[voice-cache] ${what}:`, m.slice(0, 160));
  };
  return {
    async get(key) {
      if (off) return null;
      try {
        const { data, error } = await getDb().storage.from(bucket).download(blobPath(key));
        if (error || !data) { if (error) quiet("read", error); return null; }
        const buf = Buffer.from(await data.arrayBuffer());
        return buf.length ? { data: buf, type: data.type || "application/octet-stream" } : null;
      } catch (e) { quiet("read", e); return null; }
    },
    async put(key, data, type) {
      if (off || !data.length) return;
      try {
        const { error } = await getDb().storage.from(bucket).upload(blobPath(key), data, { contentType: type, upsert: true, cacheControl: "604800" });
        if (error) quiet("save", error);
      } catch (e) { quiet("save", e); }
    },
  };
}

export function memoryBlobs(): BlobStore {
  const m = new Map<string, { data: Buffer; type: string }>();
  return { async get(k) { return m.get(k) ?? null; }, async put(k, data, type) { m.set(k, { data, type }); } };
}
