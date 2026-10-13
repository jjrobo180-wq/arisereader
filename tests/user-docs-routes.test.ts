// A.R.I.S.E. Office storage smoke tests: real Express routes, fake private storage.
// No production account or student data is used.
import test from "node:test";
import assert from "node:assert/strict";
import express, { type RequestHandler } from "express";
import { registerUserDocRoutes, type DocStore } from "../server/userDocs";

function mockStore() {
  const map = new Map<string, string>();
  const store: DocStore = {
    read: async (p) => map.get(p) ?? null,
    write: async (p, body) => { map.set(p, body); },
    remove: async (paths) => { paths.forEach((p) => map.delete(p)); },
    list: async (prefix) => [...map.keys()].filter((p) => p.startsWith(prefix + "/")).map((p) => p.slice(prefix.length + 1)),
  };
  return { store, map };
}
async function setup() {
  const { store, map } = mockStore();
  const app = express();
  app.use(express.json({ limit: "12mb" }));
  const auth: RequestHandler = (req: any, res, next) => {
    const u = req.header("x-test-user");
    if (!u) return res.status(401).json({ message: "Sign in" });
    req.user = { id: u };
    next();
  };
  registerUserDocRoutes(app, auth, store);
  const listener = app.listen(0);
  await new Promise<void>((resolve) => listener.once("listening", resolve));
  const addr = listener.address();
  if (!addr || typeof addr === "string") throw Error("No test port");
  const root = "http://127.0.0.1:" + addr.port;
  async function send(path: string, user: string | null, method = "GET", data?: unknown) {
    const res = await fetch(root + path, {
      method,
      headers: {
        ...(user ? { "x-test-user": user } : {}),
        ...(data !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    const json = await res.json();
    return { status: res.status, data: json };
  }
  return { send, map, close: () => new Promise<void>((resolve) => listener.close(() => resolve())) };
}
test("Office: users can create, edit, list, trash and restore files without sharing access", async () => {
  const api = await setup();
  try {
    assert.equal((await api.send("/api/docs", null)).status, 401);
    assert.deepEqual((await api.send("/api/docs", "user-a")).data.docs, []);
    const created = await api.send("/api/docs", "user-a", "POST", { kind: "sheet", name: "Budget", content: { tabs: [{ cells: [["10","=SUM(A1:A1)"]] }] } });
    assert.equal(created.status, 200);
    const id: string = created.data.doc.id;
    assert.ok(/^[a-z0-9]{20}$/.test(id));
    assert.equal((await api.send("/api/docs", "user-b")).data.docs.length, 0, "other user sees no files");
    assert.equal((await api.send("/api/docs/" + id, "user-b")).status, 404);
    const opened = await api.send("/api/docs/" + id, "user-a");
    assert.equal(opened.status, 200);
    assert.equal(opened.data.content.tabs[0].cells[0][0], "10");
    const staleVersion = "2020-01-01T00:00:00.000Z";
    assert.equal((await api.send("/api/docs/" + id, "user-a", "PUT", {
      baseUpdatedAt: staleVersion, content: { tabs: [] }
    })).status, 409, "second-device stale saves are rejected");
    const saved = await api.send("/api/docs/" + id, "user-a", "PUT", {
      baseUpdatedAt: opened.data.updatedAt, name: "Budget 2026", content: { tabs: [{ cells: [["15"]] }] }
    });
    assert.equal(saved.status, 200);
    assert.equal((await api.send("/api/docs/" + id, "user-a")).data.content.tabs[0].cells[0][0], "15");
    assert.equal((await api.send("/api/docs/" + id, "user-b", "PUT", {
      content: { tabs: [] }
    })).status, 404);
    assert.equal((await api.send("/api/docs/" + id, "user-a", "DELETE")).status, 200);
    assert.equal((await api.send("/api/docs", "user-a")).data.docs.length, 0);
    assert.equal((await api.send("/api/docs?trash=1", "user-a")).data.docs.length, 1);
    assert.equal((await api.send("/api/docs/" + id + "/restore", "user-a", "POST")).status, 200);
    assert.equal((await api.send("/api/docs", "user-a")).data.docs.length, 1);
  } finally { await api.close(); }
});
test("AI App data is isolated by user and saves across requests", async () => {
  const api = await setup();
  try {
    const url = "/api/app-data/premium-studio-v1";
    assert.deepEqual((await api.send(url, "person-1")).data.data, null);
    assert.equal((await api.send(url, "person-1", "PUT", { data: [{ id: "entry1", text: "Example" }] })).status, 200);
    assert.equal((await api.send(url, "person-1")).data.data[0].text, "Example");
    assert.equal((await api.send(url, "person-2")).data.data, null);
    assert.equal((await api.send(url, null, "PUT", { data: "bad" })).status, 401);
  } finally { await api.close(); }
});
