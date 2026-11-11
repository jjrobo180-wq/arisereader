// Arise WorkHub: the AI version of the IEP Writer. The template writer (shared/iepWriter) writes the whole IEP from
// the teacher's drop boxes; this asks the AI to write the same sections again in warmer, more individual wording,
// in the same order, under the same headings, using only the facts in the template's text. The teacher then picks
// the template's or the AI's wording for each section (client/src/components/teacher-hub/HubIepWriter.tsx).
import type { Express, RequestHandler } from "express";

type InSection = { id?: unknown; title?: unknown; paragraphs?: unknown; bullets?: unknown };
export type AiSection = { id: string; paragraphs: string[]; bullets: string[] };
const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const strs = (v: unknown, n: number, each: number) => (Array.isArray(v) ? v : []).map((x) => clip(x, each)).filter(Boolean).slice(0, n);

export const IEP_AI_PROMPT = `You are an experienced special education teacher improving a draft IEP. You get the draft, section by section, already in the school's template order.
Rewrite each section so it reads like a thoughtful teacher wrote it about this one child: specific, warm, plain, strengths-based, no jargon pile-ups.
Rules: keep every section id, in the same order. Use ONLY facts, numbers, dates, services, minutes and goals that are in the draft; never invent data. Keep every blank (____) exactly as it is.
Keep goals measurable (condition, behavior, criterion, how it is measured, by when) and keep every objective. Keep bullets as bullets. Do not add new sections, tables or headings.
Reply with JSON only: {"sections": [{"id": "...", "paragraphs": ["..."], "bullets": ["..."]}]}`;

/** What the AI sent back, made safe: only the sections that were asked for, plain text, bounded. */
export function cleanAiSections(raw: unknown, ids: string[]): AiSection[] {
  const list: any[] = Array.isArray((raw as any)?.sections) ? (raw as any).sections : [];
  const out: AiSection[] = [];
  for (const id of ids) {
    const s = list.find((x) => x && x.id === id);
    if (!s) continue;
    const paragraphs = strs(s.paragraphs, 12, 2500), bullets = strs(s.bullets, 30, 800);
    if (paragraphs.length || bullets.length) out.push({ id, paragraphs, bullets });
  }
  return out;
}

async function askOpenAI(system: string, user: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1", temperature: 0.3, max_tokens: 9000, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(110_000),
  });
  if (!response.ok) throw new Error(response.status === 429 ? "The AI is busy right now. Try again in a minute." : "The AI could not write the IEP. Try again.");
  const payload: any = await response.json().catch(() => null);
  return String(payload?.choices?.[0]?.message?.content || "");
}

export function registerIepAiRoutes(app: Express, authMiddleware: RequestHandler, deps: { askAI?: (system: string, user: string) => Promise<string> } = {}): void {
  const askAI = deps.askAI ?? askOpenAI;
  app.post("/api/teacher-hub/iep-ai", authMiddleware, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    if (!(req.user && (req.user.role === "teacher" || req.user.isAdmin) && !req.adminPreview)) return res.status(403).json({ message: "Only teachers can use the IEP Writer." });
    const sections: InSection[] = (Array.isArray(req.body?.sections) ? req.body.sections : []).slice(0, 30);
    const ids = sections.map((s) => clip(s?.id, 40)).filter(Boolean);
    if (!ids.length) return res.status(400).json({ message: "Write the IEP with the template first." });
    if (!process.env.OPENAI_API_KEY && !deps.askAI) return res.status(503).json({ message: "AI is not set up on this site yet." });
    const text = sections.map((s) => `### ${clip(s.id, 40)} | ${clip(s.title, 120)}\n${strs(s.paragraphs, 20, 3000).join("\n")}${strs(s.bullets, 40, 900).map((b) => `\n- ${b}`).join("")}`).join("\n\n").slice(0, 60_000);
    try {
      const sectionsOut = cleanAiSections(JSON.parse(await askAI(IEP_AI_PROMPT, text)), ids);
      if (!sectionsOut.length) return res.status(502).json({ message: "The AI's IEP didn't come out right. Try again." });
      return res.json({ sections: sectionsOut });
    } catch (e: any) {
      console.error("[iep-ai] failed:", e?.message || e);
      return res.status(502).json({ message: e?.message || "The AI could not write the IEP. Try again." });
    }
  });
}
