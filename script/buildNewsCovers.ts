// Writes a library cover for every Arise News story to client/public/covers/news.
// Run after adding a story:  npx tsx script/buildNewsCovers.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NEWS_ARTICLES } from "../shared/ariseNews";
import { newsCoverSvg } from "../shared/newsArt";

const dir = join(process.cwd(), "client/public/covers/news");
mkdirSync(dir, { recursive: true });
for (const a of NEWS_ARTICLES) writeFileSync(join(dir, `${a.slug}.svg`), newsCoverSvg(a));
console.log(`wrote ${NEWS_ARTICLES.length} covers to ${dir}`);
