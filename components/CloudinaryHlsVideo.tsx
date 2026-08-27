"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  type Ref,
  type VideoHTMLAttributes,
} from "react";
import Hls, { type ErrorData } from "hls.js";
import { isHlsAssetUrl } from "@/lib/amenities-final-assets";

type CloudinaryHlsVideoProps = Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "src"
> & {
  src: string;
  fallbackSrc?: string;
  smoothStart?: boolean;
};

function setRef(ref: Ref<HTMLVideoElement> | undefined, node: HTMLVideoElement | null) {
  if (!ref) return;

  if (typeof ref === "function") {
    ref(node);
    return;
  }

  ref.current = node;
}

function toHlsUrl(src: string) {
  if (isHlsAssetUrl(src)) {
    return src;
  }

  const [base, query = ""] = src.split("?");

  if (!base.includes("/video/upload/")) {
    return null;
  }

  const withStreamingProfile = base.includes("/video/upload/sp_")
    ? base
    : base.replace("/video/upload/", "/video/upload/sp_auto/");

  const withoutExtension = withStreamingProfile.replace(/\.[a-z0-9]+$/i, "");
  return `${withoutExtension}.m3u8${query ? `?${query}` : ""}`;
}

function getSmoothStartLevel(hls: Hls) {
  const exact1080pLevel = hls.levels.findIndex(
    (level) => level.width === 1920 && level.height === 1080,
  );

  if (exact1080pLevel >= 0) {
    return exact1080pLevel;
  }

  let bestLevel = -1;
  let bestPixels = -1;

  hls.levels.forEach((level, index) => {
    const pixels = level.width * level.height;
    const fitsSmoothStart = level.width <= 1920 && level.height <= 1080;

    if (fitsSmoothStart && pixels > bestPixels) {
      bestLevel = index;
      bestPixels = pixels;
    }
  });

  return bestLevel >= 0 ? bestLevel : 0;
}

const CloudinaryHlsVideo = forwardRef<HTMLVideoElement, CloudinaryHlsVideoProps>(
  function CloudinaryHlsVideo(
    { src, fallbackSrc, smoothStart = false, ...videoProps },
    forwardedRef,
  ) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
    const loadedHlsSrcRef = useRef<string | null>(null);

    useEffect(() => {
      return () => {
        const video = videoRef.current;
        hlsRef.current?.destroy();
        hlsRef.current = null;
        loadedHlsSrcRef.current = null;

        if (video) {
          video.pause();
          video.removeAttribute("src");
          video.src = "";
          video.load();
        }
      };
    }, []);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const hlsSrc = toHlsUrl(src);
      const directSrc = fallbackSrc ?? src;
      let networkRecoveryAttempts = 0;
      let mediaRecoveryAttempts = 0;
      const releaseHls = () => {
        hlsRef.current?.destroy();
        hlsRef.current = null;
        loadedHlsSrcRef.current = null;
      };

      const loadDirectSource = () => {
        releaseHls();
        if (video.src === directSrc) return;

        video.src = directSrc;
        video.load();
      };

      if (!hlsSrc) {
        loadDirectSource();
        return;
      }

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        releaseHls();
        video.src = hlsSrc;
        video.load();
        return;
      }

      if (!Hls.isSupported()) {
        loadDirectSource();
        return;
      }

      const hls =
        hlsRef.current ??
        new Hls({
          enableWorker: true,
          capLevelToPlayerSize: true,
          maxDevicePixelRatio: 2,
          autoStartLoad: !smoothStart,
          testBandwidth: !smoothStart,
          lowLatencyMode: false,
          maxBufferLength: smoothStart ? 45 : 30,
          maxMaxBufferLength: smoothStart ? 90 : 60,
          backBufferLength: 30,
          abrEwmaDefaultEstimate: smoothStart ? 6_500_000 : 2_000_000,
          abrEwmaDefaultEstimateMax: smoothStart ? 20_000_000 : 8_000_000,
          abrBandWidthFactor: smoothStart ? 0.82 : 0.95,
          abrBandWidthUpFactor: smoothStart ? 0.62 : 0.7,
          fetchSetup: (context, initParams) =>
            new Request(context.url, {
              ...initParams,
              cache: "force-cache",
            }),
        });

      hlsRef.current = hls;

      const handleManifestParsed = () => {
        if (!smoothStart) {
          return;
        }

        hls.startLevel = getSmoothStartLevel(hls);
        hls.startLoad(-1);
      };

      const handleHlsError = (_event: string, data: ErrorData) => {
        if (!data.fatal) return;

        if (
          data.type === Hls.ErrorTypes.NETWORK_ERROR &&
          networkRecoveryAttempts < 2
        ) {
          networkRecoveryAttempts += 1;
          hls.startLoad();
          return;
        }

        if (
          data.type === Hls.ErrorTypes.MEDIA_ERROR &&
          mediaRecoveryAttempts < 1
        ) {
          mediaRecoveryAttempts += 1;
          hls.recoverMediaError();
          return;
        }

        releaseHls();

        if (fallbackSrc && !isHlsAssetUrl(fallbackSrc)) {
          video.src = fallbackSrc;
          video.load();
        }
      };

      const handleFragmentBuffered = () => {
        networkRecoveryAttempts = 0;
      };

      hls.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
      hls.on(Hls.Events.ERROR, handleHlsError);
      hls.on(Hls.Events.FRAG_BUFFERED, handleFragmentBuffered);

      if (loadedHlsSrcRef.current !== hlsSrc) {
        hls.stopLoad();
        hls.loadSource(hlsSrc);
        loadedHlsSrcRef.current = hlsSrc;
      }

      if (hls.media !== video) {
        hls.attachMedia(video);
      }

      return () => {
        hls.off(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
        hls.off(Hls.Events.ERROR, handleHlsError);
        hls.off(Hls.Events.FRAG_BUFFERED, handleFragmentBuffered);
      };
    }, [fallbackSrc, smoothStart, src]);

    return (
      <video
        {...videoProps}
        ref={(node) => {
          videoRef.current = node;
          setRef(forwardedRef, node);
        }}
      />
    );
  },
);

export default CloudinaryHlsVideo;
