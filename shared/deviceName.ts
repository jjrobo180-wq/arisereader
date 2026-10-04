// Turns a browser user agent into something a teacher can read, like "Chromebook · Chrome".
/** A short, readable device name from a browser's user agent. */
export function describeDevice(ua: string | undefined | null) {
  const s = String(ua || "");
  if (!s) return "Unknown device";
  const device = /iPad/.test(s) || (/Macintosh/.test(s) && /Mobile/.test(s)) ? "iPad"
    : /iPhone/.test(s) ? "iPhone"
      : /CrOS/.test(s) ? "Chromebook"
        : /Android/.test(s) ? (/Mobile/.test(s) ? "Android phone" : "Android tablet")
          : /Windows/.test(s) ? "Windows computer"
            : /Macintosh|Mac OS X/.test(s) ? "Mac"
              : /Linux/.test(s) ? "Linux computer" : "Device";
  const browser = /Edg\//.test(s) ? "Edge" : /OPR\//.test(s) ? "Opera" : /Firefox\//.test(s) ? "Firefox"
    : /CriOS|Chrome\//.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : "";
  return browser ? `${device} · ${browser}` : device;
}
