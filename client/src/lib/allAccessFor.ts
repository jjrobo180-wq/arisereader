// The All Access page wears the colors of the app someone came from (shared/allAccess.ts).
import { isAllAccessApp, type AllAccessApp } from "@shared/allAccess";

/** The app someone came from ("?for=fit"), kept through Stripe's checkout and back. */
const FOR_KEY = "arise-all-access-for";
export function allAccessFor(): AllAccessApp {
  try {
    const q = new URLSearchParams(window.location.search).get("for");
    if (isAllAccessApp(q)) { sessionStorage.setItem(FOR_KEY, q); return q; }
    const kept = sessionStorage.getItem(FOR_KEY);
    return isAllAccessApp(kept) ? kept : "todo";
  } catch { return "todo"; }
}
