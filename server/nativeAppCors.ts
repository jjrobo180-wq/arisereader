import type { Request, Response, NextFunction } from "express";

/** Origins the bundled iOS apps load from (Capacitor's WebView). Only these get CORS on /api. */
export const NATIVE_APP_ORIGINS = new Set(["capacitor://localhost", "ionic://localhost"]);

/**
 * The A.R.I.S.E. To-Do iPhone app runs its UI from capacitor://localhost and calls
 * https://arisetodo.com/api/... — a cross-origin request. Without these headers iOS blocks
 * the response, so sign-in shows "Login failed" even with the right password.
 * Pod+ has its own rules on /api/podscroll, so that path is left to them.
 */
export function nativeAppCors(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/") || req.path.startsWith("/api/podscroll")) return next();
  const origin = String(req.headers.origin || "");
  res.append("Vary", "Origin");
  if (!NATIVE_APP_ORIGINS.has(origin)) return next();
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    const asked = String(req.headers["access-control-request-headers"] || "");
    res.setHeader("Access-Control-Allow-Headers", asked || "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.status(204).end();
  }
  next();
}
