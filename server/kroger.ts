// King Soopers (Kroger) store prices for the Kitchen planner, from Kroger's official Products and Locations API
// (https://developer.kroger.com). It needs a free Kroger developer app: set KROGER_CLIENT_ID and KROGER_CLIENT_SECRET
// on the server. Without them the planner keeps its built-in estimates and says the store isn't connected.
// Only public product data passes through here; nothing about the person is sent to Kroger.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";

const API = "https://api.kroger.com/v1";
const limits = createAttemptLimiter({ max: 240, windowMs: 10 * 60_000 });
let token: { value: string; until: number } | null = null;

export const storeConfigured = () => !!(process.env.KROGER_CLIENT_ID && process.env.KROGER_CLIENT_SECRET);

async function accessToken(): Promise<string> {
  if (token && token.until > Date.now() + 30_000) return token.value;
  const basic = Buffer.from(`${process.env.KROGER_CLIENT_ID}:${process.env.KROGER_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${API}/connect/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: "grant_type=client_credentials&scope=product.compact",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const j: any = await res.json();
  token = { value: String(j.access_token), until: Date.now() + Number(j.expires_in || 1800) * 1000 };
  return token.value;
}

async function get(path: string): Promise<any> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${await accessToken()}`, Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 401) { token = null; throw new Error("auth"); }
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export type StoreProduct = { storeId: string; upc: string; brand: string; name: string; label: string; price: number; regular: number; sale: boolean; image: string };
/** One Kroger product → what the planner shows. The price is the store's current one (the sale price when there is one). */
export function mapKrogerProduct(p: any): StoreProduct | null {
  const item = Array.isArray(p?.items) ? p.items[0] : null;
  const regular = Number(item?.price?.regular), promo = Number(item?.price?.promo);
  if (!p?.productId || !item || !Number.isFinite(regular) || regular <= 0) return null;
  const sale = Number.isFinite(promo) && promo > 0 && promo < regular;
  const img = (Array.isArray(p.images) ? p.images : []).find((i: any) => i?.perspective === "front") ?? (Array.isArray(p.images) ? p.images[0] : null);
  const size = (Array.isArray(img?.sizes) ? img.sizes : []).find((x: any) => x?.size === "medium") ?? (Array.isArray(img?.sizes) ? img.sizes[0] : null);
  return {
    storeId: String(p.productId).slice(0, 40), upc: String(p.upc || "").slice(0, 20), brand: String(p.brand || "").slice(0, 60), name: String(p.description || "").slice(0, 120),
    label: String(item.size || "").slice(0, 60), price: Math.round((sale ? promo : regular) * 100) / 100, regular: Math.round(regular * 100) / 100, sale, image: String(size?.url || "").slice(0, 300),
  };
}
export function mapKrogerLocation(l: any) {
  const a = l?.address || {};
  return l?.locationId ? { id: String(l.locationId).slice(0, 40), name: String(l.name || l.chain || "Store").slice(0, 80), address: [a.addressLine1, a.city, a.state].filter(Boolean).join(", ").slice(0, 120), zip: String(a.zipCode || "").slice(0, 10), chain: String(l.chain || "").slice(0, 40) } : null;
}

export function registerKrogerRoutes(app: Express, authMiddleware: RequestHandler) {
  const guard = (req: any, res: any) => {
    if (!storeConfigured()) { res.status(503).json({ message: "King Soopers isn't connected on the server yet. Prices are estimates until it is." }); return false; }
    const who = `u${req.user?.id}`; const wait = limits.retryAfter(who);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); res.status(429).json({ message: `Too many store lookups. Try again in ${waitWords(wait)}.` }); return false; }
    limits.fail(who); return true;
  };
  const fail = (res: any, e: any) => res.status(503).json({ message: e?.message === "auth" ? "The store connection was refused. Check the Kroger keys on the server." : "King Soopers can't be reached right now. Try again in a minute." });

  app.get("/api/arise-todo/store/status", authMiddleware, (_req, res) => res.json({ connected: storeConfigured() }));

  app.get("/api/arise-todo/store/locations", authMiddleware, async (req: any, res) => {
    const zip = String(req.query?.zip || "").replace(/\D/g, "").slice(0, 5);
    if (zip.length !== 5) return res.status(400).json({ message: "Enter a 5-digit ZIP code." });
    if (!guard(req, res)) return;
    try {
      const j = await get(`/locations?filter.zipCode.near=${zip}&filter.radiusInMiles=15&filter.limit=12`);
      const all = (Array.isArray(j?.data) ? j.data : []).map(mapKrogerLocation).filter(Boolean) as any[];
      // King Soopers first: that's the Kroger store in Colorado.
      return res.json({ stores: all.sort((a, b) => Number(/king soopers/i.test(b.name + b.chain)) - Number(/king soopers/i.test(a.name + a.chain))) });
    } catch (e) { return fail(res, e); }
  });

  app.get("/api/arise-todo/store/products", authMiddleware, async (req: any, res) => {
    const term = String(req.query?.term || "").trim().slice(0, 80), location = String(req.query?.location || "").replace(/[^\w-]/g, "").slice(0, 40);
    if (term.length < 2 || !location) return res.status(400).json({ message: "Search for a product at your store." });
    if (!guard(req, res)) return;
    try {
      const j = await get(`/products?filter.term=${encodeURIComponent(term)}&filter.locationId=${location}&filter.limit=24`);
      return res.json({ products: (Array.isArray(j?.data) ? j.data : []).map(mapKrogerProduct).filter(Boolean) });
    } catch (e) { return fail(res, e); }
  });

  // Today's price for each product picked from the store. One call per product (the API's own limit), four at a time.
  app.post("/api/arise-todo/store/prices", authMiddleware, async (req: any, res) => {
    const location = String(req.body?.location || "").replace(/[^\w-]/g, "").slice(0, 40);
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map((x: unknown) => String(x).replace(/[^\w-]/g, "").slice(0, 40)).filter(Boolean))].slice(0, 80) as string[];
    if (!location || !ids.length) return res.status(400).json({ message: "Nothing to price." });
    if (!guard(req, res)) return;
    const out: StoreProduct[] = [];
    try {
      for (let i = 0; i < ids.length; i += 4) {
        const batch = await Promise.allSettled(ids.slice(i, i + 4).map((id) => get(`/products/${id}?filter.locationId=${location}`)));
        for (const b of batch) if (b.status === "fulfilled") { const p = mapKrogerProduct(b.value?.data); if (p) out.push(p); }
      }
      return res.json({ prices: out, at: new Date().toISOString() });
    } catch (e) { return fail(res, e); }
  });
}
