import { readFile, writeFile } from "node:fs/promises";

const routesPath = "server/routes.ts";
const storagePath = "server/storage.ts";
const quizPath = "client/src/pages/Quiz.tsx";

const [routesSource, storageSource, quizSource] = await Promise.all([
  readFile(routesPath, "utf8"),
  readFile(storagePath, "utf8"),
  readFile(quizPath, "utf8"),
]);

let routesNext = routesSource
  .replace(
    'return Math.ceil(total * (total > 10 ? 0.70 : 0.60));',
    'return Math.ceil(total * 0.70);',
  )
  .replace(
    'return Math.round((Number(bookPoints || 0) * (score / total)) * 10) / 10;',
    'return Number(bookPoints || 0);',
  );

let storageNext = storageSource
  .replace(
    'const passingPercent = total > 10 ? 0.70 : 0.60;\n    const passingScore = Math.ceil(total * passingPercent);',
    'const passingScore = Math.ceil(total * 0.70);',
  )
  .replace(
    'const pointsEarned = passed && total > 0\n      ? Math.round((bookPoints * (score / total)) * 10) / 10\n      : 0;',
    'const pointsEarned = passed && total > 0 ? bookPoints : 0;',
  );

let quizNext = quizSource.replace(
  'Math.ceil(alreadyTaken.total * (alreadyTaken.total > 10 ? 0.70 : 0.60))',
  'Math.ceil(alreadyTaken.total * 0.70)',
);

if (!routesNext.includes('return Math.ceil(total * 0.70);') ||
    !routesNext.includes('return Number(bookPoints || 0);')) {
  throw new Error("Quiz policy verification failed in server/routes.ts");
}
if (!storageNext.includes('const passingScore = Math.ceil(total * 0.70);') ||
    !storageNext.includes('const pointsEarned = passed && total > 0 ? bookPoints : 0;')) {
  throw new Error("Quiz policy verification failed in server/storage.ts");
}
if (!quizNext.includes('Math.ceil(alreadyTaken.total * 0.70)')) {
  throw new Error("Quiz policy verification failed in client/src/pages/Quiz.tsx");
}

await Promise.all([
  routesNext !== routesSource ? writeFile(routesPath, routesNext, "utf8") : Promise.resolve(),
  storageNext !== storageSource ? writeFile(storagePath, storageNext, "utf8") : Promise.resolve(),
  quizNext !== quizSource ? writeFile(quizPath, quizNext, "utf8") : Promise.resolve(),
]);

console.log("[quiz-policy] verified: 70%+ earns the book's full point value across API, persistence, and UI.");
