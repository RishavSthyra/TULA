"use client";

import { type RefObject, useEffect } from "react";

type CursorGlowOptions = {
  radius?: number;
  selector?: string;
  enabled?: boolean;
};

export function useCursorGlow(
  rootRef: RefObject<HTMLElement | null>,
  {
    radius = 180,
    selector = "[data-cursor-glow]",
    enabled = true,
  }: CursorGlowOptions = {},
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const root = rootRef.current;
    if (!root) {
      return;
    }

    const supportsFinePointer =
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (!supportsFinePointer) {
      return;
    }

    let targets: HTMLElement[] = [];
    let rects: DOMRect[] = [];
    let rafId = 0;
    let pendingPoint: { clientX: number; clientY: number } | null = null;
    let rectsDirty = true;

    const syncTargets = () => {
      targets = Array.from(root.querySelectorAll<HTMLElement>(selector));
      rects = targets.map((target) => target.getBoundingClientRect());
      rectsDirty = false;
    };

    const observeTargets = (resizeObserver: ResizeObserver | null) => {
      if (!resizeObserver) {
        return;
      }

      resizeObserver.disconnect();
      resizeObserver.observe(root);
      targets.forEach((target) => resizeObserver.observe(target));
    };

    const clearGlow = () => {
      pendingPoint = null;

      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }

      targets.forEach((target) => {
        target.style.setProperty("--glow-opacity", "0");
      });
    };

    const paintGlow = () => {
      rafId = 0;

      if (!pendingPoint) {
        return;
      }

      if (rectsDirty || targets.length === 0) {
        syncTargets();
      }

      const { clientX, clientY } = pendingPoint;

      targets.forEach((target, index) => {
        const rect = rects[index];
        const nearestX = Math.max(rect.left, Math.min(clientX, rect.right));
        const nearestY = Math.max(rect.top, Math.min(clientY, rect.bottom));
        const distance = Math.hypot(clientX - nearestX, clientY - nearestY);
        const strength = Math.max(0, 1 - distance / radius);

        target.style.setProperty("--glow-x", `${clientX - rect.left}px`);
        target.style.setProperty("--glow-y", `${clientY - rect.top}px`);
        target.style.setProperty("--glow-opacity", strength.toFixed(3));
      });
    };

    const schedulePaint = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(paintGlow);
      }
    };

    const markDirty = () => {
      rectsDirty = true;

      if (pendingPoint) {
        schedulePaint();
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      pendingPoint = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
      schedulePaint();
    };

    syncTargets();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            markDirty();
            syncTargets();
            observeTargets(resizeObserver);
          });

    observeTargets(resizeObserver);

    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            markDirty();
            syncTargets();
            observeTargets(resizeObserver);
          });

    mutationObserver?.observe(root, {
      childList: true,
      subtree: true,
    });

    root.addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("pointerenter", markDirty, { passive: true });
    root.addEventListener("pointerleave", clearGlow);
    window.addEventListener("resize", markDirty, { passive: true });
    window.addEventListener("scroll", markDirty, {
      passive: true,
      capture: true,
    });

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }

      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerenter", markDirty);
      root.removeEventListener("pointerleave", clearGlow);
      window.removeEventListener("resize", markDirty);
      window.removeEventListener("scroll", markDirty, true);
      clearGlow();
    };
  }, [enabled, radius, rootRef, selector]);
}
