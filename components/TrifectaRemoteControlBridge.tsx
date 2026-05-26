"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  clearTrifectaPresenterApi,
  dispatchTrifectaControlEvent,
  getTrifectaPresenterState,
  getTrifectaRemoteControlConfig,
  isTrifectaRemoteCommand,
  normalizeRemoteText,
  openTrifectaLead,
  setPresentationMode,
  setTrifectaPresenterApi,
  type TrifectaRemoteCommand,
} from "@/lib/trifecta-remote-control";

type RemotePayload = Record<string, unknown>;

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "[role='button']",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "[data-trifecta-control-label]",
].join(",");

function isRecord(value: unknown): value is RemotePayload {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getPayload(command: TrifectaRemoteCommand) {
  return isRecord(command.payload) ? command.payload : {};
}

function logRemoteControl(...args: unknown[]) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info("[TrifectaRemote]", ...args);
}

function warnRemoteControl(...args: unknown[]) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.warn("[TrifectaRemote]", ...args);
}

function createEnvelope(type: string, payload?: RemotePayload): TrifectaRemoteCommand {
  return {
    id: `remote_${type}_${Date.now()}`,
    type,
    timestamp: new Date().toISOString(),
    payload,
  };
}

function resolvePath(payload: RemotePayload) {
  const candidate = payload.path;

  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return null;
  }

  const trimmedCandidate = candidate.trim();

  if (!trimmedCandidate.startsWith("http://") && !trimmedCandidate.startsWith("https://")) {
    return trimmedCandidate;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const url = new URL(trimmedCandidate);

    if (url.origin !== window.location.origin) {
      return url.href;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return trimmedCandidate;
  }
}

function resolvePresentationMode(payload: RemotePayload) {
  const booleanCandidate = [payload.enabled, payload.active, payload.value].find(
    (value) => typeof value === "boolean",
  );

  if (typeof booleanCandidate === "boolean") {
    return booleanCandidate;
  }

  const stringCandidate = [payload.mode, payload.value].find(
    (value) => typeof value === "string",
  );

  if (typeof stringCandidate !== "string") {
    return true;
  }

  const normalized = normalizeRemoteText(stringCandidate);

  return !["0", "false", "normal", "off", "disabled", "inactive"].includes(
    normalized,
  );
}

function closestInteractiveElement(target: Element | null) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  return target.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
}

function getElementLabel(element: Element) {
  const explicitLabel =
    element.getAttribute("data-trifecta-control-label") ||
    element.getAttribute("aria-label") ||
    element.getAttribute("title");

  if (explicitLabel) {
    return normalizeRemoteText(explicitLabel);
  }

  return normalizeRemoteText(element.textContent || "");
}

function scoreElementMatch(
  element: HTMLElement,
  payload: RemotePayload,
  labelNeedle: string | null,
  hrefNeedle: string | null,
  tagNeedle: string | null,
) {
  let score = 0;

  if (tagNeedle && element.tagName.toLowerCase() === tagNeedle) {
    score += 1;
  }

  if (hrefNeedle) {
    const hrefValue =
      element.getAttribute("href") || element.getAttribute("data-href");

    if (hrefValue === hrefNeedle) {
      score += 5;
    }
  }

  if (labelNeedle) {
    const label = getElementLabel(element);

    if (label === labelNeedle) {
      score += 6;
    } else if (label.includes(labelNeedle)) {
      score += 4;
    }
  }

  if (
    typeof payload.selector === "string" &&
    payload.selector.trim().length > 0 &&
    element.matches(payload.selector)
  ) {
    score += 8;
  }

  return score;
}

function resolveClientPoint(payload: RemotePayload) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawX =
    typeof payload.normalizedX === "number"
      ? payload.normalizedX
      : typeof payload.x === "number"
        ? payload.x
        : typeof payload.clientX === "number"
          ? payload.clientX
          : null;
  const rawY =
    typeof payload.normalizedY === "number"
      ? payload.normalizedY
      : typeof payload.y === "number"
        ? payload.y
        : typeof payload.clientY === "number"
          ? payload.clientY
          : null;

  if (typeof rawX !== "number" || typeof rawY !== "number") {
    return null;
  }

  const clientX = rawX >= 0 && rawX <= 1 ? rawX * window.innerWidth : rawX;
  const clientY = rawY >= 0 && rawY <= 1 ? rawY * window.innerHeight : rawY;

  return { clientX, clientY };
}

