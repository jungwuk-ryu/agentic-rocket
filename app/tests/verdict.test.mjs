import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePairedVerification } from "../server/lib/verdict.mjs";

const passingRun = (overrides = {}) => ({
  testsPassed: true,
  outputPassed: true,
  baselineSamples: [100, 101, 99],
  candidateSamples: [95, 96, 94],
  ...overrides,
});

test("verifies an improvement when all three sandboxes are green", () => {
  const result = evaluatePairedVerification([
    passingRun(),
    passingRun(),
    passingRun(),
  ]);

  assert.equal(result.verdict, "verified");
  assert.equal(
    result.runs.every((run) => run.outcome === "improved"),
    true,
  );
});

test("rejects the candidate when a sandbox correctness check fails", () => {
  const result = evaluatePairedVerification([
    passingRun(),
    passingRun({ outputPassed: false }),
    passingRun(),
  ]);

  assert.equal(result.verdict, "rejected");
  assert.match(result.reason, /Correctness checks failed/);
});

test("returns inconclusive for noisy or incomplete measurements", () => {
  const noisy = evaluatePairedVerification([
    passingRun(),
    passingRun({
      baselineSamples: [70, 100, 130],
      candidateSamples: [65, 95, 125],
    }),
    passingRun(),
  ]);
  const incomplete = evaluatePairedVerification([
    passingRun(),
    passingRun({ candidateSamples: [] }),
    passingRun(),
  ]);

  assert.equal(noisy.verdict, "inconclusive");
  assert.equal(incomplete.verdict, "inconclusive");
});

test("keeps infrastructure failures, unexecuted checks, conflicting environments, and candidate variance inconclusive", () => {
  const cases = [
    {
      name: "sandbox creation failed",
      run: {
        error: "Sandbox unavailable",
        failureKind: "execution",
        testsPassed: null,
        outputPassed: null,
      },
      outcome: "execution-error",
    },
    {
      name: "checks have not run",
      run: { testsPassed: null, outputPassed: null },
    },
    {
      name: "two improvements and one regression",
      run: { candidateSamples: [110, 111, 109] },
      outcome: "regressed",
    },
    {
      name: "candidate is highly variable",
      run: { baselineSamples: [100, 100, 100], candidateSamples: [1, 1, 250] },
      outcome: "noisy",
    },
  ];
  for (const { name, run, outcome } of cases) {
    const result = evaluatePairedVerification([
      passingRun(),
      passingRun(),
      passingRun(run),
    ]);
    assert.equal(result.verdict, "inconclusive", name);
    if (outcome) assert.equal(result.runs[2].outcome, outcome, name);
  }
});
