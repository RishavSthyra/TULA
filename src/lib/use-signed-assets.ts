"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCachedSignedAssetUrl,
  getCachedSignedAssetUrls,
  getSignedAssetUrl,
  getSignedAssetUrls,
} from "@/src/lib/signed-assets";

export function useSignedAssetUrl(input?: string | null) {
  const [signedAsset, setSignedAsset] = useState<{
    input: string;
    url: string;
  } | null>(() => {
    if (!input) {
      return null;
    }

    const cachedUrl = getCachedSignedAssetUrl(input);
    return cachedUrl ? { input, url: cachedUrl } : null;
  });

  useEffect(() => {
    let cancelled = false;

    if (!input) {
      return;
    }

    const cachedUrl = getCachedSignedAssetUrl(input);

    if (cachedUrl) {
      return;
    }

    void getSignedAssetUrl(input)
      .then((url) => {
        if (!cancelled) {
          setSignedAsset({ input, url });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSignedAsset(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [input]);

  if (!input) {
    return null;
  }

  if (signedAsset?.input === input) {
    return signedAsset.url;
  }

  return getCachedSignedAssetUrl(input);
}

export function useSignedAssetUrls(inputs: string[]) {
  const normalizedInputs = useMemo(
    () => [...new Set(inputs.filter(Boolean))],
    [inputs],
  );
  const normalizedInputsKey = normalizedInputs.join("\u0001");
  const lastRequestedKeyRef = useRef<string>("");
  const cachedSignedUrls = useMemo(
    () => getCachedSignedAssetUrls(normalizedInputs),
    [normalizedInputs],
  );
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>(
    cachedSignedUrls,
  );

  useEffect(() => {
    let cancelled = false;

    if (normalizedInputs.length === 0) {
      lastRequestedKeyRef.current = "";
      return;
    }

    if (lastRequestedKeyRef.current === normalizedInputsKey) {
      return;
    }

    lastRequestedKeyRef.current = normalizedInputsKey;

    void getSignedAssetUrls(normalizedInputs)
      .then((urls) => {
        if (!cancelled) {
          setSignedUrls(urls);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSignedUrls({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cachedSignedUrls, inputs, normalizedInputs, normalizedInputsKey]);

  const resolvedSignedUrls = useMemo(
    () => ({
      ...cachedSignedUrls,
      ...signedUrls,
    }),
    [cachedSignedUrls, signedUrls],
  );

  return Object.fromEntries(
    normalizedInputs
      .map((input) => [input, resolvedSignedUrls[input]] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