function findTargetElement(payload: RemotePayload) {
  if (typeof document === "undefined") {
    return null;
  }

  // Remote DOM targeting is intentionally best-effort. We prefer explicit
  // selectors and coordinates first, then fall back to label/href matching.
  if (typeof payload.selector === "string" && payload.selector.trim().length > 0) {
    try {
      const selectorTarget = document.querySelector(payload.selector);
      const interactiveMatch = closestInteractiveElement(selectorTarget);

      if (interactiveMatch) {
        return interactiveMatch;
      }
    } catch {
      warnRemoteControl("Ignoring invalid selector in remote command:", payload.selector);
    }
  }

  const point = resolveClientPoint(payload);

  if (point) {
    const pointTarget = closestInteractiveElement(
      document.elementFromPoint(point.clientX, point.clientY),
    );

    if (pointTarget) {
      return pointTarget;
    }
  }

  const labelNeedle =
    typeof payload.label === "string" ? normalizeRemoteText(payload.label) : null;
  const hrefNeedle = typeof payload.href === "string" ? payload.href.trim() : null;
  const tagNeedle =
    typeof payload.tag === "string" ? normalizeRemoteText(payload.tag) : null;

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR),
  );

  let bestMatch: HTMLElement | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = scoreElementMatch(
      candidate,
      payload,
      labelNeedle,
      hrefNeedle,
      tagNeedle,
    );

    if (score > bestScore) {
      bestMatch = candidate;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}

function dispatchSyntheticPointerEvent(
  element: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup",
  payload: RemotePayload,
) {
  const point = resolveClientPoint(payload);
  const pointerEventInit: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: typeof payload.pointerId === "number" ? payload.pointerId : 1,
    pointerType:
      typeof payload.pointerType === "string" ? payload.pointerType : "touch",
    button: typeof payload.button === "number" ? payload.button : 0,
    buttons:
      type === "pointerup" ? 0 : typeof payload.buttons === "number" ? payload.buttons : 1,
    clientX: point?.clientX ?? 0,
    clientY: point?.clientY ?? 0,
  };

  if (typeof PointerEvent !== "undefined") {
    element.dispatchEvent(new PointerEvent(type, pointerEventInit));
    return;
  }

  const fallbackMouseEventType =
    type === "pointermove"
      ? "mousemove"
      : type === "pointerup"
        ? "mouseup"
        : "mousedown";

  element.dispatchEvent(
    new MouseEvent(fallbackMouseEventType, {
      bubbles: true,
      cancelable: true,
      clientX: pointerEventInit.clientX,
      clientY: pointerEventInit.clientY,
      button: pointerEventInit.button,
      buttons: pointerEventInit.buttons,
    }),
  );
}

function activateElement(element: HTMLElement, payload: RemotePayload) {
  element.focus({ preventScroll: false });
  dispatchSyntheticPointerEvent(element, "pointerdown", payload);
  dispatchSyntheticPointerEvent(element, "pointerup", payload);
  element.click();
}

async function decodeMessageData(messageData: MessageEvent["data"]) {
  if (typeof messageData === "string") {
    return messageData;
  }

  if (messageData instanceof Blob) {
    return messageData.text();
  }

  if (messageData instanceof ArrayBuffer) {
    return new TextDecoder().decode(messageData);
  }

  return null;
}

