// Checks the November 2026 5-Minute Reads batches: length, glossary, quiz shape, answer spread and wording.
// Usage: npx tsx script/checkFunReads.ts [module ...]   (default: every shared/funReads*.ts batch)
import { newsWordCount, newsReadMinutes, type NewsArticle } from "../shared/ariseNews";
const mods = process.argv.slice(2).length ? process.argv.slice(2) : ["History", "People", "Stars", "Sports", "Science", "Space", "Nature", "Inventions", "Arts", "FunFacts"];
const offLimits = /\b(trump|israel|gaza|palestin|election|democrat|republican|church|mosque|temple|religio|god|prayer|war|bomb|kids|kill|killed|gun|guns|drunk|beer|wine|sexy|hell|damn|stupid|dumb)\b/i;
let bad = 0, total = 0;
(async () => {
  for (const m of mods) {
    const mod = await import(`../shared/funReads${m}.ts`);
    const list = Object.values(mod).find(Array.isArray) as NewsArticle[];
    for (const a of list) {
      total++;
      const errs: string[] = [];
      const n = newsWordCount(a);
      if (n < 585 || n > 650) errs.push(`${n} words`);
      if (newsReadMinutes(a) !== 5) errs.push(`${newsReadMinutes(a)} min`);
      if (a.dek.length <= 30 || a.dek.length >= 130) errs.push(`dek ${a.dek.length}`);
      const body = JSON.stringify(a.body).toLowerCase();
      for (const w of a.words) if (!body.includes(w.word.toLowerCase())) errs.push(`glossary "${w.word}" missing`);
      if (a.questions.length !== 5) errs.push("not 5 questions");
      for (const q of a.questions) if (new Set(q.options).size !== 4) errs.push(`dup options: ${q.question}`);
      if (new Set(a.questions.map((q) => q.correct)).size < 3) errs.push("answer key predictable");
      const text = [a.title, a.dek, JSON.stringify(a.body), JSON.stringify(a.questions)].join(" ");
      const hit = text.match(offLimits); if (hit) errs.push(`word "${hit[0]}"`);
      if (!/\.(jpe?g|png)$/i.test(a.photo?.file || "")) errs.push("photo not jpg/png");
      if (errs.length) { bad++; console.log(`${m} ${a.slug}: ${errs.join("; ")}`); }
      else console.log(`ok ${m} ${a.slug} (${n})`);
    }
  }
  console.log(`${total - bad}/${total} pass`);
})();
