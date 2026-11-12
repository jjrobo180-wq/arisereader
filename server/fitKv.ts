// Small JSON records for Cooked kept in the settings table (key → JSON text), so features like
// workout circles and guest passes need no table of their own. Tests use the in-memory one.
export type FitKv = { get(key: string): Promise<any | null>; set(key: string, value: unknown | null): Promise<void> };

export function createMemoryKv(): FitKv {
  const m = new Map<string, string>();
  return { async get(k) { const v = m.get(k); return v == null ? null : JSON.parse(v); }, async set(k, v) { if (v == null) m.delete(k); else m.set(k, JSON.stringify(v)); } };
}

export function createSupabaseKv(): FitKv {
  const db = async () => (await import("./supabase")).supabase;
  return {
    async get(key) {
      const r = await (await db()).from("settings").select("value").eq("key", key).maybeSingle();
      if (r.error) throw r.error;
      try { return r.data?.value ? JSON.parse(r.data.value) : null; } catch { return null; }
    },
    async set(key, value) {
      const c = await db();
      const r = value == null ? await c.from("settings").delete().eq("key", key) : await c.from("settings").upsert({ key, value: JSON.stringify(value) }, { onConflict: "key" });
      if (r.error) throw r.error;
    },
  };
}
