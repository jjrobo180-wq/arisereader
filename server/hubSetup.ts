// Is the database ready for everything in the Arise WorkHub?
//
// Some Hub features need tables or columns that are added by pasting a short piece of SQL into
// Supabase. When that has not been done, a feature can quietly stop working. This looks for each
// piece, says in plain words what is missing and what it costs, and (for the site owner) hands
// over the exact SQL to paste and the link to the page to paste it into.
import type { Express, RequestHandler } from "express";
import { SETUP_SQL } from "./hubSetupSql";
import { isMissingSetup } from "./teacherHub";

type Probe = { table: string; columns: string[] };

export type SetupItem = {
  id: string;
  /** What it gives the teacher, in plain words. */
  what: string;
  /** What does not work until it is set up. */
  effect: string;
  /** True when a main feature breaks or quietly changes without it. */
  needed: boolean;
  /** The migration files that set it up, in the order to run them. */
  files: string[];
  probes: Probe[];
};

/** Listed in the order their SQL has to run (later ones build on earlier ones). */
export const SETUP_ITEMS: SetupItem[] = [
  {
    id: "workspace", what: "Saving your Hub", needed: true,
    effect: "The Hub can't open or save at all.",
    files: ["teacher_hub_workspaces.sql"],
    probes: [{ table: "teacher_hub_workspaces", columns: ["teacher_id", "workspace", "updated_at"] }],
  },
  {
    id: "backups", what: "Daily backup copies of each Hub", needed: false,
    effect: "No backup copies are kept, so a mistake can't be taken back from an earlier day.",
    files: ["teacher_hub_backups.sql"],
    probes: [{ table: "teacher_hub_backups", columns: ["teacher_id", "day", "kind", "workspace", "students", "saved_at"] }],
  },
  {
    id: "polls", what: "Finding a meeting time with everyone", needed: true,
    effect: "Polls for meeting times can't be made or answered.",
    files: ["meeting_polls.sql"],
    probes: [
      { table: "meeting_polls", columns: ["id", "teacher_id", "title", "location", "message", "hub_meeting_id", "options", "status", "chosen_option", "created_at"] },
      { table: "meeting_poll_invitees", columns: ["id", "poll_id", "name", "email", "role", "token", "answers", "comment", "email_sent", "invited_at", "responded_at"] },
    ],
  },
  {
    id: "polls-send", what: "Sending poll links yourself (email or text) and keeping phone numbers", needed: true,
    effect: "Polls you send yourself come back as site-sent polls, and phone numbers are not kept.",
    files: ["meeting_polls_sender.sql", "meeting_polls_self_and_text.sql"],
    probes: [
      { table: "meeting_polls", columns: ["sender_name", "reply_to", "send_via", "send_text"] },
      { table: "meeting_poll_invitees", columns: ["phone"] },
    ],
  },
  {
    id: "availability", what: "Staff availability, and adding a poll to a staff member's own account", needed: false,
    effect: "Availability can't be saved, and staff can't add a poll to their account.",
    files: ["hub_availability.sql"],
    probes: [
      { table: "hub_availability", columns: ["user_id", "weekly", "updated_at"] },
      { table: "meeting_poll_invitees", columns: ["user_id"] },
    ],
  },
  {
    id: "mailbox", what: "Connecting your own Gmail or Outlook", needed: false,
    effect: "A teacher can't connect their own mailbox.",
    files: ["teacher_mailboxes.sql"],
    probes: [{ table: "teacher_mailboxes", columns: ["teacher_id", "provider", "email", "display_name", "refresh_token", "needs_reconnect", "connected_at"] }],
  },
  {
    id: "push", what: "Reminders on your phone", needed: false,
    effect: "Phone reminders can't be turned on.",
    files: ["push_notifications.sql"],
    probes: [
      { table: "push_subscriptions", columns: ["id", "user_id", "endpoint", "p256dh", "auth", "time_zone", "sent", "created_at", "last_used_at"] },
      { table: "push_settings", columns: ["id", "public_key", "private_key"] },
    ],
  },
];

