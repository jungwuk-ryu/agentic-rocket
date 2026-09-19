import {
  BookOpen,
  ChartLineUp,
  House,
  PlugsConnected,
  SquaresFour,
} from "@phosphor-icons/react";
import { currentFirebaseIdToken } from "./firebase-auth.js";

export const REPOSITORY = "jungwuk-ryu/agenticrocket-demo-perf";
export const DEFAULT_GOAL =
  "기존 테스트와 결과를 유지하면서 이 프로젝트의 benchmark 실행 시간을 줄여줘. 수정하고 실제로 검증한 patch를 보여줘.";
export const ACTIVE_STATUSES = new Set([
  "queued",
  "running",
  "cancelling",
  "recovering",
]);
export const PHASES = [
  ["queued", "Goal"],
  ["workspace", "Workspace"],
  ["analysis", "Investigate"],
  ["candidate-preflight", "Build candidate"],
  ["verification", "Verify"],
  ["completed", "Deliver"],
];
export const NAVIGATION = [
  ["home", "Home", House],
  ["sessions", "Sessions", SquaresFour],
  ["benchmarks", "Benchmarks", ChartLineUp],
  ["evidence", "Evidence", BookOpen],
  ["connections", "Connections", PlugsConnected],
];

export function readRoute() {
  const [page = "home", id] = window.location.hash
    .replace(/^#\/?/, "")
    .split("/");
  if (!NAVIGATION.some(([name]) => name === page)) return { page: "home" };
  return {
    page,
    id:
      page === "sessions" && /^[a-f0-9-]{36}$/i.test(id || "") ? id : undefined,
  };
}

export function statusLabel(status) {
  return (
    {
      queued: "Queued",
      running: "Agent working",
      cancelling: "Stopping safely",
      cancelled: "Cancelled",
      interrupted: "Resume available",
      recovering: "Recovering",
      completed: "Completed",
      rejected: "Rejected",
      inconclusive: "Inconclusive",
      failed: "Needs attention",
      "configuration-required": "Earlier configuration issue",
    }[status] ||
    status ||
    "Pending"
  );
}

export const timestamp = (value) =>
  value ? new Date(value).toLocaleString() : "—";
export const milliseconds = (value) =>
  Number.isFinite(value) ? `${value.toFixed(value >= 100 ? 0 : 2)} ms` : "—";
export const downloadUrl = (session, artifact) =>
  `/api/sessions/${session.id}/artifacts/${artifact.id}/download`;

export function currentVerification(session) {
  const result = session.verification;
  return session.contract?.version === "pulselog-v2" &&
    result?.contract?.version === "pulselog-v2" &&
    result.candidateFingerprint === session.candidate?.fingerprint
    ? result
    : null;
}

export async function authorizedFetch(path, options = {}) {
  const token = await currentFirebaseIdToken();
  if (!token) {
    const error = new Error("Sign in with Google to continue.");
    error.status = 401;
    throw error;
  }
  const headers = new Headers(options.headers || {});
  headers.set("authorization", `Bearer ${token}`);
  return fetch(path, { ...options, headers });
}

export async function request(path, options) {
  const response = await authorizedFetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function downloadArtifact(session, artifact) {
  const response = await authorizedFetch(downloadUrl(session, artifact));
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Download failed (${response.status}).`);
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = artifact.filename || "agenticrocket-artifact";
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}
