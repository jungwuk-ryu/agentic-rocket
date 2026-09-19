import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
    const session = await store.create({
      repositoryUrl: "https://example.test/demo",
      goal: "test",
    });
    await Promise.all(
      Array.from({ length: 12 }, (_value, index) =>
        store.appendEvent(session.id, "verification", `event ${index}`),
      ),
    );

    const persisted = JSON.parse(
      await readFile(join(root, "sessions", `${session.id}.json`), "utf8"),
    );
    assert.equal(persisted.events.length, 12);
    assert.deepEqual(
      persisted.events.map((event) => event.id),
      Array.from({ length: 12 }, (_value, index) => index + 1),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reloads existing sessions and preserves full raw evidence with an integrity fingerprint", async () => {
  const root = await mkdtemp(join(tmpdir(), "agenticrocket-recovery-"));
  try {
    const store = new FileSessionStore(root);
    await store.init();
    const session = await store.create({
      repositoryUrl: "https://example.test/demo",
      goal: "retain evidence",
    });
    const content = Buffer.from(
      `${"full command output\n".repeat(1600)}final line\n`,
    );
    const artifact = await store.writeArtifact(
      session.id,
      "raw-command.log",
      content,
      "text/plain",
    );
    await store.mutate(session.id, (draft) => {
      draft.status = "running";
      draft.commands.push({
        id: "command-1",
        commandId: "remote-command-1",
        processSessionId: "remote-session-1",
        sandboxId: "sandbox-1",
        status: "running",
      });
    });

    const restarted = new FileSessionStore(root);
    await restarted.init();
    assert.deepEqual(
      (await restarted.recent()).map((entry) => entry.id),
      [session.id],
    );
    assert.equal(
      (await restarted.get(session.id)).commands[0].commandId,
      "remote-command-1",
    );
    const restored = await restarted.readArtifact(session.id, artifact.id);
    assert.ok(restored.data.length > 12_000);
    assert.deepEqual(restored.data, content);
    assert.equal(restored.data.at(-1), 10);
    assert.equal(
      restored.artifact.hash,
      createHash("sha256").update(content).digest("hex"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
