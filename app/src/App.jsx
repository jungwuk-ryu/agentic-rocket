import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BookOpen, ChartLineUp, CheckCircle, CircleNotch, Clock, Copy, Cube, DotsThree, DownloadSimple, FileCode, FileText, GearSix, GitBranch, ListChecks, MagnifyingGlass, PaperPlaneTilt, Plus, RocketLaunch, SquaresFour, TerminalWindow, TestTube, WarningCircle, X } from "@phosphor-icons/react";

const REPO = "jungwuk-ryu/agenticrocket-demo-perf";
const DEFAULT_GOAL = "기존 테스트와 결과를 유지하면서 이 프로젝트의 benchmark 실행 시간을 줄여줘. 수정하고 실제로 검증한 patch를 보여줘.";
const PHASES = [["queued", "Goal"], ["workspace", "Workspace"], ["analysis", "Investigate"], ["candidate-preflight", "Build candidate"], ["verification", "Verify"], ["completed", "Deliver"]];
const duration = (value) => Number.isFinite(value) ? value.toFixed(value >= 100 ? 0 : 2) + " ms" : "—";
const statusText = (status) => ({ queued: "Queued", running: "Agent working", completed: "Completed", rejected: "Rejected", inconclusive: "Inconclusive", failed: "Needs attention", "configuration-required": "Configuration required" }[status] || "Starting");
const Brand = () => <div className="brand"><span><RocketLaunch weight="fill" /></span>Agentic<b>Rocket</b></div>;

function Start({ configuration, create, busy }) {
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  return <main className="landing">
    <header><Brand /><span>One project. One agent session. Measured proof.</span></header>
    <section>
      <p className="eyebrow"><i /> DAYTONA × OPENAI</p>
      <h1>Make a patch.<br />Prove it belongs.</h1>
      <p className="intro">AgenticRocket keeps one optimization agent with your project from inspection to a fixed candidate and three paired Daytona measurements.</p>
      <div className="repo"><GitBranch /><div><strong>{REPO}</strong><small>Public C++17 performance demo · main is pinned at run start</small></div><em><CheckCircle weight="fill" /> Selected</em></div>
      <label className="goal"><span>Optimization objective</span><textarea value={goal} onChange={(event) => setGoal(event.target.value)} /></label>
      <button className="primary" onClick={() => create(goal)} disabled={busy || !goal.trim()}>{busy ? <CircleNotch className="spin" /> : <RocketLaunch weight="fill" />} {busy ? "Creating session" : "Optimize this project"}<ArrowRight /></button>
      <div className="proof"><span><CheckCircle weight="fill" /> Existing tests retained</span><span><CheckCircle weight="fill" /> Candidate fingerprinted</span><span><CheckCircle weight="fill" /> 3 paired runs</span></div>
      {!configuration.credentialsReady && <p className="config"><WarningCircle weight="fill" /> Server-side configuration required: {configuration.configurationMissing.join(", ")}.</p>}
    </section>
  </main>;
}

function Sidebar({ session }) {
  const nav = [[SquaresFour, "Sessions"], [ChartLineUp, "Benchmarks"], [BookOpen, "Evidence"], [GearSix, "Settings"]];
  return <aside className="sidebar"><Brand /><button className="new"><Plus /> New session</button><small>WORKSPACE</small>{nav.map(([Icon, name], index) => <button key={name} className={"nav " + (index === 0 ? "active" : "")}><Icon />{name}{index === 0 && <b>1</b>}</button>)}<div className="current"><small>CURRENT SESSION</small><p><i className={session.status} /><strong>{session.goal}</strong><span>{statusText(session.status)}</span></p><footer><ChartLineUp weight="fill" /><b>Evidence over promises.</b><span>Every result has a patch and raw sandbox samples.</span></footer></div></aside>;
}

function Progress({ session }) {
  const active = Math.max(0, PHASES.findIndex(([name]) => name === session.phase));
  const done = session.phase === "completed" ? PHASES.length : active;
  return <div className="progress">{PHASES.map(([name, label], index) => <div key={name}><span className={index < done ? "done" : index === active && session.status === "running" ? "working" : ""}>{index < done ? <CheckCircle weight="fill" /> : index === active && session.status === "running" ? <CircleNotch className="spin" /> : <i />}</span><b>{label}</b>{index < PHASES.length - 1 && <hr className={index < done ? "done" : ""} />}</div>)}</div>;
}

