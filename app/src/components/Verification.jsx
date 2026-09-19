import {
  ChartLineUp,
  CheckCircle,
  Clock,
  Cube,
  WarningCircle,
} from "@phosphor-icons/react";
import { milliseconds, currentVerification } from "../lib/session-view.js";

export function Sandbox({ number, sandbox, run }) {
  const status = run?.error
    ? "failed"
    : run?.outcome === "noisy"
      ? "noisy"
      : run
        ? "completed"
        : sandbox?.status || "waiting";
  const checksPassed = run?.testsPassed === true && run?.outputPassed === true;
  const measured =
    Number.isFinite(run?.baselineMs) && Number.isFinite(run?.candidateMs);
  const improvement = run?.improvementPct;
  return (
    <article className={`sandbox ${status}`} data-spotlight>
      <header>
        <small>PAIRED SANDBOX {number}</small>
        {run?.error || run?.outcome === "noisy" ? (
          <WarningCircle />
        ) : run ? (
          <CheckCircle />
        ) : (
          <Clock />
        )}
      </header>
      <h3>
        {run?.error
          ? "Run needs attention"
          : run?.outcome === "noisy"
            ? "Measurement is noisy"
            : run
              ? "Paired run recorded"
              : sandbox
                ? "Measuring candidate"
                : "Awaiting candidate"}
      </h3>
      <p className="sandbox-identity">
        <Cube />
        {sandbox?.id || run?.sandboxId || "Not allocated"}
      </p>
      {run ? (
        <>
          <dl>
            <dt>Baseline mean</dt>
            <dd>{milliseconds(run.baselineMs)}</dd>
            <dt>Candidate mean</dt>
            <dd>{milliseconds(run.candidateMs)}</dd>
          </dl>
          {measured && (
            <div
              className="comparison-bars"
              aria-label={`Baseline ${milliseconds(run.baselineMs)}, candidate ${milliseconds(run.candidateMs)}`}
            >
              <i
                style={{
                  width: `${(100 * run.baselineMs) / Math.max(run.baselineMs, run.candidateMs)}%`,
                }}
              />
              <b
                style={{
                  width: `${(100 * run.candidateMs) / Math.max(run.baselineMs, run.candidateMs)}%`,
                }}
              />
            </div>
          )}
          <footer>
            <span>
              {checksPassed ? <CheckCircle /> : <WarningCircle />}
              {checksPassed
                ? "Correctness passed"
                : run.failureKind === "correctness"
                  ? "Correctness failed"
                  : "Checks incomplete"}
            </span>
            <strong
              className={
                run.outcome === "improved"
                  ? "positive"
                  : improvement < 0
                    ? "negative"
                    : ""
              }
            >
              {Number.isFinite(improvement)
                ? `${improvement > 0 ? "−" : "+"}${Math.abs(improvement).toFixed(2)}%`
                : run.outcome || "Pending verdict"}
            </strong>
          </footer>
          {run.error && <p className="run-error">{run.error}</p>}
          {run.outcome && (
            <small className="run-outcome">Outcome: {run.outcome}</small>
          )}
        </>
      ) : (
        <p className="pending">
          Both revisions run in this same environment. Results appear after
          checks and measurements finish.
        </p>
      )}
      {sandbox?.cleanup && (
        <small className="cleanup-state">
          Resource:{" "}
          {sandbox.cleanup === "deleted" ? "released" : sandbox.cleanup}
        </small>
      )}
    </article>
  );
}

export function RunGrid({ session }) {
  const verification = currentVerification(session);
  const attempt =
    session.verificationAttempt?.candidateFingerprint ===
    session.candidate?.fingerprint
      ? session.verificationAttempt
      : null;
  const attemptId = verification?.attemptId || attempt?.id;
  const runs = verification?.runs || attempt?.runs || [];
  return (
    <div className="sandboxes">
      {[1, 2, 3].map((number) => {
        const run = runs.find((item) => item.sandbox === number);
        const sandbox = (session.sandboxes || []).find(
          (item) =>
            item.role === "benchmark" &&
            (run?.sandboxId
              ? item.id === run.sandboxId
              : Boolean(attemptId) &&
                item.attemptId === attemptId &&
                item.ordinal === number),
        );
        return (
          <Sandbox
            key={`${attemptId || "pending"}-${number}`}
            number={number}
            sandbox={sandbox}
            run={run}
          />
        );
      })}
    </div>
  );
}

export function Verdict({ session }) {
  const verdict = currentVerification(session);
  const historical = Boolean(session.verification && !verdict);
  return (
    <section className="panel verdict">
      <header>
        <span>
          <ChartLineUp /> Verdict
        </span>
        <em className={`verdict-label ${verdict?.verdict || ""}`}>
          {verdict?.verdict || (historical ? "historical" : "pending")}
        </em>
      </header>
      <h3>
        {historical
          ? "Historical result. Not verified."
          : verdict?.verdict === "verified"
            ? "Candidate is verified."
            : verdict?.verdict === "rejected"
              ? "Candidate is rejected."
              : verdict
                ? "Evidence is inconclusive."
                : "No performance claim yet."}
      </h3>
      <p>
        {historical
          ? "This result predates the current fixed test and native-timing contract. Its original artifacts remain available, but its performance percentage is not trusted."
          : verdict?.reason ||
            "A verdict requires the exact candidate and all three paired sandbox results."}
      </p>
      {verdict && (
        <footer>
          <span>
            Observed mean reduction
            <br />
            <small>
              {verdict.verdict === "verified"
                ? "Accepted by the fixed policy"
                : "Not an accepted performance claim"}
            </small>
          </span>
          <b className={verdict.verdict === "verified" ? "positive" : ""}>
            {Number.isFinite(verdict.aggregateImprovementPct)
              ? `${verdict.aggregateImprovementPct.toFixed(2)}%`
              : "—"}
          </b>
        </footer>
      )}
    </section>
  );
}
