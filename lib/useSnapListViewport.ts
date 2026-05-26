"use client";

import { useCallback, useEffect, useState } from "react";

type UseSnapListViewportOptions = {
  itemCount: number;
  targetVisibleCards: number;
};

type UseSnapListViewportResult = {
  setFirstItemNode: (node: HTMLElement | null) => void;
  setListNode: (node: HTMLDivElement | null) => void;
  setScrollAreaNode: (node: HTMLDivElement | null) => void;
  viewportHeight: number | null;
};

export function useSnapListViewport({
  itemCount,
  targetVisibleCards,
}: UseSnapListViewportOptions): UseSnapListViewportResult {
  const [scrollAreaNode, setScrollAreaNodeState] = useState<HTMLDivElement | null>(null);
  const [listNode, setListNodeState] = useState<HTMLDivElement | null>(null);
  const [firstItemNode, setFirstItemNodeState] = useState<HTMLElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const measure = useCallback(() => {
    const scrollArea = scrollAreaNode;
    const list = listNode;
    const firstItem = firstItemNode;

    if (!scrollArea || !list || !firstItem || itemCount === 0) {
      setViewportHeight(null);
      return;
    }

    const itemHeight = firstItem.getBoundingClientRect().height;
    const computedListStyles = window.getComputedStyle(list);
    const gap =
      Number.parseFloat(
        computedListStyles.rowGap || computedListStyles.gap || "0",
      ) || 0;

    if (!itemHeight) {
      return;
    }

    const visibleCards = Math.min(itemCount, targetVisibleCards);
    const nextViewportHeight =
      visibleCards * itemHeight + Math.max(0, visibleCards - 1) * gap;

    setViewportHeight((currentHeight) => {
      if (
        currentHeight !== null &&
        Math.abs(currentHeight - nextViewportHeight) < 0.5
      ) {
        return currentHeight;
      }

      return nextViewportHeight;
    });
  }, [firstItemNode, itemCount, listNode, scrollAreaNode, targetVisibleCards]);

  useEffect(() => {
    const handleResize = () => {
      measure();
    };

    window.addEventListener("resize", handleResize);

    const frameId = window.requestAnimationFrame(() => {
      measure();
    });

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener("resize", handleResize);
      };
    }

    const observer = new ResizeObserver(() => {
      measure();
    });
    const observedNodes = [
      scrollAreaNode,
      listNode,
      firstItemNode,
    ].filter((node): node is HTMLElement => node !== null);

    observedNodes.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [firstItemNode, listNode, measure, scrollAreaNode]);

  const setScrollAreaNode = useCallback((node: HTMLDivElement | null) => {
    setScrollAreaNodeState(node);
  }, []);

  const setListNode = useCallback((node: HTMLDivElement | null) => {
    setListNodeState(node);
  }, []);

  const setFirstItemNode = useCallback((node: HTMLElement | null) => {
    setFirstItemNodeState(node);
  }, []);

  return {
    setFirstItemNode,
    setListNode,
    setScrollAreaNode,
    viewportHeight,
  };
}
