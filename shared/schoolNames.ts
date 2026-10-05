// School names: how they are compared, shown, and checked when a teacher types one in.
import { blockedWord } from "./study/sets";

export const US_STATES: ReadonlyArray<readonly [code: string, name: string]> = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"],
  ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"],
  ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"],
  ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"],
  ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
  ["AS", "American Samoa"], ["GU", "Guam"], ["MP", "Northern Mariana Islands"], ["PR", "Puerto Rico"], ["VI", "U.S. Virgin Islands"],
];
const STATE_CODES = new Set(US_STATES.map(([code]) => code));
export const isUsState = (code: unknown): code is string => typeof code === "string" && STATE_CODES.has(code);

/** Lower case, no accents, no punctuation, single spaces. Two names that fold to the same text are the same name. */
export function foldSchoolText(text: unknown): string {
  return String(text ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** How a school from the US list is named on the site: the town is part of the name, because "Lincoln Elementary" is in a thousand towns. */
export const schoolDisplayName = (name: string, city: string, state: string) => (city ? `${name} (${city}, ${state})` : `${name} (${state})`);

const GRADE_WORD: Record<string, string> = { PK: "Pre-K", K: "K", "13": "12+" };
/** "Pre-K to 5", "9 to 12", "K", or "" when the list doesn't say. */
export function gradeSpan(low: string, high: string): string {
  const a = GRADE_WORD[low] ?? low, b = GRADE_WORD[high] ?? high;
  if (!a && !b) return "";
  if (!a || !b || a === b) return a || b;
  return `${a} to ${b}`;
}

export class SchoolNameError extends Error {}
export const NEW_SCHOOL_LIMITS = { nameMin: 3, nameMax: 80, cityMax: 40 } as const;

// Characters that take up no space on screen.
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F­͏؜ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ]/g;
const tidy = (v: unknown, max: number) => String(v ?? "").replace(/[\t\n\r]/g, " ").replace(INVISIBLE, "").replace(/\s+/g, " ").trim().slice(0, max);

export type NewSchool = { name: string; city: string; state: string };

/**
 * Checks a school a teacher typed because it wasn't in the list. The name is
 * shown to children on the sign-up page, so it has to look like a school name:
 * letters, no rude words, no links.
 */
export function cleanNewSchool(input: unknown): NewSchool {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const name = tidy(raw.name, NEW_SCHOOL_LIMITS.nameMax);
  const city = tidy(raw.city, NEW_SCHOOL_LIMITS.cityMax);
  const state = String(raw.state ?? "").trim().toUpperCase();
  if (name.length < NEW_SCHOOL_LIMITS.nameMin || (name.match(/[A-Za-z]/g) || []).length < 3) throw new SchoolNameError("Type your school's full name.");
  if (/https?:|www\.|@|[<>{}\\]/i.test(name + city)) throw new SchoolNameError("Type just the school's name and town.");
  if (!/^[A-Za-z][A-Za-z .'-]{1,}$/.test(city)) throw new SchoolNameError("Type the town or city your school is in.");
  if (!isUsState(state)) throw new SchoolNameError("Pick the state your school is in.");
  const bad = blockedWord(`${name} ${city}`);
  if (bad) throw new SchoolNameError("That doesn't look like a school name. Please check it.");
  return { name, city, state };
}
