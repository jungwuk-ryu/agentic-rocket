import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowSquareOut,
  ChartLineUp,
  CheckCircle,
  CircleNotch,
  Copy,
  DownloadSimple,
  FileCode,
  FileText,
  GitBranch,
  ListChecks,
  RocketLaunch,
  StopCircle,
  TestTube,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  REPOSITORY,
  ACTIVE_STATUSES,
  PHASES,
  timestamp,
  authorizedFetch,
  downloadArtifact,
  currentVerification,
  request,
} from "../lib/session-view.js";
import { EmptyState, Status } from "./common.jsx";
import { RunGrid, Verdict } from "./Verification.jsx";

export function Progress({ session }) {
  const index = PHASES.findIndex(([name]) => name === session.phase);
  const active = Math.max(0, index);
  const terminal =
    ["completed", "rejected", "inconclusive"].includes(session.status) &&
    Boolean(currentVerification(session));
  return (
    <ol className="progress" aria-label="Session stages" data-reveal>
      {PHASES.map(([name, label], position) => {
        const done = terminal || (index >= 0 && position < active);
        const working = position === active && session.status === "running";
        return (
          <li key={name} aria-current={working ? "step" : undefined}>
            <span className={done ? "done" : working ? "working" : ""}>
              {done ? (
                <CheckCircle weight="fill" />
              ) : working ? (
                <CircleNotch className="spin" />
              ) : (
                position + 1
              )}
            </span>
            <b>{label}</b>
          </li>
        );
      })}
    </ol>
  );
}

export function Activity({ session }) {
  const [downloadError, setDownloadError] = useState("");
  const saveArtifact = async (artifact) => {
    setDownloadError("");
    try {
      await downloadArtifact(session, artifact);
    } catch (error) {
      setDownloadError(error.message || "The command log could not be downloaded.");
    }
  };
  return (
    <section className="panel activity">
      <header>
        <span>
          <ListChecks /> Activity
        </span>
        <small>
          {ACTIVE_STATUSES.has(session.status)
            ? "Live events"
            : "Saved history"}
        </small>
      </header>
      <ol>
        {(session.events || [])
          .slice(-7)
          .reverse()
          .map((event) => (
            <li key={event.id}>
              <i className={event.type} />
              <div>
                <strong>{event.summary}</strong>
                <small>
                  {timestamp(event.at)} · {event.type}
                </small>
                {event.type === "tool" && event.details?.artifactId && (
                  <button
                    className="text-link activity-download"
                    onClick={() => saveArtifact({ id: event.details.artifactId, filename: "command.log" })}
                  >
                    Raw command log <ArrowSquareOut />
                  </button>
                )}
              </div>
            </li>
          ))}
      </ol>
      {downloadError && <p className="inline-error" role="alert">{downloadError}</p>}
      {!session.events?.length && <p>No events recorded yet.</p>}
    </section>
  );
}

export function Diff({ session }) {
  const [patch, setPatch] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const artifactId = session.candidate?.patchArtifactId;
  useEffect(() => {
    const controller = new AbortController();
    setPatch("");
    setError("");
    setCopied(false);
    if (artifactId)
      authorizedFetch(`/api/sessions/${session.id}/artifacts/${artifactId}/download`, {
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok)
            throw new Error(
              "The patch could not be loaded. Check the artifact download.",
            );
          return response.text();
        })
        .then(setPatch)
        .catch((issue) => {
          if (issue.name !== "AbortError") setError(issue.message);
        });
    return () => controller.abort();
  }, [session.id, artifactId]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(patch);
      setCopied(true);
    } catch {
      setError(
        "Clipboard access was unavailable. You can download the original patch below.",
      );
    }
  };
  return (
    <section className="panel diff">
      <header>
        <span>
          <FileCode /> Candidate diff
        </span>
        <div>
          {session.candidate && (
            <small>SHA-256 {session.candidate.fingerprint?.slice(0, 12)}</small>
          )}
          <button
            className="icon-button"
            onClick={copy}
            disabled={!patch}
            aria-label={copied ? "Patch copied" : "Copy patch"}
          >
            {copied ? <CheckCircle /> : <Copy />}
          </button>
        </div>
      </header>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {patch ? (
        <>
          <pre tabIndex={0} aria-label="Candidate patch preview">
            {patch
              .split("\n")
              .slice(0, 80)
              .map((line, index) => (
                <code
                  key={index}
                  className={
                    line.startsWith("+")
                      ? "add"
                      : line.startsWith("-")
                        ? "remove"
                        : ""
                  }
                >
                  {line || " "}
                  {"\n"}
                </code>
              ))}
          </pre>
          {patch.split("\n").length > 80 && (
            <p className="diff-note">
              Preview shows the first 80 lines. Download the patch for the
              complete, original file.
            </p>
          )}
        </>
      ) : (
        <EmptyState
          icon={FileCode}
          title={
            artifactId ? "Loading candidate patch…" : "No candidate frozen yet"
          }
        >
          Once frozen, this exact artifact is used by every verification worker.
        </EmptyState>
      )}
    </section>
  );
}

