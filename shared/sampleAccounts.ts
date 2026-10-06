// Sample accounts: made to try the site out or to show it to someone, not real
// readers. They never count as students, never appear on a leaderboard or in a
// competition, and the admin sees them in their own "Sample accounts" list.
//
// An account is a sample when its sign-in name starts with "sample" ("sample",
// "sample-eye", "sample2"), or its display name starts with the word "Sample"
// ("Sample Student", "Sample User"). A name like "Samuel" or "Samples" is not.

/** The built-in walkthrough account counts the same way. */
const OTHER_DEMO_USERNAMES = new Set(["tutorial-eye", "admin-preview"]);

export function isSampleUsername(username: unknown): boolean {
  const u = String(username ?? "").trim().toLowerCase();
  return u.startsWith("sample") || OTHER_DEMO_USERNAMES.has(u);
}

export function isSampleDisplayName(displayName: unknown): boolean {
  return /^\s*sample(?![a-z])/i.test(String(displayName ?? ""));
}

/** Any user-shaped object: { username, displayName } or the database's { username, display_name }. */
export function isSampleAccount(user: unknown): boolean {
  if (!user || typeof user !== "object") return false;
  const u = user as Record<string, unknown>;
  return isSampleUsername(u.username) || isSampleDisplayName(u.displayName ?? u.display_name);
}
