import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Daytona } from "@daytona/sdk";
import { OpenAICompatibleClient, boundedToolResult } from "./llm.mjs";
import { evaluatePairedVerification, VERIFICATION_POLICY } from "./verdict.mjs";

const DEMO_REPOSITORY = "https://github.com/jungwuk-ryu/agenticrocket-demo-perf.git";
const MAX_AGENT_TURNS = 30;
const MAX_COMMAND_CHARS = 3_500;
const allowedRelativePath = (candidate) => typeof candidate === "string"
  && candidate.length < 300
  && !candidate.startsWith("/")
  && !candidate.split("/").includes("..")
  && candidate.trim().length > 0;

const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;
const sampleAverage = (samples) => samples.reduce((sum, sample) => sum + sample, 0) / samples.length;

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List repository files. Use this before reading unfamiliar source.",
      strict: true,
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 text file relative to the repository root.",
      strict: true,
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a bounded shell command from the repository root. Use actual build/test/benchmark commands and inspect output before deciding.",
      strict: true,
      parameters: {
        type: "object",
        properties: { command: { type: "string" }, timeoutSeconds: { type: "integer", minimum: 1, maximum: 600 } },
        required: ["command", "timeoutSeconds"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_file",
      description: "Atomically replace one repository source file after reading it. Preserve behavior and make the smallest justified optimization.",
      strict: true,
      parameters: {
        type: "object",
        properties: { path: { type: "string" }, content: { type: "string" } },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_verification_plan",
      description: "Set exact existing project commands only after you have run or inspected them. Benchmark command must print or be measurable by elapsed wall time.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          buildCommand: { type: "string" },
          testCommand: { type: "string" },
          benchmarkCommand: { type: "string" },
          outputCommand: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["buildCommand", "testCommand", "benchmarkCommand", "outputCommand", "rationale"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finish_candidate",
      description: "Finish only after a real non-empty diff, candidate build/tests, and preflight benchmark have been completed and a verification plan is set.",
      strict: true,
      parameters: {
        type: "object",
        properties: { summary: { type: "string" } },
        required: ["summary"],
        additionalProperties: false,
      },
    },
  },
];

function commandOutput(result) {
  return String(result?.artifacts?.stdout ?? result?.result ?? "").trim();
}

function processResult(result) {
  return { exitCode: result?.exitCode ?? -1, output: commandOutput(result) };
}

function parseElapsedMilliseconds(output) {
  const marker = output.match(/AGENTICROCKET_SECONDS=([0-9]+(?:\.[0-9]+)?)/);
  if (marker) return Number(marker[1]) * 1000;
  const millisecond = output.match(/(?:time|elapsed|duration)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)\s*ms/i);
  if (millisecond) return Number(millisecond[1]);
  const seconds = output.match(/(?:time|elapsed|duration)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)\s*s(?:ec(?:onds?)?)?\b/i);
  return seconds ? Number(seconds[1]) * 1000 : null;
}

function verificationCommand(command) {
  // The Daytona zsh image does not ship GNU /usr/bin/time. Measure wall time
  // with the available POSIX tooling and emit a parseable stdout marker.
  return `start=$(date +%s%N); sh -lc ${shellQuote(command)}; code=$?; end=$(date +%s%N); awk -v start="$start" -v end="$end" 'BEGIN { printf "AGENTICROCKET_SECONDS=%.6f\\n", (end-start)/1000000000 }'; exit $code`;
}

function validatePlan(plan) {
  const fields = ["buildCommand", "testCommand", "benchmarkCommand", "outputCommand"];
  if (!plan || fields.some((field) => typeof plan[field] !== "string" || plan[field].trim().length === 0 || plan[field].length > MAX_COMMAND_CHARS)) {
    throw new Error("The agent did not provide a complete, bounded verification plan.");
  }
  if (/pulselog_cli\b/.test(plan.outputCommand) && !/mktemp\b/.test(plan.outputCommand)) {
    throw new Error("The PulseLog CLI output check must create and pass a temporary log file; pulselog_cli alone only prints usage.");
  }
  if (/pulselog_cli\b/.test(plan.outputCommand) && !plan.outputCommand.includes("ts=1|status=200|latency_us=120|route=/users/123|method=GET")) {
    throw new Error("The PulseLog output fixture must use the repository's key=value pipe-delimited log format and the declared valid sample line.");
  }
  return plan;
}