export function Deliverables({ session, prepare, busy }) {
  const patch = session.artifacts?.find(
    (item) => item.id === session.candidate?.patchArtifactId,
  );
  const verification = currentVerification(session);
  const report = session.artifacts?.find(
    (item) => item.id === verification?.reportArtifactId,
  );
  const [downloadError, setDownloadError] = useState("");
  const saveArtifact = async (artifact) => {
    setDownloadError("");
    try {
      await downloadArtifact(session, artifact);
    } catch (error) {
      setDownloadError(error.message || "The artifact could not be downloaded.");
    }
  };
  return (
    <section className="deliverables">
      <div>
        <p className="eyebrow">IMMUTABLE OUTPUT</p>
        <h2>Bring the proof with you.</h2>
        <p>
          {report
            ? "The report is bound to this candidate's fingerprint and verification attempt."
            : "A current report appears only after this exact candidate has been evaluated."}
        </p>
      </div>
      <div className="action-group">
        {patch ? (
          <button className="button" onClick={() => saveArtifact(patch)}>
            <DownloadSimple /> Download patch
          </button>
        ) : (
          <button className="button" disabled>
            <DownloadSimple /> Download patch
          </button>
        )}
        {report ? (
          <button className="button" onClick={() => saveArtifact(report)}>
            <FileText /> Current report
          </button>
        ) : (
          <button className="button" disabled>
            <FileText /> Current report
          </button>
        )}
        <button
          className="button accent"
          onClick={prepare}
          disabled={!patch || !report || busy}
        >
          Prepare PR draft <ArrowRight />
        </button>
      </div>
      {downloadError && <p className="inline-error" role="alert">{downloadError}</p>}
    </section>
  );
}

