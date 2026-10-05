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

export type SchoolPickerDeps = {
  directory: SchoolDirectory;
  /** Every school on the site. Must throw when the list can't be read in full: a short list would make duplicates. */
  allSchools(): Promise<SchoolRow[]>;
  createSchool(name: string): Promise<SchoolRow>;
  /** The ids of every approved teacher. */
  approvedTeacherIds(): Promise<Set<number>>;
  getSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  /**
   * The same read, but it throws when the database can't be reached. The records here decide
   * which schools are hidden and are rewritten on every change, so a failed read must never
   * look like "no records". Left out, getSetting is used.
   */
  readSetting?(key: string): Promise<string>;
  now?: () => number;
};

/** How a school got onto the site's list through sign-up. */
type Added = {
  by: "directory" | "teacher";
  key?: string;
  /** Teachers who typed this school in. */
  teacherIds?: number[];
  /** Set for good once one of those teachers has been approved, so the school stays up if that teacher later leaves. */
  shown?: boolean;
  at: string;
};

const KEY = {
  /** US-list id -> the site's school id, for schools already picked or linked by the admin. */
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

/** "Lincoln Elementary (Springfield, IL)" -> its three parts. A name with no town in it has only the name. */
function parts(display: string): { name: string; city: string; state: string } {
  const withTown = /^(.*) \(([^()]*), ([A-Z]{2})\)$/.exec(display);
  if (withTown) return { name: withTown[1], city: withTown[2], state: withTown[3] };
  const stateOnly = /^(.*) \(([A-Z]{2})\)$/.exec(display);
  if (stateOnly) return { name: stateOnly[1], city: "", state: stateOnly[2] };
  return { name: display, city: "", state: "" };
}
/**
 * What makes two entries the same school: the same name in the same town and state.
 * The three parts are compared separately. Folding the whole text would let
 * "X High School New (York, NY)" pass for "X High School (New York, NY)".
 */
const identity = (name: string, city: string, state: string) => `${foldSchoolText(name)}|${foldSchoolText(city)}|${state}`;
const identityOf = (row: SchoolRow) => { const p = parts(row.name); return identity(p.name, p.city, p.state); };

export function registerSchoolPickerRoutes(app: Express, deps: SchoolPickerDeps) {
  const now = () => (deps.now ? deps.now() : Date.now());

  // ─── Storage ───────────────────────────────────────────────────────────────
  // Reads throw when the database can't be reached and are remembered for a few seconds.
  const MEM_MS = 20_000;
  const mem = new Map<string, { at: number; value: string }>();
  const read = async (key: string): Promise<string> => {
    const hit = mem.get(key);
    if (hit && now() - hit.at < MEM_MS) return hit.value;
    const value = await (deps.readSetting ?? deps.getSetting)(key);
    mem.set(key, { at: now(), value });
    return value;
  };
  const write = async (key: string, value: string) => { await deps.upsertSetting(key, value); mem.set(key, { at: now(), value }); };
  const parse = <T,>(raw: string, fallback: T): T => { if (!raw) return fallback; try { const v = JSON.parse(raw); return v && typeof v === "object" && !Array.isArray(v) ? (v as T) : fallback; } catch { return fallback; } };
  const readLinks = async () => parse<Record<string, number>>(await read(KEY.links), {});
  const readAdded = async () => parse<Record<string, Added>>(await read(KEY.added), {});

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
   * Schools a teacher typed in stay hidden until the admin approves one of the
   * teachers who typed it. Returns the ids to leave out of every public list.
   */
  async function hiddenIds(): Promise<Set<number>> {
    const added = await readAdded();
    const waiting = Object.entries(added).filter(([, how]) => how?.by === "teacher" && !how.shown);
    const hidden = new Set<number>();
    if (!waiting.length) return hidden;
    const approved = await deps.approvedTeacherIds();
    const nowShown: string[] = [];
    for (const [id, how] of waiting) {
      if ((Array.isArray(how.teacherIds) ? how.teacherIds : []).some((t) => approved.has(Number(t)))) nowShown.push(id);
      else hidden.add(Number(id));
    }
    // Written down once, so the school stays up even if that teacher's account is removed later.
    if (nowShown.length) {
      void serial(async () => {
        const fresh = await readAdded();
        for (const id of nowShown) if (fresh[id]?.by === "teacher") fresh[id] = { ...fresh[id], shown: true };
        await write(KEY.added, JSON.stringify(fresh));
      }).catch((e: any) => console.error("[schools] could not record an approved school:", e?.message));
    }
    return hidden;
  }
  /** The site's schools that anyone signing up may see. */
  async function visibleSchools(): Promise<SchoolRow[]> {
    const [all, hidden] = await Promise.all([deps.allSchools(), hiddenIds()]);
    return all.filter((s) => !hidden.has(Number(s.id)) && !isIndependentSchoolName(s.name));
  }
  /** Was this school added through sign-up? Those are never free by their name alone. Throws if that can't be checked. */
  async function addedAtSignup(schoolId: number): Promise<boolean> {
    return !!(await readAdded())[String(schoolId)];
  }

  /** Puts a school from the US list on the site's list, or finds it there. */
  const activate = (entry: DirectorySchool) => serial(async (): Promise<SchoolRow | null> => {
    const [links, all] = [await readLinks(), await deps.allSchools()];
    const linked = all.find((s) => Number(s.id) === Number(links[entry.key]));
    if (linked) return linked;
    const added = await readAdded();
    const want = identity(entry.name, entry.city, entry.state);
    let school = all.find((s) => identityOf(s) === want) ?? null;
    if (school) {
      // The US list vouches for this name, so a teacher's typed copy of it no longer has to wait.
      const how = added[String(school.id)];
      if (how?.by === "teacher" && !how.shown) { added[String(school.id)] = { ...how, shown: true }; await write(KEY.added, JSON.stringify(added)); }
    } else {
      if (!underCap("directory")) return null;
      school = await deps.createSchool(schoolDisplayName(entry.name, entry.city, entry.state));
      recent.directory.push(now());
      added[String(school.id)] = { by: "directory", key: entry.key, at: new Date(now()).toISOString() };
      await write(KEY.added, JSON.stringify(added));
    }
    links[entry.key] = Number(school.id);
    await write(KEY.links, JSON.stringify(links));
    return school;
  });

  /** Adds a school a teacher typed, or finds the same name in the same town already there. */
  const addTyped = (typed: NewSchool) => serial(async (): Promise<SchoolRow | null> => {
    const all = await deps.allSchools();
    const want = identity(typed.name, typed.city, typed.state);
    const same = all.find((s) => identityOf(s) === want);
    if (same) return same;
    if (!underCap("teacher")) return null;
    const school = await deps.createSchool(schoolDisplayName(typed.name, typed.city, typed.state));
    recent.teacher.push(now());
    const added = await readAdded();
    added[String(school.id)] = { by: "teacher", at: new Date(now()).toISOString() };
    await write(KEY.added, JSON.stringify(added));
    return school;
  });

  /** Records a teacher who typed this school in, once that teacher's account exists. */
  const setAddedBy = (schoolId: number, teacherId: number) => serial(async () => {
    const added = await readAdded();
    const how = added[String(schoolId)];
    if (!how || how.by !== "teacher" || how.shown) return;
    const ids = Array.isArray(how.teacherIds) ? how.teacherIds : [];
    if (ids.includes(teacherId) || ids.length >= 25) return;
    added[String(schoolId)] = { ...how, teacherIds: [...ids, teacherId] };
    await write(KEY.added, JSON.stringify(added));
  });

  /**
   * Works out the school for a sign-up from what the page sent:
   *   schoolId        a school already on the site
   *   directorySchool an id from the US list
   *   newSchool       { name, city, state } typed by a teacher (teachers only)
   * Throws SchoolPickError with a message for the person signing up.
   */
  async function pick(body: any, who: "teacher" | "student"): Promise<PickedSchool> {
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
      if (isIndependentSchoolName(typed.name)) throw new SchoolPickError("Type your school's full name.");
      // it may be in the US list after all, typed a little differently
      const listed = deps.directory.find(typed.name, typed.city, typed.state);
      if (listed) {
        const school = await activate(listed);
        if (school) return { schoolId: Number(school.id), schoolName: school.name, added: "directory" };
      }
      const school = await addTyped(typed);
      if (!school) return { schoolId: null, schoolName: schoolDisplayName(typed.name, typed.city, typed.state), added: null };
      // "teacher" means the school is waiting on a teacher's approval before others see it
      const how = (await readAdded())[String(school.id)];
      return { schoolId: Number(school.id), schoolName: school.name, added: how?.by === "teacher" && !how.shown ? "teacher" : null };
    }

    const id = Number(body?.schoolId);
    if (Number.isSafeInteger(id) && id > 0) {
      const school = (await visibleSchools()).find((s) => Number(s.id) === id);
      if (!school) throw new SchoolPickError("That school could not be found. Please pick your school again.");
      return { schoolId: id, schoolName: school.name, added: null };
    }
    return { schoolId: null, schoolName: "", added: null };
  }

  // ─── For the admin: tie one of the site's schools to its entry in the US list ───
  // A school the admin made by hand ("CGMS") is not in the US list under that name.
  // Linking it means someone who searches the school's full name lands in the same school.

  /** Each linked school's entry in the US list, by the site's school id. */
  async function linkedEntries(): Promise<Record<number, DirectorySchool>> {
    const out: Record<number, DirectorySchool> = {};
    for (const [key, schoolId] of Object.entries(await readLinks())) {
      const entry = deps.directory.get(key);
      if (entry) out[Number(schoolId)] = entry;
    }
    return out;
  }
  /** Links a school to a US-list entry, or with `key` null takes its link away. */
  const link = (schoolId: number, key: string | null) => serial(async (): Promise<DirectorySchool | null> => {
    const all = await deps.allSchools();
    const school = all.find((s) => Number(s.id) === schoolId);
    if (!school) throw new SchoolPickError("That school could not be found.");
    const links = await readLinks();
    const entry = key ? deps.directory.get(key) : null;
    if (key && !entry) throw new SchoolPickError("That school could not be found in the US list.");
    if (entry) {
      const taken = all.find((s) => Number(s.id) === Number(links[entry.key]) && Number(s.id) !== schoolId);
      if (taken) throw new SchoolPickError(`That school in the US list is already linked to “${taken.name}”.`);
    }
    for (const [k, id] of Object.entries(links)) if (Number(id) === schoolId) delete links[k];
    if (entry) links[entry.key] = schoolId;
    await write(KEY.links, JSON.stringify(links));
    return entry;
  });

  // ─── Search, for the sign-up pages. No sign-in: nobody has an account yet. ───
  app.get("/api/schools/search", async (req: any, res: any) => {
    try {
      const q = String(req.query?.q ?? "").slice(0, 80);
      const state = isUsState(String(req.query?.state ?? "").toUpperCase()) ? String(req.query.state).toUpperCase() : "";
      const folded = foldSchoolText(q);
      res.set("Cache-Control", "public, max-age=60");
      if (folded.replace(/ /g, "").length < 2) return res.json({ onSite: [], directory: [], more: false, total: deps.directory.size });

      const [visible, links] = await Promise.all([visibleSchools(), readLinks()]);
      const visibleById = new Map(visible.map((s) => [Number(s.id), s]));
      const words = folded.split(" ").filter(Boolean);
      const onSite = visible
        .filter((s) => { const name = ` ${foldSchoolText(s.name)}`; return words.every((w) => name.includes(` ${w}`)); })
        // a state filter still keeps schools whose name doesn't say a state (the site's own older entries)
        .filter((s) => { const p = parts(s.name); return !state || !p.state || p.state === state; })
        .slice(0, 8)
        .map((s) => ({ id: Number(s.id), name: s.name }));
      const shown = new Set(onSite.map((s) => s.id));

      const found = deps.directory.search(q, { state, limit: 20 });
      // the admin's matching tool wants the US list as it is, not merged with the site's schools
      if (req.query?.only === "us") return res.json({ onSite: [], directory: found.schools.map((sc) => ({ ...sc, schoolId: Number(links[sc.key]) || null })), more: found.more, total: deps.directory.size });
      const directory: Array<DirectorySchool & { schoolId: number | null }> = [];
      for (const s of found.schools) {
        const site = visibleById.get(Number(links[s.key]));
        if (!site) { directory.push({ ...s, schoolId: null }); continue; }
        // a US-list school that is on the site is shown once, under the site's name for it
        if (!shown.has(Number(site.id)) && onSite.length < 12) { onSite.push({ id: Number(site.id), name: site.name }); shown.add(Number(site.id)); }
      }
      res.json({ onSite, directory, more: found.more, total: deps.directory.size });
    } catch (e: any) {
      console.error("[schools] search failed:", e?.message);
      res.status(500).json({ message: "School search isn't working right now. Use “My school isn't listed” to continue." });
    }
  });

  return { pick, setAddedBy, visibleSchools, hiddenIds, addedAtSignup, link, linkedEntries };
}

export type SchoolPicker = ReturnType<typeof registerSchoolPickerRoutes>;