function Sandbox({ number, sandbox, run }) {
  const status = sandbox?.status || "waiting";
  const improvement = run?.improvementPct;
  return <article className={"sandbox " + status}>
    <header><div><small>DAYTONA SANDBOX {number}</small><strong>{status === "completed" ? "Paired run complete" : status === "running" ? "Measuring candidate" : status === "failed" ? "Execution failed" : "Awaiting candidate"}</strong></div><em>{status === "completed" ? <CheckCircle weight="fill" /> : <Clock />} {status}</em></header>
    <p><Cube /> {sandbox?.target || "pending allocation"}<br />{sandbox?.cpu ? sandbox.cpu + " vCPU" : "—"}{sandbox?.memoryGiB ? " · " + sandbox.memoryGiB + " GiB" : ""}</p>
    {run ? <><dl><dt>Baseline</dt><dd>{duration(run.baselineMs)}</dd><dt>Candidate</dt><dd>{duration(run.candidateMs)}</dd></dl><div className="bar"><i /><b style={{ width: Math.max(8, Math.min(100, 100 - (improvement || 0))) + "%" }} /></div><footer><span>{run.testsPassed && run.outputPassed ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />} checks {run.testsPassed && run.outputPassed ? "passed" : "not complete"}</span><strong className={improvement > 0 ? "positive" : "negative"}>{Number.isFinite(improvement) ? (improvement > 0 ? "−" : "+") + Math.abs(improvement).toFixed(2) + "%" : run.outcome}</strong></footer></> : <div className="pending"><TerminalWindow /> Results appear only after a real paired run completes.</div>}
  </article>;
}

function Activity({ session }) {
  return <section className="activity"><header><span><ListChecks /> Live activity</span><small>{session.status === "running" ? "Streaming durable events" : "Saved history"}</small></header><ol>{session.events?.slice(-7).reverse().map((event) => <li key={event.id}><i className={event.type} /><div><strong>{event.summary}</strong><small>{new Date(event.at).toLocaleTimeString()} · {event.type}</small></div></li>)}</ol></section>;
}

function Diff({ session }) {
  const [patch, setPatch] = useState("");
  const artifact = session.artifacts?.find((item) => item.id === session.candidate?.patchArtifactId);
  useEffect(() => { if (!artifact) { setPatch(""); return; } fetch("/api/sessions/" + session.id + "/artifacts/" + artifact.id + "/download").then((response) => response.ok ? response.text() : "").then(setPatch).catch(() => setPatch("")); }, [artifact?.id, session.id]);
  const copy = () => navigator.clipboard?.writeText(patch);
  return <section className="diff"><header><span><FileCode /> Candidate diff</span><div>{session.candidate && <small>SHA-256 {session.candidate.fingerprint.slice(0, 12)}</small>}<button onClick={copy} disabled={!patch}><Copy /></button></div></header>{patch ? <pre>{patch.split("\n").slice(0, 38).map((line, index) => <code key={index} className={line.startsWith("+") ? "add" : line.startsWith("-") ? "remove" : ""}>{line || " "}{"\n"}</code>)}</pre> : <div className="empty"><FileCode /><div><strong>{session.candidate ? "Patch artifact is loading" : "No candidate frozen yet"}</strong><span>The displayed diff and download are checked against the saved candidate fingerprint.</span></div></div>}</section>;
}

function Artifacts({ session, prepare }) {
  const patch = session.artifacts?.find((item) => item.id === session.candidate?.patchArtifactId);
  const report = session.artifacts?.find((item) => item.filename === "verification-report.md");
  const url = (item) => item ? "/api/sessions/" + session.id + "/artifacts/" + item.id + "/download" : undefined;
  return <section className="artifacts"><div><p className="eyebrow">IMMUTABLE OUTPUT</p><h2>Bring the proof with you.</h2><p>The shown patch hash is exactly what the three sandbox results evaluated.</p></div><div><a className={patch ? "" : "disabled"} href={url(patch)}><DownloadSimple /> Download patch</a><a className={report ? "" : "disabled"} href={url(report)}><FileText /> Verification report</a><button onClick={prepare} disabled={!patch || !report}>Prepare PR <ArrowRight /></button></div></section>;
}

