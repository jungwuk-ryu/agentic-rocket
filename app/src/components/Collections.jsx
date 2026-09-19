import { useState } from "react";
import {
  ArrowRight,
  ArrowSquareOut,
  BookOpen,
  ChartLineUp,
  CheckCircle,
  CircleNotch,
  Clock,
  DownloadSimple,
  FileText,
  GitBranch,
  Plus,
  RocketLaunch,
  SquaresFour,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  REPOSITORY,
  DEFAULT_GOAL,
  ACTIVE_STATUSES,
  timestamp,
  downloadArtifact,
  currentVerification,
} from "../lib/session-view.js";
import { EmptyState, PageHeading, Status } from "./common.jsx";
import { RunGrid } from "./Verification.jsx";
import { PipelineVisual, ProcessStrip, ConnectionVisual } from "./Graphics.jsx";

export function Start({
  configuration,
  configurationError,
  create,
  busy,
  sessions,
  canStartMultiple = false,
}) {
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const ready = configuration?.credentialsReady === true && !configurationError;
  const activeId =
    canStartMultiple
      ? null
      : configuration?.activeSessionId ||
        sessions.find((item) => ACTIVE_STATUSES.has(item.status))?.id;
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy" data-reveal>
        <p className="eyebrow">
          <i /> DAYTONA × OPENAI
        </p>
        <h1>
          Make a patch.
          <br />
          Prove it belongs.
        </h1>
        <p className="intro">
          One persistent agent for your project. From the first inspection to a
          fixed candidate, with correctness checks and three paired sandbox
          measurements.
        </p>
        <div className="repository">
          <GitBranch />
          <div>
            <strong>{REPOSITORY}</strong>
            <small>
              Public C++17 performance demo · baseline commit pinned at run
              start
            </small>
          </div>
          <CheckCircle weight="fill" />
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create(goal);
          }}
        >
          <label className="goal">
            <span>Optimization objective</span>
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              maxLength={1000}
              rows={3}
              required
            />
          </label>
          <button
            className="button primary"
            disabled={busy || !goal.trim() || !ready || Boolean(activeId)}
          >
            {busy ? (
              <CircleNotch className="spin" />
            ) : (
              <RocketLaunch weight="fill" />
            )}
            {busy ? "Creating session…" : "Optimize this project"}
            <ArrowRight />
          </button>
        </form>
        <div className="proof">
          <span>
            <CheckCircle /> Fixed test contract
          </span>
          <span>
            <CheckCircle /> Fingerprinted patch
          </span>
          <span>
            <CheckCircle /> Raw evidence retained
          </span>
        </div>
        {activeId && (
          <div className="notice">
            <Clock />
            <div>
              This project already has an active operation.{" "}
              <a href={`#/sessions/${activeId}`}>
                Open the running session <ArrowRight />
              </a>
            </div>
          </div>
        )}
        {configurationError && (
          <div className="notice warning">
            <WarningCircle />
            <p>
              We could not check the server configuration.{" "}
              <a href="#/connections">Review connections</a> before starting a
              run.
            </p>
          </div>
        )}
        {configuration && !ready && (
          <div className="notice warning">
            <WarningCircle />
            <div>
              Missing server configuration:{" "}
              {(configuration.configurationMissing || []).join(", ") ||
                "provider credentials"}
              . <a href="#/connections">View details</a>
            </div>
          </div>
        )}
        <div className="hero-footer">
          <span>Already started something?</span>
          <a href="#/sessions">
            Browse{" "}
            {sessions.length
              ? `${sessions.length} saved sessions`
              : "session history"}{" "}
            <ArrowRight />
          </a>
        </div>
        </div>
        <PipelineVisual />
      </section>
      <ProcessStrip />
    </div>
  );
}

