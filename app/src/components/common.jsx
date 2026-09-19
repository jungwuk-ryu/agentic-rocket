import { FileText, RocketLaunch } from "@phosphor-icons/react";
import { statusLabel } from "../lib/session-view.js";
import { PageGraphic } from "./Graphics.jsx";

export function Brand() {
  return (
    <a className="brand" href="#/home" aria-label="AgenticRocket home">
      <RocketLaunch weight="fill" />
      <span>
        Agentic<b>Rocket</b>
      </span>
    </a>
  );
}

export function EmptyState({ icon: Icon = FileText, title, children }) {
  return (
    <div className="empty-state">
      <Icon />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function Status({ value }) {
  return (
    <span className={`status ${value || "pending"}`}>
      <i />
      {statusLabel(value)}
    </span>
  );
}

export function PageHeading({ eyebrow, title, children, action, graphic }) {
  return (
    <header className="page-heading" data-reveal>
      <div className="page-heading-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      <div className="page-heading-aside">
        <PageGraphic variant={graphic} />
        {action}
      </div>
    </header>
  );
}