export default function TrifectaRemoteControlBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const configRef = useRef(getTrifectaRemoteControlConfig());
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const activePointerTargetRef = useRef<HTMLElement | null>(null);
  const currentPathRef = useRef(pathname);

  const sendSocketMessage = useEffectEvent((command: TrifectaRemoteCommand) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(JSON.stringify(command));

    if (configRef.current.debug) {
      logRemoteControl("sent", command.type, command);
    }

    return true;
  });

  const reportState = useEffectEvent((reason: string, sourceCommandId?: string) => {
    const state = getTrifectaPresenterState(currentPathRef.current);

    sendSocketMessage(
      createEnvelope("state.report", {
        ...state,
        reason,
        sourceCommandId,
        sessionCode: configRef.current.sessionCode ?? undefined,
      }),
    );
  });

  const handlePointerCommand = useEffectEvent(
    (commandType: "interaction.pointerDown" | "interaction.pointerMove" | "interaction.pointerUp", payload: RemotePayload) => {
      const eventType =
        commandType === "interaction.pointerDown"
          ? "pointerdown"
          : commandType === "interaction.pointerMove"
            ? "pointermove"
            : "pointerup";

      const target =
        eventType === "pointermove"
          ? activePointerTargetRef.current ?? findTargetElement(payload)
          : findTargetElement(payload);

      if (!target) {
        warnRemoteControl("No pointer target found for remote command.", {
          commandType,
          payload,
        });
        return;
      }

      if (eventType === "pointerdown") {
        activePointerTargetRef.current = target;
      }

      dispatchSyntheticPointerEvent(target, eventType, payload);

      if (eventType === "pointerup") {
        activePointerTargetRef.current = null;
      }
    },
  );

  const handleCommand = useEffectEvent((commandLike: unknown) => {
    if (!isTrifectaRemoteCommand(commandLike)) {
      warnRemoteControl("Ignoring malformed remote command.", commandLike);
      return;
    }

    const command = commandLike;
    const payload = getPayload(command);

    dispatchTrifectaControlEvent(command);

    if (configRef.current.debug) {
      logRemoteControl("received", command.type, command);
    }

    switch (command.type) {
      case "session.join": {
        return;
      }
      case "navigate": {
        const nextPath = resolvePath(payload);

        if (!nextPath) {
          warnRemoteControl("Navigate command missing payload.path.", command);
          return;
        }

        if (
          typeof window !== "undefined" &&
          (nextPath.startsWith("http://") || nextPath.startsWith("https://"))
        ) {
          window.location.assign(nextPath);
          return;
        }

        if (nextPath !== currentPathRef.current) {
          router.push(nextPath);
        }
        return;
      }
      case "presentation.reset": {
        setPresentationMode(false);
        router.push("/");
        return;
      }
      case "presentation.mode": {
        const enabled = resolvePresentationMode(payload);
        setPresentationMode(enabled);
        reportState("presentation.mode", command.id);
        return;
      }
      case "lead.open": {
        const opened = openTrifectaLead(command);

        if (!opened) {
          window.setTimeout(() => {
            openTrifectaLead(command);
          }, 250);
        }

        return;
      }
      case "state.request": {
        reportState("state.request", command.id);
        return;
      }
      case "interaction.pointerDown":
      case "interaction.pointerMove":
      case "interaction.pointerUp": {
        handlePointerCommand(command.type, payload);
        return;
      }
      case "interaction.tap": {
        const target = findTargetElement(payload);

        if (!target) {
          warnRemoteControl("No tap target found for remote command.", command);
          return;
        }

        activateElement(target, payload);
        return;
      }
      default: {
        return;
      }
    }
  });

  useEffect(() => {
    currentPathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    setTrifectaPresenterApi({
      getState: () => getTrifectaPresenterState(currentPathRef.current),
      receiveNativeCommand: (command) => {
        handleCommand(command);
      },
      setPresentationMode,
    });

    return () => {
      clearTrifectaPresenterApi([
        "getState",
        "receiveNativeCommand",
        "setPresentationMode",
      ]);
    };
  }, []);

  useEffect(() => {
    if (!configRef.current.enabled) {
      logRemoteControl("remote control disabled by env flag.");
      return;
    }

    if (!configRef.current.relayUrl || !configRef.current.sessionCode) {
      warnRemoteControl(
        "Remote control enabled, but relay URL or session code is missing.",
        configRef.current,
      );
      return;
    }

    let isDisposed = false;

    const scheduleReconnect = () => {
      if (isDisposed) {
        return;
      }

      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, configRef.current.reconnectDelayMs);
    };

    const connect = () => {
      if (isDisposed || !configRef.current.relayUrl) {
        return;
      }

      const socket = new WebSocket(configRef.current.relayUrl);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        logRemoteControl("connected to relay", configRef.current.relayUrl);
        sendSocketMessage(
          createEnvelope("session.join", {
            code: configRef.current.sessionCode ?? undefined,
            sessionCode: configRef.current.sessionCode ?? undefined,
            client: "presentation-site",
            path: currentPathRef.current,
          }),
        );
        reportState("session.join");
      });

      socket.addEventListener("message", async (event) => {
        const rawMessage = await decodeMessageData(event.data);

        if (!rawMessage) {
          return;
        }

        try {
          const parsed = JSON.parse(rawMessage) as unknown;

          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              handleCommand(item);
            }
            return;
          }

          handleCommand(parsed);
        } catch (error) {
          warnRemoteControl("Failed to parse relay message.", error, rawMessage);
        }
      });

      socket.addEventListener("error", (event) => {
        warnRemoteControl("relay socket error", event);
      });

      socket.addEventListener("close", () => {
        logRemoteControl("relay socket closed");
        socketRef.current = null;
        scheduleReconnect();
      });
    };

    connect();

    return () => {
      isDisposed = true;

      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!configRef.current.enabled) {
      return;
    }

    reportState("route.change");
  }, [pathname]);

  return null;
}
