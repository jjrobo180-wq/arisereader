// The school field on the sign-up pages. Type a few letters and it searches
// the schools already on A.R.I.S.E. and the full US school list. A school that
// is in neither can be typed in: a teacher's school is added for everyone after
// them, and a student's is passed to the admin to connect.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, Search } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { NEW_SCHOOL_LIMITS, US_STATES } from "@shared/schoolNames";
import "./school-picker.css";

export type SchoolChoice =
  /** A school already on the site. */
  | { kind: "site"; id: number; name: string }
  /** A school from the US list. `schoolId` is set when someone has picked it before. */
  | { kind: "directory"; key: string; name: string; city: string; state: string; grades: string; schoolId: number | null }
  /** A teacher typed a school that is in neither list. */
  | { kind: "new"; name: string; city: string; state: string }
  /** A student typed their school's name; the admin connects them. */
  | { kind: "unlisted"; name: string };

/** The site's own id for a choice, when it has one. Teachers are looked up by it. */
export const siteSchoolId = (c: SchoolChoice | null): number | null =>
  !c ? null : c.kind === "site" ? c.id : c.kind === "directory" ? c.schoolId : null;
/** What to send with a sign-up for this choice. */
export function schoolFields(c: SchoolChoice | null): { schoolId?: number; directorySchool?: string; newSchool?: { name: string; city: string; state: string }; unlistedSchoolName?: string } {
  if (!c) return {};
  if (c.kind === "site") return { schoolId: c.id };
  if (c.kind === "directory") return c.schoolId ? { schoolId: c.schoolId } : { directorySchool: c.key };
  if (c.kind === "new") return { newSchool: { name: c.name, city: c.city, state: c.state } };
  return { unlistedSchoolName: c.name };
}
export const schoolLabel = (c: SchoolChoice) => (c.kind === "directory" || c.kind === "new" ? `${c.name} (${c.city}, ${c.state})` : c.name);

type Found = {
  onSite: Array<{ id: number; name: string }>;
  directory: Array<{ key: string; name: string; city: string; state: string; grades: string; private: boolean; schoolId: number | null }>;
  more: boolean;
};
const STATE_KEY = "arise_signup_state";
const savedState = () => { try { const s = localStorage.getItem(STATE_KEY) || ""; return US_STATES.some(([code]) => code === s) ? s : ""; } catch { return ""; } };

