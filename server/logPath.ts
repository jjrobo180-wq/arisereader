// Request logs say what was asked for, but never the secret inside a link: a meeting-poll answer link,
// a live-quiz link and a share link each carry a code that works like a password, and the logs are
// kept (and read) by more people than the links were sent to.

const SECRET_AFTER = ["/api/meeting-poll/", "/api/integrity/live/", "/api/fyp/share/", "/meet/"];

/** The path to write in a log line, with the secret part of a private link replaced by ":token". */
export function loggablePath(path: string): string {
  for (const prefix of SECRET_AFTER) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    const slash = rest.indexOf("/");
    return `${prefix}:token${slash === -1 ? "" : rest.slice(slash)}`;
  }
  return path;
}
