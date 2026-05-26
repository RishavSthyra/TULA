"use client";

import { useEffect, useState } from "react";

const DEVTOOLS_THRESHOLD = 160;

function isBlockedShortcut(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  const opensWindowsDevtools =
    event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key);
  const opensMacDevtools =
    event.metaKey && event.altKey && ["i", "j", "c"].includes(key);
  const opensSourceView =
    (event.ctrlKey || event.metaKey) && key === "u";

  return event.key === "F12" || opensWindowsDevtools || opensMacDevtools || opensSourceView;
}

function detectDevtoolsOpen() {
  if (typeof window === "undefined") {
    return false;
  }

  const widthGap = window.outerWidth - window.innerWidth;
  const heightGap = window.outerHeight - window.innerHeight;

  return widthGap > DEVTOOLS_THRESHOLD || heightGap > DEVTOOLS_THRESHOLD;
}

export default function DevtoolsGuard() {
  const [devtoolsOpen, setDevtoolsOpen] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isBlockedShortcut(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    const updateDevtoolsState = () => {
      setDevtoolsOpen(detectDevtoolsOpen());
    };

    updateDevtoolsState();

    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", updateDevtoolsState);

    const intervalId = window.setInterval(updateDevtoolsState, 1000);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", updateDevtoolsState);
      window.clearInterval(intervalId);
    };
  }, []);

  if (process.env.NODE_ENV !== "production" || !devtoolsOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 px-6 text-center text-white">
      <div className="max-w-md space-y-3">
        <p className="text-2xl font-semibold">Developer tools are disabled for this experience.</p>
        <p className="text-sm text-white/70">
          Close the browser inspection panel to continue using the app.
        </p>
      </div>
    </div>
  );
}
