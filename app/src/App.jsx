import { useCallback, useEffect, useState } from "react";
import { CircleNotch, WarningCircle, X } from "@phosphor-icons/react";
import {
  ACTIVE_STATUSES,
  NAVIGATION,
  readRoute,
  request,
} from "./lib/session-view.js";
import { EmptyState } from "./components/common.jsx";
import { Navigation, ConfigurationStatus } from "./components/Navigation.jsx";
import {
  Start,
  SessionList,
  Benchmarks,
  EvidenceLibrary,
  Connections,
} from "./components/Collections.jsx";
import { Workspace } from "./components/SessionWorkspace.jsx";
import { MotionPage, MotionToggle, useMotionPreference } from "./components/Motion.jsx";
import { AuthGate } from "./components/AuthGate.jsx";
import {
  isGoogleUser,
  observeGoogleAuth,
  signInWithGoogle,
  signOutFromGoogle,
} from "./lib/firebase-auth.js";

function WorkspaceApp({ authUser, signOut }) {
  const [motionPaused, toggleMotion] = useMotionPreference();
  const [route, setRoute] = useState(readRoute);
  const [configuration, setConfiguration] = useState(null);
  const [configurationError, setConfigurationError] = useState("");
  const [sessions, setSessions] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [session, setSession] = useState(null);
  const [sessionError, setSessionError] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const refreshConfiguration = useCallback(async () => {
    try {
      setConfiguration(await request("/api/config"));
      setConfigurationError("");
    } catch (issue) {
      setConfigurationError(issue.message);
    }
  }, []);
  const refreshSessions = useCallback(async () => {
    setListLoading(true);
    try {
      setSessions((await request("/api/sessions")).sessions);
      setListError("");
    } catch (issue) {
      setListError(issue.message);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(readRoute());
      setError("");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    refreshSessions();
    refreshConfiguration();
  }, [route.page, route.id, refreshSessions, refreshConfiguration]);

  useEffect(() => {
    if (!route.id) {
      setSession(null);
      setSessionError("");
      return;
    }
    const id = route.id;
    const controller = new AbortController();
    let inFlight = false;
    let dirty = false;
    let timer;
    setSession(null);
    setSessionError("");
    setStreaming(false);
    const refresh = async () => {
      if (inFlight) {
        dirty = true;
        return;
      }
      inFlight = true;
      try {
        const payload = await request(`/api/sessions/${id}`, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setSession(payload.session);
          setSessionError("");
          setStreaming(true);
          setSessions((previous) => [
            payload.session,
            ...previous.filter((item) => item.id !== id),
          ]);
        }
      } catch (issue) {
        if (issue.name !== "AbortError") {
          setSessionError(issue.message);
          setStreaming(false);
        }
      } finally {
        inFlight = false;
        if (dirty && !controller.signal.aborted) {
          dirty = false;
          timer = setTimeout(refresh, 100);
        }
      }
    };
    refresh();
    const poll = window.setInterval(refresh, 1_500);
    return () => {
      controller.abort();
      window.clearInterval(poll);
      clearTimeout(timer);
    };
  }, [route.id]);

  const create = async (goal) => {
    setBusy("create");
    setError("");
    try {
      const payload = await request("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repositoryUrl: configuration?.repositoryUrl,
          goal,
        }),
      });
      window.location.hash = `/sessions/${payload.session.id}`;
      refreshConfiguration();
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy("");
    }
  };

  const action = async (name, body) => {
    if (!route.id || busy) return null;
    setBusy(name);
    setError("");
    try {
      const payload = await request(`/api/sessions/${route.id}/${name}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      if (payload.session) setSession(payload.session);
      refreshConfiguration();
      refreshSessions();
      return payload;
    } catch (issue) {
      setError(issue.message);
      return null;
    } finally {
      setBusy("");
    }
  };

  const activeSessionId =
    configuration?.activeSessionId ||
    sessions.find((item) => ACTIVE_STATUSES.has(item.status))?.id;
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <Navigation
        page={route.page}
        sessions={sessions}
        activeSessionId={activeSessionId}
        viewer={configuration?.viewer || { email: authUser.email, name: authUser.displayName }}
        signOut={signOut}
      />
      <main className="workspace" id="main-content" tabIndex={-1}>
        <div className="topbar">
          <span className="page-label">
            {NAVIGATION.find(([name]) => name === route.page)?.[1]}
            <span> / AgenticRocket</span>
          </span>
          <div className="topbar-actions">
            <MotionToggle paused={motionPaused} onToggle={toggleMotion} />
            <ConfigurationStatus
              configuration={configuration}
              error={configurationError}
            />
          </div>
        </div>
        <MotionPage routeKey={`${route.page}/${route.id || ""}`} paused={motionPaused}>
        {route.page === "home" && (
          <Start
            configuration={configuration}
            configurationError={configurationError}
            create={create}
            busy={busy === "create"}
            sessions={sessions}
            canStartMultiple={configuration?.viewer?.isAdmin === true}
          />
        )}
        {route.page === "sessions" && !route.id && (
          <SessionList
            sessions={sessions}
            loading={listLoading}
            error={listError}
            refresh={refreshSessions}
          />
        )}
        {route.id && session?.id === route.id && (
          <Workspace
            key={session.id}
            session={session}
            action={action}
            busy={busy}
            configuration={configuration}
            streaming={streaming}
          />
        )}
        {route.id && session?.id !== route.id && (
          <div className="collection-page">
            <EmptyState
              icon={sessionError ? WarningCircle : CircleNotch}
              title={sessionError ? "Session unavailable" : "Loading session…"}
            >
              {sessionError || "Reading the saved workspace and evidence."}{" "}
              <a href="#/sessions">Return to sessions</a>
            </EmptyState>
          </div>
        )}
        {route.id && session && sessionError && (
          <div className="notice warning" role="alert">
            Live refresh failed: {sessionError}. The last saved view remains
            visible.
          </div>
        )}
        {route.page === "benchmarks" && <Benchmarks sessions={sessions} />}
        {route.page === "evidence" && <EvidenceLibrary sessions={sessions} />}
        {route.page === "connections" && (
          <Connections
            configuration={configuration}
            error={configurationError}
            refresh={refreshConfiguration}
          />
        )}
        {["home", "benchmarks", "evidence"].includes(route.page) &&
          listError && (
            <div className="session-notice notice warning" role="alert">
              <WarningCircle />
              <div>
                Saved session history could not be loaded: {listError}{" "}
                <button className="button" onClick={refreshSessions}>
                  Retry
                </button>
              </div>
            </div>
          )}
        </MotionPage>
      </main>
      {error && (
        <div className="error-toast" role="alert">
          <WarningCircle />
          <span>{error}</span>
          <button
            className="icon-button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X />
          </button>
        </div>
      )}
    </div>
  );
}

function authErrorMessage(error) {
  if (error?.code === "auth/popup-closed-by-user") return "Google sign-in was cancelled.";
  if (error?.code === "auth/popup-blocked") return "Your browser blocked the Google sign-in window. Allow pop-ups and try again.";
  return error?.message || "Google sign-in could not be completed.";
}

export function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => observeGoogleAuth((user) => {
    setAuthUser(user);
    setAuthReady(true);
    setAuthBusy(false);
  }), []);

  const signIn = async () => {
    setAuthBusy(true);
    setAuthError("");
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(authErrorMessage(error));
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    setAuthBusy(true);
    try {
      await signOutFromGoogle();
      window.location.hash = "#/home";
    } finally {
      setAuthBusy(false);
    }
  };

  if (!authReady || !isGoogleUser(authUser)) {
    return (
      <AuthGate
        loading={!authReady}
        signedInWithAnotherProvider={authReady && Boolean(authUser)}
        busy={authBusy}
        error={authError}
        signIn={signIn}
      />
    );
  }

  return <WorkspaceApp key={authUser.uid} authUser={authUser} signOut={signOut} />;
}
