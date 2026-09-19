import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SessionRunner } from "../server/lib/runner.mjs";
import { FileSessionStore } from "../server/lib/store.mjs";
import {
  PROJECT_CONTRACT,
  REPOSITORY_URL,
  fingerprint,
} from "../server/lib/project.mjs";
import { VERIFICATION_POLICY } from "../server/lib/verdict.mjs";

const patch = Buffer.from(
  "diff --git a/src/analyzer.cpp b/src/analyzer.cpp\n--- a/src/analyzer.cpp\n+++ b/src/analyzer.cpp\n@@ -1 +1 @@\n-int value = 1;\n+int value = 2;\n",
);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

async function fixture(
  t,
  {
    candidateChecksum = "111",
    createGate,
    llm,
    config = {},
    sourceOutput = "",
  } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "agenticrocket-runner-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new FileSessionStore(directory);
  await store.init();
  const session = await store.create({
    repositoryUrl: REPOSITORY_URL,
    goal: "Optimize without changing output.",
  });
  const calls = { creates: [], commands: [], uploads: [], cleanup: [] };
  const daytona = {
    async create(options) {
      const sandbox = {
        id: `sandbox-${calls.creates.length + 1}`,
        fs: {
          async uploadFile(bytes, path) {
            calls.uploads.push({ bytes: Buffer.from(bytes), path });
          },
        },
        async getWorkDir() {
          return "/project";
        },
        async stop() {
          calls.cleanup.push({ id: sandbox.id, action: "stop" });
        },
        async delete() {
          calls.cleanup.push({ id: sandbox.id, action: "delete" });
        },
      };
      calls.creates.push({ ...options, id: sandbox.id });
      if (createGate) {
        createGate.entered.resolve();
        await createGate.release.promise;
      }
      return sandbox;
    },
  };
  const executor = {
    async run(id, sandbox, command, cwd, { label, signal }) {
      signal.throwIfAborted();
      calls.commands.push({ id, sandboxId: sandbox.id, command, cwd, label });
      let stdout = "";
      if (label.endsWith("contract-integrity") || label === "candidate-files")
        stdout = "src/analyzer.cpp\n";
      else if (label === "baseline-sha") stdout = `${"a".repeat(40)}\n`;
      else if (label === "candidate-patch") stdout = patch.toString("base64");
      else if (label === "read_file") stdout = sourceOutput;
      else if (command === PROJECT_CONTRACT.outputCommand)
        stdout = "route=/users/:id count=1\n";
      else if (command === PROJECT_CONTRACT.benchmarkCommand) {
        const candidate = cwd.endsWith("/candidate");
        stdout = `records=6000\niterations=3\nmedian_ms=${candidate ? 60 : 100}\nmean_ms=100\nchecksum=${candidate ? candidateChecksum : "111"}\n`;
      }
      return {
        exitCode: 0,
        stdout,
        commandId: `command-${calls.commands.length}`,
      };
    },
  };
  const runner = new SessionRunner({
    store,
    daytona,
    executor,
    config: {
      credentialsReady: true,
      proxyBaseUrl: "http://unused.invalid/v1",
      proxyApiKey: "unused",
      model: "unused",
      ...config,
    },
    llm: llm || {
      async complete() {
        throw new Error("Unexpected model call");
      },
    },
  });
  const freeze = async () => {
    const artifact = await store.writeArtifact(
      session.id,
      "candidate.patch",
      patch,
      "text/x-diff",
    );
    await store.mutate(session.id, async (draft) => {
      draft.baselineSha = "a".repeat(40);
      draft.contract = structuredClone(PROJECT_CONTRACT);
      draft.calibration = {
        samples: [100, 100, 100],
        checksum: "111",
        output: "route=/users/:id count=1\n",
        cvPct: 0,
      };
      draft.policy = { ...VERIFICATION_POLICY, calibrationCvPct: 0 };
      draft.candidate = {
        id: "candidate-1",
        summary: "Avoid repeated parsing.",
        fingerprint: fingerprint(patch),
        patchArtifactId: artifact.id,
      };
      draft.status = "completed";
    });
  };
  return { store, session, runner, calls, freeze };
}

