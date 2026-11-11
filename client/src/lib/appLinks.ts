// Where the Arise Reader iPhone app can be downloaded. The one place to set the link is
// client/public/app-links.json ({ "reader": "https://apps.apple.com/app/..." }); the public home page
// (public/reader-landing.html) reads the same file. While it is empty, no "Get the app" link shows anywhere.
import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/nativeApp";

let cached: string | null = null;
let pending: Promise<string> | null = null;

function load(): Promise<string> {
  if (cached !== null) return Promise.resolve(cached);
  pending ??= fetch("/app-links.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : {}))
    .then((j: { reader?: unknown }) => (cached = typeof j.reader === "string" && /^https:\/\//.test(j.reader.trim()) ? j.reader.trim() : ""))
    .catch(() => (cached = ""));
  return pending;
}

/** The Reader app's download link, or "" when there is none yet or when this already is the app. */
export function useReaderAppUrl(): string {
  const [url, setUrl] = useState(cached ?? "");
  useEffect(() => {
    if (isNativeApp()) return;
    let live = true;
    void load().then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, []);
  return isNativeApp() ? "" : url;
}
