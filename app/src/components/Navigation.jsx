import {
  ChartLineUp,
  CheckCircle,
  CircleNotch,
  Plus,
  ShieldCheck,
  SignOut,
  WarningCircle,
} from "@phosphor-icons/react";
import { NAVIGATION } from "../lib/session-view.js";
import { Brand, Status } from "./common.jsx";

export function Navigation({ page, sessions, activeSessionId, viewer, signOut }) {
  const active = sessions.find((item) => item.id === activeSessionId);
  return (
    <aside className="sidebar">
      <Brand />
      <a className="new-session button" href="#/home">
        <Plus />
        <span>New session</span>
      </a>
      <p className="nav-label">WORKSPACE</p>
      <nav aria-label="Main navigation" style={{ "--nav-index": NAVIGATION.findIndex(([name]) => name === page) }}>
        <span className="nav-active-track" aria-hidden="true" />
        {NAVIGATION.map(([name, label, Icon]) => (
          <a
            key={name}
            className={`nav-link ${page === name ? "active" : ""}`}
            href={`#/${name}`}
            aria-current={page === name ? "page" : undefined}
          >
            <Icon />
            <span>{label}</span>
            {name === "sessions" && <small>{sessions.length}</small>}
          </a>
        ))}
      </nav>
      <div className="sidebar-footer">
        {active && (
          <a className="active-session" href={`#/sessions/${active.id}`}>
            <small>ACTIVE SESSION</small>
            <strong>{active.goal}</strong>
            <Status value={active.status} />
          </a>
        )}
        <ChartLineUp />
        <strong>Evidence over promises.</strong>
        <p>
          A fixed patch. Reproducible checks.
          <br />
          Every measurement on record.
        </p>
        <div className="account-summary">
          <div>
            <small>SIGNED IN</small>
            <strong title={viewer?.email}>{viewer?.name || viewer?.email}</strong>
            {viewer?.isAdmin && (
              <span>
                <ShieldCheck weight="fill" /> Admin
              </span>
            )}
          </div>
          <button className="icon-button" onClick={signOut} aria-label="Sign out">
            <SignOut />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function ConfigurationStatus({ configuration, error }) {
  if (error)
    return (
      <a className="connection-status warning" href="#/connections">
        <WarningCircle /> Connection check unavailable
      </a>
    );
  if (!configuration)
    return (
      <span className="connection-status">
        <CircleNotch className="spin" /> Checking connections
      </span>
    );
  return (
    <a
      className={`connection-status ${configuration.credentialsReady ? "ready" : "warning"}`}
      href="#/connections"
    >
      {configuration.credentialsReady ? (
        <CheckCircle weight="fill" />
      ) : (
        <WarningCircle />
      )}{" "}
      {configuration.credentialsReady
        ? "Connections configured"
        : "Configuration required"}
    </a>
  );
}
