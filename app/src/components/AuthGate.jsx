import {
  CircleNotch,
  GoogleLogo,
  LockKey,
  RocketLaunch,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Brand } from "./common.jsx";
import { PipelineVisual } from "./Graphics.jsx";
import { MotionPage, MotionToggle, useMotionPreference } from "./Motion.jsx";

export function AuthGate({
  loading,
  signedInWithAnotherProvider,
  busy,
  demoBusy,
  error,
  signIn,
  signInDemo,
}) {
  const [motionPaused, toggleMotion] = useMotionPreference();
  const [showDemo, setShowDemo] = useState(false);
  const [password, setPassword] = useState("");
  const submitDemo = async (event) => {
    event.preventDefault();
    const viewer = await signInDemo(password);
    if (viewer) setPassword("");
  };
  return (
    <MotionPage routeKey="sign-in" paused={motionPaused}>
      <main className="auth-gate">
        <header className="auth-topline">
          <Brand />
          <MotionToggle paused={motionPaused} onToggle={toggleMotion} />
        </header>
        <div className="auth-layout">
          <section
            className="auth-card"
            aria-labelledby="sign-in-title"
            data-reveal
          >
            <div className="auth-mark" aria-hidden="true">
              <RocketLaunch weight="fill" />
            </div>
            <p className="eyebrow">
              <i /> PRIVATE WORKSPACE
            </p>
            <h1 id="sign-in-title">Sign in to run a session.</h1>
            <p>
              AgenticRocket keeps each workspace and its evidence with the
              Google account that started it.
            </p>
            {signedInWithAnotherProvider && (
              <p className="auth-warning" role="status">
                This workspace accepts Google sign-in only. Continue to switch
                accounts.
              </p>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary auth-sign-in"
              type="button"
              onClick={signIn}
              disabled={loading || busy || demoBusy}
            >
              {loading || busy ? (
                <CircleNotch className="spin" />
              ) : (
                <GoogleLogo weight="fill" />
              )}
              {loading
                ? "Checking sign-in…"
                : busy
                  ? "Opening Google…"
                  : "Continue with Google"}
            </button>
            <button
              className="button auth-demo-trigger"
              type="button"
              aria-expanded={showDemo}
              aria-controls="administrator-demo-form"
              onClick={() => setShowDemo((visible) => !visible)}
              disabled={loading || busy || demoBusy}
            >
              <LockKey weight="fill" />
              Administrator demo
            </button>
            {showDemo && (
              <form
                className="auth-demo-form"
                id="administrator-demo-form"
                onSubmit={submitDemo}
              >
                <label htmlFor="administrator-demo-password">
                  Demo password
                  <input
                    autoComplete="current-password"
                    autoFocus
                    id="administrator-demo-password"
                    maxLength={1_024}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter the administrator demo password"
                    required
                    type="password"
                    value={password}
                  />
                </label>
                <button
                  className="button primary auth-demo-submit"
                  disabled={!password || demoBusy || busy}
                  type="submit"
                >
                  {demoBusy ? <CircleNotch className="spin" /> : <LockKey weight="fill" />}
                  {demoBusy ? "Signing in…" : "Sign in as administrator"}
                </button>
              </form>
            )}
            <div className="auth-rule">
              <LockKey />
              <span>One active session per Google account.</span>
            </div>
          </section>
          <PipelineVisual />
        </div>
      </main>
    </MotionPage>
  );
}
