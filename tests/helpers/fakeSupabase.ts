// A small pretend Supabase for tests: tables kept in memory, the same chained calls the
// server makes (select, eq, lt, in, order, limit, insert, update, upsert, delete), and the
// errors the real one gives for a table or column the database doesn't have.
type Row = Record<string, any>;

export type FakeOptions = {
  /** Tables that have not been created yet. */
  missingTables?: string[];
  /** Columns a table does not have yet. */
  missingColumns?: Record<string, string[]>;
  /** The columns that make a row unique, per table. */
  keys?: Record<string, string[]>;
  /** Tables whose new rows get the next number as their id, like an identity column. */
  autoIds?: string[];
};

export function fakeSupabase(seed: Record<string, Row[]> = {}, options: FakeOptions = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(seed)) tables[name] = rows.map((row) => ({ ...row }));
  const log: Array<{ table: string; op: string; filters: Array<[string, string, any]>; values?: any }> = [];

  const missingTable = (table: string) => options.missingTables?.includes(table);
  const badColumn = (table: string, names: string[]) => names.find((name) => options.missingColumns?.[table]?.includes(name));
  const same = (a: any, b: any) => (a === b) || (typeof a === "string" && typeof b === "string" && a === b);

  function from(table: string) {
    const filters: Array<[string, string, any]> = [];
    let op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
    let values: any;
    let upsertOptions: any = {};
    let returning = false;
    let columns = "*";
    let ordering: { column: string; ascending: boolean } | null = null;
    let max = Infinity;
    let mode: "many" | "maybe" | "single" = "many";

    const rowsOf = () => (tables[table] ||= []);
    const matches = (row: Row) => filters.every(([kind, column, value]) => (kind === "eq" ? same(row[column], value) : kind === "lt" ? row[column] < value : kind === "in" ? (value as any[]).some((v) => same(row[column], v)) : true));
    const keyOf = () => options.keys?.[table] || ["id"];

    function run(): { data: any; error: any } {
      log.push({ table, op, filters: [...filters], values });
      if (missingTable(table)) return { data: null, error: { code: "42P01", message: `relation "public.${table}" does not exist` } };
      const asked = op === "select" ? columns.split(",").map((c) => c.trim()).filter((c) => c && c !== "*") : Object.keys(Array.isArray(values) ? values[0] || {} : values || {});
      const bad = badColumn(table, asked);
      if (bad) return { data: null, error: { code: "42703", message: `column ${table}.${bad} does not exist` } };
      const rows = rowsOf();
      let out: Row[] = [];
      if (op === "select") out = rows.filter(matches);
      if (op === "insert") {
        const list: Row[] = Array.isArray(values) ? values : [values];
        for (const item of list) {
          if (rows.some((row) => keyOf().every((k) => same(row[k], item[k])) && keyOf().every((k) => item[k] !== undefined))) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        }
        for (const item of list) {
          const row = { ...item };
          if (row.id === undefined && options.autoIds?.includes(table)) row.id = rows.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
          rows.push(row); out.push({ ...row });
        }
      }
      if (op === "update") {
        for (const row of rows) if (matches(row)) { Object.assign(row, values); out.push({ ...row }); }
      }
      if (op === "upsert") {
        const list: Row[] = Array.isArray(values) ? values : [values];
        const conflict = String(upsertOptions.onConflict || keyOf().join(",")).split(",").map((c) => c.trim());
        for (const item of list) {
          const found = rows.find((row) => conflict.every((k) => same(row[k], item[k])));
          if (found) { if (!upsertOptions.ignoreDuplicates) { Object.assign(found, item); out.push({ ...found }); } }
          else { rows.push({ ...item }); out.push({ ...item }); }
        }
      }
      if (op === "delete") {
        for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i])) out.push(...rows.splice(i, 1));
      }
      if (ordering) { const { column, ascending } = ordering; out = [...out].sort((a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (ascending ? 1 : -1)); }
      out = out.slice(0, max);
      const shown = op === "select" || returning ? out : null;
      if (mode === "many") return { data: shown, error: null };
      if (!shown || !shown.length) return { data: null, error: mode === "single" ? { code: "PGRST116", message: "no rows" } : null };
      return { data: shown[0], error: null };
    }

    const builder: any = {
      select(cols = "*") { if (op === "select") columns = cols; else returning = true; return builder; },
      insert(v: any) { op = "insert"; values = v; return builder; },
      update(v: any) { op = "update"; values = v; return builder; },
      upsert(v: any, o: any = {}) { op = "upsert"; values = v; upsertOptions = o; return builder; },
      delete() { op = "delete"; return builder; },
      eq(column: string, value: any) { filters.push(["eq", column, value]); return builder; },
      lt(column: string, value: any) { filters.push(["lt", column, value]); return builder; },
      in(column: string, value: any[]) { filters.push(["in", column, value]); return builder; },
      order(column: string, o: any = {}) { ordering = { column, ascending: o.ascending !== false }; return builder; },
      limit(n: number) { max = n; return builder; },
      maybeSingle() { mode = "maybe"; return builder; },
      single() { mode = "single"; return builder; },
      then(resolve: any, reject: any) { return Promise.resolve().then(run).then(resolve, reject); },
    };
    return builder;
  }

  return { from, tables, log };
}
