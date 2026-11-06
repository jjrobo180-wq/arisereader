import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanDriveFiles, updateDriveFile, driveKind, driveFolders } from "../shared/driveApp";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const f = (o: any) => ({ id: "a", path: "u/a.pdf", name: "a.pdf", size: 10, contentType: "application/pdf", uploadedAt: "2026-11-01T00:00:00Z", ...o });

test("Drive keeps folders and stars, and can rename, move and star", () => {
  const [kept] = cleanDriveFiles([f({ folder: "Taxes", starred: true })]);
  assert.equal(kept.folder, "Taxes");
  assert.equal(kept.starred, true);
  const next = updateDriveFile([kept], "a", { name: "b.pdf", folder: "", starred: false });
  assert.equal(next[0].name, "b.pdf");
  assert.equal(next[0].starred, false);
  assert.deepEqual(driveFolders([f({ folder: "Z" }), f({ id: "b", folder: "A" }), f({ id: "c" })]), ["A", "Z"]);
});

test("Drive knows what kind each file is", () => {
  assert.equal(driveKind(f({ contentType: "image/heic", name: "x.heic" })), "photo");
  assert.equal(driveKind(f({ contentType: "video/quicktime", name: "x.mov" })), "video");
  assert.equal(driveKind(f({})), "pdf");
  assert.equal(driveKind(f({ contentType: "application/octet-stream", name: "x.mp3" })), "audio");
});

test("Drive uploads big files straight to storage with progress, not capped at 20 MB", () => {
  const ui = read("../client/src/components/family-hub/DriveApp.tsx");
  assert.ok(ui.includes("/api/lifehub/drive/upload-url"));
  assert.ok(ui.includes("xhr.upload.onprogress"));
  assert.ok(!ui.includes("slice(0, 10)"), "no 10-file cap");
  assert.ok(!/overflow-hidden[^"]*h-screen|h-\[100dvh\]/.test(ui), "Drive scrolls with the page");
  const server = read("../server/driveApp.ts");
  assert.ok(server.includes("createSignedUploadUrl"));
  assert.ok(server.includes("fileSizeLimit: MAX_DIRECT_BYTES"));
});
