import { test } from "node:test";
import assert from "node:assert/strict";
import { readFocusLink, widgetGoHash } from "../client/src/lib/duoFocus.ts";
import { duoLinks } from "../client/src/lib/duoBoard.ts";

test("a widget tap names its hub, section and task", () => {
  const g = readFocusLink("arisetodo://focus/go?hub=work&to=calendar");
  assert.deepEqual(g, { kind: "go", hub: "work", to: "calendar", view: "", task: "" });
  assert.equal(widgetGoHash(g as any), "#/workhub?go=calendar");
  const t = readFocusLink("arisetodo://focus/go?hub=life&to=tasks&view=today&task=abc123");
  assert.equal(widgetGoHash(t as any), "#/lifehub?go=tasks&view=today&task=abc123");
});

test("unknown sections fall back to tasks; old widget links still work", () => {
  assert.equal((readFocusLink("arisetodo://focus/go?hub=x&to=nope") as any).to, "tasks");
  assert.equal((readFocusLink("arisetodo://focus/go?hub=x&to=nope") as any).hub, "life");
  assert.deepEqual(readFocusLink("arisetodo://focus/tasks"), { kind: "tasks" });
  assert.deepEqual(readFocusLink("arisetodo://focus/add"), { kind: "add" });
  assert.deepEqual(readFocusLink("arisetodo://focus/done?id=a"), { kind: "done", id: "a" });
});

test("the Links widget only gets web links", () => {
  const out = duoLinks([
    { id: "1", title: "Classroom", url: "https://classroom.google.com", emoji: "🎓" },
    { id: "2", title: "Bad", url: "javascript:alert(1)" },
    { id: "3", title: "Mail", url: "mailto:a@b.c" },
    { id: "4", title: "", url: "http://example.com/x" },
  ]);
  assert.deepEqual(out.map((l) => l.id), ["1", "4"]);
});
