// Picking a school at sign-up.
//
// The site keeps its own short list of schools (the ones somebody on the site
// belongs to). The sign-up pages also search the full US list, and a school
// picked from it is added to the site's list at that moment. A teacher whose
// school is in neither can type it in; it shows for everyone else once the
// admin has approved that teacher, so nobody can put words in front of children
// just by filling in a form.
import type { Express } from "express";
import { isIndependentSchoolName } from "../shared/independent";
import { SchoolNameError, cleanNewSchool, foldSchoolText, isUsState, schoolDisplayName, type NewSchool } from "../shared/schoolNames";
import type { DirectorySchool, SchoolDirectory } from "./schoolDirectory";

type SchoolRow = { id: number; name: string };
type AnyUser = { id: number; role?: string | null; accountApproved?: boolean };

export type SchoolPickerDeps = {
  directory: SchoolDirectory;
  allSchools(): Promise<SchoolRow[]>;
  createSchool(name: string): Promise<SchoolRow>;
  getUser(id: number): Promise<AnyUser | null | undefined>;
  getSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  now?: () => number;
};

/** How a school got onto the site's list through sign-up. */
type Added = { by: "directory" | "teacher"; key?: string; teacherIds?: number[]; at: string };

const KEY = {
  /** US-list id -> the site's school id, for schools already picked. */
  links: "school_directory_links",
  /** The site's school id -> how it was added at sign-up. */
  added: "schools_from_signup",
};
/** New schools per hour, across the whole site. Far more than real sign-ups need; stops a script filling the list. */
const HOURLY = { directory: 400, teacher: 40 };

export type PickedSchool =
  | { schoolId: number; schoolName: string; added: null | "directory" | "teacher" }
  | { schoolId: null; schoolName: string; added: null };

export class SchoolPickError extends Error {}

