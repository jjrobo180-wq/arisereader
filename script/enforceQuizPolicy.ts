import { readFile, writeFile } from "node:fs/promises";

const routesPath = "server/routes.ts";
const source = await readFile(routesPath, "utf8");

const oldPassing = 'return Math.ceil(total * (total > 10 ? 0.70 : 0.60));';
const newPassing = 'return Math.ceil(total * 0.70);';
const oldPoints = 'return Math.round((Number(bookPoints || 0) * (score / total)) * 10) / 10;';
const newPoints = 'return Number(bookPoints || 0);';

let next = source;
if (next.includes(oldPassing)) next = next.replace(oldPassing, newPassing);
if (next.includes(oldPoints)) next = next.replace(oldPoints, newPoints);

if (!next.includes(newPassing) || !next.includes(newPoints)) {
  throw new Error("Quiz scoring policy patch could not be verified in server/routes.ts");
}

if (next !== source) {
  await writeFile(routesPath, next, "utf8");
  console.log("[quiz-policy] 70%+ now earns the book's full point value.");
} else {
  console.log("[quiz-policy] scoring policy already applied.");
}
