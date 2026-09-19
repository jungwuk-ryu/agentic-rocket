import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountSessionGate,
  activeSessionForViewer,
  canAccessSession,
  canUseAgentChat,
  requireAgentChatAccess,
  visibleSessions,
} from "../server/lib/session-access.mjs";

const accountA = { uid: "uid-a", email: "a@example.com", isAdmin: false };
const accountB = { uid: "uid-b", email: "b@example.com", isAdmin: false };
const administrator = { uid: "uid-admin", email: "vojougae35@gmail.com", isAdmin: true };
const ownedByA = { id: "session-a", status: "running", owner: { uid: accountA.uid } };
const ownedByB = { id: "session-b", status: "completed", owner: { uid: accountB.uid } };
const legacy = { id: "legacy", status: "completed", owner: null };

test("sessions stay private to their Firebase UID, with legacy records reserved for the administrator", () => {
  assert.equal(canAccessSession(ownedByA, accountA), true);
  assert.equal(canAccessSession(ownedByA, accountB), false);
  assert.equal(canAccessSession(ownedByB, administrator), false);
  assert.equal(canAccessSession(legacy, accountA), false);
  assert.equal(canAccessSession(legacy, administrator), true);
  assert.deepEqual(visibleSessions([ownedByA, ownedByB, legacy], accountA), [ownedByA]);
  assert.deepEqual(visibleSessions([ownedByA, ownedByB, legacy], administrator), [legacy]);
});

test("ordinary accounts have one active-session reservation while administrators bypass the limit", () => {
  const gate = new AccountSessionGate();
  const first = gate.acquire(accountA, []);
  first.bind("starting-a");
  assert.throws(
    () => gate.acquire(accountA, []),
    (error) => error.statusCode === 409 && error.sessionId === "starting-a",
  );
  first.release();

  assert.equal(activeSessionForViewer([ownedByA], accountA), ownedByA);
  assert.throws(
    () => gate.acquire(accountA, [ownedByA]),
    (error) => error.statusCode === 409 && error.sessionId === "session-a",
  );
  assert.doesNotThrow(() => gate.acquire(administrator, [ownedByA]));
});

test("agent chat is restricted to the configured administrator", () => {
  assert.equal(canUseAgentChat(accountA), false);
  assert.equal(canUseAgentChat(administrator), true);
  assert.throws(
    () => requireAgentChatAccess(accountA),
    (error) =>
      error.statusCode === 403 &&
      error.message.includes("악의적인 사용 방지"),
  );
  assert.doesNotThrow(() => requireAgentChatAccess(administrator));
});
