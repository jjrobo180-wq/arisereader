// Podster's server, asked as the To Duo account: the To Duo sign-in goes on every request and the server
// answers as the same Podster account the Podster app uses (server/earshot.ts, the podscroll gate), so
// none of the Podster plugins (Podcasts, Audiobooks, Radio, Study Podster, Podster Social) asks anyone
// to sign in again.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { podDevice } from "@/components/super-apps/podsterLink";

export type PodApi = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;

export const podBase = () => (API_BASE || (typeof location !== "undefined" ? location.origin : "")).replace(/\/$/, "");

export function usePodApi() {
  const { token } = useAuth();
  const base = useMemo(podBase, []);
  const device = useMemo(podDevice, []);
  const api = useCallback<PodApi>(async (path, init) => {
    const url = base + path.replace(/^\/api\/earshot/, "/api/podscroll");
    let res!: Response;
    let body: any;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(url, {
          method: init?.method ?? "GET",
          headers: {
            "X-Podscroll-Device": device, ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(init?.body instanceof Blob ? { "Content-Type": init.body.type || "application/octet-stream" } : init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: init?.body instanceof Blob ? init.body : init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        });
      } catch { throw new Error("Can't reach Podster right now. Check your connection and try again."); }
      body = await res.json().catch(() => ({}));
      // The directory is busy: wait and ask again quietly a few times (reads only).
      const busy = res.status === 429 || (res.status === 503 && body?.busy !== false);
      if (!busy || attempt >= 3 || (init?.method && init.method !== "GET")) break;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
    if (!res.ok) throw Object.assign(new Error(body?.message || "Something went wrong. Try again."), { status: res.status, needSignIn: !!body?.needSignIn, needProfile: !!body?.needProfile });
    return body;
  }, [base, device, token]);
  return { api, base, device };
}

/** Whether this To Duo account is signed in to Podster (anyone with an email on their account). */
export function usePodAccount(api: PodApi) {
  const [acct, setAcct] = useState<{ signedIn: boolean; email: string | null; known: boolean }>({ signedIn: false, email: null, known: false });
  useEffect(() => {
    let live = true;
    api("/api/earshot/account").then((b) => { if (live) setAcct({ signedIn: !!b?.signedIn, email: b?.email ?? null, known: true }); }).catch(() => { if (live) setAcct((a) => ({ ...a, known: true })); });
    return () => { live = false; };
  }, [api]);
  return acct;
}
