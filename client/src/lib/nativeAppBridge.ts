// This file does NOTHING on the live website.
// For a compiled Capacitor iOS build, it picks the correct landing route and
// forwards API requests to the existing A.R.I.S.E. server. Native HTTP must be
// enabled in capacitor.config.json; test authenticated and multipart endpoints.
type NativeApp = "reader" | "todo";
const configuredApp = import.meta.env.VITE_ARISE_NATIVE_APP;
const nativeApp: NativeApp | null =
  (configuredApp === "reader" || configuredApp === "todo") &&
  (window.location.protocol === "capacitor:" || window.location.protocol === "ionic:")
    ? configuredApp
    : null;

const ORIGIN = "https://www.arisereader.com";

function existingSessionToken(): string | null {
  try {
    const cookie = document.cookie.split(";").map(v => v.trim()).find(v => v.startsWith("arise_session="));
    if (!cookie) return null;
    const session = JSON.parse(atob(cookie.substring("arise_session=".length)));
    return typeof session.token === "string" ? session.token : null;
  } catch {
    return null;
  }
}

export function installNativeAppBridge(): void {
  if (!nativeApp) return;

  // Keep deep links intact. First launch opens each product's own sign-in/dashboard.
  if (!window.location.hash || window.location.hash === "#/") {
    window.location.hash = nativeApp === "todo" ? "#/lifehub" : "#/signin";
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const localOrigin = window.location.origin;
    const apiPath = raw.startsWith("/api/")
      ? raw
      : raw.startsWith(localOrigin + "/api/")
        ? raw.substring(localOrigin.length)
        : null;
    if (!apiPath) return originalFetch(input, init);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));

    // The current web login stores its bearer token in arise_session.
    // A native bundle doesn't share the website's cookie origin, so explicitly
    // authenticate its API calls without relying on third-party cookies.
    const token = existingSessionToken();
    if (token && !headers.has("Authorization") &&
        !/^\/api\/(login|register|arise-todo\/register)(?:[/?#]|$)/.test(apiPath)) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const target = ORIGIN + apiPath;
    if (input instanceof Request) {
      return originalFetch(new Request(target, input), { ...init, headers });
    }
    return originalFetch(target, { ...init, headers });
  };
}
