"use client";

export const TRIFECTA_CONTROL_EVENT = "trifecta:control";
export const TRIFECTA_LEAD_OPEN_EVENT = "trifecta:lead-open";
export const TRIFECTA_PRESENTATION_MODE_CLASS = "trifecta-presentation-mode";
export const TRIFECTA_PRESENTATION_MODE_DATASET_KEY =
  "trifectaPresentationMode";

export type TrifectaRemoteCommand = {
  id?: string;
  type: string;
  timestamp?: string;
  payload?: Record<string, unknown> | null;
};

export type TrifectaRemoteControlConfig = {
  enabled: boolean;
  relayUrl: string | null;
  sessionCode: string | null;
  debug: boolean;
  reconnectDelayMs: number;
};

export type TrifectaPresenterState = {
  href: string;
  path: string;
  presentationMode: boolean;
};

export type TrifectaPresenterApi = {
  openLead?: () => void;
  receiveNativeCommand?: (command: unknown) => void;
  getState?: () => TrifectaPresenterState;
  setPresentationMode?: (enabled: boolean) => void;
};

declare global {
  interface Window {
    TrifectaPresenter?: TrifectaPresenterApi;
  }
}

const DEFAULT_RELAY_URL = "ws://127.0.0.1:8787/session";

export function getTrifectaRemoteControlConfig(): TrifectaRemoteControlConfig {
  return {
    enabled: process.env.NEXT_PUBLIC_TRIFECTA_REMOTE_CONTROL_ENABLED === "true",
    relayUrl:
      process.env.NEXT_PUBLIC_TRIFECTA_REMOTE_CONTROL_RELAY_URL?.trim() ||
      (process.env.NODE_ENV === "development" ? DEFAULT_RELAY_URL : null),
    sessionCode:
      process.env.NEXT_PUBLIC_TRIFECTA_REMOTE_CONTROL_SESSION_CODE?.trim() || null,
    debug: process.env.NODE_ENV !== "production",
    reconnectDelayMs: 2_500,
  };
}

export function setTrifectaPresenterApi(
  partialApi: Partial<TrifectaPresenterApi>,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.TrifectaPresenter = {
    ...(window.TrifectaPresenter ?? {}),
    ...partialApi,
  };
}

export function clearTrifectaPresenterApi(
  keys: (keyof TrifectaPresenterApi)[],
) {
  if (typeof window === "undefined" || !window.TrifectaPresenter) {
    return;
  }

  const nextApi: TrifectaPresenterApi = { ...window.TrifectaPresenter };

  for (const key of keys) {
    delete nextApi[key];
  }

  window.TrifectaPresenter =
    Object.keys(nextApi).length > 0 ? nextApi : undefined;
}

export function isTrifectaRemoteCommand(
  value: unknown,
): value is TrifectaRemoteCommand {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TrifectaRemoteCommand>;
  return typeof candidate.type === "string";
}

export function dispatchTrifectaControlEvent(command: TrifectaRemoteCommand) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(TRIFECTA_CONTROL_EVENT, {
      detail: command,
    }),
  );
}

export function openTrifectaLead(command?: TrifectaRemoteCommand) {
  if (typeof window === "undefined") {
    return false;
  }

  window.dispatchEvent(
    new CustomEvent(TRIFECTA_LEAD_OPEN_EVENT, {
      detail: command,
    }),
  );

  if (typeof window.TrifectaPresenter?.openLead === "function") {
    window.TrifectaPresenter.openLead();
    return true;
  }

  return false;
}

export function isPresentationModeEnabled() {
  if (typeof document === "undefined") {
    return false;
  }

  return document.body.classList.contains(TRIFECTA_PRESENTATION_MODE_CLASS);
}

export function setPresentationMode(enabled: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle(
    TRIFECTA_PRESENTATION_MODE_CLASS,
    enabled,
  );
  document.body.classList.toggle(TRIFECTA_PRESENTATION_MODE_CLASS, enabled);
  document.documentElement.dataset[TRIFECTA_PRESENTATION_MODE_DATASET_KEY] =
    String(enabled);
  document.body.dataset[TRIFECTA_PRESENTATION_MODE_DATASET_KEY] =
    String(enabled);
}

export function getTrifectaPresenterState(pathname?: string): TrifectaPresenterState {
  const path =
    pathname ||
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
      : "/");

  const href =
    typeof window !== "undefined"
      ? window.location.href
      : `https://trifecta-veranza.vercel.app${path}`;

  return {
    href,
    path,
    presentationMode: isPresentationModeEnabled(),
  };
}

export function normalizeRemoteText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
