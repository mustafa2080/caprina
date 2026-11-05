import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

const SCROLL_AREA_ID = "main-scroll-area";

let instance: Lenis | null = null;

/** Current Lenis instance (null on touch devices / reduced motion / before mount). */
export function getLenis(): Lenis | null {
  return instance;
}

/** Reset the main scroll area to the top (works with or without Lenis). */
export function scrollMainToTop() {
  if (instance) instance.scrollTo(0, { immediate: true, force: true });
  const el = document.getElementById(SCROLL_AREA_ID);
  if (el) el.scrollTop = 0;
}

/**
 * Smooth scrolling (Lenis) for the app shell's scroll container (#main-scroll-area).
 * The layout is rendered per-role and mounts/unmounts after login, so a MutationObserver
 * re-attaches Lenis whenever the container element changes.
 * - Touch devices keep native scrolling (syncTouch is off by default).
 * - Honors prefers-reduced-motion (respectReducedMotion, default true).
 * - Nested scrollable areas (tables, lists) keep native scroll; maps are excluded.
 * - Add data-lenis-prevent to any element that must scroll natively.
 */
export function SmoothScroll() {
  useEffect(() => {
    let lenis: Lenis | null = null;
    let wrapper: HTMLElement | null = null;

    const destroy = () => {
      lenis?.destroy();
      lenis = null;
      instance = null;
      wrapper = null;
    };

    const sync = () => {
      const el = document.getElementById(SCROLL_AREA_ID);
      if (el === wrapper) return;
      destroy();
      if (!el) return;
      wrapper = el;
      lenis = new Lenis({
        wrapper: el,
        content: (el.firstElementChild as HTMLElement | null) ?? el,
        autoRaf: true,
        lerp: 0.1,
        smoothWheel: true,
        allowNestedScroll: true,
        naiveDimensions: true, // content height changes often (async tables) — read live
        prevent: (node) => !!node.closest?.(".maplibregl-map, .mapboxgl-map"),
      });
      instance = lenis;
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      destroy();
    };
  }, []);

  return null;
}