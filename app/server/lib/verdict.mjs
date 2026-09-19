export const VERIFICATION_POLICY = Object.freeze({
  minImprovementPct: 2,
  minimumSamplesPerSide: 3,
  maxBaselineCoefficientOfVariationPct: 8,
  maxCandidateCoefficientOfVariationPct: 8,
  noiseMultiplier: 1.5,
});

export const average = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;

export function coefficientOfVariation(values) {
  if (values.length < 2) return 0;
  const mean = average(values);
  if (mean <= 0) return Number.POSITIVE_INFINITY;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1);
  return (Math.sqrt(variance) / mean) * 100;
}

function validSamples(samples) {
  return Array.isArray(samples) && samples.length >= VERIFICATION_POLICY.minimumSamplesPerSide
    && samples.every((sample) => Number.isFinite(sample) && sample > 0);
}

export function evaluatePairedVerification(runs, policy = VERIFICATION_POLICY) {
  if (!Array.isArray(runs) || runs.length !== 3) {
    return { verdict: "inconclusive", reason: "Three sandbox results are required.", runs: [] };
  }

  const evaluated = runs.map((run) => {
    const baselineSamples = run.baselineSamples || [];
    const candidateSamples = run.candidateSamples || [];
    if (run.error && run.failureKind !== "correctness") {
      return { ...run, valid: false, outcome: "execution-error", improvementPct: null };
    }
    if (!run.testsPassed || !run.outputPassed) {
      return { ...run, valid: false, outcome: "correctness-failed", improvementPct: null };
    }
    if (!validSamples(baselineSamples) || !validSamples(candidateSamples)) {
      return { ...run, valid: false, outcome: "insufficient-samples", improvementPct: null };
    }
    const baselineMs = average(baselineSamples);
    const candidateMs = average(candidateSamples);
    const improvementPct = ((baselineMs - candidateMs) / baselineMs) * 100;
    const baselineCvPct = coefficientOfVariation(baselineSamples);
    const candidateCvPct = coefficientOfVariation(candidateSamples);
    const minimumMeaningfulImprovement = Math.max(
      policy.minImprovementPct,
      Math.max(baselineCvPct, candidateCvPct, policy.calibrationCvPct || 0) * policy.noiseMultiplier,
    );
    const valid = baselineCvPct <= policy.maxBaselineCoefficientOfVariationPct
      && candidateCvPct <= policy.maxCandidateCoefficientOfVariationPct
      && (policy.calibrationCvPct || 0) <= policy.maxBaselineCoefficientOfVariationPct;
    return {
      ...run,
      baselineMs,
      candidateMs,
      improvementPct,
      baselineCvPct,
      candidateCvPct,
      thresholdPct: minimumMeaningfulImprovement,
      valid,
      outcome: !valid ? "noisy" : improvementPct >= minimumMeaningfulImprovement ? "improved" : improvementPct < 0 ? "regressed" : "below-threshold",
    };
  });

  const aggregateImprovementPct = average(evaluated.filter((run) => Number.isFinite(run.improvementPct)).map((run) => run.improvementPct));
  if (evaluated.some((run) => run.outcome === "correctness-failed")) {
    return { verdict: "rejected", reason: "Correctness checks failed in at least one sandbox.", aggregateImprovementPct, runs: evaluated };
  }
  if (evaluated.every((run) => run.outcome === "improved")) {
    return { verdict: "verified", reason: "All three paired sandbox measurements exceeded their fixed noise-aware threshold.", aggregateImprovementPct, runs: evaluated };
  }
  if (evaluated.every((run) => run.valid && ["regressed", "below-threshold"].includes(run.outcome))) {
    return { verdict: "rejected", reason: "The candidate regressed or did not reach the pre-declared adoption threshold.", aggregateImprovementPct, runs: evaluated };
  }
  return { verdict: "inconclusive", reason: "The measurements were incomplete, noisy, or inconsistent across sandboxes.", aggregateImprovementPct, runs: evaluated };
}