export class SessionRunner {
  #store;
  #config;
  #locks = new Map();

  constructor({ store, config }) {
    this.#store = store;
    this.#config = config;
  }

  isActive(sessionId) { return this.#locks.has(sessionId); }

  start(sessionId) {
    if (this.#locks.has(sessionId)) return false;
    const task = this.#run(sessionId).finally(() => this.#locks.delete(sessionId));
    this.#locks.set(sessionId, task);
    return true;
  }

  retryVerification(sessionId) {
    if (this.#locks.has(sessionId)) return false;
    const task = this.#retryVerification(sessionId).catch(async (error) => {
      const message = error instanceof Error ? error.message : "Verification retry failed";
      await this.#store.mutate(sessionId, async (draft) => {
        draft.status = "failed";
        draft.phase = "failed";
        draft.error = message;
        draft.nextAction = "Inspect the recorded error before retrying verification again.";
      });
      await this.#store.appendEvent(sessionId, "error", "Verification retry stopped with a recorded runtime error.", { message });
    }).finally(() => this.#locks.delete(sessionId));
    this.#locks.set(sessionId, task);
    return true;
  }

  async replyToFollowUp(sessionId, content) {
    const session = await this.#store.get(sessionId);
    if (!session) throw new Error("Session not found");
    await this.#store.mutate(sessionId, async (draft) => {
      draft.messages.push({ role: "user", content, at: new Date().toISOString() });
      draft.nextAction = "Respond to the user's follow-up with the persisted diff and verification evidence.";
    });
    if (!this.#config.proxyApiKey) {
      await this.#store.appendEvent(sessionId, "configuration", "Follow-up saved; proxy credential is required to ask the agent.");
      return;
    }
    const llm = new OpenAICompatibleClient({ baseUrl: this.#config.proxyBaseUrl, apiKey: this.#config.proxyApiKey, model: this.#config.model });
    const evidence = { candidate: session.candidate, verification: session.verification, events: session.events.slice(-12) };
    const response = await llm.complete([
      { role: "system", content: "You are AgenticRocket. Answer from persisted execution evidence only. If evidence is missing, say so plainly. Keep the answer under 180 words." },
      { role: "user", content: `Session evidence:\n${JSON.stringify(evidence)}\n\nFollow-up: ${content}` },
    ]);
    await this.#store.mutate(sessionId, async (draft) => {
      draft.messages.push({ role: "assistant", content: response.content || "The agent returned no visible answer.", at: new Date().toISOString() });
    });
    await this.#store.appendEvent(sessionId, "agent", "The persistent agent answered the follow-up from saved evidence.");
  }

  async cancel(sessionId) {
    const session = await this.#store.get(sessionId);
    if (!session) throw new Error("Session not found");
    await this.#store.mutate(sessionId, async (draft) => { draft.status = "cancelled"; draft.phase = "cancelled"; draft.nextAction = null; });
    await this.#store.appendEvent(sessionId, "status", "Cancellation recorded. Existing Daytona resources are retained for evidence until cleanup.");
  }

  async #retryVerification(sessionId) {
    const session = await this.#store.get(sessionId);
    if (!session?.candidate?.plan || !session.baselineSha) throw new Error("A frozen candidate and baseline are required before retrying verification.");
    if (!this.#config.credentialsReady) throw new Error("Server-side credentials are required for verification.");
    const artifact = session.artifacts.find((item) => item.id === session.candidate.patchArtifactId);
    if (!artifact) throw new Error("The frozen candidate patch artifact is unavailable.");
    const patch = await readFile(artifact.path, "utf8");
    const daytona = new Daytona({ apiKey: this.#config.daytonaApiKey, requestTimeoutMs: 30_000, otelEnabled: false });
    const plan = validatePlan(session.candidate.plan);
    await this.#store.mutate(sessionId, async (draft) => {
      draft.status = "running";
      draft.phase = "verification";
      draft.error = null;
      draft.nextAction = "Retry the fixed candidate in three paired Daytona benchmark sandboxes.";
    });
    await this.#store.appendEvent(sessionId, "verification", "Retrying three paired measurements from the immutable candidate patch after a runtime recovery.");
    const results = await Promise.all([1, 2, 3].map((number) => this.#verifyInSandbox({ sessionId, daytona, number, baselineSha: session.baselineSha, patch, plan })));
    const verification = evaluatePairedVerification(results);
    await this.#store.mutate(sessionId, async (draft) => {
      draft.verification = { ...verification, policy: VERIFICATION_POLICY, completedAt: new Date().toISOString() };
      draft.status = verification.verdict === "verified" ? "completed" : verification.verdict;
      draft.phase = "completed";
      draft.nextAction = "Review the saved patch, report, and verdict; send a follow-up to the same project agent if needed.";
    });
    const reportArtifact = await this.#store.writeArtifact(sessionId, "verification-report.md", this.#report(sessionId, session.baselineSha, session.candidate.fingerprint, plan, verification), "text/markdown; charset=utf-8");
    await this.#store.appendEvent(sessionId, "verdict", `${verification.verdict.toUpperCase()}: ${verification.reason}`, { reportArtifactId: reportArtifact.id, aggregateImprovementPct: verification.aggregateImprovementPct });
    await this.#store.checkpoint(sessionId, "verification-retry-complete");
  }

  async #run(sessionId) {
    const session = await this.#store.get(sessionId);
    if (!session) return;
    if (!this.#config.credentialsReady) {
      await this.#store.mutate(sessionId, async (draft) => {
        draft.status = "configuration-required";
        draft.phase = "configuration-required";
        draft.error = `Missing server-side configuration: ${this.#config.configurationMissing.join(", ")}`;
      });
      await this.#store.appendEvent(sessionId, "configuration", "Execution was not started because required server credentials are not configured.", { missing: this.#config.configurationMissing });
      return;
    }

    try {
      await this.#store.mutate(sessionId, async (draft) => { draft.status = "running"; draft.phase = "workspace"; draft.nextAction = "Create the Daytona work sandbox and pin main."; });
      await this.#store.appendEvent(sessionId, "workspace", "Creating a Daytona work sandbox.");
      const daytona = new Daytona({ apiKey: this.#config.daytonaApiKey, requestTimeoutMs: 30_000, otelEnabled: false });
      const workSandbox = await daytona.create({
        language: "typescript",
        autoStopInterval: 20,
        autoDeleteInterval: 180,
        labels: { product: "agenticrocket", session: sessionId, role: "work" },
      }, { timeout: 120 });
      const workDir = (await workSandbox.getWorkDir()) || "/home/daytona";
      const repoPath = `${workDir}/agenticrocket-demo-perf`;
      await this.#recordSandbox(sessionId, workSandbox, "work", "running");
      const cloneResult = await workSandbox.process.executeCommand(`git clone ${shellQuote(DEMO_REPOSITORY)} ${shellQuote(repoPath)} && git -C ${shellQuote(repoPath)} checkout main && git -C ${shellQuote(repoPath)} rev-parse HEAD`, workDir, undefined, 240);
      if (cloneResult.exitCode !== 0) throw new Error(`Repository clone failed: ${commandOutput(cloneResult).slice(-600)}`);
      const baselineSha = commandOutput(cloneResult).split(/\s+/).at(-1);
      if (!/^[a-f0-9]{40}$/i.test(baselineSha || "")) throw new Error("Could not determine the fixed main commit SHA.");
      await this.#store.mutate(sessionId, async (draft) => { draft.baselineSha = baselineSha; draft.phase = "analysis"; draft.nextAction = "Inspect the repository, form a measured optimization hypothesis, and produce one candidate."; });
      await this.#store.appendEvent(sessionId, "repository", `Pinned main at ${baselineSha.slice(0, 12)} and started the persistent agent session.`);
      await this.#store.checkpoint(sessionId, "baseline-pinned");

      const plan = await this.#runAgent(sessionId, workSandbox, repoPath, baselineSha);
      await this.#store.mutate(sessionId, async (draft) => { draft.phase = "candidate-preflight"; draft.nextAction = "Freeze the candidate after build, test, output, and preflight checks."; });
      const preflight = await this.#preflightCandidate(workSandbox, repoPath, plan);
      if (!preflight.ok) throw new Error(preflight.error);
      const patchResult = await workSandbox.process.executeCommand("git diff --binary --no-ext-diff", repoPath, undefined, 60);
      const patch = commandOutput(patchResult);
      if (!patch.trim()) throw new Error("The agent finished without a source patch.");
      const fingerprint = createHash("sha256").update(patch).digest("hex");
      const patchArtifact = await this.#store.writeArtifact(sessionId, "candidate.patch", patch, "text/x-diff; charset=utf-8");
      await this.#store.mutate(sessionId, async (draft) => {
        draft.candidate = { fingerprint, summary: plan.summary || "Candidate created by the persistent agent.", plan, patchArtifactId: patchArtifact.id, preflight, createdAt: new Date().toISOString() };
        draft.phase = "verification";
        draft.nextAction = "Run the fixed candidate in three paired Daytona benchmark sandboxes.";
      });
      await this.#store.appendEvent(sessionId, "candidate", `Candidate frozen with fingerprint ${fingerprint.slice(0, 12)}. Starting three paired verification sandboxes.`, { fingerprint });
      await this.#store.checkpoint(sessionId, "candidate-frozen");

      const results = await Promise.all([1, 2, 3].map((number) => this.#verifyInSandbox({ sessionId, daytona, number, baselineSha, patch, plan })));
      const verification = evaluatePairedVerification(results);
      await this.#store.mutate(sessionId, async (draft) => {
        draft.verification = { ...verification, policy: VERIFICATION_POLICY, completedAt: new Date().toISOString() };
        draft.status = verification.verdict === "verified" ? "completed" : verification.verdict;
        draft.phase = "completed";
        draft.nextAction = "Review the saved patch, report, and verdict; send a follow-up to the same project agent if needed.";
      });
      const reportArtifact = await this.#store.writeArtifact(sessionId, "verification-report.md", this.#report(sessionId, baselineSha, fingerprint, plan, verification), "text/markdown; charset=utf-8");
      await this.#store.appendEvent(sessionId, "verdict", `${verification.verdict.toUpperCase()}: ${verification.reason}`, { reportArtifactId: reportArtifact.id, aggregateImprovementPct: verification.aggregateImprovementPct });
      await this.#store.checkpoint(sessionId, "verification-complete");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected runner failure";
      await this.#store.mutate(sessionId, async (draft) => {
        draft.status = "failed";
        draft.phase = "failed";
        draft.error = message;
        draft.nextAction = "Inspect the recorded error and retry only after the saved state is understood.";
      });
      await this.#store.appendEvent(sessionId, "error", "Execution stopped with a recorded runtime error.", { message });
      await this.#store.checkpoint(sessionId, "failed");
    }
  }

  async #recordSandbox(sessionId, sandbox, role, status) {
    await this.#store.mutate(sessionId, async (draft) => {
      const existing = draft.sandboxes.find((item) => item.id === sandbox.id);
      const details = { id: sandbox.id, role, status, target: sandbox.target || "unknown", cpu: sandbox.cpu ?? null, memoryGiB: sandbox.memory ?? null, state: sandbox.state || "started" };
      if (existing) Object.assign(existing, details); else draft.sandboxes.push(details);
    });
  }

  async #runAgent(sessionId, sandbox, repoPath, baselineSha) {
    const session = await this.#store.get(sessionId);
    const llm = new OpenAICompatibleClient({ baseUrl: this.#config.proxyBaseUrl, apiKey: this.#config.proxyApiKey, model: this.#config.model });
    const system = [
      "You are the one persistent optimization agent for AgenticRocket.",
      "Work only in the provided Daytona repository. Read the README, source, build, tests, and benchmark before changing code.",
      "Make exactly one small source-level candidate. Preserve semantics. Do not invent benchmark output or results.",
      "Run baseline/candidate build and existing tests in the work sandbox. Then run the benchmark once as a preflight.",
      "Use set_verification_plan with commands you actually observed. Keep the benchmark deterministic and do not edit tests or benchmark inputs.",
      "Do not access credentials, external files, or paths outside the repository. Do not use network tools other than the already-cloned repository.",
      "This Daytona image commonly provides g++ but not CMake. If CMake is unavailable, do not retry or install it: compile the existing C++17 sources directly with g++, then use those observed commands in the verification plan.",
      "PulseLog's CLI requires one log-file argument. For its outputCommand, first run and then record a self-contained shell command that uses mktemp, writes a small valid log input, invokes the CLI with that file, verifies output, and removes the temporary file.",
      "For this fixed demo, the validated one-line CLI fixture is exactly: ts=1|status=200|latency_us=120|route=/users/123|method=GET. Its output check must assert records=1, errors=0, and routes=1; do not substitute another log format.",
      "After one source edit and the required observed checks, stop re-reading the repository: record the plan and call finish_candidate. After a continuity checkpoint, inspect git status/diff first and continue from that repository state.",
      `Pinned baseline SHA: ${baselineSha}. Repository root: ${repoPath}. User goal: ${session.goal}`,
    ].join("\n");
    let messages = [{ role: "system", content: system }, { role: "user", content: "Investigate, implement, and validate the best low-risk optimization now." }];
    let plan = null;
    let completed = false;

    for (let turn = 0; turn < MAX_AGENT_TURNS; turn += 1) {
      const message = await llm.complete(messages, TOOL_DEFINITIONS);
      messages.push(message);
      await this.#store.mutate(sessionId, async (draft) => { draft.agentHistory = messages; });
      if (!message.tool_calls?.length) {
        await this.#store.appendEvent(sessionId, "agent", boundedToolResult(message.content || "The agent completed a reasoning step."));
        continue;
      }
      for (const call of message.tool_calls) {
        let output;
        try {
          const args = JSON.parse(call.function.arguments || "{}");
          output = await this.#executeAgentTool({ sessionId, sandbox, repoPath, name: call.function.name, args, setPlan: (value) => { plan = value; }, finish: () => { completed = true; } });
        } catch (error) {
          output = { ok: false, error: error instanceof Error ? error.message : "Tool execution failed" };
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: boundedToolResult(output) });
        await this.#store.mutate(sessionId, async (draft) => { draft.agentHistory = messages; });
      }
      if (messages.length > 22) {
        const archived = JSON.stringify(messages.slice(0, -4), null, 2);
        await this.#store.writeArtifact(sessionId, `agent-history-${Date.now()}.json`, archived, "application/json");
        const currentSession = await this.#store.get(sessionId);
        const eventRecap = (currentSession?.events || [])
          .slice(-18)
          .map(({ type, summary }) => `- [${type}] ${summary}`)
          .join("\n");
        // A tool response is valid only beside the assistant tool-call that
        // created it. Start a clean protocol boundary after compaction instead
        // of carrying an arbitrary trailing slice of messages.
        messages = [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              "Recovered continuity checkpoint. Earlier tool history is archived.",
              "Inspect the persisted repository state before continuing; keep the fixed baseline and finish the outstanding candidate and verification plan.",
              "Recent persisted events:",
              eventRecap || "- No recent event metadata was retained.",
            ].join("\n"),
          },
        ];
        await this.#store.mutate(sessionId, async (draft) => { draft.agentHistory = messages; });
        await this.#store.checkpoint(sessionId, "forced-compact-test");
        await this.#store.appendEvent(sessionId, "checkpoint", "Forced compact path completed; baseline, candidate state, and recent tool boundary were preserved.");
      }
      if (completed && plan) return { ...validatePlan(plan), summary: plan.summary };
    }
    throw new Error("The persistent agent did not complete a candidate within the bounded tool budget.");
  }

  async #executeAgentTool({ sessionId, sandbox, repoPath, name, args, setPlan, finish }) {
    if (name === "list_files") {
      const result = await sandbox.process.executeCommand("find . -maxdepth 3 -type f | sort | head -240", repoPath, undefined, 45);
      await this.#store.appendEvent(sessionId, "tool", "Agent listed repository files.");
      return processResult(result);
    }
    if (name === "read_file") {
      if (!allowedRelativePath(args.path)) throw new Error("Invalid repository-relative path.");
      const result = await sandbox.process.executeCommand(`sed -n '1,420p' -- ${shellQuote(args.path)}`, repoPath, undefined, 45);
      await this.#store.appendEvent(sessionId, "tool", `Agent read ${args.path}.`);
      return processResult(result);
    }
    if (name === "run_command") {
      if (typeof args.command !== "string" || args.command.length > MAX_COMMAND_CHARS || /\brm\s+-rf\s+\//.test(args.command) || /\bsudo\b/.test(args.command)) throw new Error("Unsafe or oversized command rejected.");
      const result = await sandbox.process.executeCommand(args.command, repoPath, undefined, args.timeoutSeconds);
      await this.#store.appendEvent(sessionId, "tool", `Agent command finished (${result.exitCode ?? -1}): ${args.command.slice(0, 140)}`);
      return processResult(result);
    }
    if (name === "replace_file") {
      if (!allowedRelativePath(args.path) || typeof args.content !== "string" || args.content.length > 300_000) throw new Error("Invalid replacement file payload.");
      const target = `${repoPath}/${args.path}`;
      await this.#writeSandboxText(sandbox, target, args.content, repoPath);
      await this.#store.appendEvent(sessionId, "tool", `Agent replaced ${args.path}.`);
      return { ok: true, path: args.path, bytes: Buffer.byteLength(args.content) };
    }
    if (name === "set_verification_plan") {
      validatePlan(args);
      setPlan(args);
      await this.#store.appendEvent(sessionId, "plan", "Agent recorded the observed build, test, benchmark, and output verification commands.");
      return { ok: true };
    }
    if (name === "finish_candidate") {
      finish();
      await this.#store.appendEvent(sessionId, "agent", args.summary);
      return { ok: true };
    }
    throw new Error(`Unknown agent tool: ${name}`);
  }

  async #writeSandboxText(sandbox, target, content, workingDirectory) {
    try {
      await sandbox.fs.uploadFile(Buffer.from(content, "utf8"), target, 60);
    } catch (uploadError) {
      // Some Daytona SDK builds load their multipart helper lazily and cannot
      // resolve it from an ESM-only Node host. Keep the write sandbox-bound,
      // atomically replace the target, and use a shell-safe transport fallback.
      const encoded = Buffer.from(content, "utf8").toString("base64");
      const staged = `${target}.agenticrocket-${randomUUID()}`;
      const result = await sandbox.process.executeCommand(
        `printf %s ${shellQuote(encoded)} | base64 -d > ${shellQuote(staged)} && mv ${shellQuote(staged)} ${shellQuote(target)}`,
        workingDirectory,
        undefined,
        60,
      );
      if (result.exitCode !== 0) {
        const detail = commandOutput(result).slice(-500);
        const uploadMessage = uploadError instanceof Error ? uploadError.message : "SDK upload failed";
        throw new Error(`Sandbox text upload failed after SDK fallback: ${detail || uploadMessage}`);
      }
    }
  }

  async #preflightCandidate(sandbox, repoPath, plan) {
    for (const [label, command, timeout] of [["build", plan.buildCommand, 300], ["tests", plan.testCommand, 300], ["output", plan.outputCommand, 180], ["benchmark", plan.benchmarkCommand, 300]]) {
      const result = await sandbox.process.executeCommand(command, repoPath, undefined, timeout);
      const output = commandOutput(result);
      if (result.exitCode !== 0) return { ok: false, error: `Candidate ${label} preflight failed: ${output.slice(-700)}` };
      if (label === "benchmark" && !output.trim()) return { ok: false, error: "Candidate benchmark preflight produced no output." };
    }
    return { ok: true, completedAt: new Date().toISOString() };
  }

  async #verifyInSandbox({ sessionId, daytona, number, baselineSha, patch, plan }) {
    const result = { sandbox: number, testsPassed: false, outputPassed: false, baselineSamples: [], candidateSamples: [], commandOrder: [] };
    let sandbox;
    try {
      await this.#store.appendEvent(sessionId, "verification", `Creating benchmark sandbox ${number}/3.`);
      sandbox = await daytona.create({ language: "typescript", autoStopInterval: 20, autoDeleteInterval: 180, labels: { product: "agenticrocket", session: sessionId, role: "benchmark", ordinal: String(number) } }, { timeout: 120 });
      await this.#recordSandbox(sessionId, sandbox, "benchmark", "running");
      const root = (await sandbox.getWorkDir()) || "/home/daytona";
      const baselinePath = `${root}/baseline`;
      const candidatePath = `${root}/candidate`;
      const setup = await sandbox.process.executeCommand([
        `git clone ${shellQuote(DEMO_REPOSITORY)} ${shellQuote(baselinePath)}`,
        `git -C ${shellQuote(baselinePath)} checkout ${shellQuote(baselineSha)}`,
        `git clone ${shellQuote(DEMO_REPOSITORY)} ${shellQuote(candidatePath)}`,
        `git -C ${shellQuote(candidatePath)} checkout ${shellQuote(baselineSha)}`,
      ].join(" && "), root, undefined, 300);
      if (setup.exitCode !== 0) throw new Error(`Sandbox ${number} setup failed: ${commandOutput(setup).slice(-500)}`);
      const patchPath = `${root}/candidate.patch`;
      await this.#writeSandboxText(sandbox, patchPath, patch, root);
      const applied = await sandbox.process.executeCommand(`git apply --whitespace=error ${shellQuote(patchPath)}`, candidatePath, undefined, 60);
      if (applied.exitCode !== 0) throw new Error(`Sandbox ${number} could not apply candidate patch: ${commandOutput(applied).slice(-500)}`);
      for (const [path, variant] of [[baselinePath, "baseline"], [candidatePath, "candidate"]]) {
        const build = await sandbox.process.executeCommand(plan.buildCommand, path, undefined, 300);
        const tests = await sandbox.process.executeCommand(plan.testCommand, path, undefined, 300);
        const output = await sandbox.process.executeCommand(plan.outputCommand, path, undefined, 180);
        if (build.exitCode !== 0 || tests.exitCode !== 0 || output.exitCode !== 0) throw new Error(`Sandbox ${number} ${variant} correctness command failed.`);
      }
      result.testsPassed = true;
      result.outputPassed = true;
      const order = ["baseline", "candidate", "candidate", "baseline", "baseline", "candidate"];
      for (const variant of order) {
        const path = variant === "baseline" ? baselinePath : candidatePath;
        const benchmark = await sandbox.process.executeCommand(verificationCommand(plan.benchmarkCommand), path, undefined, 300);
        const output = commandOutput(benchmark);
        const milliseconds = benchmark.exitCode === 0 ? parseElapsedMilliseconds(output) : null;
        if (!milliseconds || !Number.isFinite(milliseconds)) throw new Error(`Sandbox ${number} ${variant} benchmark did not produce a usable elapsed time.`);
        result[variant === "baseline" ? "baselineSamples" : "candidateSamples"].push(milliseconds);
        result.commandOrder.push(variant);
      }
      await this.#recordSandbox(sessionId, sandbox, "benchmark", "completed");
      await this.#store.appendEvent(sessionId, "verification", `Sandbox ${number}/3 completed paired measurement.`, { baselineMs: sampleAverage(result.baselineSamples), candidateMs: sampleAverage(result.candidateSamples) });
      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Unknown sandbox error";
      await this.#store.appendEvent(sessionId, "verification-error", `Sandbox ${number}/3 failed without being hidden.`, { message: result.error });
      if (sandbox) await this.#recordSandbox(sessionId, sandbox, "benchmark", "failed");
      return result;
    }
  }

  #report(sessionId, baselineSha, fingerprint, plan, verification) {
    const rows = verification.runs.map((run) => `| ${run.sandbox} | ${run.baselineMs?.toFixed(2) ?? "—"} | ${run.candidateMs?.toFixed(2) ?? "—"} | ${run.improvementPct?.toFixed(2) ?? "—"}% | ${run.outcome} |`).join("\n");
    return `# AgenticRocket verification report\n\n- Session: ${sessionId}\n- Baseline commit: ${baselineSha}\n- Candidate fingerprint (SHA-256): ${fingerprint}\n- Verdict: **${verification.verdict}**\n- Reason: ${verification.reason}\n- Aggregate latency reduction: ${verification.aggregateImprovementPct?.toFixed(2) ?? "—"}%\n\n## Fixed conditions\n\n- Build: \`${plan.buildCommand}\`\n- Tests: \`${plan.testCommand}\`\n- Benchmark: \`${plan.benchmarkCommand}\`\n- Output check: \`${plan.outputCommand}\`\n- Three Daytona sandboxes each ran warm correctness checks then a balanced baseline/candidate sequence: baseline → candidate → candidate → baseline → baseline → candidate.\n- Adoption policy: at least ${VERIFICATION_POLICY.minImprovementPct}% and 1.5× baseline CV, with baseline CV capped at ${VERIFICATION_POLICY.maxBaselineCoefficientOfVariationPct}%.\n\n## Paired results\n\n| Sandbox | Baseline ms | Candidate ms | Reduction | Outcome |\n| --- | ---: | ---: | ---: | --- |\n${rows}\n\n## Scope\n\nTests and output checks establish behavior only within the project checks that were actually executed. The three sandboxes are independent Daytona executions; this report does not claim host-level statistical independence.\n`;
  }
}
