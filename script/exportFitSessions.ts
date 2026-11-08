// Writes every guided Arise Fit session (shared/fitSessions.ts) to native/fit-tv/sessions.json, the list the
// Apple TV and Apple Watch apps play from. Run after changing a session: npx tsx script/exportFitSessions.ts
// (tests/fit-tv-watch.test.ts fails while the file and the sessions differ). The file was once committed
// empty, and Arise Fit on Apple TV showed its title over an empty screen.
import { writeFileSync } from "node:fs";
import { SESSIONS } from "../shared/fitSessions";

writeFileSync(new URL("../native/fit-tv/sessions.json", import.meta.url), JSON.stringify(SESSIONS) + "\n");
console.log(`native/fit-tv/sessions.json: ${SESSIONS.length} sessions`);
