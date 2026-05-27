"use client";

import { useState } from "react";
import Link from "next/link";
import {
  HiBars3,
  HiBuildingOffice2,
  HiHome,
  HiMapPin,
  HiPhone,
  HiSparkles,
} from "react-icons/hi2";

type RadialMenuIcon = "home" | "projects" | "spark" | "phone" | "map";

type RadialMenuItem = {
  href?: string;
  icon: RadialMenuIcon;
  label: string;
};

type RadialGlassMenuProps = {
  items?: RadialMenuItem[];
  position?: "bottom" | "top" | "left" | "right";
  size?: number;
};

const defaultItems: RadialMenuItem[] = [
  { href: "/", icon: "home", label: "Home" },
  { href: "/project-overview", icon: "projects", label: "Projects" },
  { href: "/amenities", icon: "spark", label: "Amenities" },
  { href: "tel:+918088004411", icon: "phone", label: "Call" },
  { href: "/area-map", icon: "map", label: "Location" },
];

function MenuIcon({ icon }: { icon: RadialMenuIcon }) {
  if (icon === "projects") {
    return <HiBuildingOffice2 className="h-[42%] w-[42%]" aria-hidden />;
  }

  if (icon === "spark") {
    return <HiSparkles className="h-[42%] w-[42%]" aria-hidden />;
  }

  if (icon === "phone") {
    return <HiPhone className="h-[42%] w-[42%]" aria-hidden />;
  }

  if (icon === "map") {
    return <HiMapPin className="h-[42%] w-[42%]" aria-hidden />;
  }

  return <HiHome className="h-[42%] w-[42%]" aria-hidden />;
}

