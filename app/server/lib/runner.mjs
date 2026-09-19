import { randomUUID } from "node:crypto";
import { Daytona } from "@daytona/sdk";
import { OpenAICompatibleClient, boundedToolResult } from "./llm.mjs";
import { SandboxExecutor, checkCancelled } from "./execution.mjs";
import {
  evaluatePairedVerification,
  VERIFICATION_POLICY,
  coefficientOfVariation,
} from "./verdict.mjs";
import {
  REPOSITORY_URL,
  PROJECT_CONTRACT,
  ENVIRONMENT_COMMAND,
  CorrectnessError,
  fingerprint,
  rawOutput,
  shellQuote,
  uploadText,
  assertSourceOnly,
  parseBenchmark,
  assertSameOutput,
  assertSuccessful,
} from "./project.mjs";

const tool = (name, description, properties = {}) => ({
  type: "function",
  function: {
    name,
    description,
    strict: true,
    parameters: {
      type: "object",
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    },
  },
});
const string = { type: "string" };
const AGENT_TOOLS = [
  tool("list_files", "List the project's tracked files."),
  tool(
    "read_file",
    "Read a repository file; full output is saved as an artifact.",
    { path: string },
  ),
  tool(
    "run_command",
    "Inspect or validate the work repository; the service independently enforces its fixed verification contract.",
    {
      command: string,
      timeoutSeconds: { type: "integer", minimum: 1, maximum: 600 },
    },
  ),
  tool(
    "replace_file",
    "Replace existing src/*.cpp or include/pulselog/*.hpp source; tests and benchmark are immutable.",
    { path: string, content: string },
  ),
  tool(
    "read_artifact",
    "Read a character range of a full saved log, diff or archived conversation.",
    {
      artifactId: string,
      offset: { type: "integer", minimum: 0 },
      length: { type: "integer", minimum: 1, maximum: 12000 },
    },
  ),
  tool(
    "finish_candidate",
    "Freeze the candidate after inspecting the diff. The service runs fixed correctness and measurement checks. Give its specific change rationale.",
    { summary: string },
  ),
];
const FOLLOWUP_TOOLS = [
  tool(
    "remeasure_candidate",
    "Run three fresh paired measurements of the immutable patch with the saved contract.",
  ),
  tool(
    "continue_optimization",
    "Resume source investigation/editing in this session, preserving baseline and evidence.",
  ),
  AGENT_TOOLS.find((entry) => entry.function.name === "read_artifact"),
];
const sourcePath = (path) =>
  typeof path === "string" &&
  /^(src\/[^/]+\.cpp|include\/pulselog\/[^/]+\.hpp)$/.test(path);
const repositoryPath = (path) =>
  typeof path === "string" &&
  path.length < 300 &&
  !path.startsWith("/") &&
  !path.split("/").includes("..") &&
  !path.startsWith(".git/");
const busyError = () =>
  Object.assign(
    new Error("This session already has an active operation. Open it or wait for it to finish."),
    { statusCode: 409 },
  );

export class SessionRunner {
  #store;
  #config;
  #daytona;
  #llm;
  #executor;
  #operations = new Map();
  #projects = new Map();

  constructor({ store, config, daytona, llm, executor }) {
    this.#store = store;
    this.#config = config;
    this.#daytona =
      daytona ||
      (config.daytonaApiKey
        ? new Daytona({
            apiKey: config.daytonaApiKey,
            requestTimeoutMs: 30000,
            otelEnabled: false,
          })
        : null);
    this.#llm =
      llm ||
      new OpenAICompatibleClient({
        baseUrl: config.proxyBaseUrl,
        apiKey: config.proxyApiKey,
        model: config.model,
      });
    this.#executor = executor || new SandboxExecutor(store);
  }

  isActive(id) {
    return this.#operations.has(id);
  }
  activeProject(repository = REPOSITORY_URL) {
    return this.#projects.get(repository)?.values().next().value || null;
  }
  async waitForIdle(id) {
    await this.#operations.get(id)?.task;
  }