export function registerSchoolPickerRoutes(app: Express, deps: SchoolPickerDeps) {
  const now = () => (deps.now ? deps.now() : Date.now());

  const readJson = async <T,>(key: string, fallback: T): Promise<T> => {
    try { const raw = await deps.getSetting(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
  };
  const readAdded = async () => {
    const raw = await readJson<Record<string, Added>>(KEY.added, {});
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  };
  // one change at a time, so two sign-ups picking the same school make one school
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T,>(job: () => Promise<T>): Promise<T> => { const run = chain.then(job, job); chain = run.catch(() => {}); return run; };

  const recent: Record<"directory" | "teacher", number[]> = { directory: [], teacher: [] };
  const underCap = (kind: "directory" | "teacher") => {
    const cutoff = now() - 3_600_000;
    recent[kind] = recent[kind].filter((t) => t > cutoff);
    return recent[kind].length < HOURLY[kind];
  };

  /**
   * Schools a teacher typed in stay hidden until the admin approves that teacher.
   * Returns the ids to leave out of every public list.
   */
  async function hiddenIds(): Promise<Set<number>> {
    const added = await readAdded();
    const hidden = new Set<number>();
    for (const [id, how] of Object.entries(added)) {
      if (how?.by !== "teacher") continue;
      // shown as soon as one of the teachers who typed it has been approved
      let approved = false;
      for (const teacherId of Array.isArray(how.teacherIds) ? how.teacherIds : []) {
        const teacher = await deps.getUser(Number(teacherId)).catch(() => null);
        if (teacher && teacher.role === "teacher" && teacher.accountApproved !== false) { approved = true; break; }
      }
      if (!approved) hidden.add(Number(id));
    }
    return hidden;
  }
  /** The site's schools that anyone signing up may see. */
  async function visibleSchools(): Promise<SchoolRow[]> {
    const [all, hidden] = await Promise.all([deps.allSchools(), hiddenIds()]);
    return all.filter((s) => !hidden.has(Number(s.id)) && !isIndependentSchoolName(s.name));
  }
  /** Was this school added through sign-up? Those are never free by their name alone. */
  async function addedAtSignup(schoolId: number): Promise<boolean> {
    return !!(await readAdded())[String(schoolId)];
  }

  /** Puts a school from the US list on the site's list, or finds it there. */
  const activate = (entry: DirectorySchool) => serial(async (): Promise<SchoolRow | null> => {
    const links = await readJson<Record<string, number>>(KEY.links, {});
    const all = await deps.allSchools();
    const linked = all.find((s) => Number(s.id) === Number(links[entry.key]));
    if (linked) return linked;
    const name = schoolDisplayName(entry.name, entry.city, entry.state);
    // the town is part of the name, so the same name is the same school
    let school = all.find((s) => foldSchoolText(s.name) === foldSchoolText(name)) ?? null;
    let created = false;
    if (!school) {
      if (!underCap("directory")) return null;
      school = await deps.createSchool(name);
      recent.directory.push(now());
      created = true;
    }
    links[entry.key] = Number(school.id);
    await deps.upsertSetting(KEY.links, JSON.stringify(links));
    if (created) {
      const added = await readAdded();
      added[String(school.id)] = { by: "directory", key: entry.key, at: new Date(now()).toISOString() };
      await deps.upsertSetting(KEY.added, JSON.stringify(added));
    }
    return school;
  });

  /** Adds a school a teacher typed. Hidden from everyone else until `approveAddedBy` names an approved teacher. */
  const addTyped = (typed: NewSchool) => serial(async (): Promise<{ school: SchoolRow; isNew: boolean } | null> => {
    const name = schoolDisplayName(typed.name, typed.city, typed.state);
    const all = await deps.allSchools();
    const same = all.find((s) => foldSchoolText(s.name) === foldSchoolText(name) || foldSchoolText(s.name) === foldSchoolText(typed.name));
    if (same) return { school: same, isNew: false };
    if (!underCap("teacher")) return null;
    const school = await deps.createSchool(name);
    recent.teacher.push(now());
    const added = await readAdded();
    added[String(school.id)] = { by: "teacher", at: new Date(now()).toISOString() };
    await deps.upsertSetting(KEY.added, JSON.stringify(added));
    return { school, isNew: true };
  });

  /** Records a teacher who typed this school in, once that teacher's account exists. */
  const setAddedBy = (schoolId: number, teacherId: number) => serial(async () => {
    const added = await readAdded();
    const how = added[String(schoolId)];
    if (!how || how.by !== "teacher") return;
    const ids = Array.isArray(how.teacherIds) ? how.teacherIds : [];
    if (ids.includes(teacherId) || ids.length >= 25) return;
    added[String(schoolId)] = { ...how, teacherIds: [...ids, teacherId] };
    await deps.upsertSetting(KEY.added, JSON.stringify(added));
  });

  /**
   * Works out the school for a sign-up from what the page sent:
   *   schoolId        a school already on the site
   *   directorySchool an id from the US list
   *   newSchool       { name, city, state } typed by a teacher (teachers only)
   * Throws SchoolPickError with a message for the person signing up.
   */
  async function pick(body: any, who: "teacher" | "student"): Promise<PickedSchool> {
    const none: PickedSchool = { schoolId: null, schoolName: "", added: null };

    if (body?.directorySchool) {
      const entry = deps.directory.get(String(body.directorySchool));
      if (!entry) throw new SchoolPickError("That school could not be found. Please search for it again.");
      const school = await activate(entry);
      // over the hourly limit: the account is still made, and the admin connects the school
      if (!school) return { schoolId: null, schoolName: schoolDisplayName(entry.name, entry.city, entry.state), added: null };
      return { schoolId: Number(school.id), schoolName: school.name, added: "directory" };
    }

    if (body?.newSchool && who === "teacher") {
      let typed: NewSchool;
      try { typed = cleanNewSchool(body.newSchool); }
      catch (e) { throw new SchoolPickError(e instanceof SchoolNameError ? e.message : "Type your school's name, town and state."); }
      // it may be in the US list after all, typed a little differently
      const listed = deps.directory.find(typed.name, typed.city, typed.state);
      if (listed) {
        const school = await activate(listed);
        if (school) return { schoolId: Number(school.id), schoolName: school.name, added: "directory" };
      }
      if (isIndependentSchoolName(typed.name)) throw new SchoolPickError("Type your school's full name.");
      const made = await addTyped(typed);
      // over the hourly limit: the account is still made, and the admin connects the school
      if (!made) return { schoolId: null, schoolName: schoolDisplayName(typed.name, typed.city, typed.state), added: null };
      // "teacher" means the school is waiting on a teacher's approval before others see it
      const waiting = (await readAdded())[String(made.school.id)]?.by === "teacher";
      return { schoolId: Number(made.school.id), schoolName: made.school.name, added: waiting ? "teacher" : null };
    }

    const id = Number(body?.schoolId);
    if (Number.isSafeInteger(id) && id > 0) {
      const school = (await visibleSchools()).find((s) => Number(s.id) === id);
      if (!school) throw new SchoolPickError("That school could not be found. Please pick your school again.");
      return { schoolId: id, schoolName: school.name, added: null };
    }
    return none;
  }

  // ─── Search, for the sign-up pages. No sign-in: nobody has an account yet. ───
  app.get("/api/schools/search", async (req: any, res: any) => {
    try {
      const q = String(req.query?.q ?? "").slice(0, 80);
      const state = isUsState(String(req.query?.state ?? "").toUpperCase()) ? String(req.query.state).toUpperCase() : "";
      const folded = foldSchoolText(q);
      res.set("Cache-Control", "public, max-age=60");
      if (folded.replace(/ /g, "").length < 2) return res.json({ onSite: [], directory: [], more: false, total: deps.directory.size });

      const [visible, links] = await Promise.all([visibleSchools(), readJson<Record<string, number>>(KEY.links, {})]);
      const words = folded.split(" ").filter(Boolean);
      const onSite = visible
        .filter((s) => { const name = ` ${foldSchoolText(s.name)}`; return words.every((w) => name.includes(` ${w}`)); })
        // a state filter still keeps schools whose name doesn't say a state (the site's own older entries)
        .filter((s) => !state || !/\([^()]*, [A-Z]{2}\)$/.test(s.name) || s.name.endsWith(`, ${state})`))
        .slice(0, 8)
        .map((s) => ({ id: Number(s.id), name: s.name }));
      const shownIds = new Set(onSite.map((s) => s.id));
      const visibleIds = new Set(visible.map((s) => Number(s.id)));

      const found = deps.directory.search(q, { state, limit: 20 });
      const directory = found.schools
        .map((s) => ({ ...s, schoolId: visibleIds.has(Number(links[s.key])) ? Number(links[s.key]) : null }))
        // already listed above under its site name
        .filter((s) => !s.schoolId || !shownIds.has(s.schoolId));
      res.json({ onSite, directory, more: found.more, total: deps.directory.size });
    } catch (e: any) {
      console.error("[schools] search failed:", e?.message);
      res.status(500).json({ message: "School search isn't working right now. Use “My school isn't listed” to continue." });
    }
  });

  return { pick, setAddedBy, visibleSchools, hiddenIds, addedAtSignup };
}

export type SchoolPicker = ReturnType<typeof registerSchoolPickerRoutes>;