export function Conversation({ session, send, busy, configured, canChat = false }) {
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(() =>
    Boolean(session.messages?.length),
  );
  const messagesRef = useRef(null);
  const messageCount = session.messages?.length ?? 0;
  const queuedCount = session.pendingMessages?.length ?? 0;
  const latestAgentMessage = [...(session.messages || [])]
    .reverse()
    .find((item) => item.role === "assistant");
  const chatLocked = !canChat;
  const unavailable = !configured || session.status === "cancelling";
  const sendDisabled = !message.trim() || busy || unavailable || chatLocked;

  useEffect(() => {
    if (!expanded || !messagesRef.current) return;
    messagesRef.current.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [expanded, messageCount]);

  const submit = async (event) => {
    event.preventDefault();
    if (sendDisabled) return;
    setExpanded(true);
    if (await send(message.trim())) setMessage("");
  };

  return (
    <section
      className={`conversation ${expanded ? "is-expanded" : "is-collapsed"}`}
      aria-label="Agent conversation"
    >
      <div className="conversation-panel">
        <header className="conversation-header">
          <button
            className="conversation-identity"
            type="button"
            onClick={() => setExpanded((isExpanded) => !isExpanded)}
            aria-expanded={expanded}
            aria-controls="session-conversation-panel"
          >
            <span className="conversation-title">
              <strong>AgenticRocket</strong>
              <small>
                {busy
                  ? "Sending instruction…"
                  : queuedCount > 0
                    ? `${queuedCount} instruction${queuedCount === 1 ? "" : "s"} queued`
                    : messageCount > 0
                      ? `${messageCount} saved message${messageCount === 1 ? "" : "s"}`
                      : "Session follow-up"}
              </small>
            </span>
          </button>
          <button
            className="conversation-expand"
            type="button"
            onClick={() => setExpanded((isExpanded) => !isExpanded)}
            aria-label={
              expanded ? "Collapse conversation" : "Expand conversation"
            }
            aria-controls="session-conversation-panel"
            aria-expanded={expanded}
          >
            {expanded ? "Collapse" : "Open"}
          </button>
        </header>
        {!expanded && latestAgentMessage ? (
          <p className="conversation-preview" aria-live="polite" aria-atomic="true">
            {latestAgentMessage.content}
          </p>
        ) : null}
        <div
          className="conversation-detail"
          id="session-conversation-panel"
          aria-hidden={!expanded}
        >
          {messageCount > 0 ? (
            <ol className="messages" ref={messagesRef}>
              {session.messages.map((item, index) => (
                <li
                  key={item.id || index}
                  className={item.role === "user" ? "user" : "agent"}
                >
                  <div>
                    <strong>
                      {item.role === "user" ? "You" : "AgenticRocket"}
                    </strong>
                    <small>{timestamp(item.at || item.createdAt)}</small>
                  </div>
                  <p>{item.content}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="conversation-empty">
              Your follow-up instructions and the agent's responses appear here.
              The saved patch and previous messages stay with this session.
            </p>
          )}
        </div>
        {queuedCount > 0 ? (
          <p className="queued-note" role="status">
            {queuedCount} instruction(s) queued for the agent.
          </p>
        ) : null}
      </div>
      <form className={`follow ${chatLocked ? "is-locked" : ""}`} onSubmit={submit}>
        {chatLocked ? (
          <p
            className="conversation-access-notice"
            id="chat-access-notice"
            role="status"
          >
            <strong lang="ko">관리자 전용 채팅</strong>
            <span className="conversation-access-reason">
              <b>Why?</b>{" "}
              <span lang="ko">
                악의적인 사용 방지를 위해 불가피하게 막아두었습니다.
              </span>
            </span>
          </p>
        ) : null}
        <label className="sr-only" htmlFor="follow-up">
          Follow-up instruction
        </label>
        <textarea
          id="follow-up"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit(event);
            }
          }}
          maxLength={2000}
          rows={1}
          disabled={chatLocked}
          aria-describedby={chatLocked ? "chat-access-notice" : undefined}
          placeholder={
            chatLocked
              ? "관리자만 채팅을 사용할 수 있습니다."
              : "Ask why it changed, or give the next instruction…"
          }
        />
        <button
          className="conversation-send"
          disabled={sendDisabled}
          aria-label="Send follow-up instruction"
        >
          {busy ? "Sending" : "Send"}
        </button>
      </form>
    </section>
  );
}

export function DraftDialog({ draft, close }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      className="draft-dialog"
      ref={ref}
      onCancel={close}
      onClick={(event) => {
        if (event.target === ref.current) close();
      }}
      aria-labelledby="draft-title"
    >
      <button
        className="icon-button close-dialog"
        onClick={close}
        aria-label="Close PR draft"
      >
        <X />
      </button>
      <CheckCircle className="draft-check" />
      <p className="eyebrow">PULL REQUEST READY · EVIDENCE-ATTACHED DRAFT</p>
      <h2 id="draft-title">Ready for your review.</h2>
      <p>{draft.state}</p>
      <label>
        Title
        <input aria-label="PR draft title" readOnly value={draft.title} />
      </label>
      <label>
        Body
        <textarea aria-label="PR draft body" readOnly value={draft.body} rows={12} />
      </label>
      <p>
        No pull request has been created or submitted. Review the verdict and
        changes before publishing.
      </p>
    </dialog>
  );
}