export function SessionList({ sessions, loading, error, refresh }) {
  const [search, setSearch] = useState("");
  const filtered = sessions.filter((item) =>
    `${item.goal} ${item.id} ${item.status}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="collection-page">
      <PageHeading
        eyebrow="PERSISTENT WORKSPACE"
        title="Sessions"
        graphic="sessions"
        action={
          <a className="button" href="#/home">
            <Plus /> New session
          </a>
        }
      >
        Continue a project, inspect its history, or review the evidence behind a
        decision.
      </PageHeading>
      <div className="collection-toolbar">
        <label>
          Find a session
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search goal, status, or session ID"
          />
        </label>
        <button className="button" onClick={refresh} disabled={loading}>
          {loading ? <CircleNotch className="spin" /> : <Clock />} Refresh
        </button>
      </div>
      {error && (
        <div className="notice warning" role="alert">
          <WarningCircle />
          {error}
        </div>
      )}
      {!filtered.length ? (
        <EmptyState
          icon={SquaresFour}
          title={loading ? "Loading saved sessions…" : "No matching sessions"}
        >
          {loading
            ? "Reading durable session records from the server."
            : "Start a new session from Home, or adjust your search."}
        </EmptyState>
      ) : (
        <div className="session-list">
          {filtered.map((item) => {
            const verification = currentVerification(item);
            return (
              <a
                className="session-row"
                key={item.id}
                href={`#/sessions/${item.id}`}
              >
                <div className="session-symbol">
                  <RocketLaunch />
                </div>
                <div className="session-description">
                  <strong>{item.goal}</strong>
                  <small>
                    {item.id.slice(0, 8)} · Updated {timestamp(item.updatedAt)}
                  </small>
                </div>
                <div className="session-summary">
                  <Status value={item.status} />
                  {item.verification && (
                    <small>
                      {verification
                        ? `${verification.verdict} · current contract`
                        : "Historical result · unverified"}
                    </small>
                  )}
                </div>
                <ArrowRight />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Benchmarks({ sessions }) {
  const measured = sessions.filter(
    (item) => item.verification || item.verificationAttempt,
  );
  return (
    <div className="collection-page">
      <PageHeading eyebrow="PAIRED MEASUREMENTS" title="Benchmarks" graphic="benchmarks">
        Native benchmark medians, correctness checks, and noise-aware decisions.
        Historical results are never counted as verified under the current
        contract.
      </PageHeading>
      {!measured.length ? (
        <EmptyState icon={ChartLineUp} title="No benchmark attempts yet">
          A session's measurements will appear here once a candidate reaches
          verification.
        </EmptyState>
      ) : (
        measured.map((session) => {
          const verification = currentVerification(session);
          const legacy = session.verification && !verification;
          return (
            <section className="benchmark-record" key={session.id}>
              <header>
                <div>
                  <a href={`#/sessions/${session.id}`}>
                    {session.goal} <ArrowSquareOut />
                  </a>
                  <small>
                    {session.id.slice(0, 8)} ·{" "}
                    {verification?.metric ||
                      (legacy ? "Legacy timing" : "Measurements in progress")}
                  </small>
                </div>
                <span
                  className={`verdict-label ${verification?.verdict || ""}`}
                >
                  {verification?.verdict ||
                    (legacy ? "historical · unverified" : "in progress")}
                </span>
              </header>
              {legacy ? (
                <p className="record-description">
                  Saved before the fixed correctness and native-timing contract.
                  Open the session to inspect its original artifacts; this
                  result does not support a current performance claim.
                </p>
              ) : (
                <>
                  <p className="record-description">
                    {verification?.reason ||
                      "Waiting for the full paired run. A partial result is not a performance verdict."}
                  </p>
                  <RunGrid session={session} />
                </>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

export function EvidenceLibrary({ sessions }) {
  const [filter, setFilter] = useState("deliverables");
  const [search, setSearch] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const saveArtifact = async (session, artifact) => {
    setDownloadError("");
    try {
      await downloadArtifact(session, artifact);
    } catch (error) {
      setDownloadError(error.message || "The artifact could not be downloaded.");
    }
  };
  const artifacts = sessions
    .flatMap((session) =>
      (session.artifacts || []).map((artifact) => ({ session, artifact })),
    )
    .filter(
      ({ session, artifact }) =>
        (filter === "all" ||
          /\.patch$|report|draft/i.test(artifact.filename)) &&
        `${session.goal} ${session.id} ${artifact.filename}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  return (
    <div className="collection-page">
      <PageHeading eyebrow="DURABLE ARTIFACTS" title="Evidence library" graphic="evidence">
        Original patches, verification reports, and full command logs. Every
        download remains attached to the session that produced it.
      </PageHeading>
      <div className="collection-toolbar">
        <label>
          Find evidence
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filename, session ID, or goal"
          />
        </label>
        <label>
          Show
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="deliverables">Patches & reports</option>
            <option value="all">All evidence & raw logs</option>
          </select>
        </label>
      </div>
      {downloadError && <p className="inline-error" role="alert">{downloadError}</p>}
      {!artifacts.length ? (
        <EmptyState icon={BookOpen} title="No matching evidence">
          Choose all evidence to include command logs, or start a session to
          produce artifacts.
        </EmptyState>
      ) : (
        <div className="artifact-list">
          {artifacts.map(({ session, artifact }) => {
            const currentReport =
              currentVerification(session)?.reportArtifactId === artifact.id;
            const currentPatch =
              session.candidate?.patchArtifactId === artifact.id;
            return (
              <article className="artifact-row" key={artifact.id}>
                <FileText />
                <div>
                  <button
                    className="artifact-download"
                    onClick={() => saveArtifact(session, artifact)}
                  >
                    {artifact.filename}
                  </button>
                  <small>
                    <a href={`#/sessions/${session.id}`}>
                      Session {session.id.slice(0, 8)}
                    </a>{" "}
                    · {timestamp(artifact.createdAt)} ·{" "}
                    {Number(artifact.bytes || 0).toLocaleString()} bytes
                  </small>
                  <code>SHA-256 {artifact.hash}</code>
                  <span>
                    {currentReport
                      ? "Current verification report"
                      : currentPatch
                        ? "Current candidate patch"
                        : "Saved evidence · may refer to an earlier attempt"}
                  </span>
                </div>
                <button
                  className="icon-button"
                  onClick={() => saveArtifact(session, artifact)}
                  aria-label={`Download ${artifact.filename}`}
                >
                  <DownloadSimple />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Connections({ configuration, error, refresh }) {
  return (
    <div className="collection-page">
      <PageHeading
        eyebrow="SERVER CONNECTIONS"
        title="Connections"
        graphic="connections"
        action={
          <button className="button" onClick={refresh}>
            <Clock /> Check again
          </button>
        }
      >
        Credentials are managed on the server. Secrets are never sent to this
        browser.
      </PageHeading>
      <section className="connection-card" data-spotlight data-reveal>
        <ConnectionVisual ready={configuration?.credentialsReady === true && !error} />
        <h2>
          {error
            ? "Connection check unavailable"
            : !configuration
              ? "Checking configuration…"
              : configuration.credentialsReady
                ? "Ready to start a session"
                : "Server configuration required"}
        </h2>
        <p>
          {error ||
            (configuration?.credentialsReady
              ? "The server has the required model and sandbox credentials configured. Each run records the actual provider response; configured credentials are not a provider availability guarantee."
              : "The server administrator must configure the missing values below before new work can start.")}
        </p>
        <dl>
          <dt>Model</dt>
          <dd>{configuration?.model || "Checking…"}</dd>
          <dt>Repository</dt>
          <dd>{configuration?.repositoryUrl || REPOSITORY}</dd>
          <dt>Required configuration</dt>
          <dd>
            {configuration?.credentialsReady
              ? "Present"
              : (configuration?.configurationMissing || []).join(", ") ||
                "Checking…"}
          </dd>
          <dt>Active operation</dt>
          <dd>
            {configuration?.activeSessionId ? (
              <a href={`#/sessions/${configuration.activeSessionId}`}>
                Open session {configuration.activeSessionId.slice(0, 8)}{" "}
                <ArrowRight />
              </a>
            ) : (
              "None reported"
            )}
          </dd>
        </dl>
        <p className="connection-note">
          An older session may retain a previous configuration error. That
          historical message does not describe the server's current
          configuration.
        </p>
      </section>
    </div>
  );
}
