
/** Cleaned as you type: the start is trimmed but a space (or new line) just typed at the end stays, or the next word could never be typed. */
const typedEnd = (s: string) => s.replace(/^\s+/, "").replace(/ {2,}$/, "");
// Trainer websites (November 2026): every Cooked Trainer coach can publish their own site at arisetodo.com/#/t/<slug>,
// built from their listing (photo, bio, prices, specialties, reviews) plus what they add here: a look, a headline,
// services, photos and FAQs. The contact form sends leads straight to the trainer's app. Server: server/coach.ts.
export type SiteTemplate = "bold" | "clean" | "studio" | "warm";
export const SITE_TEMPLATES: { id: SiteTemplate; name: string; blurb: string }[] = [
  { id: "bold", name: "Bold", blurb: "Dark, big type, made for strength coaches" },
  { id: "clean", name: "Clean", blurb: "White space and elegant headings" },
  { id: "studio", name: "Studio", blurb: "Your photo full screen, like a boutique gym" },
  { id: "warm", name: "Warm", blurb: "Soft and friendly, great for wellness and seniors" },
];
export const SITE_ACCENTS = ["#ff5a1f", "#e11d48", "#7c3aed", "#2563eb", "#0d9488", "#16a34a", "#ca8a04", "#111827"];

export type SiteService = { id: string; title: string; text: string; price: string };
export type SiteFaq = { id: string; q: string; a: string };
export type SiteConfig = {
  published: boolean; template: SiteTemplate; accent: string;
  heroTitle: string; heroSub: string; about: string; cta: string;
  services: SiteService[]; photos: string[]; faqs: SiteFaq[];
  showReviews: boolean; showPrices: boolean;
};
export const emptySite = (): SiteConfig => ({ published: false, template: "bold", accent: SITE_ACCENTS[0], heroTitle: "", heroSub: "", about: "", cta: "Book a free consult", services: [], photos: [], faqs: [], showReviews: true, showPrices: true });

export type LeadStatus = "new" | "contacted" | "won" | "lost";
export const LEAD_STATUS: { id: LeadStatus; label: string }[] = [{ id: "new", label: "New" }, { id: "contacted", label: "Contacted" }, { id: "won", label: "Became a client" }, { id: "lost", label: "Not a fit" }];
export type Lead = { id: string; at: string; name: string; email: string; phone: string; goal: string; message: string; source: "site" | "marketplace" | "import"; status: LeadStatus; tags?: string[] };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+$/g, "").slice(0, max) : "");
const arr = <T,>(v: unknown, max: number, f: (x: any) => T | null): T[] => (Array.isArray(v) ? v.slice(0, max).map(f).filter((x): x is T => x !== null) : []);
const id = (v: unknown) => (typeof v === "string" && /^[\w-]{1,40}$/.test(v) ? v : Math.random().toString(36).slice(2, 12));
const img = (v: unknown) => (typeof v === "string" && (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 400_000 || /^https:\/\/[^\s"'<>]{4,400}$/.test(v)) ? v : "");

export function cleanSite(raw: unknown): SiteConfig {
  const r = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const e = emptySite();
  return {
    published: r.published === true,
    template: SITE_TEMPLATES.some((t) => t.id === r.template) ? r.template : e.template,
    accent: SITE_ACCENTS.includes(r.accent) ? r.accent : e.accent,
    heroTitle: str(r.heroTitle, 90), heroSub: str(r.heroSub, 220), about: str(r.about, 3000), cta: str(r.cta, 40) || e.cta,
    services: arr(r.services, 8, (s) => { const title = str(s?.title, 60); return title ? { id: id(s.id), title, text: str(s.text, 400), price: str(s.price, 40) } : null; }),
    photos: arr(r.photos, 8, (p) => img(p) || null),
    faqs: arr(r.faqs, 10, (f) => { const q = str(f?.q, 160); return q ? { id: id(f.id), q, a: str(f.a, 800) } : null; }),
    showReviews: r.showReviews !== false, showPrices: r.showPrices !== false,
  };
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
/** A message from the site's contact form. Needs a name and a way to reach them. */
export function cleanLead(raw: unknown, at: string, source: Lead["source"] = "site"): Lead | null {
  const r = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const name = typedEnd(str(r.name, 80)), email = typedEnd(str(r.email, 254)), phone = str(r.phone, 30).replace(/[^\d+()\-.\s]/g, "").trim();
  if (!name || (!EMAIL.test(email) && phone.replace(/\D/g, "").length < 7)) return null;
  return { id: id(undefined), at, name, email: EMAIL.test(email) ? email : "", phone, goal: str(r.goal, 120), message: str(r.message, 2000), source, status: "new" };
}
export const cleanLeads = (raw: unknown): Lead[] => arr(raw, 2000, (l) => {
  const x = l && typeof l === "object" ? l : {};
  const c = cleanLead(x, str(x.at, 30) || new Date(0).toISOString(), x.source === "marketplace" || x.source === "import" ? x.source : "site");
  const tags = Array.isArray(x.tags) ? x.tags.map((t: unknown) => str(t, 30)).filter(Boolean).slice(0, 5) : [];
  return c ? { ...c, id: id(x.id), status: LEAD_STATUS.some((s) => s.id === x.status) ? x.status : "new", ...(tags.length ? { tags } : {}) } : null;
});

/** The site's address: the trainer's name, then their id (so no two trainers can collide, and no lookup table is needed). */
export const siteSlug = (name: string, trainerId: number) => `${(name || "coach").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 40) || "coach"}-${trainerId.toString(36)}`;
export const idFromSlug = (slug: string): number | null => { const m = /-([0-9a-z]{1,10})$/.exec(String(slug || "")); if (!m) return null; const n = parseInt(m[1], 36); return Number.isSafeInteger(n) && n > 0 ? n : null; };