  async #launch(id, operation, action) {
    const session = await this.#store.get(id);
    if (!session) throw new Error("Session not found");
    if (this.#operations.has(id)) throw busyError();
    const control = {
      controller: new AbortController(),
      resources: new Map(),
      task: null,
    };
    const projectOperations = this.#projects.get(session.repositoryUrl) || new Set();
    projectOperations.add(id);
    this.#projects.set(session.repositoryUrl, projectOperations);
    this.#operations.set(id, control);
    control.task = (async () => {
      let succeeded = false;
      try {
        if (!this.#config.credentialsReady)
          throw new Error(
            "Server-side proxy and Daytona credentials are required.",
          );
        await this.#store.mutate(id, async (draft) => {
          draft.status = "running";
          draft.operation = operation;
          draft.error = null;
          draft.nextAction = null;
        });
        if (
          operation !== "resume" &&
          (session.commands || []).some((command) =>
            ["running", "submitting", "needs-inspection"].includes(
              command.status,
            ),
          )
        )
          await this.#reconcile(id, control);
        await action(control);
        await this.#drainMessages(id, control);
        checkCancelled(control.controller.signal);
        succeeded = true;
      } catch (error) {
        const cancelled =
          control.controller.signal.aborted || error.name === "AbortError";
        await this.#store.mutate(id, async (draft) => {
          draft.resumePhase = draft.phase;
          draft.status = cancelled ? "cancelled" : "failed";
          draft.phase = draft.status;
          draft.error = cancelled ? null : error.message;
          draft.nextAction =
            "Inspect saved evidence, then resume this project when ready.";
        });
        await this.#store.appendEvent(
          id,
          cancelled ? "cancelled" : "error",
          cancelled ? "Execution cancelled at a safe boundary." : error.message,
        );
      } finally {
        await this.#cleanup(id, control);
        if (control.controller.signal.aborted)
          await this.#store.mutate(id, async (draft) => {
            draft.status = "cancelled";
            draft.phase = "cancelled";
            draft.error = null;
          });
        await this.#store.checkpoint(
          id,
          control.controller.signal.aborted
            ? "cancelled"
            : "operation-complete",
        );
        const current = await this.#store.get(id);
        const queuedFollowUp = Boolean(
          succeeded &&
          !control.controller.signal.aborted &&
          current.pendingMessages?.length,
        );
        if (queuedFollowUp)
          await this.#store.mutate(id, async (draft) => {
            draft.status = "queued";
            draft.operation = "follow-up";
          });
        this.#operations.delete(id);
        projectOperations.delete(id);
        if (!projectOperations.size) this.#projects.delete(session.repositoryUrl);
        if (queuedFollowUp) {
          this.#launch(id, "follow-up", (next) =>
            this.#drainMessages(id, next),
          ).catch(() => {});
        }
      }
    })();
    return true;
  }

  async start(id) {
    return this.#launch(id, "optimize", (control) =>
      this.#optimize(id, control),
    );
  }
  async retryVerification(id) {
    const session = await this.#store.get(id);
    if (!session?.candidate) throw new Error("A frozen candidate is required.");
    return this.#launch(id, "remeasure", (control) =>
      this.#verify(id, control),
    );
  }
  async resume(id) {
    return this.#launch(id, "resume", async (control) => {
      await this.#reconcile(id, control);
      const session = await this.#store.get(id);
      const resumePhase =
        session.resumePhase || session.recovery?.previousPhase || session.phase;
      if (
        session.pendingMessages?.length &&
        ![
          "workspace",
          "analysis",
          "candidate-preflight",
          "verification",
        ].includes(resumePhase)
      )
        return;
      if (
        session.candidate &&
        session.contract &&
        session.calibration &&
        ["verification", "completed"].includes(resumePhase)
      )
        await this.#verify(id, control);
      else await this.#optimize(id, control);
    });
  }

  async recover() {
    for (const session of await this.#store.recent()) {
      if (
        !["running", "queued", "cancelling", "recovering"].includes(
          session.status,
        )
      )
        continue;
      await this.#store.mutate(session.id, async (draft) => {
        draft.status = "interrupted";
        draft.nextAction =
          "Resume to inspect recorded remote commands before continuing. No work was submitted again.";
        draft.recovery = {
          previousPhase: draft.phase,
          detectedAt: new Date().toISOString(),
        };
      });
      await this.#store.appendEvent(
        session.id,
        "recovery",
        "Server restart detected. Remote command IDs and workspace retained; resume reconciles them before new work.",
      );
    }
  }

  async #reconcile(id, control) {
    const session = await this.#store.get(id);
    for (const record of session.sandboxes || []) {
      if (record.cleanup === "deleted") {
        await this.#retireCommands(id, record.id, "interrupted");
        continue;
      }
      let sandbox;
      try {
        sandbox = await this.#daytona.get(record.id || record.name);
      } catch (error) {
        if (
          error.statusCode === 404 ||
          error.response?.status === 404 ||
          /not found|404/i.test(error.message)
        ) {
          await this.#markSandbox(id, record.name || record.id, {
            cleanup: "deleted",
            state: "missing",
          });
          await this.#store.mutate(id, async (draft) => {
            for (const command of draft.commands || [])
              if (
                command.sandboxId === record.id &&
                ["running", "submitting", "needs-inspection"].includes(
                  command.status,
                )
              )
                command.status = "interrupted";
          });
          continue;
        }
        throw error;
      }
      control.resources.set(sandbox.id, { sandbox, role: record.role });
      const pending = (session.commands || []).filter(
        (entry) =>
          entry.sandboxId === sandbox.id &&
          ["running", "submitting", "needs-inspection"].includes(entry.status),
      );
      if (pending.length && sandbox.state !== "started")
        await sandbox.start(120);
      for (const command of pending) {
        try {
          await this.#executor.inspect(
            id,
            sandbox,
            command,
            control.controller.signal,
          );
        } catch (error) {
          if (
            !/not found|404/i.test(error.message) &&
            error.statusCode !== 404 &&
            error.response?.status !== 404
          )
            throw error;
          await this.#store.mutate(id, async (draft) => {
            const entry = draft.commands.find((item) => item.id === command.id);
            entry.status = "interrupted";
            entry.error =
              "Remote process no longer exists; inspect source state before continuation.";
          });
        }
      }
    }
    await this.#store.appendEvent(
      id,
      "recovery",
      "Persisted remote executions reconciled before continuation.",
    );
  }

  async cancel(id) {
    const session = await this.#store.get(id);
    if (!session) throw new Error("Session not found");
    const control = this.#operations.get(id);
    control?.controller.abort();
    await this.#store.mutate(id, async (draft) => {
      draft.status = control ? "cancelling" : "cancelled";
      draft.pendingMessages = [];
      draft.nextAction = "Stopping remote processes and preserving evidence.";
    });
    for (const command of session.commands || []) {
      if (
        !["submitting", "running", "needs-inspection"].includes(command.status)
      )
        continue;
      try {
        const sandbox =
          control?.resources.get(command.sandboxId)?.sandbox ||
          (await this.#daytona.get(command.sandboxId));
        await this.#executor.cancel(id, sandbox, command);
      } catch (error) {
        if (
          /not found|404/i.test(error.message) ||
          error.statusCode === 404 ||
          error.response?.status === 404
        )
          await this.#retireCommands(id, command.sandboxId, "cancelled");
        else await this.#store.appendEvent(id, "cleanup-error", error.message);
      }
    }
    if (!control) {
      const resources = new Map();
      for (const record of session.sandboxes.filter(
        (entry) => entry.cleanup !== "deleted",
      )) {
        try {
          const sandbox = await this.#daytona.get(record.id || record.name);
          resources.set(sandbox.id, { sandbox, role: record.role });
        } catch {}
      }
      await this.#cleanup(id, { resources });
    }
  }

  async replyToFollowUp(id, content) {
    const session = await this.#store.get(id);
    if (!session) throw new Error("Session not found");
    const message = {
      id: randomUUID(),
      role: "user",
      content,
      at: new Date().toISOString(),
    };
    await this.#store.mutate(id, async (draft) => {
      draft.messages.push(message);
      (draft.pendingMessages ||= []).push(message.id);
    });
    if (!this.isActive(id))
      await this.#launch(id, "follow-up", (control) =>
        this.#drainMessages(id, control),
      );
  }

  async #drainMessages(id, control) {
    for (;;) {
      checkCancelled(control.controller.signal);
      const session = await this.#store.get(id);
      const pending = session.pendingMessages || [];
      if (!pending.length) return;
      const patch = session.candidate
        ? (
            await this.#store.readArtifact(
              id,
              session.candidate.patchArtifactId,
            )
          ).data.toString("utf8")
        : "No frozen diff yet.";
      const messages = [
        {
          role: "system",
          content:
            "You own this persistent project session. Explain questions using actual diff and evidence. For a request to measure again call remeasure_candidate; for code changes/resume call continue_optimization. Do not claim execution without a tool result. Retain earlier constraints. Answer in the user's language.",
        },
        {
          role: "user",
          content: JSON.stringify({
            goal: session.goal,
            baseline: session.baselineSha,
            candidate: session.candidate,
            diff: patch,
            verification: session.verification,
            events: session.events.slice(-15),
          }),
        },
        ...session.messages.map(({ role, content }) => ({ role, content })),
      ];
      for (let turn = 0; turn < 6; turn++) {
        const response = await this.#llm.complete(
          messages,
          FOLLOWUP_TOOLS,
          control.controller.signal,
        );
        messages.push(response);
        if (!response.tool_calls?.length) {
          await this.#store.mutate(id, async (draft) => {
            draft.messages.push({
              role: "assistant",
              content: response.content || "No response was returned.",
              at: new Date().toISOString(),
            });
          });
          break;
        }
        for (const call of response.tool_calls) {
          checkCancelled(control.controller.signal);
          let result;
          if (call.function.name === "remeasure_candidate")
            result = await this.#verify(id, control);
          else if (call.function.name === "continue_optimization")
            result = await this.#optimize(id, control);
          else if (call.function.name === "read_artifact")
            result = await this.#readArtifact(
              id,
              JSON.parse(call.function.arguments),
            );
          else throw new Error("Unknown follow-up tool");
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: boundedToolResult(result),
          });
        }
      }
      await this.#store.writeArtifact(
        id,
        `follow-up-${Date.now()}.json`,
        JSON.stringify(messages, null, 2),
        "application/json",
      );
      await this.#store.mutate(id, async (draft) => {
        draft.pendingMessages = (draft.pendingMessages || []).filter(
          (messageId) => !pending.includes(messageId),
        );
        draft.status =
          draft.verification?.verdict === "verified"
            ? "completed"
            : draft.verification?.verdict || "completed";
      });
    }
  }

  async #createSandbox(id, control, role, ordinal = null, attemptId = null) {
    checkCancelled(control.controller.signal);
    const name = `ar-${role}-${randomUUID()}`;
    await this.#store.mutate(id, async (draft) => {
      draft.sandboxes.push({
        name,
        role,
        ordinal,
        attemptId,
        status: "creating",
      });
    });
    const sandbox = await this.#daytona.create(
      {
        name,
        language: "typescript",
        autoStopInterval: 20,
        autoDeleteInterval: role === "work" ? -1 : 180,
        labels: { product: "agenticrocket", session: id, role },
      },
      { timeout: 120 },
    );
    control.resources.set(sandbox.id, { sandbox, role });
    await this.#markSandbox(id, name, {
      id: sandbox.id,
      status: "running",
      target: sandbox.target,
      cpu: sandbox.cpu,
      memoryGiB: sandbox.memory,
      cleanup: null,
    });
    checkCancelled(control.controller.signal);
    return sandbox;
  }

  async #markSandbox(id, key, values) {
    await this.#store.mutate(id, async (draft) => {
      const item = draft.sandboxes.find(
        (entry) => entry.id === key || entry.name === key,
      );
      if (item) Object.assign(item, values);
    });
  }

  async #command(id, control, sandbox, cwd, command, label, timeout = 300) {
    checkCancelled(control.controller.signal);
    const result = await this.#executor.run(id, sandbox, command, cwd, {
      label,
      timeout,
      signal: control.controller.signal,
    });
    await this.#store.appendEvent(
      id,
      "tool",
      `${label}: exit ${result.exitCode}`,
      { commandId: result.commandId, artifactId: result.logArtifactId },
    );
    return result;
  }

  async #workspace(id, control) {
    const session = await this.#store.get(id);
    if (session.workspace?.sandboxId) {
      let sandbox;
      try {
        sandbox = await this.#daytona.get(session.workspace.sandboxId);
      } catch (error) {
        if (
          !/not found|404/i.test(error.message) &&
          error.statusCode !== 404 &&
          error.response?.status !== 404
        )
          throw error;
      }
      if (sandbox && session.workspace.ready !== false) {
        control.resources.set(sandbox.id, { sandbox, role: "work" });
        if (sandbox.state !== "started") await sandbox.start(120);
        await this.#markSandbox(id, sandbox.id, {
          cleanup: null,
          status: "running",
        });
        await this.#store.mutate(id, async (draft) => {
          draft.contract ||= structuredClone(PROJECT_CONTRACT);
        });
        return { sandbox, path: session.workspace.path };
      }
    }
    // A submitted clone is reconciled first on resume; reuse that sandbox and
    // inspect its checkout instead of allocating a second work environment.
    const existing =
      session.workspace?.ready === false &&
      control.resources.get(session.workspace.sandboxId)?.sandbox;
    const sandbox =
      existing || (await this.#createSandbox(id, control, "work"));
    if (existing && existing.state !== "started") await existing.start(120);
    const root = (await sandbox.getWorkDir()) || "/home/daytona";
    const path = `${root}/project`;
    await this.#store.mutate(id, async (draft) => {
      draft.workspace = { sandboxId: sandbox.id, path, ready: false };
    });
    assertSuccessful(
      await this.#command(
        id,
        control,
        sandbox,
        root,
        `(test -d ${shellQuote(`${path}/.git`)} || git clone ${shellQuote(REPOSITORY_URL)} ${shellQuote(path)}) && git -C ${shellQuote(path)} checkout ${shellQuote(session.baselineSha || "main")}`,
        "clone-baseline",
      ),
      "Clone",
    );
    const shaResult = await this.#command(
      id,
      control,
      sandbox,
      path,
      "git rev-parse HEAD",
      "baseline-sha",
    );
    const sha = rawOutput(shaResult).trim();
    if (!/^[a-f0-9]{40}$/.test(sha))
      throw new Error("Could not pin baseline commit.");
    await this.#store.mutate(id, async (draft) => {
      draft.baselineSha = sha;
      draft.workspace = { sandboxId: sandbox.id, path, ready: true };
      draft.contract ||= structuredClone(PROJECT_CONTRACT);
    });
    if (session.candidate) {
      const { data } = await this.#store.readArtifact(
        id,
        session.candidate.patchArtifactId,
      );
      await uploadText(sandbox, `${root}/restore.patch`, data, root);
      assertSuccessful(
        await this.#command(
          id,
          control,
          sandbox,
          path,
          `git apply --check ${shellQuote(`${root}/restore.patch`)} && git apply ${shellQuote(`${root}/restore.patch`)}`,
          "restore-candidate",
        ),
        "Restore patch",
      );
    }
    return { sandbox, path };
  }

  async #optimize(id, control) {
    await this.#store.mutate(id, async (draft) => {
      draft.phase = "workspace";
    });
    const { sandbox, path } = await this.#workspace(id, control);
    let session = await this.#store.get(id);
    const contract = session.contract;
    if (!session.calibration) {
      const baselinePath = `${path}-calibration`;
      assertSuccessful(
        await this.#command(
          id,
          control,
          sandbox,
          path,
          `test -d ${shellQuote(baselinePath)} || git worktree add --detach ${shellQuote(baselinePath)} ${session.baselineSha}`,
          "calibration-checkout",
        ),
        "Calibration checkout",
      );
      assertSuccessful(
        await this.#command(
          id,
          control,
          sandbox,
          baselinePath,
          contract.buildCommand,
          "baseline-build",
        ),
        "Baseline build",
      );
      assertSuccessful(
        await this.#command(
          id,
          control,
          sandbox,
          baselinePath,
          contract.testCommand,
          "baseline-tests",
        ),
        "Baseline tests",
      );
      const samples = [];
      let reference;
      for (let sample = 0; sample < 4; sample++) {
        const result = assertSuccessful(
          await this.#command(
            id,
            control,
            sandbox,
            baselinePath,
            contract.benchmarkCommand,
            sample ? "baseline-calibration" : "baseline-warmup",
          ),
          "Baseline benchmark",
        );
        const parsed = parseBenchmark(rawOutput(result), contract);
        if (reference) assertSameOutput(reference, parsed);
        reference = parsed;
        if (sample) samples.push(parsed.milliseconds);
      }
      const output = assertSuccessful(
        await this.#command(
          id,
          control,
          sandbox,
          baselinePath,
          contract.outputCommand,
          "baseline-output",
        ),
        "Baseline output",
      );
      const calibration = {
        samples,
        checksum: reference.checksum,
        output: rawOutput(output),
        cvPct: coefficientOfVariation(samples),
        at: new Date().toISOString(),
      };
      await this.#store.mutate(id, async (draft) => {
        draft.calibration = calibration;
        draft.policy = {
          ...VERIFICATION_POLICY,
          calibrationCvPct: calibration.cvPct,
        };
      });
      await this.#store.checkpoint(id, "baseline-calibrated");
    }
    await this.#store.mutate(id, async (draft) => {
      draft.phase = "analysis";
    });
    const summary = await this.#agent(id, control, sandbox, path);
    checkCancelled(control.controller.signal);
    session = await this.#store.get(id);
    const changed = assertSuccessful(
      await this.#command(
        id,
        control,
        sandbox,
        path,
        `git diff --name-only --no-renames ${session.baselineSha}`,
        "candidate-files",
      ),
      "Changed files",
    );
    const untracked = assertSuccessful(
      await this.#command(
        id,
        control,
        sandbox,
        path,
        "git ls-files --others --exclude-standard",
        "untracked-files",
      ),
      "Untracked files",
    );
    assertSourceOnly(
      rawOutput(changed),
      rawOutput(untracked).split(/\r?\n/).filter(Boolean),
    );
    // Base64 preserves exact patch bytes, including final LF, across SDK transport.
    const encoded = assertSuccessful(
      await this.#command(
        id,
        control,
        sandbox,
        path,
        `git diff --binary --no-ext-diff ${session.baselineSha} | base64 -w0`,
        "candidate-patch",
      ),
      "Patch extraction",
    );
    const patch = Buffer.from(rawOutput(encoded).trim(), "base64");
    if (!patch.length) throw new Error("Candidate patch is empty.");
    await uploadText(sandbox, `${path}/.candidate.patch`, patch, path);
    assertSuccessful(
      await this.#command(
        id,
        control,
        sandbox,
        path,
        "git apply --reverse --check .candidate.patch",
        "patch-roundtrip-check",
      ),
      "Patch reverse application",
    );
    await this.#store.mutate(id, async (draft) => {
      draft.phase = "candidate-preflight";
    });
    assertSuccessful(
      await this.#command(
        id,
        control,
        sandbox,
        path,
        contract.buildCommand,
        "candidate-build",
      ),
      "Candidate build",
      true,
    );
    assertSuccessful(
      await this.#command(
        id,
        control,
        sandbox,
        path,
        contract.testCommand,
        "candidate-tests",
      ),
      "Candidate tests",
      true,
    );
    const output = assertSuccessful(
      await this.#command(
        id,
        control,
        sandbox,
        path,
        contract.outputCommand,
        "candidate-output",
      ),
      "Candidate output",
      true,
    );
    if (rawOutput(output) !== session.calibration.output)
      throw new CorrectnessError("Candidate CLI output differs from baseline.");
    const result = assertSuccessful(
      await this.#command(
        id,
        control,
        sandbox,
        path,
        contract.benchmarkCommand,
        "candidate-preflight",
      ),
      "Candidate benchmark",
      true,
    );
    const preflight = parseBenchmark(rawOutput(result), contract);
    assertSameOutput(session.calibration, preflight);
    const artifact = await this.#store.writeArtifact(
      id,
      "candidate.patch",
      patch,
      "text/x-diff; charset=utf-8",
    );
    await this.#store.mutate(id, async (draft) => {
      if (draft.candidate)
        (draft.candidateHistory ||= []).push(draft.candidate);
      draft.candidate = {
        id: randomUUID(),
        summary,
        fingerprint: fingerprint(patch),
        patchArtifactId: artifact.id,
        plan: contract,
        preflight,
        createdAt: new Date().toISOString(),
      };
    });
    await this.#store.checkpoint(id, "candidate-frozen");
    return this.#verify(id, control);
  }

  async #agent(id, control, sandbox, path) {
    const session = await this.#store.get(id);
    const previousHistory = session.agentHistory?.length
      ? await this.#store.writeArtifact(
          id,
          `prior-agent-history-${Date.now()}.json`,
          JSON.stringify(session.agentHistory, null, 2),
          "application/json",
        )
      : null;
    const system = [
      "You are the persistent optimization agent for this project. Read README, source, tests and benchmark, then make one small behavior-preserving source optimization.",
      "The service already built/tested the fixed baseline and measured calibration. It owns the fixed build/test/checksum/benchmark contract; never alter tests, benchmark or build settings.",
      "Use tools only inside the work repository. Read existing files before replacing them. Do not modify git metadata, use network commands or access credentials. Once a useful patch exists call finish_candidate with its specific rationale; the service performs preflight and three-sandbox verification.",
      `Baseline ${session.baselineSha}. Repository ${path}. Fixed contract: ${JSON.stringify(session.contract)}.`,
    ].join("\n");
    let messages = [
      { role: "system", content: system },
      {
        role: "user",
        content: JSON.stringify({
          goal: session.goal,
          previousCandidate: session.candidate,
          constraints: session.messages,
          checkpoint: session.checkpoints.at(-1),
          previousHistoryArtifactId: previousHistory?.id,
          artifacts: session.artifacts.map(({ id, filename }) => ({
            id,
            filename,
          })),
        }),
      },
    ];
    const seenInstructions = new Set(session.messages.map((entry) => entry.id));
    for (let turn = 0; turn < (this.#config.maxAgentTurns || 36); turn++) {
      checkCancelled(control.controller.signal);
      const current = await this.#store.get(id);
      for (const instruction of current.messages.filter(
        (entry) => entry.role === "user" && !seenInstructions.has(entry.id),
      )) {
        messages.push({
          role: "user",
          content: `New instruction at a safe tool boundary: ${instruction.content}`,
        });
        seenInstructions.add(instruction.id);
      }
      const response = await this.#llm.complete(
        messages,
        AGENT_TOOLS,
        control.controller.signal,
      );
      const { reasoning_content: ignoredReasoning, ...message } = response;
      messages.push(message);
      let finished = null;
      if (!message.tool_calls?.length)
        await this.#store.appendEvent(
          id,
          "agent",
          message.content || "Inspecting project evidence.",
        );
      for (const call of message.tool_calls || []) {
        checkCancelled(control.controller.signal);
        let output;
        try {
          const args = JSON.parse(call.function.arguments || "{}");
          if (call.function.name === "finish_candidate") {
            if (!args.summary?.trim())
              throw new Error("A concrete change summary is required.");
            finished = args.summary;
            output = { ok: true };
          } else if (call.function.name === "read_artifact")
            output = await this.#readArtifact(id, args);
          else if (call.function.name === "replace_file") {
            if (
              !sourcePath(args.path) ||
              typeof args.content !== "string" ||
              args.content.length > 300000
            )
              throw new Error(
                "Only existing project source files may be replaced.",
              );
            assertSuccessful(
              await this.#command(
                id,
                control,
                sandbox,
                path,
                `git ls-files --error-unmatch ${shellQuote(args.path)} && test ! -L ${shellQuote(args.path)}`,
                "source-path-check",
              ),
              "Source path",
            );
            await uploadText(
              sandbox,
              `${path}/${args.path}`,
              args.content,
              path,
            );
            output = { ok: true, path: args.path };
          } else {
            let command;
            if (call.function.name === "list_files") command = "git ls-files";
            else if (call.function.name === "read_file") {
              if (!repositoryPath(args.path))
                throw new Error("Invalid repository path");
              command = `cat -- ${shellQuote(args.path)}`;
            } else if (call.function.name === "run_command") {
              if (
                typeof args.command !== "string" ||
                args.command.length > 3500 ||
                /\b(sudo|curl|wget)\b|\.git\//.test(args.command)
              )
                throw new Error(
                  "Command exceeds the scoped project tool contract.",
                );
              command = args.command;
            } else throw new Error("Unknown agent tool");
            output = await this.#command(
              id,
              control,
              sandbox,
              path,
              command,
              call.function.name,
              Math.min(600, Math.max(1, args.timeoutSeconds || 120)),
            );
          }
        } catch (error) {
          checkCancelled(control.controller.signal);
          output = { error: error.message };
        }
        const artifact = await this.#store.writeArtifact(
          id,
          `tool-${call.id}.json`,
          JSON.stringify(output, null, 2),
          "application/json",
        );
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({
            artifactId: artifact.id,
            preview: boundedToolResult(output),
          }),
        });
      }
      await this.#store.mutate(id, async (draft) => {
        draft.agentHistory = messages;
      });
      if (finished) {
        await this.#store.writeArtifact(
          id,
          `agent-history-${Date.now()}.json`,
          JSON.stringify(messages, null, 2),
          "application/json",
        );
        return finished;
      }
      const estimatedTokens = Math.ceil(JSON.stringify(messages).length / 3);
      if (estimatedTokens > (this.#config.contextSoftLimit || 240000)) {
        const archive = await this.#store.writeArtifact(
          id,
          `agent-history-${Date.now()}.json`,
          JSON.stringify(messages, null, 2),
          "application/json",
        );
        await this.#store.checkpoint(id, "context-compact");
        const current = await this.#store.get(id);
        messages = [
          { role: "system", content: system },
          {
            role: "user",
            content: JSON.stringify({
              goal: current.goal,
              constraints: current.messages,
              checkpoint: current.checkpoints.at(-1),
              originalHistoryArtifactId: archive.id,
              recentEvents: current.events.slice(-18),
              instruction:
                "Resume at the completed tool boundary. Inspect git status/diff; use read_artifact for full previous outputs.",
            }),
          },
        ];
        await this.#store.appendEvent(
          id,
          "checkpoint",
          "Context compacted at a completed tool boundary; full history and logs remain retrievable.",
        );
      }
    }
    throw new Error(
      "Agent exhausted its configured turn budget. Resume from the saved work repository.",
    );
  }

  async #readArtifact(id, { artifactId, offset = 0, length = 12000 }) {
    const { data } = await this.#store.readArtifact(id, artifactId);
    const content = data.toString("utf8");
    const start = Math.max(0, Number(offset) || 0);
    const end = start + Math.max(1, Math.min(12000, Number(length) || 12000));
    return {
      content: content.slice(start, end),
      nextOffset: end < content.length ? end : null,
      totalCharacters: content.length,
    };
  }

  async #verify(id, control) {
    const session = await this.#store.get(id);
    if (!session.candidate || !session.contract || !session.calibration)
      throw new Error(
        "Resume optimization to establish a fixed contract and baseline before remeasurement.",
      );
    const { data: patch } = await this.#store.readArtifact(
      id,
      session.candidate.patchArtifactId,
    );
    if (fingerprint(patch) !== session.candidate.fingerprint)
      throw new Error("Candidate fingerprint mismatch");
    const attemptId = randomUUID();
    await this.#store.mutate(id, async (draft) => {
      if (draft.verification)
        (draft.verificationHistory ||= []).push(draft.verification);
      else if (draft.verificationAttempt)
        (draft.verificationHistory ||= []).push({
          ...draft.verificationAttempt,
          attemptId: draft.verificationAttempt.id,
          verdict: "inconclusive",
          reason: "This attempt was interrupted before a final verdict.",
          contract: draft.contract,
          metric: draft.contract.metric,
        });
      draft.verification = null;
      draft.phase = "verification";
      draft.verificationAttempt = {
        id: attemptId,
        candidateFingerprint: draft.candidate.fingerprint,
        policy: draft.policy,
        startedAt: new Date().toISOString(),
        runs: [],
      };
    });
    const settled = await Promise.allSettled(
      [1, 2, 3].map((ordinal) =>
        this.#pairedRun(id, control, session, patch, ordinal, attemptId),
      ),
    );
    checkCancelled(control.controller.signal);
    const results = settled.map((result, index) =>
      result.status === "fulfilled"
        ? result.value
        : {
            sandbox: index + 1,
            failureKind: "execution",
            error: result.reason.message,
          },
    );
    const verdict = evaluatePairedVerification(results, session.policy);
    const verification = {
      ...verdict,
      attemptId,
      candidateFingerprint: session.candidate.fingerprint,
      metric: session.contract.metric,
      policy: session.policy,
      contract: session.contract,
      completedAt: new Date().toISOString(),
    };
    const artifact = await this.#store.writeArtifact(
      id,
      "verification-report.md",
      this.#report(session, verification),
      "text/markdown; charset=utf-8",
    );
    checkCancelled(control.controller.signal);
    await this.#store.mutate(id, async (draft) => {
      draft.verification = { ...verification, reportArtifactId: artifact.id };
      draft.status =
        verdict.verdict === "verified" ? "completed" : verdict.verdict;
      draft.phase = "completed";
      draft.nextAction = null;
    });
    await this.#store.appendEvent(
      id,
      "verdict",
      `${verdict.verdict.toUpperCase()}: ${verdict.reason}`,
      { reportArtifactId: artifact.id },
    );
    await this.#store.checkpoint(id, "verification-complete");
    return verification;
  }

  async #pairedRun(id, control, session, patch, ordinal, attemptId) {
    const result = {
      sandbox: ordinal,
      attemptId,
      testsPassed: null,
      outputPassed: null,
      baselineSamples: [],
      candidateSamples: [],
      commandOrder: [],
      warmups: [],
      sampleEvidence: [],
    };
    let sandbox;
    const contract = session.contract;
    try {
      sandbox = await this.#createSandbox(
        id,
        control,
        "benchmark",
        ordinal,
        attemptId,
      );
      result.sandboxId = sandbox.id;
      const root = (await sandbox.getWorkDir()) || "/home/daytona";
      const baseline = `${root}/baseline`;
      const candidate = `${root}/candidate`;
      const run = (cwd, command, label) =>
        this.#command(
          id,
          control,
          sandbox,
          cwd,
          command,
          `sandbox-${ordinal}-${label}`,
        );
      assertSuccessful(
        await run(
          root,
          `git clone ${shellQuote(REPOSITORY_URL)} ${shellQuote(baseline)} && git -C ${shellQuote(baseline)} checkout ${session.baselineSha} && git clone --shared ${shellQuote(baseline)} ${shellQuote(candidate)}`,
          "setup",
        ),
        "Verification setup",
      );
      await uploadText(sandbox, `${root}/candidate.patch`, patch, root);
      assertSuccessful(
        await run(
          candidate,
          `git apply --check ${shellQuote(`${root}/candidate.patch`)} && git apply ${shellQuote(`${root}/candidate.patch`)}`,
          "patch-apply",
        ),
        "Patch application",
      );
      const paths = assertSuccessful(
        await run(
          candidate,
          `git diff --name-only --no-renames ${session.baselineSha}`,
          "contract-integrity",
        ),
        "Verification files",
      );
      assertSourceOnly(rawOutput(paths));
      result.environment = rawOutput(
        await run(root, ENVIRONMENT_COMMAND, "environment"),
      );
      const outputs = {};
      for (const [variant, cwd] of [
        ["baseline", baseline],
        ["candidate", candidate],
      ]) {
        assertSuccessful(
          await run(cwd, contract.buildCommand, `${variant}-build`),
          `${variant} build`,
          variant === "candidate",
        );
        assertSuccessful(
          await run(cwd, contract.testCommand, `${variant}-tests`),
          `${variant} tests`,
          variant === "candidate",
        );
        const output = assertSuccessful(
          await run(cwd, contract.outputCommand, `${variant}-output`),
          `${variant} output`,
          variant === "candidate",
        );
        outputs[variant] = rawOutput(output);
      }
      result.testsPassed = true;
      if (outputs.baseline !== outputs.candidate)
        throw new CorrectnessError("Baseline and candidate CLI output differ.");
      result.outputs = outputs;
      const benchmark = async (variant, label) => {
        const execution = assertSuccessful(
          await run(
            variant === "baseline" ? baseline : candidate,
            contract.benchmarkCommand,
            label,
          ),
          `${variant} benchmark`,
        );
        const parsed = parseBenchmark(rawOutput(execution), contract);
        assertSameOutput(session.calibration, parsed);
        return { ...parsed, variant, logArtifactId: execution.logArtifactId };
      };
      for (const variant of ["baseline", "candidate"])
        result.warmups.push(await benchmark(variant, `${variant}-warmup`));
      assertSameOutput(result.warmups[0], result.warmups[1]);
      result.outputPassed = true;
      for (const variant of contract.order) {
        const measurement = await benchmark(variant, `${variant}-sample`);
        result[
          variant === "baseline" ? "baselineSamples" : "candidateSamples"
        ].push(measurement.milliseconds);
        result.commandOrder.push(variant);
        result.sampleEvidence.push(measurement);
      }
      await this.#markSandbox(id, sandbox.id, { status: "completed" });
    } catch (error) {
      result.error = error.message;
      result.failureKind =
        error instanceof CorrectnessError ? "correctness" : "execution";
      if (result.failureKind === "correctness") result.outputPassed = false;
      if (sandbox)
        await this.#markSandbox(id, sandbox.id, { status: "failed" });
    } finally {
      await this.#store.mutate(id, async (draft) => {
        draft.verificationAttempt.runs.push(result);
      });
      if (sandbox) await this.#dispose(id, control, sandbox, "benchmark");
    }
    return result;
  }

  async #dispose(id, control, sandbox, role) {
    try {
      const current = await this.#store.get(id);
      for (const command of (current.commands || []).filter(
        (entry) =>
          entry.sandboxId === sandbox.id &&
          ["running", "submitting", "needs-inspection"].includes(entry.status),
      )) {
        try {
          await this.#executor.cancel(
            id,
            sandbox,
            command,
            control.controller?.signal.aborted ? "cancelled" : "interrupted",
          );
        } catch (error) {
          await this.#store.appendEvent(
            id,
            "cleanup-error",
            `Could not collect partial command output: ${error.message}`,
          );
        }
      }
      if (role === "benchmark") await sandbox.delete(60, true);
      else await sandbox.stop(60);
      await this.#markSandbox(id, sandbox.id, {
        cleanup: role === "benchmark" ? "deleted" : "stopped",
        state: role === "benchmark" ? "deleted" : "stopped",
      });
      await this.#retireCommands(
        id,
        sandbox.id,
        control.controller?.signal.aborted ? "cancelled" : "interrupted",
      );
      control.resources.delete(sandbox.id);
    } catch (error) {
      await this.#markSandbox(id, sandbox.id, {
        cleanup: "failed",
        cleanupError: error.message,
      });
      await this.#store.appendEvent(
        id,
        "cleanup-error",
        `Resource cleanup failed: ${error.message}`,
      );
    }
  }
  async #retireCommands(id, sandboxId, status) {
    await this.#store.mutate(id, async (draft) => {
      for (const command of draft.commands || []) {
        if (
          command.sandboxId === sandboxId &&
          ["running", "submitting", "needs-inspection"].includes(command.status)
        ) {
          command.status = status;
          command.completedAt = new Date().toISOString();
        }
      }
    });
  }
  async #cleanup(id, control) {
    for (const { sandbox, role } of [...control.resources.values()])
      await this.#dispose(id, control, sandbox, role);
  }

  #report(session, verification) {
    const rows = verification.runs
      .map(
        (run) =>
          `| ${run.sandbox} | ${run.sandboxId || "unallocated"} | ${run.baselineMs?.toFixed(3) ?? "—"} | ${run.candidateMs?.toFixed(3) ?? "—"} | ${run.improvementPct?.toFixed(2) ?? "—"} | ${run.outcome} |`,
      )
      .join("\n");
    return `# AgenticRocket verification\n\n${session.candidate.summary}\n\n- Baseline: ${session.baselineSha}\n- Candidate SHA-256: ${session.candidate.fingerprint}\n- Attempt: ${verification.attemptId}\n- Verdict: **${verification.verdict}**\n- Reason: ${verification.reason}\n- Metric: native benchmark median_ms, averaged across three invocations per variant\n- Aggregate: arithmetic mean of each sandbox's percentage latency reduction\n\n## Fixed contract\n\n\`\`\`json\n${JSON.stringify({ contract: session.contract, policy: session.policy, calibration: session.calibration }, null, 2)}\n\`\`\`\n\n## Paired results\n\n| Sandbox | ID | Baseline ms | Candidate ms | Reduction % | Outcome |\n| --- | --- | ---: | ---: | ---: | --- |\n${rows}\n\n## Raw evidence\n\n\`\`\`json\n${JSON.stringify(verification.runs, null, 2)}\n\`\`\`\n\nEach variant has an explicit unmeasured warm-up. CLI outputs and every benchmark checksum must match. Tests, benchmark and build settings remain fixed. Passing correctness covers these checks only. Separate sandboxes do not imply independent physical hosts. Previous attempts remain in session history.\n`;
  }
}
