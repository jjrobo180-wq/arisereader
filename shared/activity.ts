// Small helpers for the student activity view (shared so they can be tested on their own).

/** A short, readable device name from a browser's user-agent string. */
export function deviceFrom(ua: string | undefined | null) {
  const s = String(ua || "");
  if (!s) return "";
  const os = /CrOS/.test(s) ? "Chromebook" : /iPad/.test(s) || (/Macintosh/.test(s) && /Mobile/.test(s)) ? "iPad" : /iPhone/.test(s) ? "iPhone"
    : /Android/.test(s) ? "Android" : /Windows/.test(s) ? "Windows" : /Macintosh|Mac OS X/.test(s) ? "Mac" : /Linux/.test(s) ? "Linux" : "";
  const browser = /Edg\//.test(s) ? "Edge" : /OPR\//.test(s) ? "Opera" : /Firefox\//.test(s) ? "Firefox" : /CriOS|Chrome\//.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : "";
  return [os, browser].filter(Boolean).join(" · ");
}

/** Earned date → the attempt's completion time: now for today, otherwise midday that day (never in the future). */
export function completedAtFor(earnedOn: string, now = new Date()) {
  const today = now.toLocaleDateString("en-CA");
  if (earnedOn >= today) return now.toISOString();
  return new Date(`${earnedOn}T18:00:00Z`).toISOString();
}

