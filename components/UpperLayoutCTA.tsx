"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, type Transition } from "framer-motion";
import { FiPhone, FiDownload, FiDollarSign, FiGrid, FiHome } from "react-icons/fi";
import { BiHome } from "react-icons/bi";
import { IoMapOutline } from "react-icons/io5";
import { RiBuilding2Line } from "react-icons/ri";
import { Footprints, Menu, Sparkles, X } from "lucide-react";

interface CtaButtonType {
  name: string;
  link?: string;
  action: "link" | "quote-modal";
  isHighlight: boolean;
  icon: React.ReactNode;
}

type UpperLayoutCTAProps = {
  onQuoteClick: () => void;
  mergeRouteLinks?: boolean;
};

function shouldBottomDockCta() {
  if (typeof window === "undefined") {
    return false;
  }

  const compactViewport = window.matchMedia("(max-width: 1279px)").matches;
  const primaryPointerCoarse = window.matchMedia("(pointer: coarse)").matches;
  const finePointerAvailable =
    window.matchMedia("(pointer: fine)").matches ||
    window.matchMedia("(any-pointer: fine)").matches;

  return (
    compactViewport || (primaryPointerCoarse && !finePointerAvailable)
  );
}

function shouldHideMasterPlanCompactDesktopRail(pathname: string | null) {
  if (typeof window === "undefined" || pathname !== "/master-plan") {
    return false;
  }

  return (
    window.matchMedia("(min-width: 1280px) and (max-width: 1699px)").matches &&
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(pointer: coarse)").matches &&
    !window.matchMedia("(any-pointer: coarse)").matches
  );
}

const spring: Transition = {
  type: "spring",
  stiffness: 280,
  damping: 24,
};

function isQuickRouteActive(pathname: string, href?: string) {
  if (!href) {
    return false;
  }

  if (href === "/exterior-walkthrough") {
    return (
      pathname === "/exterior-walkthrough" ||
      pathname === "/exterior-tour" ||
      pathname === "/exterios-walkthrough" ||
      pathname === "/walkthrough"
    );
  }

  return pathname === href;
}

function getRemoteControlProps(button: CtaButtonType) {
  return {
    "data-trifecta-control-label": button.name,
    ...(button.action === "quote-modal"
      ? { "data-trifecta-quote-trigger": "true" }
      : {}),
  };
}