test(
  "remeasurement preserves patch bytes and rejects mismatching checksums despite successful commands",
  { timeout: 10000 },
  async (t) => {
    const { runner, store, session, calls, freeze } = await fixture(t, {
      candidateChecksum: "999",
    });
    await freeze();
    await runner.retryVerification(session.id);
    await runner.waitForIdle(session.id);

    const result = await store.get(session.id);
    assert.equal(calls.creates.length, 3);
    assert.equal(calls.uploads.length, 3);
    for (const upload of calls.uploads)
      assert.deepEqual(upload.bytes, patch, "including the final newline");
    assert.equal(result.verification.verdict, "rejected");
    for (const run of result.verification.runs) {
      assert.equal(run.testsPassed, true);
      assert.equal(run.outputPassed, false);
      assert.equal(run.outcome, "correctness-failed");
      assert.match(run.error, /checksum mismatch/);
    }
    assert.equal(
      calls.cleanup.filter(({ action }) => action === "delete").length,
      3,
    );
    assert.ok(result.candidate.summary.includes("repeated parsing"));
  },
);

test(
  "cancellation during sandbox creation remains terminal and cleans the late-created resource",
  { timeout: 10000 },
  async (t) => {
    const createGate = { entered: deferred(), release: deferred() };
    const { runner, store, session, calls } = await fixture(t, { createGate });
    await runner.start(session.id);
    await createGate.entered.promise;
    await runner.cancel(session.id);
    createGate.release.resolve();
    await runner.waitForIdle(session.id);

    const result = await store.get(session.id);
    assert.equal(result.status, "cancelled");
    assert.equal(result.verification, null);
    assert.equal(
      calls.creates.length,
      1,
      "no verification sandboxes are created after cancellation",
    );
    assert.equal(calls.commands.length, 0);
    assert.deepEqual(calls.cleanup, [{ id: "sandbox-1", action: "stop" }]);
    assert.equal(result.sandboxes[0].cleanup, "stopped");
    assert.equal(runner.isActive(session.id), false);
    assert.equal(runner.activeProject(), null);
  },
);

test(
  "follow-up remeasurement executes tools with prior conversation and actual diff",
  { timeout: 10000 },
  async (t) => {
    const modelCalls = [];
    const llm = {
      async complete(messages, tools) {
        modelCalls.push({ messages: structuredClone(messages), tools });
        if (modelCalls.length === 1)
          return {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "measure-again",
                type: "function",
                function: { name: "remeasure_candidate", arguments: "{}" },
              },
            ],
          };
        return {
          role: "assistant",
          content: "The same patch was measured again in three sandboxes.",
        };
      },
    };
    const { runner, store, session, calls, freeze } = await fixture(t, { llm });
    await freeze();
    await store.mutate(session.id, async (draft) => {
      draft.messages.push({
        role: "user",
        content: "Keep the existing parser behavior.",
      });
      draft.messages.push({
        role: "assistant",
        content: "I will preserve the parser contract.",
      });
    });
    await runner.replyToFollowUp(session.id, "Remeasure this patch.");
    await runner.waitForIdle(session.id);

    const result = await store.get(session.id);
    assert.equal(modelCalls.length, 2);
    assert.ok(
      modelCalls[0].tools.some(
        ({ function: definition }) => definition.name === "remeasure_candidate",
      ),
    );
    assert.ok(
      modelCalls[0].messages.some(
        ({ content }) => content === "Keep the existing parser behavior.",
      ),
    );
    assert.equal(
      JSON.parse(modelCalls[0].messages[1].content).diff,
      patch.toString("utf8"),
    );
    assert.ok(
      modelCalls[1].messages.some(
        ({ role, tool_call_id }) =>
          role === "tool" && tool_call_id === "measure-again",
      ),
    );
    assert.equal(calls.creates.length, 3);
    assert.ok(
      calls.commands.length > 0,
      "follow-up must perform work, not merely describe it",
    );
    assert.equal(result.verification.verdict, "verified");
    for (const run of result.verification.runs) {
      assert.deepEqual(run.commandOrder, PROJECT_CONTRACT.order);
      assert.equal(run.warmups.length, 2);
      assert.equal(run.baselineSamples.length, 3);
      assert.equal(run.candidateSamples.length, 3);
      assert.ok(calls.creates.some(({ id }) => id === run.sandboxId));
    }
    assert.deepEqual(result.pendingMessages, []);
    assert.match(result.messages.at(-1).content, /measured again/);
  },
);

