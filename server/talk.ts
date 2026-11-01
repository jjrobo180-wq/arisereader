// Arise Talk on the server (shared/talk.ts has the words and the rules).
//
// Talking never waits on this file: the voices come from POST /api/voice/say (server/routes.ts), and
// the boards live on the phone. This file adds what needs an account:
//   GET  /api/talk/me                 Premium or not, and when the last backup was made
//   GET  /api/talk/backup             the saved boards, phrases and settings
//   PUT  /api/talk/backup             save them (any account; it's how a new phone gets them back)
//   POST /api/talk/ai/sentence        Premium: a few words → full sentences to say
//   POST /api/talk/ai/replies         Premium: what someone said → replies to tap
//   POST /api/talk/ai/photo           Premium: a photo → words and phrases about it
//   POST /api/talk/listen             Premium: a short recording → the words in it (nothing is kept)
//   POST /api/talk/premium/checkout   Stripe Checkout for Premium (a free week first)
//   POST /api/talk/premium/confirm    after paying: Premium turns on
//   POST /api/talk/premium/manage     Stripe's page to change the card or cancel
//   POST /api/talk/admin/comp         the site owner gives someone Premium for a while
import type { Express, RequestHandler } from "express";
import { cleanTalk, KINDS, PREMIUM, type TalkData, type TalkKind } from "../shared/talk";
import { createAttemptLimiter } from "./attemptLimiter";

export type TalkRow = { userId: number; data: TalkData | null; premiumUntil: string | null; plan: "month" | "year" | null; stripeCustomer: string | null; stripeSub: string | null; updatedAt: string | null };
export type TalkStore = { get(userId: number): Promise<TalkRow | null>; save(row: TalkRow): Promise<void> };
export type TalkAi = {
  /** A chat model's answer (JSON text) to a system prompt and a message. */
  chat(system: string, user: string): Promise<string>;
  /** A vision model's answer (JSON text) about a photo. */
  see(prompt: string, dataUrl: string): Promise<string>;
  /** The words in a short recording. */
  hear(audio: Buffer, mime: string): Promise<string>;
};
export type TalkDeps = { store?: TalkStore; stripeKey?: () => Promise<string>; appUrl?: string; isAdmin?: (req: any) => boolean; ai?: Partial<TalkAi>; now?: () => number; fetch?: typeof fetch };

const blank = (userId: number): TalkRow => ({ userId, data: null, premiumUntil: null, plan: null, stripeCustomer: null, stripeSub: null, updatedAt: null });

export function memoryTalkStore(): TalkStore {
  const rows = new Map<number, TalkRow>();
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
  return { async get(id) { const r = rows.get(id); return r ? clone(r) : null; }, async save(r) { rows.set(r.userId, clone(r)); } };
}

export function supabaseTalkStore(): TalkStore {
  const db = async () => (await import("./supabase")).supabase;
  const must = <T,>(r: { data: T; error: any }): T => { if (r.error) throw r.error; return r.data; };
  return {
    async get(id) {
      const r: any = must(await (await db()).from("talk_users").select("*").eq("user_id", id).maybeSingle());
      return r ? { userId: Number(r.user_id), data: r.data ? cleanTalk(r.data) : null, premiumUntil: r.premium_until ?? null, plan: r.plan ?? null, stripeCustomer: r.stripe_customer ?? null, stripeSub: r.stripe_sub ?? null, updatedAt: r.updated_at ?? null } : null;
    },
    async save(t) {
      must(await (await db()).from("talk_users").upsert({ user_id: t.userId, data: t.data, premium_until: t.premiumUntil, plan: t.plan, stripe_customer: t.stripeCustomer, stripe_sub: t.stripeSub, updated_at: t.updatedAt ?? new Date().toISOString() }, { onConflict: "user_id" }));
    },
  };
}

// ——— The AI helpers ——————————————————————————————————————————————————————————————————————————————
const GROQ = "https://api.groq.com/openai/v1";
const groqKey = () => process.env.GROQ_API_KEY || "";
const openAiOn = () => !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "routed-to-grok" && process.env.USE_OPENAI === "1";