/** `who` "admin" is the admin matching one of the site's schools to the US list: only that list is searched, and nothing can be typed in. */
export function SchoolPicker({ value, onChange, who }: { value: SchoolChoice | null; onChange: (choice: SchoolChoice | null) => void; who: "student" | "teacher" | "admin" }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [state, setState] = useState(savedState);
  const [found, setFound] = useState<Found | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState({ name: "", city: "" });
  const [typedError, setTypedError] = useState("");
  const latest = useRef(0);
  const searchBox = useRef<HTMLInputElement>(null);

  const ready = query.trim().replace(/\s/g, "").length >= 2;

  // Search a moment after the typing stops. Only the newest answer is shown.
  useEffect(() => {
    if (value || typing) return;
    // every change makes older answers out of date, including clearing the box
    const mine = ++latest.current;
    if (!ready) { setFound(null); setSearching(false); setFailed(false); return; }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/schools/search?q=${encodeURIComponent(query.trim())}${state ? `&state=${state}` : ""}${who === "admin" ? "&only=us" : ""}`);
        const data = res.ok ? await res.json() : null;
        if (mine !== latest.current) return;
        if (!data || !Array.isArray(data.onSite) || !Array.isArray(data.directory)) { setFound(null); setFailed(true); }
        else { setFound(data); setFailed(false); }
      } catch { if (mine === latest.current) { setFound(null); setFailed(true); } }
      finally { if (mine === latest.current) setSearching(false); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, state, ready, value, typing, who]);

  const pickState = (code: string) => { setState(code); try { localStorage.setItem(STATE_KEY, code); } catch { /* private mode */ } };
  const change = () => { onChange(null); setTyping(false); window.setTimeout(() => searchBox.current?.focus(), 0); };

  const acceptTyped = () => {
    const name = typed.name.replace(/\s+/g, " ").trim(), city = typed.city.replace(/\s+/g, " ").trim();
    if (name.length < NEW_SCHOOL_LIMITS.nameMin) return setTypedError("Type your school's full name.");
    if (who === "student") { setTypedError(""); return onChange({ kind: "unlisted", name }); }
    if (!/^\p{L}[\p{L} .'\u2019-]{1,}$/u.test(city)) return setTypedError("Type the town or city your school is in.");
    if (!state) return setTypedError("Pick the state your school is in.");
    setTypedError("");
    onChange({ kind: "new", name, city, state });
  };

  // Enter in these boxes means "use this school", not "send the whole sign-up form"
  const enterUsesTyped = (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); acceptTyped(); } };

  const stateSelect = (
    <select className="sp-state" aria-label="State" value={state} onChange={(e) => pickState(e.target.value)} data-testid="select-school-state">
      <option value="">{typing ? "State…" : "Any state"}</option>
      {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select>
  );

  // ─── A school is chosen ────────────────────────────────────────────────────
  if (value) {
    const detail = value.kind === "directory" ? [`${value.city}, ${value.state}`, value.grades && `Grades ${value.grades}`].filter(Boolean).join(" · ")
      : value.kind === "new" ? `${value.city}, ${value.state} · New to A.R.I.S.E.`
      : value.kind === "unlisted" ? "Not in the list. We'll connect you to it." : "";
    return (
      <div className="sp" data-testid="school-picker">
        <div className="sp-chosen" role="status">
          <Check aria-hidden className="sp-check" />
          <div className="sp-chosen-text">
            <strong>{value.name}</strong>
            {detail && <span>{detail}</span>}
          </div>
          <button type="button" className="sp-link" onClick={change} data-testid="button-change-school">Change</button>
        </div>
        {value.kind === "new" && <p className="sp-note">Other teachers and students will be able to pick your school once your account is approved.</p>}
      </div>
    );
  }

  // ─── Typing in a school that isn't listed ──────────────────────────────────
  if (typing) {
    return (
      <div className="sp" data-testid="school-picker">
        <div className="sp-typing">
          <label htmlFor={`${id}-name`}>School name</label>
          <input id={`${id}-name`} type="text" autoFocus value={typed.name} maxLength={NEW_SCHOOL_LIMITS.nameMax} placeholder="Example: Oak Hill Academy"
            onChange={(e) => setTyped({ ...typed, name: e.target.value })} onKeyDown={enterUsesTyped} data-testid="input-new-school-name" />
          {who === "teacher" && (
            <div className="sp-two">
              <div>
                <label htmlFor={`${id}-city`}>Town or city</label>
                <input id={`${id}-city`} type="text" value={typed.city} maxLength={NEW_SCHOOL_LIMITS.cityMax} placeholder="Example: Denver"
                  onChange={(e) => setTyped({ ...typed, city: e.target.value })} onKeyDown={enterUsesTyped} data-testid="input-new-school-city" />
              </div>
              <div>
                <label htmlFor={`${id}-state`}>State</label>
                {stateSelect}
              </div>
            </div>
          )}
          <p className="sp-note">
            {who === "teacher"
              ? "Your school is added to the list. Other teachers and students can pick it once your account is approved."
              : "No problem. You get full access right away, and we'll connect you to your school."}
          </p>
          {typedError && <p className="sp-error" role="alert">{typedError}</p>}
          <div className="sp-row">
            <button type="button" className="sp-btn sp-btn-main" onClick={acceptTyped} data-testid="button-use-typed-school">Use this school</button>
            <button type="button" className="sp-btn" onClick={() => { setTyping(false); setTypedError(""); }}>Back to search</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Searching ─────────────────────────────────────────────────────────────
  const none = !!found && !found.onSite.length && !found.directory.length;
  return (
    <div className="sp" data-testid="school-picker">
      <div className="sp-search">
        <div className="sp-box">
          <Search aria-hidden className="sp-glass" />
          <input ref={searchBox} id={`${id}-q`} type="search" autoComplete="off" value={query} placeholder="Type your school's name or initials" aria-label="Search for your school by name or initials"
            onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} data-testid="input-school-search" />
        </div>
        {stateSelect}
      </div>

      {!ready && <p className="sp-hint">{who === "admin" ? "Type the school's full name and pick it from the US school list." : "Start typing and pick your school from the list. Picking your state first makes it quicker."}</p>}
      {ready && searching && !found && <p className="sp-hint" role="status">Searching…</p>}
      {failed && <p className="sp-error" role="alert">School search isn't working right now. Use “My school isn't listed” to keep going.</p>}

      {found && (
        <div className="sp-results" role="group" aria-label="Schools found" aria-busy={searching}>
          {found.onSite.length > 0 && <p className="sp-group">Already on A.R.I.S.E.</p>}
          {found.onSite.map((s) => (
            <button key={`s${s.id}`} type="button" className="sp-item" onClick={() => onChange({ kind: "site", id: s.id, name: s.name })} data-testid={`school-option-${s.id}`}>
              <strong>{s.name}</strong>
            </button>
          ))}
          {found.directory.length > 0 && found.onSite.length > 0 && <p className="sp-group">More schools</p>}
          {found.directory.map((s) => (
            <button key={s.key} type="button" className="sp-item" onClick={() => onChange({ kind: "directory", key: s.key, name: s.name, city: s.city, state: s.state, grades: s.grades, schoolId: s.schoolId })} data-testid={`school-option-${s.key}`}>
              <strong>{s.name}</strong>
              <span>{[`${s.city}, ${s.state}`, s.grades && `Grades ${s.grades}`, s.private && "Private"].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
          {none && <p className="sp-hint">No school found with that name{state ? " in that state" : ""}. Check the spelling{who === "admin" ? "." : ", or use the button below."}</p>}
          {found.more && <p className="sp-hint">More schools match. Add the town{state ? "" : " or pick your state"} to narrow it down.</p>}
        </div>
      )}

      {who !== "admin" && (
        <button type="button" className="sp-link sp-missing" onClick={() => { setTyping(true); setTyped({ name: query.trim().slice(0, NEW_SCHOOL_LIMITS.nameMax), city: "" }); }} data-testid="button-school-not-listed">
          My school isn't listed
        </button>
      )}
    </div>
  );
}
