// An in-memory stand-in for the Supabase client, enough of it for the podcast social routes: select
// with filters, order, limit, counts and single rows; insert, upsert, update and delete (with the
// unique rules and "on delete cascade" the real tables have); a missing table's error; and storage.
// Not a test file itself (no ".test"): imported by tests/earshot-social-v2.test.ts.
type Row = Record<string, any>;
export type TableSpec = {
  /** Columns that together must be unique (optionally only for rows that match where). */
  unique?: { cols: string[]; where?: (r: Row) => boolean }[];
  /** Filled in on insert when not given. */
  defaults?: () => Row;
  /** When a row here is deleted, rows in these tables pointing at it go too. */
  cascade?: { table: string; col: string; key?: string }[];
  serial?: boolean;
};

const same = (a: unknown, b: unknown) => (a == null || b == null ? a == b : String(a) === String(b));

export function fakeSupabase(specs: Record<string, TableSpec>, o: { missing?: string[] } = {}) {
  const tables: Record<string, Row[]> = Object.fromEntries(Object.keys(specs).map((t) => [t, []]));
  const seq: Record<string, number> = {};
  const missing = new Set(o.missing ?? []);
  const files = new Map<string, { bytes: number; type: string }>();
  let clock = Date.parse("2026-10-25T12:00:00Z");
  const now = () => new Date((clock += 1000)).toISOString();

  function removeRows(table: string, rows: Row[]) {
    tables[table] = tables[table].filter((r) => !rows.includes(r));
    for (const c of specs[table].cascade ?? []) {
      const keys = rows.map((r) => r[c.key ?? "id"]);
      const hit = tables[c.table].filter((r) => keys.some((k) => same(r[c.col], k)));
      if (hit.length) removeRows(c.table, hit);
    }
  }
  const clash = (table: string, row: Row, others: Row[]) => (specs[table].unique ?? []).some((u) => (!u.where || u.where(row)) && others.some((x) => x !== row && (!u.where || u.where(x)) && u.cols.every((c) => same(x[c], row[c]))));

  class Query implements PromiseLike<any> {
    private op: "select" | "insert" | "upsert" | "update" | "delete" = "select";
    private filters: ((r: Row) => boolean)[] = [];
    private cols = "*"; private returning = false; private countMode = false; private head = false;
    private sortBy: { col: string; asc: boolean } | null = null; private max = Infinity;
    private one: "" | "single" | "maybe" = "";
    private payload: any; private conflict: string[] = []; private ignoreDup = false;
    constructor(private table: string) {}
    select(cols = "*", opts?: { count?: string; head?: boolean }) {
      if (this.op === "select") { this.cols = cols; this.countMode = !!opts?.count; this.head = !!opts?.head; } else { this.returning = true; this.cols = cols; }
      return this;
    }
    insert(v: Row | Row[]) { this.op = "insert"; this.payload = v; return this; }
    upsert(v: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) { this.op = "upsert"; this.payload = v; this.conflict = (opts?.onConflict ?? "id").split(",").map((x) => x.trim()); this.ignoreDup = !!opts?.ignoreDuplicates; return this; }
    update(v: Row) { this.op = "update"; this.payload = v; return this; }
    delete() { this.op = "delete"; return this; }
    eq(c: string, v: unknown) { this.filters.push((r) => same(r[c], v)); return this; }
    neq(c: string, v: unknown) { this.filters.push((r) => !same(r[c], v)); return this; }
    is(c: string, v: unknown) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
    in(c: string, list: unknown[]) { this.filters.push((r) => list.some((v) => same(r[c], v))); return this; }
    or(expr: string) {
      const parts = expr.split(",").map((p) => { const [col, op, ...rest] = p.split("."); return { col, op, val: rest.join(".") }; });
      this.filters.push((r) => parts.some(({ col, op, val }) => {
        if (op !== "ilike") throw new Error(`fake: or ${op}`);
        const re = new RegExp(`^${val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`, "i");
        return re.test(String(r[col] ?? ""));
      }));
      return this;
    }
    order(col: string, opts?: { ascending?: boolean }) { this.sortBy = { col, asc: opts?.ascending !== false }; return this; }
    limit(n: number) { this.max = n; return this; }
    single() { this.one = "single"; return this; }
    maybeSingle() { this.one = "maybe"; return this; }
    private project(r: Row) { if (this.cols.trim() === "*") return { ...r }; return Object.fromEntries(this.cols.split(",").map((c) => c.trim()).filter(Boolean).map((c) => [c, r[c] ?? null])); }
    private finish(rows: Row[], count?: number) {
      const data = rows.map((r) => this.project(r));
      if (this.one) {
        if (data.length > 1 || (this.one === "single" && !data.length)) return { data: null, error: { code: "PGRST116", message: "not one row" } };
        return { data: data[0] ?? null, error: null };
      }
      return { data: this.head ? null : data, error: null, count };
    }
    run(): any {
      if (missing.has(this.table)) return { data: null, error: { code: "42P01", message: `relation "public.${this.table}" does not exist` } };
      const T = tables[this.table], spec = specs[this.table];
      if (!T) throw new Error(`fake: no table ${this.table}`);
      const match = (r: Row) => this.filters.every((f) => f(r));
      if (this.op === "select") {
        let rows = T.filter(match);
        if (this.sortBy) { const { col, asc } = this.sortBy; rows = [...rows].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1)); }
        const count = rows.length;
        return this.finish(rows.slice(0, this.max), this.countMode ? count : undefined);
      }
      if (this.op === "insert" || this.op === "upsert") {
        const list: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload];
        const out: Row[] = [];
        for (const v of list) {
          if (this.op === "upsert") {
            const hit = T.find((r) => this.conflict.every((c) => same(r[c], v[c])));
            if (hit) { if (!this.ignoreDup) Object.assign(hit, v); out.push(hit); continue; }
          }
          const row: Row = { ...(spec.defaults?.() ?? {}), created_at: now(), ...v };
          if (spec.serial && row.id == null) row.id = (seq[this.table] = (seq[this.table] ?? 0) + 1);
          if (clash(this.table, row, T)) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          T.push(row); out.push(row);
        }
        return this.returning ? this.finish(out) : { data: null, error: null };
      }
      if (this.op === "update") {
        const rows = T.filter(match);
        rows.forEach((r) => Object.assign(r, this.payload));
        return this.returning ? this.finish(rows) : { data: null, error: null };
      }
      const rows = T.filter(match);
      const copies = rows.map((r) => ({ ...r }));
      removeRows(this.table, rows);
      return this.returning ? this.finish(copies) : { data: null, error: null };
    }
    then<A = any, B = never>(ok?: ((v: any) => A | PromiseLike<A>) | null, bad?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
      return Promise.resolve().then(() => this.run()).then(ok, bad);
    }
  }

  const client = {
    from: (t: string) => new Query(t),
    storage: {
      from: (bucket: string) => ({
        async upload(path: string, blob: Blob, opts?: { contentType?: string }) { files.set(`${bucket}/${path}`, { bytes: blob.size, type: opts?.contentType ?? "" }); return { data: { path }, error: null }; },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/object/public/${bucket}/${path}` } }),
        async remove(paths: string[]) { paths.forEach((p) => files.delete(`${bucket}/${p}`)); return { data: null, error: null }; },
        async createSignedUploadUrl(path: string) { return { data: { signedUrl: `https://storage.test/upload/${bucket}/${path}` }, error: null }; },
      }),
    },
  };
  return { client, tables, files, missing };
}