function Workspace({ session, followUp, prepare }) {
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState(null);
  const runs = session.verification?.runs || [];
  const sandboxes = (session.sandboxes?.filter((item) => item.role === "benchmark") || []).slice(-3);
  const work = session.sandboxes?.find((item) => item.role === "work");
  const verdict = session.verification;
  const openDraft = async () => { const draftResult = await prepare(); if (draftResult) setDraft(draftResult); };
  const send = async (event) => { event.preventDefault(); if (!message.trim()) return; await followUp(message); setMessage(""); };
  return <main className="app"><Sidebar session={session} /><div className="workspace"><div className="top"><div className="mobile-brand"><Brand /></div><div className="search"><MagnifyingGlass /> Search sessions, code, or ask the agent… <kbd>⌘ K</kbd></div><span><i className={session.status} /> {statusText(session.status)}</span><button><DotsThree /></button></div><section className="mission"><div><small>SESSIONS / {session.id.slice(0, 8)}</small><h1>{session.goal}</h1><p><GitBranch /> {REPO} · main · baseline {session.baselineSha?.slice(0, 12) || "pending"}</p></div><aside><RocketLaunch weight="fill" /><div><small>SESSION GOAL</small><b>Fast, safe, measured.</b><span>One owner. One candidate. Three real paired runs.</span></div></aside></section><Progress session={session} /><div className="grid"><div><section className="verification"><header><div><p className="eyebrow">FIXED CANDIDATE · PAIRED MEASUREMENT</p><h2>{verdict?.verdict === "verified" ? "Verified in 3 sandboxes" : "Verification evidence"}</h2><p>Both revisions are warmed and alternated in each isolated environment.</p></div><span><Cube /><small>WORK SANDBOX</small><b>{work?.id?.slice(0, 12) || "creating"}</b></span></header><div className="sandboxes">{[1, 2, 3].map((number) => <Sandbox key={number} number={number} sandbox={sandboxes[number - 1]} run={runs.find((run) => run.sandbox === number)} />)}</div></section><Diff session={session} /></div><aside className="evidence"><section className="verdict"><header><span><ChartLineUp /> Verdict</span><em className={verdict?.verdict || "pending"}>{verdict?.verdict || "pending"}</em></header><strong>{verdict ? verdict.verdict === "verified" ? "Candidate is verified." : verdict.verdict === "rejected" ? "Candidate is rejected." : "Evidence is inconclusive." : "No performance claim yet."}</strong><p>{verdict?.reason || "A verdict appears only after a fixed candidate and every sandbox measurement finish."}</p>{verdict && <footer><span>Aggregate latency reduction</span><b className={verdict.aggregateImprovementPct > 0 ? "positive" : "negative"}>{Number.isFinite(verdict.aggregateImprovementPct) ? verdict.aggregateImprovementPct.toFixed(2) + "%" : "—"}</b></footer>}</section><Activity session={session} /><section className="method"><header><TestTube /> Measurement contract</header><p>Minimum improvement is fixed before the final run. Noisy, missing, conflicting, and regressed results remain visible.</p><ul><li>main commit pinned</li><li>build · test · output checks</li><li>balanced baseline/candidate order</li></ul></section></aside></div><Artifacts session={session} prepare={openDraft} /><form className="follow" onSubmit={send}><div><RocketLaunch weight="fill" /><span><b>Same agent session</b><small>Context and evidence persist</small></span></div><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask why it changed, or give the next instruction…" /><button disabled={!message.trim()}><PaperPlaneTilt weight="fill" /></button></form></div>{draft && <div className="modal"><section><button onClick={() => setDraft(null)}><X /></button><CheckCircle weight="fill" /><p className="eyebrow">PULL REQUEST READY ✓</p><h2>Draft prepared from real evidence.</h2><em>{draft.state}</em><label>Title<input readOnly value={draft.title} /></label><label>Body<textarea readOnly value={draft.body} /></label><p>No pull request was created or submitted by this demo.</p></section></div>}</main>;
}

export function App() {
  const [configuration, setConfiguration] = useState({ credentialsReady: true, configurationMissing: [] });
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async (id) => { const response = await fetch("/api/sessions/" + id); if (response.ok) setSession((await response.json()).session); }, []);
  useEffect(() => { fetch("/api/config").then((response) => response.json()).then(setConfiguration); const id = localStorage.getItem("agenticrocket.sessionId"); if (id) refresh(id); }, [refresh]);
  useEffect(() => { if (!session?.id) return; const source = new EventSource("/api/sessions/" + session.id + "/events?after=" + (session.sequence || 0)); source.addEventListener("session", () => refresh(session.id)); source.addEventListener("heartbeat", () => refresh(session.id)); return () => source.close(); }, [session?.id, session?.sequence, refresh]);
  const create = async (goal) => { setBusy(true); setError(""); try { const response = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repositoryUrl: configuration.repositoryUrl, goal }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); localStorage.setItem("agenticrocket.sessionId", payload.session.id); setSession(payload.session); } catch (issue) { setError(issue.message); } finally { setBusy(false); } };
  const followUp = async (content) => { const response = await fetch("/api/sessions/" + session.id + "/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content }) }); const payload = await response.json(); if (response.ok) setSession(payload.session); else setError(payload.error); };
  const prepare = async () => { const response = await fetch("/api/sessions/" + session.id + "/prepare-pr", { method: "POST" }); const payload = await response.json(); if (!response.ok) { setError(payload.error); return null; } return payload.draft; };
  return <>{session ? <Workspace session={session} followUp={followUp} prepare={prepare} /> : <Start configuration={configuration} create={create} busy={busy} />}{error && <div className="error"><WarningCircle weight="fill" /> {error}<button onClick={() => setError("")}><X /></button></div>}</>;
}