async function post(url: string, key: string, body: unknown, ms: number): Promise<any> {
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw Object.assign(new Error(`ai ${r.status}`), { status: r.status });
  return r.json();
}
export const defaultAi: TalkAi = {
  async chat(system, user) {
    const messages = [{ role: "system", content: system }, { role: "user", content: user }];
    if (groqKey()) {
      try {
        const j = await post(`${GROQ}/chat/completions`, groqKey(), { model: process.env.TALK_AI_MODEL || "openai/gpt-oss-120b", reasoning_effort: "low", temperature: 0.6, max_tokens: 700, response_format: { type: "json_object" }, messages }, 20_000);
        return String(j?.choices?.[0]?.message?.content || "");
      } catch (e) { console.warn("[talk] Groq chat:", (e as Error).message); }
    }
    // The site's usual AI route (server/aiProvider.ts sends it to whichever service is working).
    const j = await post("https://api.openai.com/v1/chat/completions", process.env.OPENAI_API_KEY || "routed", { model: "gpt-4.1-mini", temperature: 0.6, max_tokens: 700, response_format: { type: "json_object" }, messages }, 30_000);
    return String(j?.choices?.[0]?.message?.content || "");
  },
  async see(prompt, dataUrl) {
    const messages = [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }];
    if (groqKey()) {
      try {
        const j = await post(`${GROQ}/chat/completions`, groqKey(), { model: process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct", temperature: 0.4, max_tokens: 900, response_format: { type: "json_object" }, messages }, 40_000);
        return String(j?.choices?.[0]?.message?.content || "");
      } catch (e) { if (!openAiOn()) throw e; }
    }
    if (!openAiOn()) throw new Error("no vision");
    const j = await post("https://api.openai.com/v1/chat/completions", process.env.OPENAI_API_KEY!, { model: "gpt-4.1-mini", temperature: 0.4, max_tokens: 900, response_format: { type: "json_object" }, messages }, 40_000);
    return String(j?.choices?.[0]?.message?.content || "");
  },
  async hear(audio, mime) {
    const ext = mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac") ? "m4a" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";
    const ask = async (url: string, key: string, model: string) => {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(audio)], { type: mime }), `speech.${ext}`);
      form.append("model", model); form.append("language", "en"); form.append("response_format", "json");
      const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(25_000) });
      if (!r.ok) throw Object.assign(new Error(`hear ${r.status}`), { status: r.status });
      return String((await r.json().catch(() => ({})))?.text || "").trim();
    };
    if (groqKey()) { try { return await ask(`${GROQ}/audio/transcriptions`, groqKey(), "whisper-large-v3-turbo"); } catch (e) { if (!process.env.OPENAI_API_KEY) throw e; } }
    if (!process.env.OPENAI_API_KEY) throw new Error("no transcription");
    return ask("https://api.openai.com/v1/audio/transcriptions", process.env.OPENAI_API_KEY, "whisper-1");
  },
};

const json = (text: string): any => { try { return JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : {}; } catch { return {}; } } };
const lines = (v: unknown, max: number, len = 160): string[] => (Array.isArray(v) ? v : []).map((x) => String(typeof x === "string" ? x : (x as any)?.text ?? "").replace(/\s+/g, " ").trim().slice(0, len)).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, max);

export const SENTENCE_PROMPT = `You help a person who talks with an AAC app (they tap words to speak). They tapped a few words; write what they most likely mean as short, natural sentences in the first person, the way they'd say them out loud. Keep their meaning; don't add facts, names or feelings they didn't give. Plain words, no emoji. Answer as JSON: {"options": ["…", "…", "…"]} with three different readings, the most likely first.`;
export const REPLIES_PROMPT = `You help a person who talks with an AAC app reply in conversation. Someone just said something to them. Suggest six short replies they might want to say (first person, natural, under 12 words each): a mix of yes and no, a feeling, a question back, and a "give me a moment" kind of reply when that fits. Don't assume facts about their life. Plain words, no emoji. Answer as JSON: {"replies": ["…", …]}.`;
export const PHOTO_PROMPT = `This photo is for a person who talks with an AAC app (they tap pictures and words to speak). Name what's in the photo and what they might want to say about it. Answer as JSON: {"title": "two or three words for the scene", "words": [{"label": "one or two words", "emoji": "one emoji", "kind": "thing|action|describe|people|social|question"}], "phrases": ["short first-person sentence", …]} with 8 to 12 words (things you can see first, then actions and describing words) and 4 to 6 phrases. Plain, everyday words. Never identify a real person by name.`;

