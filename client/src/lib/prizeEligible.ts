// Whether this account's readers can win Arise Reader's prizes (only Conservatory Green Middle School's students:
// server /api/prizes/eligible, shared/prizeSchool.ts). False until the server says yes, so nobody else sees them.
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/queryClient";

const known = new Map<string, boolean>();
export function usePrizeEligible(token: string | null | undefined): boolean {
  const [ok, setOk] = useState(() => (token ? known.get(token) ?? false : false));
  useEffect(() => {
    if (!token) { setOk(false); return; }
    let alive = true;
    fetch(`${API_BASE}/api/prizes/eligible`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { eligible: false }))
      .then((d) => { const v = !!d?.eligible; known.set(token, v); if (alive) setOk(v); })
      .catch(() => { if (alive) setOk(false); });
    return () => { alive = false; };
  }, [token]);
  return ok;
}
