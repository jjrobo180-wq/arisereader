// Writes every guided Cooked session (shared/fitSessions.ts) to native/fit-tv/sessions.json, the list the
// Apple TV and Apple Watch apps play from. Run after changing a session: npx tsx script/exportFitSessions.ts
// (tests/tv-and-watch.test.ts fails while the file and the sessions differ). The file was once committed
// empty, and Cooked on Apple TV showed its title over an empty screen.
import { writeFileSync } from "node:fs";
import { SESSIONS } from "../shared/fitSessions";
import { TIMER_PRESETS, timerSession } from "../shared/fitTimers";

writeFileSync(new URL("../native/fit-tv/sessions.json", import.meta.url), JSON.stringify(SESSIONS) + "\n");
// The built-in interval timers too, so the TV has them before anyone signs in.
writeFileSync(new URL("../native/fit-tv/timers.json", import.meta.url), JSON.stringify(TIMER_PRESETS.map(timerSession)) + "\n");
console.log(`native/fit-tv/sessions.json: ${SESSIONS.length} sessions; timers.json: ${TIMER_PRESETS.length} timers`);
