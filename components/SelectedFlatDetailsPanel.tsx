"use client";

import { forwardRef, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowUpRight,
  BedDouble,
  Building2,
  Compass,
  Expand,
  Ruler,
  X,
} from "lucide-react";
import { Cormorant_Garamond } from "next/font/google";
import type { InventoryApartment } from "@/types/inventory";
import { formatBlockLabel } from "@/lib/inventory-display";
import SignedImage from "@/src/components/common/SignedImage";

type SelectedFlatDetailsPanelProps = {
  apartment: InventoryApartment;
  compact?: boolean;
  desktopEnhancedCompact?: boolean;
  hideCloseButton?: boolean;
  onClose: () => void;
};

const selectedFlatSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

function parseRoomDimensions(roomDimensions: string) {
  return roomDimensions
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const [label, ...valueParts] = part.split(":");
      const value = valueParts.join(":").trim();

      if (!value) {
        return {
          key: `${part}-${index}`,
          label: `Space ${index + 1}`,
          value: label.trim(),
        };
      }

      return {
        key: `${label}-${index}`,
        label: label.trim(),
        value,
      };
    });
}

function getStatusStyles(status: InventoryApartment["status"]) {
  if (status === "Available") {
    return {
      badgeClassName:
        "border-[#d7e2d4] bg-[#edf2ea] text-[#4b684c]",
      textClassName: "text-[#4b684c]",
      dotClassName: "bg-[#698565]",
    };
  }

  if (status === "Reserved") {
    return {
      badgeClassName:
        "border-[#e8dcc6] bg-[#f4eee1] text-[#8b6c39]",
      textClassName: "text-[#8b6c39]",
      dotClassName: "bg-[#a88b54]",
    };
  }

  return {
    badgeClassName:
      "border-[#dfddd6] bg-[#efeee9] text-[#77776e]",
    textClassName: "text-[#77776e]",
    dotClassName: "bg-[#92938a]",
  };
}

const metaCardClassName =
  "min-w-0 rounded-[22px] border border-[#d9c99c]/70 bg-[#f8f4e8]/82 px-4 py-4 text-[#1f3f2b] shadow-[0_14px_32px_rgba(39,47,34,0.10),inset_0_1px_0_rgba(255,255,255,0.94)] backdrop-blur-md";

const premiumPanelShellClassName =
  "relative isolate overflow-hidden border border-[#d8bd78]/42 bg-[linear-gradient(145deg,rgba(250,248,238,0.56)_0%,rgba(240,237,224,0.50)_48%,rgba(249,246,234,0.60)_100%)] text-[#1f3f2b] shadow-[0_14px_38px_rgba(20,36,25,0.10),inset_0_1px_0_rgba(255,255,255,0.62),inset_0_0_0_1px_rgba(255,255,255,0.13)] backdrop-blur-sm";

const ornamentLineClassName =
  "pointer-events-none absolute border-[#cfad63]/45 opacity-70";

const SelectedFlatDetailsPanel = forwardRef<
  HTMLDivElement,
  SelectedFlatDetailsPanelProps
