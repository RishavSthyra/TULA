"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  Building2,
  FileDown,
  Heart,
  Home,
  MapPin,
  Menu,
  Phone,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { TRIFECTA_LEAD_OPEN_EVENT } from "@/lib/trifecta-remote-control";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/project-overview", label: "Overview", icon: Building2 },
  { href: "/area-map", label: "Location", icon: MapPin },
  { href: "/amenities", label: "Amenities", icon: Heart },
  { href: "/master-plan", label: "Master Plan", icon: UserRound },
] as const;

function isActiveRoute(pathname: string, href: string) {
  return pathname === href;
}

export default function MobileSiteNav() {
  const pathname = usePathname();
  const [isRendered, setIsRendered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const flowerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const navItemRefs = useRef<(HTMLElement | null)[]>([]);
  const actionRefs = useRef<(HTMLElement | null)[]>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (!isRendered || !isOpen) return;

    const overlay = overlayRef.current;
    const panel = panelRef.current;
    const flower = flowerRef.current;
    const header = headerRef.current;
    const closeButton = closeButtonRef.current;
    const navItemsToAnimate = navItemRefs.current.filter(
      (item): item is HTMLElement => item !== null,
    );
    const actions = actionRefs.current.filter(
      (item): item is HTMLElement => item !== null,
    );

    if (!overlay || !panel) return;

    timelineRef.current?.kill();
    gsap.set(overlay, { autoAlpha: 0 });
    gsap.set(panel, {
      yPercent: 105,
      scale: 0.985,
      transformOrigin: "bottom center",
    });
    gsap.set([header, closeButton, flower], { autoAlpha: 0, y: 16 });
    gsap.set(navItemsToAnimate, { autoAlpha: 0, y: 24, scale: 0.985 });
    gsap.set(actions, { autoAlpha: 0, y: 18, scale: 0.96 });

    const timeline = gsap.timeline();
    timeline
      .to(overlay, {
        autoAlpha: 1,
        duration: 0.26,
        ease: "power2.out",
      })
      .to(
        panel,
        {
          yPercent: 0,
          scale: 1,
          duration: 0.86,
          ease: "expo.out",
        },
        0,
      )
      .to(
        [header, closeButton],
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.48,
          ease: "power3.out",
          stagger: 0.05,
        },
        0.22,
      )
      .to(
        flower,
        {
          autoAlpha: 1,
          y: 0,
          rotate: 0,
          duration: 0.72,
          ease: "power3.out",
        },
        0.18,
      )
      .to(
        navItemsToAnimate,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.46,
          ease: "power3.out",
          stagger: 0.055,
        },
        0.34,
      )
      .to(
        actions,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.42,
          ease: "power3.out",
          stagger: 0.045,
        },
        0.56,
      );

    timelineRef.current = timeline;

    return () => {
      timeline.kill();
    };
  }, [isOpen, isRendered]);

  useEffect(() => {
    if (!isRendered) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isRendered]);

  const openMenu = () => {
    setIsRendered(true);
    setIsOpen(true);
  };

  const closeMenu = () => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    const navItemsToAnimate = navItemRefs.current.filter(
      (item): item is HTMLElement => item !== null,
    );
    const actions = actionRefs.current.filter(
      (item): item is HTMLElement => item !== null,
    );

    if (!overlay || !panel) {
      setIsOpen(false);
      setIsRendered(false);
      return;
    }

    timelineRef.current?.kill();

    const timeline = gsap.timeline({
      onComplete: () => {
        setIsOpen(false);
        setIsRendered(false);
      },
    });

    timeline
      .to(actions, {
        autoAlpha: 0,
        y: -10,
        scale: 0.96,
        duration: 0.16,
        ease: "power2.in",
        stagger: { each: 0.025, from: "end" },
      })
      .to(
        navItemsToAnimate,
        {
          autoAlpha: 0,
          y: -18,
          scale: 0.985,
          duration: 0.22,
          ease: "power2.in",
          stagger: { each: 0.025, from: "end" },
        },
        0.02,
      )
      .to(
        panel,
        {
          yPercent: 105,
          scale: 0.985,
          duration: 0.52,
          ease: "expo.in",
        },
        0.12,
      )
      .to(
        overlay,
        {
          autoAlpha: 0,
          duration: 0.22,
          ease: "power2.in",
        },
        0.22,
      );

    timelineRef.current = timeline;
  };

  const openQuote = () => {
    window.dispatchEvent(new Event(TRIFECTA_LEAD_OPEN_EVENT));
    closeMenu();
  };

  return (
    <div className="xl:hidden">
      {isRendered ? (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[70] bg-[#0f180f]/46 backdrop-blur-[7px]"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeMenu();
            }
          }}
        >
          <nav
            ref={panelRef}
            aria-label="Mobile site navigation"
            className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[2.15rem] border-x-0 border-b-0 border-t border-[#dfcfac]/85 bg-[linear-gradient(180deg,rgba(255,252,245,0.99)_0%,rgba(244,238,226,0.975)_100%)] px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-5 text-[#263b2b] shadow-[0_-28px_76px_rgba(28,44,30,0.24),inset_0_1px_0_rgba(255,255,255,0.97)] sm:inset-x-0 sm:bottom-0 sm:rounded-t-[2.5rem] sm:px-7 sm:pb-[calc(env(safe-area-inset-bottom)+1.4rem)] sm:pt-7"
          >
            <div
              ref={flowerRef}
              className="pointer-events-none absolute -right-5 -top-6 h-44 w-44 sm:-right-4 sm:-top-8 sm:h-60 sm:w-60"
            >
              <Image
                src="/flowerUI.png"
                alt=""
                fill
                sizes="240px"
                className="object-contain object-right-top opacity-[0.24] mix-blend-multiply"
              />
            </div>

            <div ref={headerRef} className="relative z-10 mb-7">
              <p className="text-[0.66rem] font-bold uppercase tracking-[0.32em] text-[#53684a]">
                TULA
              </p>
              <h2 className="mt-2 text-[2rem] font-semibold leading-none text-[#28442f]">
                Navigation
              </h2>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeMenu}
              className="absolute right-5 top-5 z-20 flex size-12 items-center justify-center rounded-full border border-[#dfcfac]/90 bg-[#fffdf8]/88 text-[#40543f] shadow-[0_12px_28px_rgba(43,52,37,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] sm:right-7 sm:top-7 sm:size-14"
              aria-label="Close navigation menu"
            >
              <X className="size-5" />
            </button>

            <div className="relative z-10 overflow-hidden rounded-[1.65rem] border border-[#e3d5ba]/90 bg-[#fffdf8]/52">
              {navItems.map(({ href, label, icon: Icon }, index) => {
                const isActive = isActiveRoute(pathname, href);
                const isLastItem = index === navItems.length - 1;

                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={closeMenu}
                    ref={(node) => {
                      navItemRefs.current[index] = node;
                    }}
                    className={`group relative flex h-[4.35rem] items-center justify-between px-4 text-base font-semibold transition active:scale-[0.99] sm:h-[4.75rem] sm:px-5 ${
                      isActive
                        ? "bg-[linear-gradient(90deg,rgba(91,118,79,0.2)_0%,rgba(91,118,79,0.08)_40%,rgba(255,253,248,0)_100%)] text-[#29412f]"
                        : "text-[#304238]"
                    } ${!isLastItem ? "border-b border-[#e8dcc6]" : ""}`}
                  >
                    <span
                      className={`absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full transition ${
                        isActive ? "bg-[#5b764f]" : "bg-transparent"
                      }`}
                    />
                    <span className="inline-flex min-w-0 items-center gap-4">
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                          isActive
                            ? "bg-[#5b764f] text-[#fff8e8] shadow-[0_10px_20px_rgba(43,72,43,0.16)]"
                            : "border border-[#dfcfac]/80 bg-[#f7f1e5] text-[#40543f]"
                        }`}
                      >
                        <Icon className="size-4.5" />
                      </span>
                      <span className="truncate">{label}</span>
                    </span>
                    <Send
                      className={`size-4.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                        isActive ? "text-[#5b764f]" : "text-[#40543f]"
                      }`}
                    />
                  </Link>
                );
              })}
            </div>

            <div className="relative z-10 mt-6 grid grid-cols-3 gap-3">
              <a
                ref={(node) => {
                  actionRefs.current[0] = node;
                }}
                href="tel:+918088004411"
                className="flex h-14 items-center justify-center rounded-full border border-[#e1d5bf] bg-[#fffdf8]/82 text-[#40543f] shadow-[0_10px_22px_rgba(43,52,37,0.055)]"
                aria-label="Call"
              >
                <Phone className="size-4.5" />
              </a>
              <a
                ref={(node) => {
                  actionRefs.current[1] = node;
                }}
                href="/Veranza Floorplan_ E-Brochure_V3_02-03-26 (2).pdf"
                className="flex h-14 items-center justify-center rounded-full border border-[#e1d5bf] bg-[#fffdf8]/82 text-[#40543f] shadow-[0_10px_22px_rgba(43,52,37,0.055)]"
                aria-label="Download brochure"
              >
                <FileDown className="size-4.5" />
              </a>
              <button
                ref={(node) => {
                  actionRefs.current[2] = node;
                }}
                type="button"
                onClick={openQuote}
                className="flex h-14 items-center justify-center rounded-full border border-[#6c8659] bg-[radial-gradient(circle_at_32%_25%,#69895e_0%,#45603c_58%,#2a452d_100%)] text-white shadow-[0_14px_30px_rgba(43,72,43,0.2)]"
                aria-label="Get a quote"
              >
                <Send className="size-4.5" />
              </button>
            </div>
          </nav>
        </div>
      ) : null}

      {!isRendered ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),1rem)] z-[70] flex justify-start px-4 sm:px-6">
          <button
            type="button"
            onClick={openMenu}
            className="pointer-events-auto flex size-13 items-center justify-center rounded-full border border-[#dfcfac]/80 bg-[linear-gradient(180deg,rgba(255,252,245,0.96),rgba(241,237,226,0.94))] text-[#304238] shadow-[0_18px_42px_rgba(30,46,30,0.18),inset_0_1px_0_rgba(255,255,255,0.95)]"
            aria-label="Open navigation menu"
            aria-expanded={false}
          >
            <Menu className="size-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
