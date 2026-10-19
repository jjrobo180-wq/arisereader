// Advisories: a school's homeroom groups, each led by one or more advisors. At DSST: Conservatory
// Green Middle School every 7th-grade advisory has two co-advisors and two sections in one room.
// Students are placed in an advisory when their accounts are uploaded (AddStudentsModal), so the
// sign-in pop-up only asks for their ELA teacher.
import { nameWords } from "./classTeachers";

export type Advisory = {
  id: string;
  /** The advisors, as "First Last". */
  teachers: string[];
  grade?: string;
  room?: string;
  /** Section numbers from the school's roster, for reference. */
  sections?: string[];
};

/** Conservatory Green Middle School, 2026-27 (from the school's Section Rosters, 10/19/2026). */
const CONSERVATORY_GREEN_MS: Advisory[] = [
  { id: "cgms-7010", teachers: ["Lucy Chase", "Jeffrey Shuster"], grade: "7", room: "212", sections: ["7010", "7011"] },
  { id: "cgms-7020", teachers: ["Kennedy Isaac", "Sandra Ross"], grade: "7", room: "213", sections: ["7020", "7021"] },
  { id: "cgms-7030", teachers: ["Veysel Altunel", "Francisco Padilla"], grade: "7", room: "215", sections: ["7030", "7031"] },
  { id: "cgms-7040", teachers: ["Edward King", "Ellie Ruos"], grade: "7", room: "216", sections: ["7040", "7041"] },
  { id: "cgms-7050", teachers: ["Meg Hines-Brazell", "Marissa Kast"], grade: "7", room: "217", sections: ["7050", "7051"] },
];

/** The advisories at a school, found by its name ("Conservatory Green Middle School (Denver, CO)"). */
export function advisoriesForSchool(schoolName: string): Advisory[] {
  const words = nameWords(schoolName).join(" ");
  if (words.includes("conservatory green") && !words.includes("high")) return CONSERVATORY_GREEN_MS;
  return [];
}

const lastName = (full: string) => full.trim().split(/\s+/).slice(-1)[0] || full;

/** The advisory's name as students and teachers see it: "Chase & Shuster". */
export const advisoryName = (a: Advisory) => a.teachers.map(lastName).join(" & ");

/** A longer label for choosing one: "Chase & Shuster · Grade 7 · Room 212". */
export const advisoryLabel = (a: Advisory) =>
  [`${a.teachers.join(" & ")}`, a.grade ? `Grade ${a.grade}` : "", a.room ? `Room ${a.room}` : ""].filter(Boolean).join(" · ");

/** The teacher account (if any) for one of the advisory's advisors, matched by name. */
export function advisorAccount<T extends { id: number; displayName: string }>(a: Advisory, teachers: readonly T[]): T | null {
  for (const name of a.teachers) {
    const want = nameWords(name).join(" ");
    const hit = teachers.find((t) => nameWords(t.displayName).join(" ") === want);
    if (hit) return hit;
  }
  return null;
}

/** Is this teacher (by account name) one of the advisory's advisors? */
export const isAdvisor = (a: Advisory, displayName: string) => a.teachers.some((n) => nameWords(n).join(" ") === nameWords(displayName).join(" "));
