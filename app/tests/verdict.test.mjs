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
  const result = evaluatePairedVerification([passingRun(), passingRun(), passingRun()]);

  assert.equal(result.verdict, "verified");
  assert.equal(result.runs.every((run) => run.outcome === "improved"), true);
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
    passingRun({ baselineSamples: [70, 100, 130], candidateSamples: [65, 95, 125] }),
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
