import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileSessionStore } from "../server/lib/store.mjs";

test("serializes concurrent session writes without dropping evidence", async () => {
  const root = await mkdtemp(join(tmpdir(), "agenticrocket-store-"));
  try {
    const store = new FileSessionStore(root);
    await store.init();
    const session = await store.create({ repositoryUrl: "https://example.test/demo", goal: "test" });
    await Promise.all(Array.from({ length: 12 }, (_value, index) => store.appendEvent(session.id, "verification", `event ${index}`)));

    const persisted = JSON.parse(await readFile(join(root, "sessions", `${session.id}.json`), "utf8"));
    assert.equal(persisted.events.length, 12);
    assert.deepEqual(persisted.events.map((event) => event.id), Array.from({ length: 12 }, (_value, index) => index + 1));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