export function Workspace({ session, action, busy, configuration, streaming }) {
  const [draft, setDraft] = useState(null);
  const workSandbox = session.sandboxes?.find((item) => item.id === session.workspace?.sandboxId);
  const active = ACTIVE_STATUSES.has(session.status);
  const currentContract = session.contract?.version === "pulselog-v2";
  const historical = Boolean(
    session.verification && !currentVerification(session),
  );
  const historicalConfiguration =
    session.status === "configuration-required" &&
    configuration?.credentialsReady;
  const canOperate = configuration?.credentialsReady && !busy;
  const prepare = async () => {
    const payload = await action("prepare-pr");
    if (payload?.draft) setDraft(payload.draft);
  };
  return (
    <>
      <header className="mission" data-reveal>
        <div>
          <a className="breadcrumb" href="#/sessions">
            SESSIONS
          </a>
          <small> / {session.id.slice(0, 8)}</small>
          <h1>{session.goal}</h1>
          <p>
            <GitBranch />
            {REPOSITORY} · baseline{" "}
            <code>{session.baselineSha?.slice(0, 12) || "pending"}</code>
          </p>
        </div>
        <div className="mission-state">
          <Status value={session.status} />
          <small>
            {streaming
              ? "Connected to live events"
              : "Reconnecting to live events…"}
          </small>
        </div>
      </header>
      <div className="session-controls">
        <div className="action-group">
          {active ? (
            <button
              className="button danger"
              onClick={() => action("cancel")}
              disabled={busy || session.status === "cancelling"}
            >
              <StopCircle />
              {session.status === "cancelling"
                ? "Stopping…"
                : "Cancel operation"}
            </button>
          ) : (
            <button
              className="button"
              onClick={() => action("resume")}
              disabled={!canOperate}
            >
              <RocketLaunch />
              {currentContract
                ? "Resume session"
                : "Continue under current contract"}
            </button>
          )}
          <button
            className="button"
            onClick={() => action("retry-verification")}
            disabled={
              !canOperate || active || !session.candidate || !currentContract
            }
          >
            <ChartLineUp /> Remeasure candidate
          </button>
          <a className="text-link" href="#/evidence">
            All saved evidence <ArrowRight />
          </a>
        </div>
        <code>{session.id}</code>
      </div>
      {(session.error || session.nextAction || historicalConfiguration) && (
        <div
          className={`session-notice notice ${session.error ? "warning" : ""}`}
        >
          <WarningCircle />
          <div>
            {historicalConfiguration && (
              <strong>
                The server is configured now. This session retains an earlier
                configuration failure.
              </strong>
            )}
            {session.error && (
              <p>
                {typeof session.error === "string"
                  ? session.error
                  : JSON.stringify(session.error)}
              </p>
            )}
            {session.nextAction && (
              <p>
                <strong>Next:</strong> {session.nextAction}
              </p>
            )}
          </div>
        </div>
      )}
      <Progress session={session} />
      <div className="workspace-grid">
        <div>
          <section className="verification panel">
            <header>
              <div>
                <p className="eyebrow">FIXED CANDIDATE · PAIRED MEASUREMENT</p>
                <h2>Verification evidence</h2>
                <p>
                  {historical
                    ? "Legacy artifacts are preserved. Fresh verification is required before making a performance claim."
                    : "Both revisions are warmed and measured in a balanced order in each environment."}
                </p>
              </div>
            </header>
            {historical ? (
              <EmptyState
                icon={TestTube}
                title="Historical measurements are not verified"
              >
                Continue this session under the current contract to build a new,
                evidence-backed candidate.
              </EmptyState>
            ) : (
              <RunGrid session={session} />
            )}
          </section>
          <Diff session={session} />
        </div>
        <aside className="evidence-rail">
          <Verdict session={session} />
          <Activity session={session} />
          <section className="panel method">
            <header>
              <TestTube /> Measurement contract
            </header>
            {workSandbox && <p>Work sandbox: <code title={workSandbox.id}>{workSandbox.id.slice(0, 12)}</code> · {workSandbox.cleanup || workSandbox.status}</p>}
            <p>
              Project-owned timings and fixed correctness checks. Environment
              failures and noisy or conflicting samples remain inconclusive.
            </p>
            <ul>
              <li>Baseline commit pinned</li>
              <li>Build, test, output and checksum checks</li>
              <li>Warm-up on both revisions</li>
              <li>Native median_ms, not process startup time</li>
            </ul>
          </section>
        </aside>
      </div>
      <Deliverables session={session} prepare={prepare} busy={Boolean(busy)} />
      <Conversation
        session={session}
        send={async (content) => Boolean(await action("messages", { content }))}
        busy={busy === "messages"}
        configured={configuration?.credentialsReady}
        canChat={configuration?.viewer?.isAdmin === true}
      />
      {draft && <DraftDialog draft={draft} close={() => setDraft(null)} />}
    </>
  );
}
