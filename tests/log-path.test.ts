// Run with: npx tsx --test tests/log-path.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { loggablePath } from "../server/logPath";

test("the secret in a private link never reaches the logs", () => {
  const secret = "k3J9xQ2mZp7vL0aB8cD4eF6gH1iN5oR";
  assert.equal(loggablePath(`/api/meeting-poll/${secret}`), "/api/meeting-poll/:token");
  assert.equal(loggablePath(`/api/meeting-poll/${secret}/claim`), "/api/meeting-poll/:token/claim");
  assert.equal(loggablePath(`/api/integrity/live/${secret}/events`), "/api/integrity/live/:token/events");
  assert.equal(loggablePath(`/api/fyp/share/${secret}`), "/api/fyp/share/:token");
  assert.equal(loggablePath(`/meet/${secret}`), "/meet/:token");
});

test("every other path is logged as it is", () => {
  for (const path of ["/api/teacher-hub/workspace", "/api/teacher-hub/polls/abc/choose", "/api/me", "/api/meeting-poll", "/"]) assert.equal(loggablePath(path), path);
});
