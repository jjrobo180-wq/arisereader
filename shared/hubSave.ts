// Saving the Teacher Hub: the rules the page and the server both follow.
//
// The whole workspace is saved as one JSON object per teacher, so two things have to be
// watched: that it stays under the size limit, and that a second phone or computer
// can't quietly save over newer work (every save says which copy it started from).

/** The most the server will save for one teacher. */
export const MAX_WORKSPACE_BYTES = 800_000;

/** What a failed save means, in the words the page shows. */
export type SaveBlock = "conflict" | "too_large" | "seats_full" | "plan" | "signed_out" | "rejected";

/** The server's answer codes. */
export const HUB_CONFLICT = "hub_conflict";
export const HUB_SEATS_FULL = "hub_seats_full";

/** Bytes the workspace takes up once it is saved (what the server limits). */
export function workspaceBytes(workspace: unknown): number {
  let json = "";
  try {
    json = JSON.stringify(workspace) ?? "";
  } catch {
    return 0;
  }
  return new TextEncoder().encode(json).length;
}

export type SizeLevel = "ok" | "warn" | "high" | "full";

/** How full the Hub is: warn from 70%, high from 90%, full at the limit. */
export function sizeLevel(bytes: number, max = MAX_WORKSPACE_BYTES): SizeLevel {
  const used = bytes / max;
  return used >= 1 ? "full" : used >= 0.9 ? "high" : used >= 0.7 ? "warn" : "ok";
}

/** 0 to 100, for "Your Hub is 72% full". */
export function sizePercent(bytes: number, max = MAX_WORKSPACE_BYTES): number {
  return Math.max(0, Math.min(100, Math.round((bytes / max) * 100)));
}

/** True when two times name the same moment (the database may write one time in two forms). */
export function sameInstant(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Date.parse(a);
  const y = Date.parse(b);
  return Number.isFinite(x) && Number.isFinite(y) && x === y;
}

/** The words for a save that needs the teacher before it can go on. */
export function blockMessage(block: SaveBlock, serverMessage = ""): string {
  switch (block) {
    case "conflict":
      return "Your Hub was changed on another phone or computer. Choose which copy to keep.";
    case "too_large":
      return "Your Hub is full, so it can't save. Delete old attendance, notes or saved emails to make room.";
    case "seats_full":
      return serverMessage || "Your Teacher Hub plan is full. Add more students on your plan page to keep growing your caseload.";
    case "plan":
      return "Your Teacher Hub plan has ended, so changes can't be saved.";
    case "signed_out":
      return "You were signed out, so changes can't be saved. Sign in again. What you typed is still on this screen.";
    case "rejected":
      return serverMessage || "The server would not accept this change.";
  }
}

/** How long to wait before trying a failed save again: 2, 5, 15, then every 30 seconds. */
export function retryDelay(attempt: number): number {
  const steps = [2_000, 5_000, 15_000, 30_000];
  return steps[Math.max(0, Math.min(steps.length - 1, attempt - 1))];
}
