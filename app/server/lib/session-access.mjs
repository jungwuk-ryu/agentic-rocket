export const ACTIVE_SESSION_STATUSES = new Set([
  "queued",
  "running",
  "cancelling",
  "recovering",
]);

export class SessionAccessError extends Error {
  constructor(message, { statusCode = 403, sessionId } = {}) {
    super(message);
    this.name = "SessionAccessError";
    this.statusCode = statusCode;
    this.sessionId = sessionId;
    this.expose = true;
  }
}

export const ADMIN_CHAT_ACCESS_MESSAGE =
  "관리자만 에이전트 채팅을 사용할 수 있습니다. 악의적인 사용 방지를 위해 불가피하게 막아두었습니다.";

export function canUseAgentChat(viewer) {
  return viewer?.isAdmin === true;
}

export function requireAgentChatAccess(viewer) {
  if (!canUseAgentChat(viewer)) throw new SessionAccessError(ADMIN_CHAT_ACCESS_MESSAGE);
}

export function sessionOwner(viewer) {
  return {
    uid: viewer.uid,
    email: viewer.email,
    name: viewer.name || null,
  };
}

export function isSessionOwner(session, viewer) {
  return Boolean(session?.owner?.uid && viewer?.uid && session.owner.uid === viewer.uid);
}

export function canAccessSession(session, viewer) {
  return isSessionOwner(session, viewer) || (viewer?.isAdmin === true && !session?.owner?.uid);
}

export function visibleSessions(sessions, viewer) {
  return sessions.filter((session) => canAccessSession(session, viewer));
}

export function activeSessionForViewer(sessions, viewer, { excludeId } = {}) {
  return sessions.find((session) =>
    session.id !== excludeId &&
    isSessionOwner(session, viewer) &&
    ACTIVE_SESSION_STATUSES.has(session.status),
  ) || null;
}

export class AccountSessionGate {
  #reservations = new Map();

  acquire(viewer, sessions, { sessionId } = {}) {
    if (!viewer?.uid) throw new SessionAccessError("A signed-in account is required.", { statusCode: 401 });
    if (viewer.isAdmin) return { bind() {}, release() {} };

    const existingReservation = this.#reservations.get(viewer.uid);
    if (existingReservation) {
      if (sessionId && existingReservation.sessionId === sessionId) return { bind() {}, release() {} };
      throw new SessionAccessError("This Google account already has a session starting or running.", {
        statusCode: 409,
        sessionId: existingReservation.sessionId,
      });
    }

    const active = activeSessionForViewer(sessions, viewer, { excludeId: sessionId });
    if (active) {
      throw new SessionAccessError("This Google account already has an active session.", {
        statusCode: 409,
        sessionId: active.id,
      });
    }

    const reservation = { sessionId: sessionId || null };
    this.#reservations.set(viewer.uid, reservation);
    return {
      bind: (id) => { reservation.sessionId = id; },
      release: () => {
        if (this.#reservations.get(viewer.uid) === reservation) this.#reservations.delete(viewer.uid);
      },
    };
  }
}