export default function RadialGlassMenu({
  items = defaultItems,
  position = "bottom",
  size = 320,
}: RadialGlassMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const visibleItems = items.slice(0, 5);
  const centerSize = size * 0.155;
  const bubbleSize = size * 0.115;
  const radius = size * 0.27;
  const isHorizontal = position === "top" || position === "bottom";
  const stageWidth = isHorizontal ? size : size * 0.7;
  const stageHeight = isHorizontal ? size * 0.5 : size;
  const centerX =
    position === "left"
      ? 0
      : position === "right"
        ? stageWidth
        : stageWidth / 2;
  const centerY =
    position === "top" ? 0 : position === "bottom" ? stageHeight : stageHeight / 2;
  const angleRanges = {
    bottom: [-162, -18],
    top: [18, 162],
    left: [-72, 72],
    right: [124, 236],
  } satisfies Record<NonNullable<RadialGlassMenuProps["position"]>, [number, number]>;
  const [startAngle, endAngle] = angleRanges[position];
  const angleStep =
    visibleItems.length > 1 ? (endAngle - startAngle) / (visibleItems.length - 1) : 0;
  const viewportPositionClass = {
    bottom: "fixed bottom-0 left-1/2 -translate-x-1/2",
    top: "fixed left-1/2 top-0 -translate-x-1/2",
    left: "fixed left-0 top-1/2 -translate-y-1/2",
    right: "fixed right-0 top-1/2 -translate-y-1/2",
  }[position];
  const iconOffset = {
    bottom: "0px, -42%",
    top: "0px, 28%",
    left: "28%, 0px",
    right: "-52%, 0px",
  }[position];

  return (
    <div
      className={`radial-menu ${isOpen ? "is-open" : ""} ${viewportPositionClass} z-50 isolate overflow-visible`}
      style={
        {
          width: `${stageWidth}px`,
          height: `${stageHeight}px`,
          "--cx": `${centerX}px`,
          "--cy": `${centerY}px`,
          "--center-size": `${centerSize}px`,
          "--bubble-size": `${bubbleSize}px`,
          "--center-icon-offset": iconOffset,
        } as React.CSSProperties
      }
    >
      <style>
        {`
          @property --radial-liquid-angle-1 {
            syntax: "<angle>";
            inherits: false;
            initial-value: -75deg;
          }

          @property --radial-liquid-angle-2 {
            syntax: "<angle>";
            inherits: false;
            initial-value: -45deg;
          }

          .radial-center,
          .radial-item {
            --border-width: 1px;
            color: rgba(239, 255, 225, .96);
            isolation: isolate;
            background:
              linear-gradient(
                -75deg,
                rgba(18, 56, 22, 0.26),
                rgba(112, 174, 84, 0.3),
                rgba(7, 32, 15, 0.34)
              );
            box-shadow:
              inset 0 0.125em 0.125em rgba(0, 0, 0, 0.16),
              inset 0 -0.125em 0.125em rgba(235, 255, 216, 0.28),
              0 0.25em 0.125em -0.125em rgba(0, 0, 0, 0.34),
              0 0 0.1em 0.16em inset rgba(185, 240, 150, 0.16),
              0 14px 34px rgba(0, 0, 0, 0.28);
            outline: 0;
            border: 0;
            overflow: hidden;
            -webkit-backdrop-filter: blur(4px) saturate(1.35);
            backdrop-filter: blur(4px) saturate(1.35);
          }

          .radial-center::before,
          .radial-item::before {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 0;
            border-radius: inherit;
            background:
              linear-gradient(
                var(--radial-liquid-angle-2),
                rgba(255, 255, 255, 0) 0%,
                rgba(236, 255, 212, 0.34) 40% 50%,
                rgba(255, 255, 255, 0) 55%
              );
            background-size: 200% 200%;
            background-position: 0% 50%;
            mix-blend-mode: screen;
            opacity: .72;
            pointer-events: none;
            transition:
              background-position 500ms cubic-bezier(0.25, 1, 0.5, 1),
              --radial-liquid-angle-2 500ms cubic-bezier(0.25, 1, 0.5, 1);
          }

          .radial-center::after,
          .radial-item::after {
            content: "";
            position: absolute;
            z-index: 1;
            inset: calc(var(--border-width) / -2);
            width: calc(100% + var(--border-width));
            height: calc(100% + var(--border-width));
            border-radius: 999px;
            padding: var(--border-width);
            box-sizing: border-box;
            background:
              conic-gradient(
                from var(--radial-liquid-angle-1) at 50% 50%,
                rgba(4, 40, 10, 0.78),
                rgba(12, 67, 17, 0) 5% 40%,
                rgba(214, 255, 178, 0.48) 50%,
                rgba(12, 67, 17, 0) 60% 95%,
                rgba(4, 40, 10, 0.78)
              ),
              linear-gradient(180deg, rgba(222, 255, 194, 0.32), rgba(36, 98, 32, 0.34));
            mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            mask-composite: exclude;
            pointer-events: none;
            transition:
              all 400ms cubic-bezier(0.25, 1, 0.5, 1),
              --radial-liquid-angle-1 500ms ease;
          }

          .radial-item {
            left: var(--cx);
            top: var(--cy);
            transform:
              translate(-50%, -50%)
              translate(calc(var(--x) * .18), calc(var(--y) * .18))
              scale(.36);
            opacity: 0;
            transition:
              transform 780ms cubic-bezier(.18, 1.18, .24, 1),
              opacity 420ms ease;
            transition-delay: 0ms;
            pointer-events: none;
          }

          .radial-menu.is-open .radial-item {
            transform:
              translate(-50%, -50%)
              translate(var(--x), var(--y))
              scale(1);
            opacity: 1;
            transition-delay: var(--delay);
            pointer-events: auto;
          }

          .radial-item:hover {
            --radial-liquid-angle-1: -125deg;
            color: rgba(248, 255, 232, 1);
            transform:
              translate(-50%, -50%)
              translate(var(--x), var(--y))
              scale(.975);
            -webkit-backdrop-filter: blur(.5px) saturate(1.45);
            backdrop-filter: blur(.5px) saturate(1.45);
            box-shadow:
              inset 0 0.125em 0.125em rgba(0, 0, 0, 0.08),
              inset 0 -0.125em 0.125em rgba(235, 255, 216, 0.46),
              0 0.15em 0.05em -0.1em rgba(0, 0, 0, 0.3),
              0 0 0.05em 0.12em inset rgba(225, 255, 199, 0.32),
              0 12px 30px rgba(0, 0, 0, 0.2);
          }

          .radial-item:hover::before,
          .radial-center:hover::before {
            background-position: 25% 50%;
          }

          .radial-center {
            left: var(--cx);
            top: var(--cy);
            appearance: none;
            transform: translate(-50%, -50%);
            transition: transform 700ms cubic-bezier(.18, 1.05, .24, 1);
          }

          .radial-menu.is-open .radial-center {
            transform: translate(-50%, -50%) scale(1.04);
          }

          .radial-center:hover {
            --radial-liquid-angle-1: -125deg;
            transform: translate(-50%, -50%) scale(.99);
            -webkit-backdrop-filter: blur(.5px) saturate(1.45);
            backdrop-filter: blur(.5px) saturate(1.45);
          }

          .radial-center-icon {
            transform: translate(var(--center-icon-offset));
          }

          .radial-icon {
            position: relative;
            z-index: 2;
            filter: drop-shadow(0 .18em .08em rgba(0, 0, 0, .14));
          }

          .radial-label {
            transform: translate(-50%, 6px);
            transition: opacity 240ms ease, transform 240ms ease;
          }

          .radial-item:hover .radial-label {
            opacity: 1;
            transform: translate(-50%, 0);
          }

          @media (prefers-reduced-motion: reduce) {
            .radial-item,
            .radial-center,
            .radial-label {
              transition-duration: 1ms;
            }
          }
        `}
      </style>

      {visibleItems.map((item, index) => {
        const angle = startAngle + angleStep * index;
        const x = Math.cos((angle * Math.PI) / 180) * radius;
        const y = Math.sin((angle * Math.PI) / 180) * radius;

        return (
          <Link
            aria-label={item.label}
            className="radial-item absolute z-20 flex items-center justify-center rounded-full"
            href={item.href ?? "#"}
            key={item.label}
            style={
              {
                width: "var(--bubble-size)",
                height: "var(--bubble-size)",
                "--x": `${x}px`,
                "--y": `${y}px`,
                "--delay": `${index * 70}ms`,
              } as React.CSSProperties
            }
          >
            <span className="radial-icon flex h-full w-full items-center justify-center">
              <MenuIcon icon={item.icon} />
            </span>
            <span className="radial-label pointer-events-none absolute -left-[150%] top-0 mt-2 whitespace-nowrap rounded-full border border-white/10 bg-[#071008]/82 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-white/78 opacity-0 shadow-[0_10px_26px_rgba(0,0,0,.32)] backdrop-blur-md">
              {item.label}
            </span>
          </Link>
        );
      })}

      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        className="radial-center absolute z-30 flex items-center justify-center rounded-full p-0"
        onClick={() => setIsOpen((open) => !open)}
        style={{
          width: "var(--center-size)",
          height: "var(--center-size)",
        }}
        type="button"
      >
        <HiBars3
          className="radial-center-icon radial-icon h-[30%] w-[30%]"
          aria-hidden
        />
      </button>
    </div>
  );
}
