// The November 2026 5-Minute Reads: 100 new kid-friendly pieces across every category. Each batch is built
// by shared/funReadsKit.ts; they join QUICK_READS (shared/quickReads.ts) and become 5-point library quizzes.
// Check them with `npx tsx script/checkFunReads.ts`.
import type { NewsArticle } from "./ariseNews";
import { FUN_HISTORY } from "./funReadsHistory";
import { FUN_PEOPLE } from "./funReadsPeople";
import { FUN_STARS } from "./funReadsStars";
import { FUN_SPORTS } from "./funReadsSports";
import { FUN_SCIENCE } from "./funReadsScience";
import { FUN_SPACE } from "./funReadsSpace";
import { FUN_NATURE } from "./funReadsNature";
import { FUN_INVENTIONS } from "./funReadsInventions";
import { FUN_ARTS } from "./funReadsArts";
import { FUN_FACTS } from "./funReadsFunFacts";

export const FUN_READS: NewsArticle[] = [
  ...FUN_HISTORY, ...FUN_PEOPLE, ...FUN_STARS, ...FUN_SPORTS, ...FUN_SCIENCE,
  ...FUN_SPACE, ...FUN_NATURE, ...FUN_INVENTIONS, ...FUN_ARTS, ...FUN_FACTS,
];
