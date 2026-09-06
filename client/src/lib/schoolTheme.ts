// School theme system - applies per-school branding (colors, mascot name)
// Default theme is orange/Reader. Each school can override with their own colors/mascot.

export interface SchoolTheme {
  mascotName: string;
  primaryHsl: string;
  primaryForegroundHsl: string;
  mascotEmoji?: string;
}

const DEFAULT_THEME: SchoolTheme = {
  mascotName: "Reader",
  primaryHsl: "21 100% 50%",
  primaryForegroundHsl: "0 0% 100%",
};

let currentTheme: SchoolTheme = DEFAULT_THEME;
let teacherBand: string = '';

export function setSchoolTheme(theme: SchoolTheme | null | undefined) {
  currentTheme = theme || DEFAULT_THEME;
  const root = document.documentElement;
  root.style.setProperty("--primary", currentTheme.primaryHsl);
  root.style.setProperty("--primary-foreground", currentTheme.primaryForegroundHsl);
}

export function setTeacherBand(band: string) {
  teacherBand = band || '';
}

export function getMascotEmoji(): string {
  return currentTheme.mascotEmoji || "";
}

export function getMascotName(): string {
  return currentTheme.mascotName;
}

// Brand text: "A.R.I.S.E Reader" or "A.R.I.S.E Hornets!" etc.
export function getBrandSuffix(): string {
  const mascot = currentTheme.mascotName;
  if (mascot === "Reader") return "Reader";
  return `${mascot}!`;
}

export function getSchoolTheme(): SchoolTheme {
  return currentTheme;
}

export function getTeacherBand(): string {
  return teacherBand;
}
