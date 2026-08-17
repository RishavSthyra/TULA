"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import gsap from "gsap";
import { Howl, Howler } from "howler";
import { Cormorant_Garamond } from "next/font/google";

const cinematicSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
  variable: "--font-cinematic-serif",
});

type CinematicIntroProps = {
  onComplete?: () => void;
  progress?: number;
  readyToComplete?: boolean;
};

type CinematicIntroStageProps = {
  onCompleteRef: MutableRefObject<(() => void) | undefined>;
  readyToComplete?: boolean;
  loaderNodeRef: MutableRefObject<HTMLDivElement | null>;
};

const SESSION_KEY = "tula-cinematic-intro-complete";
const INTRO_AUDIO_URL = "/atlasaudio-nature-519434.mp3";

const TIMELINE_START = 0.15;
const LINE_IN_DURATION = 1.18;
const LINE_OUT_DURATION = 0.92;
const SCREEN_OVERLAP = 0.35;
const FADE_OUT_DURATION = 1;
const INTRO_AUDIO_VOLUME = 0.22;

const CinematicIntroStage = memo(function CinematicIntroStage({
  onCompleteRef,
  readyToComplete = true,
  loaderNodeRef,
}: CinematicIntroStageProps) {
  const [isActive, setIsActive] = useState(false);
  const [showSoundPrompt, setShowSoundPrompt] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const greenGlowRef = useRef<HTMLDivElement>(null);
  const goldLeakRef = useRef<HTMLDivElement>(null);
  const mistRef = useRef<HTMLDivElement>(null);
  const vignetteRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);

  const screen1Line1Ref = useRef<HTMLSpanElement>(null);
  const screen1Line2Ref = useRef<HTMLSpanElement>(null);
  const screen1Ref = useRef<HTMLDivElement>(null);

  const screen2Line1Ref = useRef<HTMLSpanElement>(null);
  const screen2Line2Ref = useRef<HTMLSpanElement>(null);
  const screen2Line3Ref = useRef<HTMLSpanElement>(null);
  const screen2Ref = useRef<HTMLDivElement>(null);

  const screen3Line1Ref = useRef<HTMLSpanElement>(null);
  const screen3Line2Ref = useRef<HTMLSpanElement>(null);
  const screen3Ref = useRef<HTMLDivElement>(null);

  const revealRef = useRef<HTMLDivElement>(null);
  const revealWelcomeRef = useRef<HTMLSpanElement>(null);
  const revealTulaRef = useRef<HTMLHeadingElement>(null);
  const revealLineRef = useRef<HTMLDivElement>(null);
  const revealRhythmRef = useRef<HTMLSpanElement>(null);
  const revealLocationRef = useRef<HTMLSpanElement>(null);

  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const audioRef = useRef<Howl | null>(null);
  const soundIdRef = useRef<number | null>(null);
  const audioPlayAttemptInFlightRef = useRef(false);
  const readyToCompleteRef = useRef(readyToComplete);
  const waitingForReadyRef = useRef(false);
  const setLoaderRefs = useCallback(
    (node: HTMLDivElement | null) => {
      loaderRef.current = node;
      loaderNodeRef.current = node;
    },
    [loaderNodeRef],
  );

  const shouldPlay = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    return true;
  }, []);

  const handleComplete = useCallback(() => {
    const audio = audioRef.current;
    if (audio?.playing()) {
      audio.fade(audio.volume(), 0, 900);
      window.setTimeout(() => {
        audio.stop();
      }, 950);
    }

    sessionStorage.setItem(SESSION_KEY, "1");
    setIsActive(false);
    onCompleteRef.current?.();
  }, []);

  const fadeOutWhenReady = useCallback(() => {
    if (!readyToCompleteRef.current) {
      waitingForReadyRef.current = true;
      return;
    }

    waitingForReadyRef.current = false;
    gsap.to(overlayRef.current, {
      opacity: 0,
      duration: FADE_OUT_DURATION,
      ease: "power2.inOut",
      onComplete: handleComplete,
    });
  }, [handleComplete]);

  const handleSkip = useCallback(() => {
    if (timelineRef.current) {
      timelineRef.current.kill();
      timelineRef.current = null;
    }

    fadeOutWhenReady();
  }, [fadeOutWhenReady]);

  useEffect(() => {
    readyToCompleteRef.current = readyToComplete;
    if (readyToComplete && waitingForReadyRef.current) {
      fadeOutWhenReady();
    }
  }, [fadeOutWhenReady, readyToComplete]);

  const playIntroAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.playing()) {
      audioPlayAttemptInFlightRef.current = false;
      setShowSoundPrompt(false);
      return;
    }

    if (audioPlayAttemptInFlightRef.current && audio.state() === "loading") {
      return;
    }

    audioPlayAttemptInFlightRef.current = true;
    if (Howler.ctx?.state === "suspended") {
      void Howler.ctx.resume?.().catch(() => undefined);
    }

    audio.volume(0);
    const soundId = audio.play();
    soundIdRef.current = typeof soundId === "number" ? soundId : null;

    if (typeof soundId === "number") {
      audio.fade(0, INTRO_AUDIO_VOLUME, 1200, soundId);
    } else {
      audio.fade(0, INTRO_AUDIO_VOLUME, 1200);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldPlay()) return;

    let autoplayTimer: number | null = null;
    let retryInterval: number | null = null;
    Howler.autoUnlock = true;

    const audio = new Howl({
      src: [INTRO_AUDIO_URL],
      html5: false,
      loop: true,
      preload: true,
      volume: 0,
      onload: () => {
        window.setTimeout(playIntroAudio, 0);
      },
      onplay: (soundId) => {
        soundIdRef.current = soundId;
        audioPlayAttemptInFlightRef.current = false;
        setShowSoundPrompt(false);
      },
      onplayerror: () => {
        audioPlayAttemptInFlightRef.current = false;
        setShowSoundPrompt(true);
      },
      onloaderror: () => {
        audioPlayAttemptInFlightRef.current = false;
        setShowSoundPrompt(true);
      },
      onunlock: () => {
        window.setTimeout(playIntroAudio, 0);
      },
    });

    audioRef.current = audio;
    autoplayTimer = window.setTimeout(playIntroAudio, 0);
    retryInterval = window.setInterval(() => {
      if (!audioRef.current || audioRef.current.playing()) {
        return;
      }
      playIntroAudio();
    }, 1600);

    const handleAudioGestureUnlock = () => {
      playIntroAudio();
    };
    const handleAudioRetry = () => {
      window.setTimeout(playIntroAudio, 0);
    };

    window.addEventListener("pointerdown", handleAudioGestureUnlock, {
      capture: true,
      passive: true,
    });
    window.addEventListener("touchstart", handleAudioGestureUnlock, {
      capture: true,
      passive: true,
    });
    window.addEventListener("keydown", handleAudioGestureUnlock, {
      capture: true,
    });
    window.addEventListener("focus", handleAudioRetry);
    window.addEventListener("pageshow", handleAudioRetry);
    document.addEventListener("visibilitychange", handleAudioRetry);

    return () => {
      if (autoplayTimer !== null) {
        window.clearTimeout(autoplayTimer);
      }
      if (retryInterval !== null) {
        window.clearInterval(retryInterval);
      }
      window.removeEventListener("pointerdown", handleAudioGestureUnlock, {
        capture: true,
      });
      window.removeEventListener("touchstart", handleAudioGestureUnlock, {
        capture: true,
      });
      window.removeEventListener("keydown", handleAudioGestureUnlock, {
        capture: true,
      });
      window.removeEventListener("focus", handleAudioRetry);
      window.removeEventListener("pageshow", handleAudioRetry);
      document.removeEventListener("visibilitychange", handleAudioRetry);
      audio.stop();
      audio.unload();
      audioPlayAttemptInFlightRef.current = false;
      audioRef.current = null;
    };
  }, [playIntroAudio, shouldPlay]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldPlay()) return;

    let disposed = false;

    const startIntro = () => {
      if (disposed) return;
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;
      setIsActive(true);
    };

    startIntro();

    return () => {
      disposed = true;
    };
  }, [shouldPlay]);

  useEffect(() => {
    if (!isActive) return;
    if (!shouldPlay()) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      // Optional future hook: start an ambient forest sound here after a user gesture.
      tl.set(
        [
          screen1Ref.current,
          screen2Ref.current,
          screen3Ref.current,
          revealRef.current,
        ],
        { opacity: 1 },
        0
      );

      tl.set(
        [
          screen1Line1Ref.current,
          screen1Line2Ref.current,
          screen2Line1Ref.current,
          screen2Line2Ref.current,
          screen2Line3Ref.current,
          screen3Line1Ref.current,
          screen3Line2Ref.current,
          revealWelcomeRef.current,
          revealTulaRef.current,
          revealLineRef.current,
          revealRhythmRef.current,
          revealLocationRef.current,
        ],
        { opacity: 0 },
        0
      );

      tl.set(
        [
          screen1Line1Ref.current,
          screen1Line2Ref.current,
          screen2Line1Ref.current,
          screen2Line2Ref.current,
          screen2Line3Ref.current,
          screen3Line1Ref.current,
          screen3Line2Ref.current,
          revealWelcomeRef.current,
          revealTulaRef.current,
          revealRhythmRef.current,
          revealLocationRef.current,
        ],
        { willChange: "transform, opacity, filter" },
        0
      );

      tl.set(goldLeakRef.current, { x: -40 }, 0);
      tl.set(mistRef.current, { x: 0, y: 0 }, 0);
      tl.set(vignetteRef.current, { opacity: 0.35 }, 0);
      tl.to(
        greenGlowRef.current,
        { scale: 1.12, duration: 14.5, ease: "sine.inOut" },
        0
      );
      tl.to(
        goldLeakRef.current,
        { x: 40, duration: 14.5, ease: "sine.inOut" },
        0
      );
      tl.to(
        mistRef.current,
        {
          x: 28,
          y: 14,
          duration: 14.5,
          ease: "sine.inOut",
        },
        0
      );
      tl.to(
        vignetteRef.current,
        {
          opacity: 0.55,
          duration: 3.6,
          yoyo: true,
          repeat: 3,
          ease: "sine.inOut",
        },
        0
      );

      tl.to(
        loaderRef.current,
        { opacity: 0.56, duration: 1, ease: "power2.out" },
        TIMELINE_START
      );

      const screen1Start = TIMELINE_START + 0.35;
      const screen2Start = 3.3;
      const screen3Start = 7;
      const revealStart = 10.15;

      tl.fromTo(
        screen1Line1Ref.current,
        { opacity: 0, filter: "blur(8px)", y: 18, scale: 0.99 },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          scale: 1,
          duration: LINE_IN_DURATION,
          ease: "power3.out",
        },
        screen1Start
      );

      tl.fromTo(
        screen1Line2Ref.current,
        { opacity: 0, filter: "blur(8px)", y: 18, scale: 0.99 },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          scale: 1,
          duration: LINE_IN_DURATION,
          ease: "power3.out",
        },
        screen1Start + 1.15
      );

      tl.to(
        [screen1Line1Ref.current, screen1Line2Ref.current],
        {
          opacity: 0,
          filter: "blur(6px)",
          y: -12,
          scale: 1.01,
          duration: LINE_OUT_DURATION,
          ease: "power2.in",
        },
        screen2Start - SCREEN_OVERLAP
      );

      tl.fromTo(
        screen2Line1Ref.current,
        { opacity: 0, filter: "blur(7px)", y: 16, scale: 0.99 },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          scale: 1,
          duration: 1.08,
          ease: "power3.out",
        },
        screen2Start
      );

      tl.fromTo(
        screen2Line2Ref.current,
        { opacity: 0, filter: "blur(7px)", y: 16, scale: 0.99 },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          scale: 1,
          duration: 1.08,
          ease: "power3.out",
        },
        screen2Start + 0.92
      );

      tl.fromTo(
        screen2Line3Ref.current,
        { opacity: 0, filter: "blur(7px)", y: 16, scale: 0.99 },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          scale: 1,
          duration: 1.08,
          ease: "power3.out",
        },
        screen2Start + 1.84
      );

      tl.to(
        [screen2Line1Ref.current, screen2Line2Ref.current, screen2Line3Ref.current],
        {
          opacity: 0,
          filter: "blur(6px)",
          y: -12,
          scale: 1.01,
          duration: LINE_OUT_DURATION,
          ease: "power2.in",
        },
        screen3Start - SCREEN_OVERLAP
      );

      tl.fromTo(
        screen3Line1Ref.current,
        { opacity: 0, filter: "blur(8px)", y: 18, scale: 0.99 },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          scale: 1,
          duration: LINE_IN_DURATION,
          ease: "power3.out",
        },
        screen3Start
      );

      tl.fromTo(
        screen3Line2Ref.current,
        { opacity: 0, filter: "blur(8px)", y: 18, scale: 0.99 },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          scale: 1,
          duration: 1.35,
          ease: "power3.out",
        },
        screen3Start + 1.2
      );

      tl.to(
        [screen3Line1Ref.current, screen3Line2Ref.current],
        {
          opacity: 0,
          filter: "blur(6px)",
          y: -12,
          scale: 1.01,
          duration: LINE_OUT_DURATION,
          ease: "power2.in",
        },
        revealStart - SCREEN_OVERLAP
      );

      tl.set(revealRef.current, { opacity: 1 }, revealStart - 0.3);

      tl.fromTo(
        revealWelcomeRef.current,
        { opacity: 0, filter: "blur(6px)", y: 10, scale: 0.995 },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          scale: 1,
          duration: 1.05,
          ease: "power3.out",
        },
        revealStart
      );

      tl.to(
        revealWelcomeRef.current,
        {
          opacity: 0,
          filter: "blur(5px)",
          y: -8,
          duration: 0.75,
          ease: "power2.inOut",
        },
        revealStart + 1.05
      );

      tl.fromTo(
        revealTulaRef.current,
        {
          opacity: 0,
          filter: "blur(9px)",
          y: 22,
          scale: 0.985,
          letterSpacing: "0.24em",
        },
        {
          opacity: 0.96,
          filter: "blur(0px)",
          y: 0,
          scale: 1,
          letterSpacing: "0.18em",
          duration: 1.45,
          ease: "power3.out",
        },
        revealStart + 1.35
      );

      tl.fromTo(
        revealLineRef.current,
        { opacity: 0, scaleX: 0 },
        {
          opacity: 1,
          scaleX: 1,
          duration: 1.4,
          ease: "power3.out",
        },
        revealStart + 2.15
      );

      tl.fromTo(
        revealRhythmRef.current,
        { opacity: 0, filter: "blur(6px)", y: 12, scale: 0.99 },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          scale: 1,
          duration: 1.25,
          ease: "power2.out",
        },
        revealStart + 2.75
      );

      tl.fromTo(
        revealLocationRef.current,
        { opacity: 0, filter: "blur(5px)", y: 8 },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          duration: 1,
          ease: "power2.out",
        },
        revealStart + 3.25
      );

      tl.call(fadeOutWhenReady, undefined, 14.15);
      tl.set(
        [
          screen1Line1Ref.current,
          screen1Line2Ref.current,
          screen2Line1Ref.current,
          screen2Line2Ref.current,
          screen2Line3Ref.current,
          screen3Line1Ref.current,
          screen3Line2Ref.current,
          revealWelcomeRef.current,
          revealTulaRef.current,
          revealRhythmRef.current,
          revealLocationRef.current, 
        ],
        { willChange: "auto" },
        14.2
      );

      timelineRef.current = tl;
    }, overlayRef);

    return () => {
      ctx.revert();
      timelineRef.current = null;
    };
  }, [shouldPlay, handleComplete, fadeOutWhenReady, isActive]);

  if (!isActive) return null;

  return (
    <div
      ref={overlayRef}
      onPointerDownCapture={playIntroAudio}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        overflow: "hidden",
        backgroundColor: "#000",
        opacity: 1,
        pointerEvents: "auto",
      }}
    >
      {/* Atmospheric background layers */}
      <div
        ref={greenGlowRef}
        style={{
          position: "absolute",
          inset: "-8%",
          background:
            "radial-gradient(ellipse 62% 46% at 18% 74%, rgba(34,120,70,0.28) 0%, rgba(15,60,36,0.16) 46%, transparent 74%), radial-gradient(ellipse 54% 40% at 86% 18%, rgba(28,104,62,0.2) 0%, transparent 70%), radial-gradient(ellipse 74% 58% at 50% 42%, rgba(34,98,57,0.31) 0%, rgba(13,45,28,0.18) 42%, transparent 72%)",
          pointerEvents: "none",
          transformOrigin: "50% 50%",
          willChange: "transform",
        }}
      />

      <div
        ref={goldLeakRef}
        style={{
          position: "absolute",
          inset: "-12% -18%",
          background:
            "linear-gradient(112deg, transparent 24%, rgba(200,169,106,0.03) 46%, rgba(200,169,106,0.1) 55%, rgba(255,238,192,0.025) 64%, transparent 78%)",
          pointerEvents: "none",
          willChange: "transform",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.72) 0%, transparent 24%, transparent 70%, rgba(0,0,0,0.78) 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.5) 0%, transparent 18%, transparent 82%, rgba(0,0,0,0.48) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Subtle noise texture */}
      <div
        ref={mistRef}
        style={{
          position: "absolute",
          inset: "-10%",
          opacity: 0.045,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
          pointerEvents: "none",
          willChange: "transform",
        }}
      />

      <div
        ref={vignetteRef}
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 62% 48% at 50% 48%, transparent 0%, rgba(0,0,0,0.18) 52%, rgba(0,0,0,0.86) 100%)",
          pointerEvents: "none",
          willChange: "opacity",
        }}
      />

      {/* Single center stage — all screens absolutely stacked here */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Screen 1 */}
        <div
          ref={screen1Ref}
          className="cinematic-screen cinematic-screen--opening"
        >
          <span
            ref={screen1Line1Ref}
            className={`${cinematicSerif.className} cinematic-copy cinematic-copy--lead`}
          >
            Have you ever dreamed&hellip;
          </span>
          <span
            ref={screen1Line2Ref}
            className={`${cinematicSerif.className} cinematic-copy cinematic-copy--lead cinematic-copy--indent`}
          >
            of a place where the city fades away?
          </span>
        </div>

        {/* Screen 2 */}
        <div
          ref={screen2Ref}
          className="cinematic-screen cinematic-screen--movement"
        >
          <span
            ref={screen2Line1Ref}
            className={`${cinematicSerif.className} cinematic-copy cinematic-copy--secondary cinematic-copy--left`}
          >
            Where water moves beside you.
          </span>
          <span
            ref={screen2Line2Ref}
            className={`${cinematicSerif.className} cinematic-copy cinematic-copy--secondary cinematic-copy--right`}
          >
            Where paths lead deeper into calm.
          </span>
          <span
            ref={screen2Line3Ref}
            className={`${cinematicSerif.className} cinematic-copy cinematic-copy--secondary cinematic-copy--center`}
          >
            Where the sky stays open.
          </span>
        </div>

        {/* Screen 3 */}
        <div
          ref={screen3Ref}
          className="cinematic-screen cinematic-screen--closing"
        >
          <span
            ref={screen3Line1Ref}
            className={`${cinematicSerif.className} cinematic-copy cinematic-copy--lead`}
          >
            Here, nature is not an escape.
          </span>
          <span
            ref={screen3Line2Ref}
            className={`${cinematicSerif.className} cinematic-copy cinematic-copy--final`}
          >
            It is home.
          </span>
        </div>

        {/* Final Reveal */}
        <div
          ref={revealRef}
          className="cinematic-reveal"
        >
          <span
            ref={revealWelcomeRef}
            className={`${cinematicSerif.className} cinematic-reveal__welcome`}
          >
            Welcome to
          </span>

          <h1
            ref={revealTulaRef}
            className={`${cinematicSerif.className} cinematic-reveal__title`}
          >
            TULA
          </h1>

          <div
            ref={revealLineRef}
            style={{
              width: "clamp(80px, 20vw, 160px)",
              height: "1px",
              background:
                "linear-gradient(90deg, transparent, #c8a96a, transparent)",
              marginTop: "0.9em",
              transformOrigin: "center",
            }}
          />

          <span
            ref={revealRhythmRef}
            className={`${cinematicSerif.className} cinematic-reveal__rhythm`}
          >
            Rhythm of Trees
          </span>

          <span
            ref={revealLocationRef}
            className={`${cinematicSerif.className} cinematic-reveal__location`}
          >
            Bangalore
          </span>
        </div>
      </div>

      {/* Bottom-center ambient loader */}
      <div
        ref={setLoaderRefs}
        aria-label="Entering the landscape 0%"
        style={{
          position: "absolute",
          left: "50%",
          bottom: "2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.65rem",
          opacity: 0,
          pointerEvents: "none",
          transform: "translateX(-50%)",
        }}
      >
        <div className="loader-grid" />
        {/* <span className="cinematic-loader-copy">
          Entering the landscape {clampedProgress}%
        </span> */}
      </div>

      {/* Skip button — bottom right */}
      <button
        onClick={handleSkip}
        className="cinematic-skip-button"
        style={{
          position: "absolute",
          bottom: "2.5rem",
          right: "2rem",
          fontFamily: "var(--font-sans, system-ui)",
          fontSize: "10px",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.35)",
          backgroundColor: "transparent",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "9999px",
          padding: "0.6rem 1.4rem",
          cursor: "pointer",
          transition: "all 0.3s ease",
        }}
        aria-label="Skip intro"
      >
        Skip Intro
      </button>

      {showSoundPrompt ? (
        <button
          type="button"
          onClick={playIntroAudio}
          className="cinematic-sound-button"
          aria-label="Enable intro sound"
        >
          Enable Sound
        </button>
      ) : null}

      {/* CSS Loader Animation */}
      <style>{`
        .cinematic-screen,
        .cinematic-reveal {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: clamp(2rem, 6vw, 5rem);
          pointer-events: none;
        }

        .cinematic-screen--opening {
          align-items: flex-start;
          padding-left: clamp(2rem, 11vw, 10rem);
          padding-bottom: clamp(4rem, 10vh, 7rem);
        }

        .cinematic-screen--movement {
          align-items: stretch;
          gap: clamp(0.7rem, 1.8vh, 1.2rem);
          padding-inline: clamp(2rem, 12vw, 12rem);
        }

        .cinematic-screen--closing {
          align-items: flex-end;
          padding-right: clamp(2rem, 12vw, 11rem);
          padding-top: clamp(3rem, 9vh, 7rem);
        }

        .cinematic-reveal {
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .cinematic-reveal__welcome {
          position: absolute;
          left: 50%;
          top: calc(50% - clamp(3.9rem, 8vw, 7rem));
          width: min(92vw, 980px);
          color: rgba(235, 238, 232, 0.74);
          font-size: clamp(1.05rem, 1.9vw, 2rem);
          font-weight: 500;
          line-height: 1;
          letter-spacing: clamp(0.16rem, 0.5vw, 0.42rem);
          text-align: center;
          text-indent: clamp(0.16rem, 0.5vw, 0.42rem);
          text-shadow: 0 16px 38px rgba(0, 0, 0, 0.72);
          transform: translate(-50%, -50%);
          will-change: transform, opacity;
        }

        .cinematic-reveal__title {
          margin: 0;
          padding-left: 0.18em;
          color: #f6f7ef;
          font-size: clamp(4.8rem, 14vw, 13rem);
          font-weight: 600;
          line-height: 0.8;
          letter-spacing: 0.18em;
          text-align: center;
          text-shadow:
            0 20px 52px rgba(0, 0, 0, 0.72),
            0 0 68px rgba(224, 232, 218, 0.12);
          transform-origin: 50% 50%;
          will-change: transform, opacity, letter-spacing;
        }

        .cinematic-reveal__rhythm {
          margin-top: clamp(0.8rem, 1.9vh, 1.35rem);
          color: rgba(246, 247, 239, 0.78);
          font-size: clamp(1.18rem, 2.2vw, 2.35rem);
          font-weight: 500;
          line-height: 1;
          letter-spacing: clamp(0.08rem, 0.32vw, 0.24rem);
          text-align: center;
          text-shadow:
            0 14px 34px rgba(0, 0, 0, 0.68),
            0 0 36px rgba(200, 169, 106, 0.07);
          will-change: transform, opacity;
        }

        .cinematic-reveal__location {
          margin-top: clamp(0.55rem, 1.25vh, 0.9rem);
          color: rgba(200, 169, 106, 0.66);
          font-size: clamp(0.72rem, 1.05vw, 0.9rem);
          font-weight: 500;
          letter-spacing: clamp(0.14rem, 0.52vw, 0.38rem);
          text-align: center;
          text-indent: clamp(0.14rem, 0.52vw, 0.38rem);
        }

        .cinematic-copy {
          display: block;
          max-width: min(980px, 88vw);
          color: rgba(255, 255, 255, 0.92);
          text-shadow:
            0 10px 28px rgba(0, 0, 0, 0.62),
            0 0 28px rgba(214, 188, 136, 0.07);
          will-change: transform, opacity;
        }

        .cinematic-copy--lead {
          font-size: clamp(1.45rem, 3.35vw, 3.55rem);
          font-weight: 500;
          line-height: 1.03;
          letter-spacing: clamp(0.015rem, 0.1vw, 0.08rem);
        }

        .cinematic-copy--indent {
          margin-top: clamp(0.6rem, 1.4vh, 1rem);
          margin-left: clamp(1.5rem, 8vw, 9rem);
          color: rgba(247, 239, 224, 0.84);
        }

        .cinematic-copy--secondary {
          font-size: clamp(1.12rem, 2.45vw, 2.55rem);
          font-weight: 500;
          line-height: 1.08;
          letter-spacing: clamp(0.015rem, 0.09vw, 0.08rem);
          color: rgba(255, 255, 255, 0.86);
        }

        .cinematic-copy--left {
          align-self: flex-start;
          text-align: left;
        }

        .cinematic-copy--right {
          align-self: flex-end;
          text-align: right;
          color: rgba(235, 220, 190, 0.88);
        }

        .cinematic-copy--center {
          align-self: center;
          text-align: center;
          color: rgba(255, 255, 255, 0.78);
        }

        .cinematic-copy--final {
          margin-top: clamp(0.7rem, 1.6vh, 1.2rem);
          font-size: clamp(2rem, 5.1vw, 5.3rem);
          font-weight: 600;
          line-height: 0.9;
          color: #fff8ea;
          text-shadow:
            0 12px 34px rgba(0, 0, 0, 0.62),
            0 0 44px rgba(214, 188, 136, 0.14);
        }

        @media (max-width: 640px) {
          .cinematic-screen,
          .cinematic-reveal {
            padding: 2rem 1.25rem;
          }

          .cinematic-screen--opening,
          .cinematic-screen--closing {
            align-items: center;
            padding-inline: 1.25rem;
            text-align: center;
          }

          .cinematic-copy--indent {
            margin-left: 0;
          }

          .cinematic-screen--movement {
            padding-inline: 1.25rem;
          }

          .cinematic-copy--left,
          .cinematic-copy--right,
          .cinematic-copy--center {
            align-self: center;
            text-align: center;
          }

          .cinematic-reveal__title {
            font-size: clamp(4rem, 22vw, 6.4rem);
          }

          .cinematic-copy,
          .cinematic-reveal__title,
          .cinematic-reveal__welcome,
          .cinematic-reveal__rhythm,
          .cinematic-copy--final {
            text-shadow: 0 10px 26px rgba(0, 0, 0, 0.7);
          }
        }

        @media (prefers-reduced-motion: reduce), (max-width: 480px) {
          .loader-grid::before,
          .loader-grid::after {
            animation-duration: 2.4s;
          }

          .cinematic-copy,
          .cinematic-reveal__title,
          .cinematic-reveal__welcome,
          .cinematic-reveal__rhythm {
            will-change: opacity, transform;
          }
        }

        .loader-grid {
          width: 26px;
          aspect-ratio: 1;
          display: grid;
          opacity: 1;
        }
        .loader-grid::before,
        .loader-grid::after {
          content: "";
          grid-area: 1/1;
          margin: 0 0 9px 9px;
          --c:#0000 calc(100%/3),rgba(200,169,106,0.68) 0 calc(2*100%/3),#0000 0;
          --c1:linear-gradient(90deg,var(--c));
          --c2:linear-gradient(0deg,var(--c));
          background: var(--c1), var(--c2), var(--c1), var(--c2);
          background-size: 300% 2px, 2px 300%;
          background-repeat: no-repeat;
          animation: l12 1.6s infinite linear;
        }
        .loader-grid::after {
          margin: 9px 9px 0 0;
          transform: scale(-1,-1);
        }

        .cinematic-loader-copy {
          color: rgba(200, 169, 106, 0.58);
          font-family: var(--font-sans, system-ui);
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.28em;
          line-height: 1;
          text-align: center;
          text-indent: 0.28em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .cinematic-sound-button {
          position: absolute;
          bottom: 2.5rem;
          left: 2rem;
          border: 1px solid rgba(200, 169, 106, 0.24);
          border-radius: 9999px;
          background: rgba(0, 0, 0, 0.22);
          color: rgba(200, 169, 106, 0.74);
          cursor: pointer;
          font-family: var(--font-sans, system-ui);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.28em;
          line-height: 1;
          padding: 0.65rem 1.35rem;
          text-transform: uppercase;
          transition:
            background-color 0.28s ease,
            border-color 0.28s ease,
            color 0.28s ease;
        }

        .cinematic-sound-button:hover {
          background: rgba(200, 169, 106, 0.08);
          border-color: rgba(200, 169, 106, 0.42);
          color: rgba(246, 230, 194, 0.88);
        }

        .cinematic-skip-button:hover {
          color: rgba(255,255,255,0.65) !important;
          background-color: rgba(255,255,255,0.05) !important;
        }

        @keyframes l12 {
          0%   {background-position: 50% 0,100% 100%,0 100%,0 0}
          25%  {background-position: 0 0,100% 50%,0 100%,0 0}
          50%  {background-position: 0 0,100% 0,50% 100%,0 0}
          75%  {background-position: 0 0,100% 0,100% 100%,0 50%}
          75.01%{background-position: 100% 0,100% 0,100% 100%,0 50%}
          100% {background-position: 50% 0,100% 0,100% 100%,0 100%}
        }
      `}</style>
    </div>
  );
});

export default function CinematicIntro({
  onComplete,
  progress = 0,
  readyToComplete = true,
}: CinematicIntroProps) {
  const clampedProgress = Math.round(Math.max(0, Math.min(100, progress)));
  const loaderNodeRef = useRef<HTMLDivElement | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    loaderNodeRef.current?.setAttribute(
      "aria-label",
      `Entering the landscape ${clampedProgress}%`,
    );
  }, [clampedProgress]);

  return (
    <CinematicIntroStage
      loaderNodeRef={loaderNodeRef}
      onCompleteRef={onCompleteRef}
      readyToComplete={readyToComplete}
    />
  );
}