export function cleanPhotoAnswer(raw: any): { title: string; words: { label: string; emoji: string; kind: TalkKind }[]; phrases: string[] } {
  const words = (Array.isArray(raw?.words) ? raw.words : []).map((w: any) => ({
    label: String(w?.label ?? w ?? "").replace(/\s+/g, " ").trim().slice(0, 30),
    emoji: Array.from(String(w?.emoji ?? "")).slice(0, 4).join("").trim(),
    kind: (KINDS as string[]).includes(w?.kind) ? (w.kind as TalkKind) : "thing",
  })).filter((w: { label: string }, i: number, a: { label: string }[]) => w.label && a.findIndex((x) => x.label.toLowerCase() === w.label.toLowerCase()) === i).slice(0, 14);
  return { title: String(raw?.title ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || "My photo", words, phrases: lines(raw?.phrases, 6) };
}

class Refused extends Error { constructor(message: string, public status = 400) { super(message); } }
const SITE = "https://arisetodo.com";
const stripeForm = (o: Record<string, unknown>, prefix = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => { const key = prefix ? `${prefix}[${k}]` : k; return v && typeof v === "object" ? stripeForm(v as Record<string, unknown>, key) : v === undefined ? [] : [`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`]; });
const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export function registerTalkRoutes(app: Express, auth: RequestHandler, deps: TalkDeps = {}) {
  const store = deps.store ?? supabaseTalkStore();
  const ai: TalkAi = { ...defaultAi, ...deps.ai };
  const now = deps.now ?? Date.now;
  const doFetch = deps.fetch ?? fetch;
  const me = (req: any): number => { const id = Number(req.user?.id); if (!Number.isInteger(id) || id <= 0) throw new Refused("Sign in first.", 401); return id; };
  const wrap = (fn: (req: any, res: any) => Promise<unknown>) => async (req: any, res: any) => {
    res.setHeader("Cache-Control", "no-store");
    try { const out = await fn(req, res); if (!res.headersSent) res.json(out ?? { ok: true }); }
    catch (e: any) { if (e instanceof Refused) return res.status(e.status).json({ message: e.message }); console.error("[talk]", e?.message || e); res.status(500).json({ message: "Something went wrong. Try again in a moment." }); }
  };
  const row = async (id: number) => (await store.get(id)) ?? blank(id);

  // ——— Premium ———
  async function stripe(method: "GET" | "POST", path: string, params?: Record<string, unknown>): Promise<any> {
    const key = (await deps.stripeKey?.().catch(() => "")) || "";
    if (!key) throw new Refused("Payments aren't set up yet. Try again soon.", 409);
    const res = await doFetch(`https://api.stripe.com/v1${path}`, { method, headers: { Authorization: `Bearer ${key}`, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body: method === "POST" && params ? stripeForm(params).join("&") : undefined });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) { console.error("[talk] Stripe refused", res.status, data?.error?.code); throw new Refused("The payment service couldn't do that. Nothing was charged.", 502); }
    return data;
  }
  const subEnd = (sub: any) => Number(sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? sub?.trial_end) * 1000;
  /** Premium now? Renewals are checked with Stripe when the paid time is nearly up. */
  async function premiumOf(req: any, t: TalkRow): Promise<{ on: boolean; row: TalkRow }> {
    if (deps.isAdmin?.(req)) return { on: true, row: t };
    let r = t;
    // Paid on the website (often from the iPhone app, in Safari): the checkout is looked up here.
    if (r.stripeSub?.startsWith("cs_")) {
      try {
        const s = await stripe("GET", `/checkout/sessions/${encodeURIComponent(r.stripeSub)}?expand%5B%5D=subscription`);
        const sub = s?.subscription;
        if (s?.status === "complete" && sub && (sub.status === "active" || sub.status === "trialing")) {
          r = { ...r, plan: s?.metadata?.plan === "year" ? "year" : "month", stripeCustomer: String(s.customer || r.stripeCustomer || "") || null, stripeSub: String(sub.id), premiumUntil: new Date((subEnd(sub) || now() + 31 * 864e5) + 2 * 864e5).toISOString() };
          await store.save(r);
        } else if (s?.status === "expired") { r = { ...r, stripeSub: null }; await store.save(r); }
      } catch { /* try again next time */ }
    }
    if (r.stripeSub?.startsWith("sub_") && (!r.premiumUntil || Date.parse(r.premiumUntil) < now() + 3 * 864e5)) {
      try {
        const sub = await stripe("GET", `/subscriptions/${encodeURIComponent(r.stripeSub)}`);
        const live = sub?.status === "active" || sub?.status === "trialing";
        const end = subEnd(sub);
        if (live && end) { r = { ...r, premiumUntil: new Date(end + 2 * 864e5).toISOString() }; await store.save(r); }
      } catch { /* Stripe unreachable: go by what's saved */ }
    }
    return { on: !!r.premiumUntil && Date.parse(r.premiumUntil) >= now(), row: r };
  }
  const needPremium = async (req: any) => {
    const id = me(req);
    const { on } = await premiumOf(req, await row(id));
    if (!on) throw new Refused("That's part of Arise Talk Premium.", 402);
    return id;
  };

  app.get("/api/talk/me", auth, wrap(async (req) => {
    const id = me(req);
    const { on, row: t } = await premiumOf(req, await row(id));
    return { premium: on, premiumUntil: t.premiumUntil, plan: t.plan, subscribed: !!t.stripeSub?.startsWith("sub_"), backupAt: t.data ? t.updatedAt : null, prices: PREMIUM };
  }));

  // ——— Backups ———
  app.get("/api/talk/backup", auth, wrap(async (req) => {
    const t = await row(me(req));
    return { data: t.data, updatedAt: t.data ? t.updatedAt : null };
  }));
  const backupLimit = createAttemptLimiter({ max: 120, windowMs: 60 * 60_000, now });
  app.put("/api/talk/backup", auth, wrap(async (req) => {
    const id = me(req);
    if (backupLimit.retryAfter(String(id)) > 0) throw new Refused("Backups are paused for a few minutes. Your words are safe on this phone.", 429);
    backupLimit.fail(String(id));
    const raw = req.body?.data;
    if (!raw || typeof raw !== "object") throw new Refused("Nothing to back up.");
    const data = cleanTalk(raw);
    const at = new Date(now()).toISOString();
    await store.save({ ...(await row(id)), data: { ...data, updatedAt: data.updatedAt }, updatedAt: at });
    return { backupAt: at };
  }));

  // ——— AI helpers (Premium) ———
  const aiLimit = createAttemptLimiter({ max: 150, windowMs: 60 * 60_000, now });
  const photoLimit = createAttemptLimiter({ max: 40, windowMs: 60 * 60_000, now });
  const limit = (l: ReturnType<typeof createAttemptLimiter>, id: number) => {
    if (l.retryAfter(String(id)) > 0) throw new Refused("That's a lot in a short time. Try again in a few minutes.", 429);
    l.fail(String(id));
  };
  const busy = (e: unknown) => { console.warn("[talk] AI:", (e as Error)?.message); return new Refused("The AI helper is busy. Try again in a moment.", 503); };

  app.post("/api/talk/ai/sentence", auth, wrap(async (req) => {
    const id = await needPremium(req);
    const words = String(req.body?.words ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
    if (!words) throw new Refused("Tap a few words first.");
    limit(aiLimit, id);
    const context = String(req.body?.context ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
    let out: string[];
    try { out = lines(json(await ai.chat(SENTENCE_PROMPT, `Words tapped: ${words}${context ? `\nWhat they're talking about: ${context}` : ""}`)).options, 3); }
    catch (e) { throw busy(e); }
    if (!out.length) throw busy(new Error("empty"));
    return { options: out };
  }));

  app.post("/api/talk/ai/replies", auth, wrap(async (req) => {
    const id = await needPremium(req);
    const heard = String(req.body?.heard ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
    if (!heard) throw new Refused("Nothing was heard. Try again.");
    limit(aiLimit, id);
    const name = String(req.body?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
    let out: string[];
    try { out = lines(json(await ai.chat(REPLIES_PROMPT, `${name ? `The person replying is called ${name}.\n` : ""}They heard: "${heard}"`)).replies, 6); }
    catch (e) { throw busy(e); }
    if (!out.length) throw busy(new Error("empty"));
    return { replies: out };
  }));

  app.post("/api/talk/ai/photo", auth, wrap(async (req) => {
    const id = await needPremium(req);
    const image = String(req.body?.image ?? "");
    if (!IMAGE.test(image) || image.length > 3_000_000) throw new Refused("That photo couldn't be read. Try another.");
    limit(photoLimit, id);
    let out: ReturnType<typeof cleanPhotoAnswer>;
    try { out = cleanPhotoAnswer(json(await ai.see(PHOTO_PROMPT, image))); }
    catch (e) { throw busy(e); }
    if (!out.words.length && !out.phrases.length) throw new Refused("Nothing could be picked out in that photo. Try a clearer one.", 422);
    return out;
  }));

  app.post("/api/talk/listen", auth, wrap(async (req) => {
    const id = await needPremium(req);
    const audio: Buffer = req.body;
    const mime = String(req.headers["content-type"] || "").split(";")[0].toLowerCase();
    if (!Buffer.isBuffer(audio) || audio.length < 800) throw new Refused("Nothing was recorded. Try again.");
    if (audio.length > 4_000_000) throw new Refused("That's too long. Keep it under half a minute.");
    if (!/^audio\//.test(mime)) throw new Refused("That recording couldn't be read.");
    limit(aiLimit, id);
    let text = "";
    try { text = (await ai.hear(audio, mime)).slice(0, 600); }
    catch (e) { throw busy(e); }
    return { text };
  }));

  // ——— Buying Premium (Stripe, on the website) ———
  const back = (req: any) => {
    const asked = String(req.body?.returnTo || "");
    try { const u = new URL(asked); if (u.protocol === "https:" && [new URL(deps.appUrl || SITE).host, "arisetodo.com", "www.arisetodo.com"].includes(u.host)) return u.origin + u.pathname; } catch { /* default */ }
    return (deps.appUrl || SITE).replace(/\/$/, "") + "/";
  };
  app.post("/api/talk/premium/checkout", auth, wrap(async (req) => {
    const id = me(req);
    const plan = req.body?.plan === "year" ? "year" : "month";
    const t = await row(id);
    if ((await premiumOf(req, t)).on && t.stripeSub?.startsWith("sub_")) throw new Refused("You already have Premium. Thank you!");
    const paidBefore = !!t.stripeCustomer;
    const base = back(req);
    const session = await stripe("POST", "/checkout/sessions", {
      mode: "subscription", client_reference_id: String(id), success_url: `${base}#/talk?premium={CHECKOUT_SESSION_ID}`, cancel_url: `${base}#/talk`,
      ...(t.stripeCustomer ? { customer: t.stripeCustomer } : { customer_email: req.user?.email || undefined }),
      line_items: { 0: { quantity: 1, price_data: { currency: "usd", unit_amount: plan === "year" ? PREMIUM.yearCents : PREMIUM.monthCents, recurring: { interval: plan }, product_data: { name: PREMIUM.name, description: "Listen and reply, smart sentences, snap to talk, all six AI voices and your own photos in Arise Talk." } } } },
      subscription_data: { ...(paidBefore ? {} : { trial_period_days: PREMIUM.trialDays }), metadata: { arise_talk: String(id), plan } },
      metadata: { arise_talk: String(id), plan },
    });
    // Remembered, so Premium turns on even if the payment page is closed before it comes back here.
    if (!t.stripeSub?.startsWith("sub_")) await store.save({ ...(await row(id)), stripeSub: String(session.id) });
    return { url: session.url };
  }));
  app.post("/api/talk/premium/confirm", auth, wrap(async (req) => {
    const id = me(req);
    const sid = String(req.body?.session || "");
    if (!/^cs_[A-Za-z0-9_]{8,200}$/.test(sid)) throw new Refused("That payment wasn't found.");
    const s = await stripe("GET", `/checkout/sessions/${sid}?expand%5B%5D=subscription`);
    if (String(s?.client_reference_id) !== String(id) && String(s?.metadata?.arise_talk) !== String(id)) throw new Refused("That payment belongs to someone else.", 403);
    const sub = s?.subscription;
    if (!(s?.status === "complete" && sub && (sub.status === "active" || sub.status === "trialing"))) throw new Refused("The payment hasn't gone through yet.", 409);
    const end = subEnd(sub) || now() + 31 * 864e5;
    const t = await row(id);
    await store.save({ ...t, plan: s?.metadata?.plan === "year" ? "year" : "month", stripeCustomer: String(s.customer || t.stripeCustomer || "") || null, stripeSub: String(sub.id), premiumUntil: new Date(end + 2 * 864e5).toISOString() });
    return { premium: true };
  }));
  app.post("/api/talk/premium/manage", auth, wrap(async (req) => {
    const t = await row(me(req));
    if (!t.stripeCustomer) throw new Refused("There's no Premium plan to manage yet.");
    const p = await stripe("POST", "/billing_portal/sessions", { customer: t.stripeCustomer, return_url: `${back(req)}#/talk` });
    return { url: p.url };
  }));
  app.post("/api/talk/admin/comp", auth, wrap(async (req) => {
    if (!deps.isAdmin?.(req)) throw new Refused("Only the site owner can do that.", 403);
    const userId = Number(req.body?.userId); const days = Math.max(1, Math.min(3650, Number(req.body?.days) || 30));
    if (!Number.isInteger(userId) || userId <= 0) throw new Refused("Which account?");
    const t = await row(userId);
    await store.save({ ...t, premiumUntil: new Date(Math.max(now(), t.premiumUntil ? Date.parse(t.premiumUntil) : 0) + days * 864e5).toISOString() });
    return { ok: true };
  }));
}
