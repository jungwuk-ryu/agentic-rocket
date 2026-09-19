import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SessionRunner } from "../server/lib/runner.mjs";
import { FileSessionStore } from "../server/lib/store.mjs";
import { REPOSITORY_URL } from "../server/lib/project.mjs";

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test("runner permits separate sessions to be active together", { timeout: 10000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "agenticrocket-concurrency-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new FileSessionStore(directory);
  await store.init();
  const first = await store.create({ repositoryUrl: REPOSITORY_URL, goal: "first" });
  const second = await store.create({ repositoryUrl: REPOSITORY_URL, goal: "second" });
  const created = deferred();
  const release = deferred();
  let sandboxNumber = 0;
  const daytona = {
    async create() {
      created.resolve();
      await release.promise;
      sandboxNumber += 1;
      return {
        id: `sandbox-${sandboxNumber}`,
        async stop() {},
        async delete() {},
      };
    },
  };
  const runner = new SessionRunner({
    store,
    daytona,
    llm: { async complete() { throw new Error("The model must not run before sandbox allocation."); } },
    config: {
      credentialsReady: true,
      proxyBaseUrl: "http://unused.invalid/v1",
      proxyApiKey: "unused",
      model: "unused",
    },
  });

  await runner.start(first.id);
  await created.promise;
  await runner.start(second.id);

  assert.equal(runner.isActive(first.id), true);
  assert.equal(runner.isActive(second.id), true);

  await runner.cancel(first.id);
  await runner.cancel(second.id);
  release.resolve();
  await Promise.all([runner.waitForIdle(first.id), runner.waitForIdle(second.id)]);
  assert.equal(runner.isActive(first.id), false);
  assert.equal(runner.isActive(second.id), false);
});