test(
  "forced compaction preserves full retrievable evidence and resumes at a valid tool boundary",
  { timeout: 10000 },
  async (t) => {
    const sourceOutput = `${"source line\n".repeat(3000)}FULL_OUTPUT_TAIL`;
    const requests = [];
    let context;
    let archivedHistoryId;
    let originalOutputId;
    const llm = {
      async complete(messages) {
        requests.push(structuredClone(messages));
        let name;
        let args;
        if (requests.length === 1) {
          name = "read_file";
          args = { path: "src/analyzer.cpp" };
        } else if (requests.length === 2) {
          const compact = JSON.parse(messages[1].content);
          archivedHistoryId = compact.originalHistoryArtifactId;
          const archived = JSON.parse(
            (
              await context.store.readArtifact(
                context.session.id,
                archivedHistoryId,
              )
            ).data,
          );
          originalOutputId = JSON.parse(
            archived.find(({ role }) => role === "tool").content,
          ).artifactId;
          const { data } = await context.store.readArtifact(
            context.session.id,
            originalOutputId,
          );
          name = "read_artifact";
          args = {
            artifactId: originalOutputId,
            offset: data.toString("utf8").length - 100,
            length: 100,
          };
        } else {
          name = "finish_candidate";
          args = {
            summary: "Avoid repeated parsing after reading preserved evidence.",
          };
        }
        return {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: `compact-tool-${requests.length}`,
              type: "function",
              function: { name, arguments: JSON.stringify(args) },
            },
          ],
        };
      },
    };
    context = await fixture(t, {
      llm,
      sourceOutput,
      config: { contextSoftLimit: 1, maxAgentTurns: 4 },
    });
    await context.runner.start(context.session.id);
    await context.runner.waitForIdle(context.session.id);

    const result = await context.store.get(context.session.id);
    assert.equal(result.status, "completed", result.error);
    assert.equal(requests.length, 3);
    for (const messages of requests.slice(1)) {
      assert.deepEqual(
        messages.map(({ role }) => role),
        ["system", "user"],
        "compact starts without orphan tool calls/results",
      );
      const compact = JSON.parse(messages[1].content);
      assert.equal(compact.checkpoint.baselineSha, "a".repeat(40));
      assert.equal(
        compact.checkpoint.contract.version,
        PROJECT_CONTRACT.version,
      );
      assert.ok(compact.originalHistoryArtifactId);
    }
    const originalOutput = JSON.parse(
      (await context.store.readArtifact(result.id, originalOutputId)).data,
    );
    assert.equal(
      originalOutput.stdout,
      sourceOutput,
      "context preview truncation must not truncate the original artifact",
    );
    const history = JSON.parse(
      (await context.store.readArtifact(result.id, archivedHistoryId)).data,
    );
    assert.equal(history.at(-2).tool_calls[0].id, history.at(-1).tool_call_id);
    const readBack = result.artifacts.find(
      ({ filename }) => filename === "tool-compact-tool-2.json",
    );
    assert.match(
      JSON.parse(
        (await context.store.readArtifact(result.id, readBack.id)).data,
      ).content,
      /FULL_OUTPUT_TAIL/,
    );
    assert.equal(result.baselineSha, "a".repeat(40));
    assert.equal(result.candidate.fingerprint, fingerprint(patch));
    assert.equal(
      result.verification.candidateFingerprint,
      result.candidate.fingerprint,
    );
    assert.ok(
      result.checkpoints.some(({ reason }) => reason === "context-compact"),
    );
  },
);
