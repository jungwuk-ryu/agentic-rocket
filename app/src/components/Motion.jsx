import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "@phosphor-icons/react";

const REVEAL_TARGETS =
  "[data-reveal], .session-row, .artifact-row, .benchmark-record, .sandbox, .panel, .deliverables";
const MOTION_PREFERENCE = "agenticrocket:motion-paused";

export function useMotionPreference() {
  const [paused, setPaused] = useState(() => {
    try {
      return localStorage.getItem(MOTION_PREFERENCE) === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(MOTION_PREFERENCE, String(paused));
    } catch {
      // Motion can still be controlled when browser storage is unavailable.
    }
  }, [paused]);
  const toggle = () => setPaused((previous) => !previous);
  return [paused, toggle];
}

export function MotionToggle({ paused, onToggle }) {
  return (
    <button
      className="motion-toggle"
      type="button"
      aria-pressed={paused}
      aria-label={paused ? "Resume visual motion" : "Pause visual motion"}
      title={paused ? "Resume visual motion" : "Pause visual motion"}
      onClick={onToggle}
    >
      {paused ? <Play weight="fill" /> : <Pause weight="fill" />}
      <span>Motion</span>
    </button>
  );
}

// One observer per page; pointer coordinates never enter React state. The page
// itself is never transformed, so the fixed conversation keeps its viewport anchor.
export function MotionPage({ routeKey, paused, children }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    const seen = new WeakSet();
    let frame = 0;
    let pointer;
    let spotlight;
    const visibility = () => {
      root.dataset.motion =
        paused || preference.matches || document.hidden ? "off" : "on";
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    preference.addEventListener("change", visibility);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(({ target, isIntersecting }) => {
          if (target.classList.contains("motion-scene")) {
            target.dataset.inView = String(isIntersecting);
            if (isIntersecting && target.hasAttribute("data-reveal")) {
              target.classList.add("has-entered");
            }
          } else if (isIntersecting) {
            target.classList.add("has-entered");
            observer.unobserve(target);
          }
        });
      },
      { threshold: 0.08 },
    );

    const observe = (node) => {
      if (!(node instanceof Element)) return;
      const targets = [
        ...(node.matches(`${REVEAL_TARGETS}, .motion-scene`) ? [node] : []),
        ...node.querySelectorAll(`${REVEAL_TARGETS}, .motion-scene`),
      ];
      targets.forEach((target, index) => {
        if (seen.has(target)) return;
        seen.add(target);
        target.style.setProperty(
          "--reveal-delay",
          `${Math.min(index % 6, 4) * 45}ms`,
        );
        observer.observe(target);
      });
    };
    observe(root);
    const mutations = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(observe));
    });
    mutations.observe(root, { childList: true, subtree: true });

    const resetSpotlight = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (!spotlight) return;
      spotlight.removeAttribute("data-pointer-active");
      spotlight.style.removeProperty("--tilt-x");
      spotlight.style.removeProperty("--tilt-y");
      spotlight = null;
    };
    const move = (event) => {
      if (root.dataset.motion === "off" || !finePointer.matches) return;
      const target = event.target.closest("[data-spotlight]");
      if (target !== spotlight) {
        resetSpotlight();
        spotlight = target;
      }
      if (!spotlight) return;
      pointer = { x: event.clientX, y: event.clientY };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = spotlight.getBoundingClientRect();
        const x = pointer.x - rect.left;
        const y = pointer.y - rect.top;
        spotlight.dataset.pointerActive = "true";
        spotlight.style.setProperty("--pointer-x", `${x}px`);
        spotlight.style.setProperty("--pointer-y", `${y}px`);
        spotlight.style.setProperty(
          "--tilt-x",
          `${(0.5 - y / rect.height) * 5}deg`,
        );
        spotlight.style.setProperty(
          "--tilt-y",
          `${(x / rect.width - 0.5) * 5}deg`,
        );
      });
    };
    root.addEventListener("pointermove", move, { passive: true });
    root.addEventListener("pointerleave", resetSpotlight);
    return () => {
      resetSpotlight();
      observer.disconnect();
      mutations.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      preference.removeEventListener("change", visibility);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", resetSpotlight);
    };
  }, [routeKey, paused]);

  return (
    <div className="page-motion" ref={rootRef}>
      {children}
    </div>
  );
}