export default function UpperLayoutCTA({
  onQuoteClick,
  mergeRouteLinks = false,
}: UpperLayoutCTAProps) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);
  const [shouldDockAtBottom, setShouldDockAtBottom] = useState(
    shouldBottomDockCta,
  );
  const [shouldHideCompactDesktopRail, setShouldHideCompactDesktopRail] =
    useState(() => shouldHideMasterPlanCompactDesktopRail(pathname));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMenuRendered, setIsMobileMenuRendered] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const menuOverlayRef = useRef<HTMLDivElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const menuHandleRef = useRef<HTMLDivElement | null>(null);
  const menuCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<(HTMLElement | null)[]>([]);
  const menuLetterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const menuUtilityRefs = useRef<(HTMLElement | null)[]>([]);
  const menuAnimationRef = useRef<gsap.core.Timeline | null>(null);
  const scrollerDragRef = useRef<{
    dragging: boolean;
    lastX: number;
    pointerId: number | null;
  }>({
    dragging: false,
    lastX: 0,
    pointerId: null,
  });
  const isMasterPlanRoute = pathname === "/master-plan";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const compactViewportMedia = window.matchMedia("(max-width: 1279px)");
    const touchViewportMedia = window.matchMedia("(pointer: coarse)");
    const finePointerMedia = window.matchMedia("(pointer: fine)");
    const anyFinePointerMedia = window.matchMedia("(any-pointer: fine)");

    const syncBottomDock = () => {
      setShouldDockAtBottom(
        compactViewportMedia.matches ||
          (touchViewportMedia.matches &&
            !finePointerMedia.matches &&
            !anyFinePointerMedia.matches),
      );
    };

    syncBottomDock();
    compactViewportMedia.addEventListener("change", syncBottomDock);
    touchViewportMedia.addEventListener("change", syncBottomDock);
    finePointerMedia.addEventListener("change", syncBottomDock);
    anyFinePointerMedia.addEventListener("change", syncBottomDock);

    return () => {
      compactViewportMedia.removeEventListener("change", syncBottomDock);
      touchViewportMedia.removeEventListener("change", syncBottomDock);
      finePointerMedia.removeEventListener("change", syncBottomDock);
      anyFinePointerMedia.removeEventListener("change", syncBottomDock);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const compactDesktopMedia = window.matchMedia(
      "(min-width: 1280px) and (max-width: 1699px)",
    );
    const finePointerMedia = window.matchMedia("(pointer: fine)");
    const coarsePointerMedia = window.matchMedia("(pointer: coarse)");
    const anyCoarsePointerMedia = window.matchMedia("(any-pointer: coarse)");

    const syncCompactDesktopRail = () => {
      setShouldHideCompactDesktopRail(
        pathname === "/master-plan" &&
          compactDesktopMedia.matches &&
          finePointerMedia.matches &&
          !coarsePointerMedia.matches &&
          !anyCoarsePointerMedia.matches,
      );
    };

    syncCompactDesktopRail();
    compactDesktopMedia.addEventListener("change", syncCompactDesktopRail);
    finePointerMedia.addEventListener("change", syncCompactDesktopRail);
    coarsePointerMedia.addEventListener("change", syncCompactDesktopRail);
    anyCoarsePointerMedia.addEventListener("change", syncCompactDesktopRail);

    return () => {
      compactDesktopMedia.removeEventListener("change", syncCompactDesktopRail);
      finePointerMedia.removeEventListener("change", syncCompactDesktopRail);
      coarsePointerMedia.removeEventListener("change", syncCompactDesktopRail);
      anyCoarsePointerMedia.removeEventListener(
        "change",
        syncCompactDesktopRail,
      );
    };
  }, [pathname]);

  const primaryButtons: CtaButtonType[] = [
    {
      name: "Contact Us",
      link: "tel:+91-808 800 4411",
      action: "link",
      isHighlight: false,
      icon: (
        <FiPhone className="h-[0.82rem] w-[0.82rem] xl:h-[0.9rem] xl:w-[0.9rem] 2xl:h-[0.98rem] 2xl:w-[0.98rem]" />
      ),
    },
    {
      name: "Brochure",
      link: "/Veranza Floorplan_ E-Brochure_V3_02-03-26 (2).pdf",
      action: "link",
      isHighlight: false,
      icon: (
        <FiDownload className="h-[0.82rem] w-[0.82rem] xl:h-[0.9rem] xl:w-[0.9rem] 2xl:h-[0.98rem] 2xl:w-[0.98rem]" />
      ),
    },
    {
      name: "Get A Quote",
      action: "quote-modal",
      isHighlight: false,
      icon: (
        <FiDollarSign className="h-[0.82rem] w-[0.82rem] xl:h-[0.9rem] xl:w-[0.9rem] 2xl:h-[0.98rem] 2xl:w-[0.98rem]" />
      ),
    },
  ];

  if (isMasterPlanRoute) {
    primaryButtons.push({
      name: "Home",
      link: "/",
      action: "link",
      isHighlight: isQuickRouteActive(pathname ?? "", "/"),
      icon: (
        <FiHome className="h-[0.82rem] w-[0.82rem] xl:h-[0.9rem] xl:w-[0.9rem] 2xl:h-[0.98rem] 2xl:w-[0.98rem]" />
      ),
    });
  }

  const routeButtons = useMemo<CtaButtonType[]>(() => {
    if (!mergeRouteLinks) {
      return [];
    }

    const buttons: CtaButtonType[] = [
      {
        name: "Home",
        link: "/",
        action: "link",
        isHighlight: isQuickRouteActive(pathname ?? "", "/"),
        icon: (
          <BiHome className="h-[0.82rem] w-[0.82rem] xl:h-[0.9rem] xl:w-[0.9rem] 2xl:h-[0.98rem] 2xl:w-[0.98rem]" />
        ),
      },
      {
        name: "Project Overview",
        link: "/project-overview",
        action: "link",
        isHighlight: isQuickRouteActive(pathname ?? "", "/project-overview"),
        icon: (
          <FiGrid className="h-[0.82rem] w-[0.82rem] xl:h-[0.9rem] xl:w-[0.9rem] 2xl:h-[0.98rem] 2xl:w-[0.98rem]" />
        ),
      },
      {
        name: "Master Plan",
        link: "/master-plan",
        action: "link",
        isHighlight: isQuickRouteActive(pathname ?? "", "/master-plan"),
        icon: (
          <RiBuilding2Line className="h-[0.82rem] w-[0.82rem] xl:h-[0.9rem] xl:w-[0.9rem] 2xl:h-[0.98rem] 2xl:w-[0.98rem]" />
        ),
      },
      {
        name: "Amenities",
        link: "/amenities",
        action: "link",
        isHighlight: isQuickRouteActive(pathname ?? "", "/amenities"),
        icon: (
          <Sparkles className="h-[0.82rem] w-[0.82rem] xl:h-[0.9rem] xl:w-[0.9rem] 2xl:h-[0.98rem] 2xl:w-[0.98rem]" />
        ),
      },
      {
        name: "Map",
        link: "/area-map",
        action: "link",
        isHighlight: isQuickRouteActive(pathname ?? "", "/area-map"),
        icon: (
          <IoMapOutline className="h-[0.82rem] w-[0.82rem] xl:h-[0.9rem] xl:w-[0.9rem] 2xl:h-[0.98rem] 2xl:w-[0.98rem]" />
        ),
      },
      {
        name: "Walkthrough",
        link: "/exterior-walkthrough",
        action: "link",
        isHighlight: isQuickRouteActive(pathname ?? "", "/exterior-walkthrough"),
        icon: (
          <Footprints className="h-[0.82rem] w-[0.82rem] xl:h-[0.9rem] xl:w-[0.9rem] 2xl:h-[0.98rem] 2xl:w-[0.98rem]" />
        ),
      },
    ];

    return buttons.filter(
      (button) => !(isMasterPlanRoute && button.name === "Home"),
    );
  }, [isMasterPlanRoute, mergeRouteLinks, pathname]);

  const buttons = [...primaryButtons, ...routeButtons];
  const compactMenuButtons =
    routeButtons.length > 0 ? routeButtons : primaryButtons;
  const compactUtilityButtons =
    routeButtons.length > 0 ? primaryButtons : [];
  const shouldShowLabels = !mergeRouteLinks && !shouldDockAtBottom;
  const shouldEnableRailDrag = shouldDockAtBottom;
  const isDesktopTopRail = !shouldDockAtBottom;

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (!shouldDockAtBottom || !isMobileMenuRendered) {
      document.body.style.overflow = "";
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuRendered, shouldDockAtBottom]);

  useEffect(() => {
    if (!shouldDockAtBottom || !isMobileMenuRendered) {
      menuAnimationRef.current?.kill();
      return;
    }

    const overlay = menuOverlayRef.current;
    const panel = menuPanelRef.current;
    const handle = menuHandleRef.current;
    const closeButton = menuCloseButtonRef.current;
    const items = menuItemRefs.current.filter(
      (item): item is HTMLElement => item !== null,
    );
    const letters = menuLetterRefs.current.filter(
      (item): item is HTMLSpanElement => item !== null,
    );
    const utilities = menuUtilityRefs.current.filter(
      (item): item is HTMLElement => item !== null,
    );

    if (!overlay || !panel) {
      return;
    }

    menuAnimationRef.current?.kill();

    if (isMobileMenuOpen) {
      gsap.set(overlay, { autoAlpha: 0 });
      gsap.set(panel, { yPercent: 100, scaleY: 0.985, transformOrigin: "bottom center" });
      gsap.set(handle, { opacity: 0, scaleX: 0.6, y: 10 });
      gsap.set(closeButton, { opacity: 0, scale: 0.86, rotate: -10 });
      gsap.set(items, { opacity: 0, y: 22 });
      gsap.set(letters, { opacity: 0, yPercent: 120 });
      gsap.set(utilities, { opacity: 0, y: 18, scale: 0.92 });

      const openTimeline = gsap.timeline();
      openTimeline
        .to(overlay, {
          autoAlpha: 1,
          duration: 0.3,
          ease: "expo.out",
        })
        .to(
          panel,
          {
            yPercent: 0,
            scaleY: 1,
            duration: 0.82,
            ease: "expo.out",
          },
          0,
        )
        .to(
          handle,
          {
            opacity: 1,
            scaleX: 1,
            y: 0,
            duration: 0.48,
            ease: "expo.out",
          },
          0.18,
        )
        .to(
          closeButton,
          {
            opacity: 1,
            scale: 1,
            rotate: 0,
            duration: 0.42,
            ease: "expo.out",
          },
          0.2,
        )
        .to(
          items,
          {
            opacity: 1,
            y: 0,
            duration: 0.52,
            ease: "expo.out",
            stagger: 0.04,
          },
          0.24,
        )
        .to(
          letters,
          {
            opacity: 1,
            yPercent: 0,
            duration: 0.56,
            ease: "expo.out",
            stagger: 0.006,
          },
          0.26,
        )
        .to(
          utilities,
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.42,
            ease: "expo.out",
            stagger: 0.035,
          },
          0.4,
        );

      menuAnimationRef.current = openTimeline;
      return () => {
        openTimeline.kill();
      };
    }

    const closeTimeline = gsap.timeline({
      onComplete: () => {
        setIsMobileMenuRendered(false);
      },
    });

    closeTimeline
      .to(utilities, {
        opacity: 0,
        y: 10,
        scale: 0.92,
        duration: 0.18,
        ease: "expo.in",
        stagger: {
          each: 0.02,
          from: "end",
        },
      })
      .to(
        items,
        {
          opacity: 0,
          y: 16,
          duration: 0.24,
          ease: "expo.in",
          stagger: {
            each: 0.018,
            from: "end",
          },
        },
        0.02,
      )
      .to(
        closeButton,
        {
          opacity: 0,
          scale: 0.88,
          rotate: -8,
          duration: 0.18,
          ease: "expo.in",
        },
        0.04,
      )
      .to(
        handle,
        {
          opacity: 0,
          scaleX: 0.72,
          y: 8,
          duration: 0.18,
          ease: "expo.in",
        },
        0.04,
      )
      .to(
        panel,
        {
          yPercent: 100,
          scaleY: 0.985,
          duration: 0.48,
          ease: "expo.in",
        },
        0.08,
      )
      .to(
        overlay,
        {
          autoAlpha: 0,
          duration: 0.22,
          ease: "expo.in",
        },
        0.16,
      );

    menuAnimationRef.current = closeTimeline;

    return () => {
      closeTimeline.kill();
    };
  }, [isMobileMenuOpen, isMobileMenuRendered, shouldDockAtBottom]);

  if (shouldHideCompactDesktopRail) {
    return null;
  }

  if (shouldDockAtBottom) {
    let mobileLetterIndex = 0;

    return (
      <>
        {isMobileMenuRendered ? (
          <div
            ref={menuOverlayRef}
            className="pointer-events-auto fixed inset-0 z-50 bg-black/48 backdrop-blur-[6px]"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setIsMobileMenuOpen(false);
              }
            }}
          >
            <div
              ref={menuPanelRef}
              className="absolute inset-x-0 bottom-0 max-h-[calc(100svh-1rem)] overflow-hidden rounded-t-[2.25rem] border-t border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,248,246,0.98))] text-zinc-950 shadow-[0_-24px_70px_rgba(0,0,0,0.18)] backdrop-blur-3xl"
              role="dialog"
              aria-modal="true"
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.65),rgba(255,255,255,0.14)_18%,transparent_45%,rgba(0,0,0,0.02))]" />
              <div className="relative flex flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-6 sm:pt-5">
                <div className="mb-4 flex items-center justify-between">
                  <div
                    ref={menuHandleRef}
                    className="h-1 w-14 rounded-full bg-zinc-300"
                  />
                  <button
                    ref={menuCloseButtonRef}
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/8 bg-white/70 text-zinc-900 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl transition active:scale-[0.98]"
                    aria-label="Close navigation menu"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mx-auto w-full max-w-[34rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="space-y-0">
                    {compactMenuButtons.map((button, index) => {
                      const labelChars = Array.from(button.name.toUpperCase());

                      const itemContent = (
                        <>
                          <div className="flex min-w-0 items-center gap-3.5">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/8 bg-zinc-100 text-zinc-600 transition duration-300 group-hover:border-black/12 group-hover:bg-zinc-950 group-hover:text-white">
                              {button.icon}
                            </span>
                            <span className="flex min-w-0 flex-wrap overflow-hidden text-[1.58rem] font-medium uppercase leading-[0.92] tracking-[-0.05em] text-zinc-950 sm:text-[1.9rem]">
                              {labelChars.map((char) => {
                                const letterIndex = mobileLetterIndex++;

                                return (
                                  <span
                                    key={`${button.name}-${letterIndex}-${char}`}
                                    ref={(node) => {
                                      menuLetterRefs.current[letterIndex] = node;
                                    }}
                                    className="inline-block"
                                  >
                                    {char === " " ? "\u00A0" : char}
                                  </span>
                                );
                              })}
                            </span>
                          </div>
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-400 transition duration-300 group-hover:translate-x-1 group-hover:text-zinc-950">
                            <span className="text-lg leading-none">+</span>
                          </span>
                        </>
                      );

                      const itemClassName = `group relative flex w-full items-center justify-between gap-3 border-b border-zinc-200 py-4 text-left transition duration-300 last:border-b-0 sm:py-[1.15rem] ${
                        button.isHighlight
                          ? "text-zinc-950"
                          : "text-zinc-800 hover:text-zinc-950"
                      }`;

                      return button.action === "link" && button.link ? (
                        <Link
                          key={button.name}
                          href={button.link}
                          title={button.name}
                          aria-label={button.name}
                          {...getRemoteControlProps(button)}
                          onClick={() => setIsMobileMenuOpen(false)}
                          ref={(node) => {
                            menuItemRefs.current[index] = node;
                          }}
                          className={itemClassName}
                        >
                          {itemContent}
                        </Link>
                      ) : (
                        <button
                          key={button.name}
                          type="button"
                          title={button.name}
                          aria-label={button.name}
                          {...getRemoteControlProps(button)}
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            onQuoteClick();
                          }}
                          ref={(node) => {
                            menuItemRefs.current[index] = node;
                          }}
                          className={itemClassName}
                        >
                          {itemContent}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {compactUtilityButtons.length > 0 ? (
                  <div className="mt-4 flex justify-center">
                    <div className="inline-flex flex-wrap items-center gap-3 px-1 py-1">
                      {compactUtilityButtons.map((button, index) =>
                        button.action === "link" && button.link ? (
                          <Link
                            key={button.name}
                            href={button.link}
                            title={button.name}
                            aria-label={button.name}
                            onClick={() => setIsMobileMenuOpen(false)}
                            ref={(node) => {
                              menuUtilityRefs.current[index] = node;
                            }}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/8 bg-white text-zinc-700 shadow-[0_8px_18px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-0.5 hover:border-black/12 hover:bg-zinc-950 hover:text-white"
                          >
                            <span className="flex h-4 w-4 items-center justify-center">
                              {button.icon}
                            </span>
                          </Link>
                        ) : (
                          <button
                            key={button.name}
                            type="button"
                            title={button.name}
                            aria-label={button.name}
                            {...getRemoteControlProps(button)}
                            onClick={() => {
                              setIsMobileMenuOpen(false);
                              onQuoteClick();
                            }}
                            ref={(node) => {
                              menuUtilityRefs.current[index] = node;
                            }}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/8 bg-white text-zinc-700 shadow-[0_8px_18px_rgba(0,0,0,0.06)] transition duration-300 hover:-translate-y-0.5 hover:border-black/12 hover:bg-zinc-950 hover:text-white"
                          >
                            <span className="flex h-4 w-4 items-center justify-center">
                              {button.icon}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {!isMobileMenuOpen ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),1rem)] z-[60] flex justify-start px-4 sm:px-5">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuRendered(true);
                setIsMobileMenuOpen(true);
              }}
              className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-[linear-gradient(180deg,rgba(26,26,28,0.92),rgba(7,7,8,0.96))] text-stone-100 shadow-[0_16px_40px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl transition active:scale-[0.98] sm:h-11 sm:w-11"
              aria-label="Open navigation menu"
              aria-expanded={false}
            >
              <Menu className="h-[1.05rem] w-[1.05rem]" />
            </button>
          </div>
        ) : null}
      </>
    );
  }

  const handleScrollerPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!shouldEnableRailDrag || !scrollerRef.current) {
      return;
    }

    const nextDragState = scrollerDragRef.current;
    nextDragState.dragging = true;
    nextDragState.lastX = event.clientX;
    nextDragState.pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleScrollerPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const dragState = scrollerDragRef.current;
    const scroller = scrollerRef.current;

    if (
      !shouldEnableRailDrag ||
      !dragState.dragging ||
      dragState.pointerId !== event.pointerId ||
      !scroller
    ) {
      return;
    }

    const deltaX = event.clientX - dragState.lastX;
    dragState.lastX = event.clientX;
    scroller.scrollLeft -= deltaX;
  };

  const handleScrollerPointerUp = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const dragState = scrollerDragRef.current;

    if (dragState.pointerId !== event.pointerId) {
      return;
    }

    dragState.dragging = false;
    dragState.pointerId = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <>
      <div
        className={`pointer-events-none fixed inset-x-0 z-50 flex justify-center px-2 md:px-0 ${
          shouldDockAtBottom
            ? "bottom-[max(env(safe-area-inset-bottom),0.85rem)]"
            : "top-3 md:top-4"
        }`}
      >
      <motion.div
        layout
        transition={spring}
        className="pointer-events-auto relative mx-auto w-fit max-w-full"
      >
        <motion.div
          layout
          transition={spring}
          className={`relative max-w-full overflow-hidden rounded-full border shadow-[0_14px_42px_rgba(0,0,0,0.34)] backdrop-blur-2xl ${
            isDesktopTopRail
              ? "border-white/12 bg-black/72 px-1.5 py-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
              : "border-white/18 bg-black/42 px-2 py-2 shadow-[0_14px_42px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.16)] sm:px-2.5 sm:py-2.5"
          } ${
            shouldDockAtBottom
              ? "md:px-5 md:py-3"
              : isDesktopTopRail
                ? ""
                : "sm:px-3 sm:py-2.5 xl:px-3.5 xl:py-2.5 2xl:px-4 2xl:py-3"
          }`}
        >
          <motion.div
            ref={scrollerRef}
            layout
            transition={spring}
            onPointerDown={handleScrollerPointerDown}
            onPointerMove={handleScrollerPointerMove}
            onPointerUp={handleScrollerPointerUp}
            onPointerCancel={handleScrollerPointerUp}
            className={`flex max-w-[calc(100vw-2rem)] items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              isDesktopTopRail ? "gap-1 sm:gap-1.5" : "gap-1 sm:gap-1.5 2xl:gap-2"
            } ${
              shouldEnableRailDrag
                ? "cursor-grab touch-pan-x active:cursor-grabbing"
                : ""
            } ${shouldDockAtBottom ? "md:max-w-[calc(100vw-2rem)]" : "md:max-w-none"} ${
              isDesktopTopRail ? "md:gap-1.5" : "md:gap-2"
            }`}
          >
            {buttons.map((button) => {
              const isHovered = shouldShowLabels && hovered === button.name;
              const shouldExpandDesktopButton = isDesktopTopRail && isHovered;

              return (
                <motion.div
                  key={button.name}
                  layout
                  onHoverStart={() => setHovered(button.name)}
                  onHoverEnd={() => setHovered(null)}
                  transition={spring}
                >
                  {button.action === "link" && button.link ? (
                    <Link
                      href={button.link}
                      title={button.name}
                      aria-label={button.name}
                      {...getRemoteControlProps(button)}
                    >
                      <motion.div
                        layout
                        transition={spring}
                        className={`inline-flex shrink-0 items-center justify-center overflow-hidden border font-medium transition ${
                          isDesktopTopRail
                            ? `h-8 min-w-8 rounded-[0.9rem] ${
                                button.isHighlight
                                  ? "border-white bg-white text-black shadow-[0_8px_18px_rgba(255,255,255,0.12)]"
                                  : "border-white/14 bg-white/[0.04] hover:border-white/28 hover:bg-white/[0.08]"
                              } ${shouldExpandDesktopButton ? "w-auto px-3" : "w-8 px-0"}`
                            : `rounded-[1rem] text-[9px] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] xl:text-[10px] 2xl:rounded-[1.05rem] 2xl:text-xs ${
                                button.isHighlight
                                  ? "border-white/50 bg-white/90 text-zinc-900 shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
                                  : "border-white/12 bg-white/[0.08] text-white/92 hover:border-white/24 hover:bg-white/[0.14]"
                              }`
                        }`}
                        animate={{
                          paddingLeft: isDesktopTopRail
                            ? shouldExpandDesktopButton
                              ? 12
                              : 0
                            : isHovered
                              ? 14
                              : mergeRouteLinks
                                ? 8
                                : 9,
                          paddingRight: isDesktopTopRail
                            ? shouldExpandDesktopButton
                              ? 12
                              : 0
                            : isHovered
                              ? 14
                              : mergeRouteLinks
                                ? 8
                                : 9,
                        }}
                      >
                        <motion.span
                          className={`flex items-center justify-center ${
                            isDesktopTopRail
                              ? `${button.isHighlight ? "text-black" : "text-white"} h-3.5 w-3.5`
                              : "h-6 w-4 sm:h-7 sm:w-[1.05rem] xl:h-8 xl:w-5 2xl:h-10 2xl:w-6"
                          }`}
                          animate={{ scale: isHovered ? 1.08 : 1 }}
                          transition={spring}
                        >
                          {button.icon}
                        </motion.span>

                        <AnimatePresence initial={false}>
                          {shouldShowLabels && isHovered && (
                            <motion.span
                              initial={{ width: 0, opacity: 0, x: -8 }}
                              animate={{ width: "auto", opacity: 1, x: 0 }}
                              exit={{ width: 0, opacity: 0, x: -8 }}
                              transition={{ duration: 0.22, ease: "easeOut" }}
                              className="overflow-hidden text-white text-xs whitespace-nowrap pl-2"
                            >
                              {button.name}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </Link>
                  ) : (
                    <motion.button
                      type="button"
                      title={button.name}
                      aria-label={button.name}
                      {...getRemoteControlProps(button)}
                      layout
                      transition={spring}
                      onClick={onQuoteClick}
                      className={`inline-flex shrink-0 items-center justify-center overflow-hidden border font-medium transition ${
                        isDesktopTopRail
                          ? `h-8 min-w-8 rounded-[0.9rem] ${
                              button.isHighlight
                                ? "border-white bg-white text-black shadow-[0_8px_18px_rgba(255,255,255,0.12)]"
                                : "border-white/14 bg-white/[0.04] hover:border-white/28 hover:bg-white/[0.08]"
                            } ${shouldExpandDesktopButton ? "w-auto px-3" : "w-8 px-0"}`
                          : `rounded-[1rem] text-[9px] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] xl:text-[10px] 2xl:rounded-[1.05rem] 2xl:text-xs ${
                              button.isHighlight
                                ? "border-white/50 bg-white/90 text-zinc-900 shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
                                : "border-white/12 bg-white/[0.08] text-white/92 hover:border-white/24 hover:bg-white/[0.14]"
                            }`
                      }`}
                      animate={{
                        paddingLeft: isDesktopTopRail
                          ? shouldExpandDesktopButton
                            ? 12
                            : 0
                          : isHovered
                            ? 14
                            : mergeRouteLinks
                              ? 8
                              : 9,
                        paddingRight: isDesktopTopRail
                          ? shouldExpandDesktopButton
                            ? 12
                            : 0
                          : isHovered
                            ? 14
                            : mergeRouteLinks
                              ? 8
                              : 9,
                      }}
                    >
                      <motion.span
                        className={`flex items-center justify-center ${
                          isDesktopTopRail
                            ? `${button.isHighlight ? "text-black" : "text-white"} h-3.5 w-3.5`
                            : "h-6 w-4 sm:h-7 sm:w-[1.05rem] xl:h-8 xl:w-5 2xl:h-10 2xl:w-6"
                        }`}
                        animate={{ scale: isHovered ? 1.08 : 1 }}
                        transition={spring}
                      >
                        {button.icon}
                      </motion.span>

                      <AnimatePresence initial={false}>
                        {shouldShowLabels && isHovered && (
                          <motion.span
                            initial={{ width: 0, opacity: 0, x: -8 }}
                            animate={{ width: "auto", opacity: 1, x: 0 }}
                            exit={{ width: 0, opacity: 0, x: -8 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="overflow-hidden text-white text-xs whitespace-nowrap pl-2"
                          >
                            {button.name}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      </motion.div>
      </div>
    </>
  );
}
