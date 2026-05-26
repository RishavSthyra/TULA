"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  type Ref,
  type VideoHTMLAttributes,
} from "react";
import Hls, { type ErrorData } from "hls.js";

type CloudinaryHlsVideoProps = Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "src"
> & {
  src: string;
  fallbackSrc?: string;
  preferHighQualityStart?: boolean;
};

function setRef(ref: Ref<HTMLVideoElement> | undefined, node: HTMLVideoElement | null) {
  if (!ref) return;

  if (typeof ref === "function") {
    ref(node);
    return;
  }

  ref.current = node;
}

function toCloudinaryHlsUrl(src: string) {
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

function getPreferredStartLevel(hls: Hls, video: HTMLVideoElement) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth =
    Math.max(video.clientWidth, window.innerWidth || 0) * pixelRatio;
  const targetHeight =
    Math.max(video.clientHeight, window.innerHeight || 0) * pixelRatio;

  let fallbackLevel = -1;

  for (let index = 0; index < hls.levels.length; index += 1) {
    const level = hls.levels[index];
    if (!level) continue;

    fallbackLevel = index;

    const matchesWidth = level.width >= targetWidth * 0.9;
    const matchesHeight = level.height >= targetHeight * 0.9;

    if (matchesWidth || matchesHeight) {
      return index;
    }
  }

  return fallbackLevel;
}

const CloudinaryHlsVideo = forwardRef<HTMLVideoElement, CloudinaryHlsVideoProps>(
  function CloudinaryHlsVideo(
    { src, fallbackSrc, preferHighQualityStart = false, ...videoProps },
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

      const hlsSrc = toCloudinaryHlsUrl(src);
      const directSrc = fallbackSrc ?? src;
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
          abrEwmaDefaultEstimate: preferHighQualityStart ? 12_000_000 : 2_000_000,
          abrEwmaDefaultEstimateMax: preferHighQualityStart
            ? 20_000_000
            : 8_000_000,
        });

      hlsRef.current = hls;

      const handleManifestParsed = () => {
        if (!preferHighQualityStart) {
          return;
        }

        const preferredStartLevel = getPreferredStartLevel(hls, video);
        if (preferredStartLevel < 0) {
          return;
        }

        hls.startLevel = preferredStartLevel;
        hls.nextLoadLevel = preferredStartLevel;
        hls.nextAutoLevel = preferredStartLevel;
        hls.bandwidthEstimate = Math.max(
          hls.levels[preferredStartLevel]?.bitrate ?? 0,
          hls.abrEwmaDefaultEstimate,
        );
      };

      const handleHlsError = (_event: string, data: ErrorData) => {
        if (!data.fatal) return;

        releaseHls();
        loadDirectSource();
      };

      hls.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
      hls.on(Hls.Events.ERROR, handleHlsError);

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
      };
    }, [fallbackSrc, preferHighQualityStart, src]);

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