export type SetupState = "ok" | "missing" | "unknown";
export type SetupResult = { item: SetupItem; state: SetupState };

type Db = { from(table: string): any };

async function probe(db: Db, p: Probe): Promise<SetupState> {
  try {
    const { error } = await db.from(p.table).select(p.columns.join(",")).limit(0);
    if (!error) return "ok";
    return isMissingSetup(error) ? "missing" : "unknown";
  } catch {
    return "unknown";
  }
}

/** Looks for every piece. A piece is "missing" only when the database says so; anything else is "unknown", never "missing". */
export async function checkSetup(db: Db, items: SetupItem[] = SETUP_ITEMS): Promise<SetupResult[]> {
  return Promise.all(
    items.map(async (item) => {
      const states = await Promise.all(item.probes.map((p) => probe(db, p)));
      const state: SetupState = states.includes("missing") ? "missing" : states.includes("unknown") ? "unknown" : "ok";
      return { item, state };
    }),
  );
}

/** The SQL to paste for what is missing: each file once, in order, then a nudge so Supabase notices the change right away. */
export function fixSql(results: SetupResult[]): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const { item, state } of results) {
    if (state !== "missing") continue;
    for (const file of item.files) {
      if (seen.has(file)) continue;
      seen.add(file);
      parts.push(`-- ${file}\n${(SETUP_SQL[file] || "").trim()}`);
    }
  }
  if (!parts.length) return "";
  return `${parts.join("\n\n")}\n\nnotify pgrst, 'reload schema';\n`;
}

/** The page in Supabase where SQL is pasted and run, for this site's own project. */
export function sqlEditorUrl(supabaseUrl: string = process.env.SUPABASE_URL || ""): string {
  try {
    const host = new URL(supabaseUrl).hostname;
    if (host.endsWith(".supabase.co")) return `https://supabase.com/dashboard/project/${host.split(".")[0]}/sql/new`;
  } catch {
    /* no project address set */
  }
  return "https://supabase.com/dashboard/projects";
}

type SetupDeps = {
  /** The Arise WorkHub gate: answers the request itself and returns null when this person can't use the Hub. */
  gate(req: any, res: any): Promise<unknown | null>;
  db?: Db;
  url?: string;
  /** How long an answer is reused (tests turn this off). */
  cacheMs?: number;
};

export function registerHubSetupRoutes(app: Express, authMiddleware: RequestHandler, deps: SetupDeps) {
  const cacheMs = deps.cacheMs ?? 30_000;
  let cached: { at: number; results: SetupResult[] } | null = null;

  async function results(fresh: boolean): Promise<SetupResult[]> {
    if (!fresh && cached && Date.now() - cached.at < cacheMs) return cached.results;
    const db = deps.db ?? (await import("./supabase")).supabase;
    const found = await checkSetup(db);
    cached = { at: Date.now(), results: found };
    return found;
  }

  app.get("/api/teacher-hub/setup-check", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    try {
      const found = await results(req.query?.fresh === "1");
      const missing = found.filter((r) => r.state === "missing");
      const body: Record<string, unknown> = {
        ok: missing.length === 0,
        blocking: missing.some((r) => r.item.needed),
        missing: missing.map(({ item }) => ({ id: item.id, what: item.what, effect: item.effect, needed: item.needed })),
        unknown: found.filter((r) => r.state === "unknown").map((r) => r.item.id),
      };
      // Only the site owner can paste SQL into the database, so only the owner is handed it.
      if (req.user?.isAdmin === true && missing.length) {
        body.sqlEditorUrl = deps.url ? sqlEditorUrl(deps.url) : sqlEditorUrl();
        body.fixAllSql = fixSql(found);
      }
      res.set("Cache-Control", "no-store");
      return res.json(body);
    } catch (error: any) {
      console.error("[teacher-hub] setup check failed", error?.message);
      return res.status(500).json({ message: "Could not check the setup." });
    }
  });
}
