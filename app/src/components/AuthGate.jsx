import {
  CircleNotch,
  GoogleLogo,
  LockKey,
  RocketLaunch,
} from "@phosphor-icons/react";
import { Brand } from "./common.jsx";
import { PipelineVisual } from "./Graphics.jsx";
import { MotionPage, MotionToggle, useMotionPreference } from "./Motion.jsx";

export function AuthGate({
  loading,
  signedInWithAnotherProvider,
  busy,
  error,
  signIn,
}) {
  const [motionPaused, toggleMotion] = useMotionPreference();
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
              onClick={signIn}
              disabled={loading || busy}
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