/** The social tables as migrations/podcast_social.sql and podcast_social_v2.sql make them. */
export const SOCIAL_TABLES: Record<string, TableSpec> = {
  podcast_profiles: { unique: [{ cols: ["voter"] }, { cols: ["handle"] }], defaults: () => ({ bio: "", avatar: "🎧", hidden: false }), cascade: [{ table: "podcast_posts", col: "voter", key: "voter" }, { table: "podcast_people_follows", col: "followee", key: "voter" }, { table: "podcast_comments", col: "voter", key: "voter" }] },
  podcast_posts: {
    serial: true, defaults: () => ({ caption: "", reports: 0, hidden: false, clip: null, repost_of: null }),
    unique: [{ cols: ["voter", "episode_id"], where: (r) => r.kind === "bookmark" }, { cols: ["voter", "repost_of"], where: (r) => r.kind === "repost" && r.caption === "" }],
    cascade: [{ table: "podcast_post_likes", col: "post_id" }, { table: "podcast_post_reports", col: "post_id" }, { table: "podcast_posts", col: "repost_of" }, { table: "podcast_comments", col: "post_id" }, { table: "podcast_notifications", col: "post_id" }],
  },
  podcast_post_likes: { unique: [{ cols: ["post_id", "voter"] }] },
  podcast_post_reports: { unique: [{ cols: ["post_id", "voter"] }] },
  podcast_people_follows: { unique: [{ cols: ["follower", "followee"] }] },
  podcast_comments: { serial: true, defaults: () => ({ reports: 0, hidden: false, parent_id: null }), cascade: [{ table: "podcast_comments", col: "parent_id" }, { table: "podcast_comment_likes", col: "comment_id" }, { table: "podcast_notifications", col: "comment_id" }] },
  podcast_comment_likes: { unique: [{ cols: ["comment_id", "voter"] }] },
  podcast_notifications: { serial: true, defaults: () => ({ read: false, post_id: null, comment_id: null }) },
};

/** Records an Express app's routes so tests can call them without a server. */
export function fakeApp() {
  const routes: { method: string; path: string; handlers: any[] }[] = [];
  const add = (method: string) => (path: string, ...handlers: any[]) => { routes.push({ method, path, handlers }); };
  const app: any = { get: add("GET"), post: add("POST"), delete: add("DELETE"), use: () => {} };
  async function call(method: string, url: string, o: { voter?: string; body?: any } = {}) {
    const [path, qs] = url.split("?");
    for (const r of routes) {
      if (r.method !== method) continue;
      const a = r.path.split("/"), b = path.split("/");
      if (a.length !== b.length) continue;
      const params: Record<string, string> = {};
      if (!a.every((seg, i) => (seg.startsWith(":") ? ((params[seg.slice(1)] = decodeURIComponent(b[i])), true) : seg === b[i]))) continue;
      const req: any = { params, query: Object.fromEntries(new URLSearchParams(qs || "")), body: o.body ?? {}, voter: o.voter ?? "dalice", headers: {} };
      const res: any = { statusCode: 200, body: undefined, headers: {} as Record<string, string>,
        status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; }, set(k: any, v?: any) { if (typeof k === "string") this.headers[k] = v; return this; }, end() { return this; } };
      // Like Express: each handler runs in turn while the one before called next().
      for (const h of r.handlers) {
        let go = false;
        await h(req, res, () => { go = true; });
        if (!go) break;
      }
      return res as { statusCode: number; body: any };
    }
    throw new Error(`no route ${method} ${path}`);
  }
  return { app, call, routes };
}