>(function SelectedFlatDetailsPanel(
  {
    apartment,
    compact = false,
    desktopEnhancedCompact = false,
    hideCloseButton = false,
    onClose,
  },
  ref,
) {
  const dimensionItems = useMemo(
    () => parseRoomDimensions(apartment.roomDimensions),
    [apartment.roomDimensions],
  );
  const statusStyles = getStatusStyles(apartment.status);
  const formattedAreaSqft = `${Math.round(apartment.areaSqft).toLocaleString("en-IN")} sq ft`;
  const compactFacts = [
    { label: "Block", value: formatBlockLabel(apartment.tower) },
    { label: "Floor", value: apartment.floorLabel || apartment.floor },
    { label: "Facing", value: apartment.facing },
    { label: "Saleable area", value: formattedAreaSqft },
  ];

  if (compact) {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, x: 12, y: 6 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: 12, y: 6 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-auto w-full self-start"
        data-scroll-area="flat-details-panel"
        data-flat-details-panel
        onTouchMoveCapture={(event) => event.stopPropagation()}
        onWheelCapture={(event) => event.stopPropagation()}
      >
        <div
          className={`rounded-[28px] ${premiumPanelShellClassName} ${
            desktopEnhancedCompact
              ? "custom-scrollbar max-h-[68dvh] overflow-y-auto overscroll-contain touch-pan-y 2xl:max-h-[72dvh]"
              : "overflow-hidden"
          }`}
        >
          <div className="pointer-events-none absolute inset-2 rounded-[21px] border border-[#ead8a4]/55" />
          <div className="relative p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#58715f]">Selected flat</p>
                <h2 className={`${selectedFlatSerif.className} mt-2 break-words text-[2.75rem] font-medium leading-none tracking-[-0.025em] text-[#21462d]`}>
                  {apartment.title}
                </h2>
              </div>
              {!hideCloseButton ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="-mr-1 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d8bd78]/50 bg-[#f8f4e8]/70 text-[#58715f] transition hover:bg-[#fbfaf4] hover:text-[#21462d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#58715f]"
                  aria-label="Close flat details"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p className="rounded-full border border-[#d8bd78]/45 bg-[#fbfaf4]/80 px-3 py-1.5 text-xs font-semibold text-[#1f3f2b]">{apartment.bhk} BHK</p>
              <span className={
                "inline-flex items-center gap-1.5 rounded-full border border-[#d8bd78]/35 bg-[#fbfaf4]/65 px-3 py-1.5 text-xs font-medium " + statusStyles.textClassName
              }>
                <span className={"h-1.5 w-1.5 rounded-full " + statusStyles.dotClassName} aria-hidden="true" />
                {apartment.status}
              </span>
            </div>

            <dl className="mt-5 divide-y divide-[#d8bd78]/30 border-y border-[#d8bd78]/40">
              {compactFacts.map((item) => (
                <div key={item.label} className="flex items-baseline justify-between gap-4 py-3">
                  <dt className="shrink-0 text-xs font-semibold text-[#fff6df] [text-shadow:0_1px_3px_rgba(20,40,26,0.55)]">{item.label}</dt>
                  <dd className="min-w-0 break-words text-right text-sm font-semibold tabular-nums text-[#1f3f2b]">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>

            <Link
              href="/interior-kitchen-foyer"
              className="mt-5 flex min-h-12 items-center justify-between gap-3 rounded-full border border-[#d7bf80]/40 bg-[#23412a]/90 px-5 py-3 text-sm font-medium text-[#fff6df] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm transition hover:bg-[#2c5134] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4a667]"
            >
              View interior
              <ArrowUpRight className="h-4 w-4 shrink-0 text-[#d9c28a]" strokeWidth={1.7} aria-hidden="true" />
            </Link>
            <p className="mt-2.5 text-[11px] font-medium leading-4 text-[#fff6df] [text-shadow:0_1px_3px_rgba(20,40,26,0.55)]">Representative interior</p>

            {!desktopEnhancedCompact && dimensionItems.length > 0 ? (
              <section className="mt-6 rounded-[22px] border border-[#d7bf80]/40 bg-[#23412a]/90 p-4 text-[#f7efd9]" aria-label="Room dimensions">
                <h3 className={`${selectedFlatSerif.className} text-xl font-semibold text-[#fff6df]`}>Room dimensions</h3>
                <dl className="mt-2 divide-y divide-[#d9c28a]/20">
                  {dimensionItems.map((item) => (
                    <div key={item.key} className="flex items-baseline justify-between gap-4 py-2.5">
                      <dt className="min-w-0 text-xs text-[#f7efd9]/75">{item.label}</dt>
                      <dd className="shrink-0 text-right text-xs font-medium tabular-nums">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.99 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto mx-auto w-full max-w-[min(97vw,1480px)]"
      data-scroll-area="flat-details-panel"
      data-flat-details-panel
      onTouchMoveCapture={(event) => {
        event.stopPropagation();
      }}
      onWheelCapture={(event) => {
        event.stopPropagation();
      }}
    >
      <div
        className={`custom-scrollbar max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[34px] rounded-tr-[72px] rounded-bl-[24px] ${premiumPanelShellClassName} sm:max-h-[calc(100dvh-2rem)] xl:max-h-[min(78dvh,860px)] xl:overflow-hidden`}
      >
        <div className="pointer-events-none absolute inset-[10px] rounded-[26px] rounded-tr-[58px] rounded-bl-[18px] border border-[#ead8a4]/55" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_5%,rgba(255,255,255,0.88),transparent_30%),radial-gradient(circle_at_91%_12%,rgba(236,218,169,0.28),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.24),rgba(232,236,222,0.18))]" />
        <div
          className={`${ornamentLineClassName} -right-5 top-12 h-40 w-28 rounded-[50%] border-l`}
        />
        <div
          className={`${ornamentLineClassName} -bottom-12 -left-8 h-56 w-36 rounded-[50%] border-r`}
        />

        <div className="relative z-10 p-5 sm:p-6 xl:flex xl:h-full xl:flex-col xl:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-[#d8bd78]/45 pb-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-full border border-[#d8bd78]/55 bg-[#f8f4e8]/74 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.32em] text-[#697560]">
                  Signature Residence
                </span>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] ${statusStyles.badgeClassName}`}
                >
                  <span
                    className={`inline-flex h-2 w-2 rounded-full ${statusStyles.dotClassName}`}
                  />
                  {apartment.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-[#697560]">
                    Selected Flat
                  </p>
                  <h3
                    className={`${selectedFlatSerif.className} mt-1.5 text-[2.6rem] font-medium leading-none text-[#21462d] sm:text-[3.2rem] xl:text-[3.75rem]`}
                  >
                    {apartment.title}
                  </h3>
                </div>

                <div className="pb-1 text-sm text-[#687468] sm:text-base">
                  Floor{" "}
                  <span className="font-semibold text-[#21462d]">
                    {apartment.floorLabel || apartment.floor}
                  </span>
                </div>
              </div>
            </div>

            {!hideCloseButton ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d8bd78]/65 bg-[#f8f4e8]/82 text-[#58715f] shadow-[0_12px_28px_rgba(33,50,35,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] transition hover:bg-white"
                aria-label="Close flat details"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid items-start gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
            <div className="flex min-w-0 flex-col">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className={metaCardClassName}>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#9a8054]">
                    Block
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#1f3f2b]">
                    <Building2 className="h-4 w-4 text-[#a88a45]" />
                    {formatBlockLabel(apartment.tower)}
                  </div>
                </div>

                <div className={metaCardClassName}>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#9a8054]">
                    Config
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#1f3f2b]">
                    <BedDouble className="h-4 w-4 text-[#a88a45]" />
                    {apartment.bhk} BHK
                  </div>
                </div>

                <div className={metaCardClassName}>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#9a8054]">
                    Facing
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#1f3f2b]">
                    <Compass className="h-4 w-4 text-[#a88a45]" />
                    {apartment.facing}
                  </div>
                </div>

                <div className={metaCardClassName}>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#9a8054]">
                    Saleable Area
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#1f3f2b]">
                    <Expand className="h-4 w-4 text-[#a88a45]" />
                    {formattedAreaSqft}
                  </div>
                </div>

                <div className={metaCardClassName}>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#9a8054]">
                    Inventory
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#1f3f2b]">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#5f8d57]" />
                    {apartment.status}
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-[28px] border border-[#d8bd78]/55 bg-[linear-gradient(180deg,rgba(35,65,42,0.96),rgba(28,54,36,0.98))] text-[#f5ecd7] shadow-[0_18px_38px_rgba(25,55,34,0.22),inset_0_1px_0_rgba(255,255,255,0.14)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9c28a]/18 px-5 py-3.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-[#d9c28a]">
                      Spatial Composition
                    </p>
                    <h4
                      className={`${selectedFlatSerif.className} mt-1.5 text-2xl font-semibold leading-none text-[#fff6df]`}
                    >
                      Room dimensions
                    </h4>
                  </div>

                  <div className="rounded-full border border-[#d9c28a]/35 bg-white/8 px-3 py-1.5 text-[11px] font-medium text-[#f5ecd7]">
                    Detailed layout
                  </div>
                </div>

                {dimensionItems.length > 0 ? (
                  <div className="px-5 py-3 sm:py-4">
                    <div className="grid gap-x-6 divide-y divide-[#d9c28a]/18 sm:grid-cols-2 sm:divide-y-0">
                      {dimensionItems.map((item, index) => (
                        <div
                          key={item.key}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3 sm:border-b sm:border-[#d9c28a]/18"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d9c28a]/30 bg-white/8">
                              <Ruler className="h-4 w-4 text-[#d9c28a]" />
                            </div>

                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-[0.24em] text-[#d9c28a]/70">
                                {String(index + 1).padStart(2, "0")}
                              </p>
                              <p className="truncate text-sm font-medium text-[#fff6df]">
                                {item.label}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-semibold tracking-[0.01em] text-[#f5ecd7]">
                              {item.value}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-6 text-sm text-[#f5ecd7]/72">
                    Room dimensions are not available for this apartment yet.
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 xl:border-l xl:border-[#d8bd78]/45 xl:pl-5">
              <div className="overflow-hidden rounded-[28px] border border-[#d8bd78]/55 bg-[#f8f4e8]/68 shadow-[0_14px_32px_rgba(39,47,34,0.10),inset_0_1px_0_rgba(255,255,255,0.94)] backdrop-blur-md">
                <div className="border-b border-[#d8bd78]/40 px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.26em] text-[#9a8054]">
                    Mapped Residence
                  </p>
                  <h4
                    className={`${selectedFlatSerif.className} mt-1.5 text-2xl font-semibold leading-none text-[#21462d]`}
                  >
                    Floor-plan preview
                  </h4>
                </div>

                <div className="p-4">
                  <div className="relative overflow-hidden rounded-[24px] border border-[#d8bd78]/55 bg-[#f8f4e8]/70">
                    <div className="relative aspect-[16/10] w-full">
                      <SignedImage
                        src={apartment.floorPlanImage}
                        alt={`${apartment.title} mapped floor plan`}
                        fill
                        sizes="(max-width: 1280px) 100vw, 480px"
                        className="bg-[#f7f3e8] object-contain p-2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default SelectedFlatDetailsPanel;
