// The Kitchen planner's calls to the server for King Soopers (server/kroger.ts). Every call carries the person's sign-in.
import { API_BASE } from "@/lib/queryClient";

export type StoreProduct = { storeId: string; upc: string; brand: string; name: string; label: string; price: number; regular: number; sale: boolean; image: string };
export type StoreLocation = { id: string; name: string; address: string; zip: string; chain: string };

async function call<T>(token: string | null, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/arise-todo/store${path}`, { ...init, headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.body ? { "Content-Type": "application/json" } : {}) } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || "The store can't be reached right now.");
  return body as T;
}
export const storeStatus = (token: string | null) => call<{ connected: boolean }>(token, "/status").then((b) => b.connected).catch(() => false);
export const findStores = (token: string | null, zip: string) => call<{ stores: StoreLocation[] }>(token, `/locations?zip=${encodeURIComponent(zip)}`).then((b) => b.stores || []);
export const searchStore = (token: string | null, term: string, location: string) => call<{ products: StoreProduct[] }>(token, `/products?term=${encodeURIComponent(term)}&location=${encodeURIComponent(location)}`).then((b) => b.products || []);
export const storePrices = (token: string | null, location: string, ids: string[]) => call<{ prices: StoreProduct[]; at: string }>(token, "/prices", { method: "POST", body: JSON.stringify({ location, ids }) });
