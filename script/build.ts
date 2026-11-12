import path from "node:path";
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "node:fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function verifyTts() {
  if (process.env.VERIFY_TTS_ON_BUILD !== "true") return;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("[tts-build-check] skipped: OPENAI_API_KEY missing");
    return;
  }
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "marin",
        input: "Voice check.",
        response_format: "mp3",
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.log("[tts-build-check] failed:", response.status, detail.slice(0, 500));
      return;
    }
    const bytes = (await response.arrayBuffer()).byteLength;
    console.log("[tts-build-check] success: generated", bytes, "bytes of audio");
  } catch (error: any) {
    console.log("[tts-build-check] error:", error?.message || String(error));
  }
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  // Podster's website, served on arisetodo.com at /podster/ (homepage, /podster/app/, /podster/creators/).
  console.log("building podster...");
  process.env.PODSTER_BASE = "/podster/";
  try {
    await viteBuild({ configFile: "podscroll/vite.config.ts", build: { outDir: path.resolve("dist/public/podster"), emptyOutDir: true } });
  } finally {
    delete process.env.PODSTER_BASE;
  }
  // Every page link and file must stay inside /podster/, or it would open a To Duo page instead.
  for (const page of ["index.html", "app/index.html", "creators/index.html"]) {
    const html = await readFile(path.resolve("dist/public/podster", page), "utf-8");
    const stray = html.match(/(?:href|src)="\/(?!podster\/|\/)[^"]*"/g);
    if (stray) throw new Error(`podster/${page} links outside /podster/: ${stray.slice(0, 5).join(", ")}`);
    if (page === "app/index.html" && !html.includes('"/podster/assets/')) throw new Error(`podster/${page} has no /podster/assets/ files`);
  }
  console.log("podster built at /podster/");

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await verifyTts();

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
