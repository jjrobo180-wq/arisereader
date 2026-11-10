// Arise All Access bought in the iPhone app with Apple's in-app purchase (native/arise-store, StoreKit 2).
// The server checks each purchase Apple signs (server/appleStore.ts) and turns All Access on for the
// signed-in account. Builds without the plugin (older TestFlight builds, the website) never show it.
import { API_BASE } from "@/lib/queryClient";
import { hasNativePlugin, nativeAppInfo, nativeCall, nativeListen } from "@/lib/nativeApp";

const PLUGIN = /AriseStore/;
const call = (method: string, options?: unknown) => nativeCall(PLUGIN, "AriseStore", method, options);

/** This app build can sell All Access with Apple. */
export const appleStoreReady = (): boolean => hasNativePlugin(PLUGIN);
/** This app's All Access product in App Store Connect. */
export const allAccessProductId = (): string => `${nativeAppInfo().bundle}.allaccess.monthly`;

/** The App Store country (e.g. "USA"), or "" when it can't be told. */
export async function appStoreCountry(): Promise<string> {
  if (!appleStoreReady()) return "";
  try { return String((await call("storefront"))?.country || ""); } catch { return ""; }
}

/** The price Apple shows for All Access here ("$9.99"), or null when the App Store doesn't offer it. */
export async function allAccessApplePrice(): Promise<string | null> {
  if (!appleStoreReady()) return null;
  try { const p = await call("product", { id: allAccessProductId() }); return p?.available ? String(p.displayPrice) : null; } catch { return null; }
}

async function api(path: string, token: string, body?: unknown) {
  const r = await fetch(`${API_BASE}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.message || "That didn't work. Please try again.");
  return d;
}

/** Hands Apple's signed purchases to the server. */
export async function sendApplePurchases(token: string, transactions: string[]) {
  if (!transactions.length) return null;
  return api("/api/all-access/apple", token, { transactions });
}

export type AppleBuy = { status: "purchased" | "pending" | "cancelled"; live?: boolean };
/** Buys All Access with Apple for the signed-in account. */
export async function buyAllAccessWithApple(token: string): Promise<AppleBuy> {
  const { token: accountToken } = await api("/api/all-access/apple-token", token);
  const r = await call("purchase", { id: allAccessProductId(), token: accountToken });
  if (r?.status !== "purchased" || !r.jws) return { status: r?.status === "pending" ? "pending" : "cancelled" };
  const saved = await sendApplePurchases(token, [String(r.jws)]);
  return { status: "purchased", live: !!saved?.live };
}

/** Asks the App Store for purchases made before (a new phone, a reinstall) and sends them. */
export async function restoreApplePurchases(token: string) {
  const r = await call("restore");
  const list: string[] = Array.isArray(r?.transactions) ? r.transactions.map(String) : [];
  return list.length ? sendApplePurchases(token, list) : { ok: true, live: false, none: true };
}

/** Apple's own Manage Subscriptions sheet (to cancel or change a plan bought in the app). */
export const manageAppleSubscription = () => call("manage").catch(() => undefined);

let started = "";
/** On opening the app signed in: sends running subscriptions (renewals) and listens for new ones. */
export function startAppleSync(token: string | null) {
  if (!token || !appleStoreReady() || started === token) return;
  started = token;
  call("entitlements").then((r) => sendApplePurchases(token, Array.isArray(r?.transactions) ? r.transactions.map(String) : [])).catch(() => {});
  void nativeListen("AriseStore", "transaction", (d: any) => { if (d?.jws && started) sendApplePurchases(started, [String(d.jws)]).catch(() => {}); });
}
