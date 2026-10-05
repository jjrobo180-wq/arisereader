// Admin: shows where one of the site's schools sits in the US school list, and
// lets the admin match it. A school made by hand ("CGMS") isn't in that list
// under its short name; once matched, anyone who searches the school's full
// name at sign-up lands in this school instead of starting a second one.
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { SchoolPicker } from "@/components/SchoolPicker";

type UsEntry = { key: string; name: string; city: string; state: string };
type School = { id: number; name: string; usList?: UsEntry | null; waitingForTeacherApproval?: boolean };

function cookieToken(): string | null {
  try {
    const c = document.cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith("arise_session="));
    return c ? JSON.parse(atob(c.substring("arise_session=".length))).token || null : null;
  } catch { return null; }
}

export default function SchoolUsListMatch({ school, onChanged }: { school: School; onChanged: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (key: string | null) => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/schools/${school.id}/us-list`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token || cookieToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "That didn't work. Try again.");
      setOpen(false);
      onChanged();
    } catch (e: any) { setError(e.message || "That didn't work. Try again."); }
    finally { setBusy(false); }
  };

  const link = "font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200 disabled:opacity-50";
  return (
    <div className="mb-3 space-y-2 text-xs text-muted-foreground" data-testid={`school-us-list-${school.id}`}>
      {school.waitingForTeacherApproval && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-2 text-amber-200">A teacher typed this school in at sign-up. It stays out of the school search until you approve that teacher.</p>
      )}
      {school.usList ? (
        <p>
          Matched to the US school list: <span className="font-semibold text-foreground">{school.usList.name}</span>, {school.usList.city}, {school.usList.state}.{" "}
          <button type="button" className={link} disabled={busy} onClick={() => setOpen((v) => !v)}>Change</button>{" "}
          <button type="button" className={link} disabled={busy} onClick={() => { if (window.confirm(`Remove the match for ${school.name}?`)) void save(null); }}>Remove match</button>
        </p>
      ) : (
        <p>
          Not matched to the US school list.{" "}
          <button type="button" className={link} disabled={busy} onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : "Match it"}</button>
        </p>
      )}
      {open && (
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <p className="mb-2">Find this school by its full name. People who search that name at sign-up will then join <span className="font-semibold text-foreground">{school.name}</span>.</p>
          <SchoolPicker who="admin" value={null} onChange={(choice) => { if (choice?.kind === "directory") void save(choice.key); }} />
        </div>
      )}
      {error && <p className="text-red-400" role="alert">{error}</p>}
    </div>
  );
}
