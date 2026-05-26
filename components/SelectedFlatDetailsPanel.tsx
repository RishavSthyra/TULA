"use client";

import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { forwardRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { BedDouble, Building2, Expand, MapPin, Play, Ruler, X } from "lucide-react";
import type { InventoryApartment } from "@/types/inventory";
import { buildWalkthroughHref } from "@/lib/walkthrough";

type SelectedFlatDetailsPanelProps = {
  apartment: InventoryApartment;
  compact?: boolean;
  desktopEnhancedCompact?: boolean;
  hideCloseButton?: boolean;
  onClose: () => void;
};

const PANEL_PREVIEW_IMAGE = "/frames_webp_full_q35/frame_00121.webp";

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
        "border-emerald-300/45 bg-emerald-100/72 text-emerald-700",
      dotClassName: "bg-emerald-500",
    };
  }

  if (status === "Reserved") {
    return {
      badgeClassName: "border-amber-300/45 bg-amber-100/72 text-amber-700",
      dotClassName: "bg-amber-500",
    };
  }

  return {
    badgeClassName: "border-rose-300/45 bg-rose-100/72 text-rose-700",
    dotClassName: "bg-rose-500",
  };
}

const metaCardClassName =
  "rounded-[22px] border border-white/55 bg-white/42 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl";

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
  const router = useRouter();
  const dimensionItems = useMemo(
    () => parseRoomDimensions(apartment.roomDimensions),
    [apartment.roomDimensions],
  );
  const statusStyles = getStatusStyles(apartment.status);
  const handleOpenWalkthrough = useCallback(() => {
    router.push(
      buildWalkthroughHref({
        apartment: {
          id: apartment.id,
          flatNumber: apartment.flatNumber,
          tower: apartment.tower,
          floorLabel: apartment.floorLabel,
          bhk: apartment.bhk,
        },
      }),
    );
  }, [apartment.bhk, apartment.flatNumber, apartment.floorLabel, apartment.id, apartment.tower, router]);
  const compactFacts = [
    {
      key: "tower",
      label: "Tower",
      value: apartment.tower,
      icon: Building2,
    },
    {
      key: "config",
      label: "Configuration",
      value: `${apartment.bhk} BHK`,
      icon: BedDouble,
    },
    {
      key: "area",
      label: "Surface",
      value: `${apartment.areaSqft} sqft`,
      icon: Expand,
    },
    {
      key: "facing",
      label: "Orientation",
      value: apartment.facing,
      icon: MapPin,
    },
  ];

  if (compact) {
    const compactWrapperClassName = desktopEnhancedCompact
      ? "pointer-events-auto w-full self-start"
      : "pointer-events-auto h-full min-h-0 w-full self-stretch";
    const compactPanelClassName = desktopEnhancedCompact
      ? "custom-scrollbar relative flex max-h-[52vh] min-h-0 flex-col overflow-y-auto overscroll-contain rounded-[20px] border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(245,247,250,0.54))] text-zinc-900 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-[28px] [-webkit-overflow-scrolling:touch] touch-pan-y xl:rounded-[24px] 2xl:max-h-[60vh] 2xl:rounded-[30px]"
      : "custom-scrollbar relative flex h-full max-h-full min-h-0 flex-col overflow-y-auto overscroll-contain rounded-[20px] border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(245,247,250,0.58))] text-zinc-900 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-[28px] [-webkit-overflow-scrolling:touch] touch-pan-y sm:rounded-[28px] md:rounded-[30px]";
    const compactContentClassName = desktopEnhancedCompact
      ? "relative flex min-h-0 flex-col p-3 xl:p-3.5 2xl:p-5"
      : "relative flex min-h-0 flex-col p-3 sm:p-4 md:p-5";
    const compactHeroTitleClassName = desktopEnhancedCompact
      ? "mt-0.5 truncate text-[1.2rem] font-semibold leading-none tracking-[-0.06em] text-zinc-950 xl:text-[1.4rem] 2xl:text-[1.9rem]"
      : "mt-0.5 truncate text-[1.4rem] font-semibold leading-none tracking-[-0.06em] text-zinc-950 sm:mt-1 sm:text-[1.9rem]";

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, x: 22, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: 18, y: 8 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={compactWrapperClassName}
        data-scroll-area="flat-details-panel"
        data-flat-details-panel
        onTouchMoveCapture={(event) => {
          event.stopPropagation();
        }}
        onWheelCapture={(event) => {
          event.stopPropagation();
        }}
      >
        <div className={compactPanelClassName}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.42),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(228,232,238,0.34),transparent_30%)]" />

          <div className={compactContentClassName}>
            {/* <div className="flex items-center justify-between gap-2 sm:gap-3">
              <div className="h-9 w-9 shrink-0 opacity-0 sm:h-10 sm:w-10" aria-hidden="true" />

              <div className="min-w-0 flex-1 text-center">
                <p className="text-[9px] uppercase tracking-[0.28em] text-white/38 sm:text-[10px]">
                  Selected Flat
                </p>
                <p className={compactTitleClassName}>
                  {apartment.title}
                </p>
              </div>

              {!hideCloseButton ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/54 text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition hover:bg-white/78 hover:text-zinc-900 sm:h-10 sm:w-10"
                  aria-label="Close flat details"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              ) : (
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] sm:px-3 sm:py-2 sm:text-[10px] ${statusStyles.badgeClassName}`}
                >
                  <span
                    className={`inline-flex h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${statusStyles.dotClassName}`}
                  />
                  {apartment.status}
                </span>
              )}
            </div> */}
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/54 text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition hover:bg-white/78 hover:text-zinc-900 sm:h-10 sm:w-10"
                aria-label="Close flat details"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            )}

            <div className="mt-0 rounded-[18px] border border-white/60 bg-white/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl mt-4 sm:rounded-[24px] sm:p-4">
              <div className="flex items-end justify-between gap-2 sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.26em] text-zinc-500 sm:text-[10px]">
                    Selected Flat
                  </p>
                  <p className={compactHeroTitleClassName}>
                    {apartment.title}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[9px] uppercase tracking-[0.26em] text-zinc-500 sm:text-[10px]">
                    Floor
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-zinc-800 sm:mt-1 sm:text-lg">
                    {apartment.floorLabel || apartment.floor}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 sm:mt-3 sm:gap-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.24em] text-zinc-500 sm:text-[10px]">
                    Walkthrough
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-zinc-600 sm:text-sm">
                    Open the full apartment walkthrough from the button below.
                  </p>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] sm:px-3 sm:py-1.5 sm:text-[10px] ${statusStyles.badgeClassName}`}
                >
                  <span
                    className={`inline-flex h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 ${statusStyles.dotClassName}`}
                  />
                  {apartment.status}
                </span>
              </div>
            </div>

            {/* {desktopEnhancedCompact ? (
              <div
                className="group mt-3 relative shrink-0 overflow-hidden rounded-[18px] border border-white/60 bg-white/35 cursor-pointer shadow-[0_14px_34px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:mt-4 sm:rounded-[24px]"
                onClick={handleOpenWalkthrough}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleOpenWalkthrough();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="relative aspect-[16/10] w-full">
                  <NextImage
                    src={PANEL_PREVIEW_IMAGE}
                    alt={`${apartment.title} preview`}
                    fill
                    sizes="420px"
                    className="object-cover transition duration-700 group-hover:scale-[1.025]"
                  />

                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenWalkthrough();
                      }}
                      className="flex h-[3rem] w-[3rem] items-center justify-center rounded-full border border-white/65 bg-white/82 shadow-[0_18px_34px_rgba(15,23,42,0.14)] backdrop-blur-md transition duration-300 hover:scale-105 hover:bg-white sm:h-[3.5rem] sm:w-[3.5rem] md:h-[4.2rem] md:w-[4.2rem]"
                      aria-label="Play preview"
                    >
                      <Play className="ml-0.5 h-5 w-5 fill-zinc-900 text-zinc-900 sm:h-5 sm:w-5 md:h-6 md:w-6" />
                    </button>
                  </div>
                </div>
              </div>
            ) : null} */}

            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-b border-white/45 pb-3 sm:gap-x-4 sm:gap-y-3 sm:pb-4">
              {compactFacts.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.key} className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/55 bg-white/48 sm:h-9 sm:w-9">
                      <Icon className="h-3.5 w-3.5 text-zinc-600 sm:h-4 sm:w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-[0.24em] text-zinc-500 sm:text-[10px]">
                        {item.label}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-medium text-zinc-800 sm:text-sm">
                        {item.value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {!desktopEnhancedCompact ? (
              <div className="mt-3 sm:mt-4">
                <button
                  type="button"
                  onClick={handleOpenWalkthrough}
                  className="inline-flex w-full items-center justify-center rounded-full border border-[#d4b06a]/65 bg-[linear-gradient(135deg,#f5e4bd_0%,#dfbf7e_44%,#b8863f_100%)] px-3 py-2.5 text-xs font-semibold text-[#2f2009] shadow-[0_16px_34px_rgba(120,84,28,0.22),inset_0_1px_0_rgba(255,248,230,0.72)] transition hover:brightness-[1.03] sm:px-4 sm:py-3 sm:text-sm md:py-3.5"
                >
                  Open walkthrough
                </button>
              </div>
            ) : null}

            {!desktopEnhancedCompact ? (
              <div className="mt-3 flex flex-col sm:mt-4">
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.26em] text-zinc-500 sm:text-[10px]">
                      Dimensions
                    </p>
                    <p className="mt-0.5 text-sm font-semibold tracking-[-0.03em] text-zinc-900 sm:text-base">
                      Room dimensions
                    </p>
                  </div>

                  <div className="rounded-full border border-white/55 bg-white/46 px-2 py-1 text-[10px] font-medium text-zinc-500 sm:px-3 sm:py-1.5 sm:text-[11px]">
                    {dimensionItems.length} rooms
                  </div>
                </div>

                <div className="mt-3 pr-1 sm:mt-4">
                  <div className="space-y-2.5 pb-1 sm:space-y-3 sm:pb-1">
                    {dimensionItems.length > 0 ? (
                      dimensionItems.map((item, index) => (
                        <div
                          key={item.key}
                          className="flex items-start justify-between gap-2 border-b border-white/45 pb-2.5 last:border-b-0 last:pb-0 sm:gap-3 sm:pb-3"
                        >
                          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/55 bg-white/46 sm:h-9 sm:w-9">
                              <Ruler className="h-3.5 w-3.5 text-zinc-600 sm:h-4 sm:w-4" />
                            </div>

                            <div className="min-w-0">
                              <p className="text-[9px] uppercase tracking-[0.24em] text-zinc-400 sm:text-[10px]">
                                {String(index + 1).padStart(2, "0")}
                              </p>
                              <p className="mt-0.5 truncate text-xs font-medium text-zinc-800 sm:text-sm">
                                {item.label}
                              </p>
                            </div>
                          </div>

                          <p className="shrink-0 text-right text-xs font-semibold tracking-[0.01em] text-zinc-900 sm:text-sm">
                            {item.value}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-xs text-zinc-500 sm:py-6 sm:text-sm">
                        Room dimensions are not available for this apartment yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <div
              className={`mt-3 border-t border-white/45 px-3 pt-2.5 sm:mt-4 sm:px-4 sm:pt-3 md:px-5 ${
                desktopEnhancedCompact
                  ? "pb-0.5"
                  : "hidden"
              }`}
            >
              <button
                type="button"
                onClick={handleOpenWalkthrough}
                className="inline-flex w-full items-center justify-center rounded-full border border-[#d4b06a]/65 bg-[linear-gradient(135deg,#f5e4bd_0%,#dfbf7e_44%,#b8863f_100%)] px-3 py-2.5 text-xs font-semibold text-[#2f2009] shadow-[0_16px_34px_rgba(120,84,28,0.22),inset_0_1px_0_rgba(255,248,230,0.72)] transition hover:brightness-[1.03] sm:px-4 sm:py-3 sm:text-sm md:py-3.5"
              >
                Open walkthrough
              </button>
            </div>
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
      <div className="relative max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[30px] border border-white/14 bg-[linear-gradient(180deg,rgba(21,24,31,0.95),rgba(27,31,39,0.92))] text-white shadow-[0_28px_90px_rgba(0,0,0,0.38)] backdrop-blur-[26px] custom-scrollbar sm:max-h-[calc(100dvh-2rem)] xl:max-h-[min(78dvh,860px)] xl:overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(246,226,181,0.07),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(168,135,86,0.06),transparent_26%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent_16%,transparent_82%,rgba(0,0,0,0.10))]" />

        <div className="relative p-4 sm:p-5 xl:flex xl:h-full xl:flex-col xl:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.32em] text-white/60">
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
                  <p className="text-[10px] uppercase tracking-[0.28em] text-white/38">
                    Selected Flat
                  </p>
                  <h3 className="mt-1.5 text-[2rem] font-semibold leading-none tracking-[-0.08em] text-white sm:text-[2.45rem] xl:text-[2.8rem]">
                    {apartment.title}
                  </h3>
                </div>

                <div className="pb-1 text-sm text-white/54 sm:text-base">
                  Floor{" "}
                  <span className="font-medium text-white/86">
                    {apartment.floorLabel || apartment.floor}
                  </span>
                </div>
              </div>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/62 sm:text-[15px]">
                A quieter, more curated apartment brief with live inventory
                details, dimensional planning data, and a premium preview panel
                designed to feel spacious without overpowering the master plan.
              </p>
            </div>

            {!hideCloseButton ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/76 transition hover:bg-white/12 hover:text-white"
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
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                    Tower
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-white/92">
                    <Building2 className="h-4 w-4 text-[#d4c09a]" />
                    {apartment.tower}
                  </div>
                </div>

                <div className={metaCardClassName}>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                    Configuration
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-white/92">
                    <BedDouble className="h-4 w-4 text-[#d4c09a]" />
                    {apartment.bhk} BHK
                  </div>
                </div>

                <div className={metaCardClassName}>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                    Facing
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-white/92">
                    <MapPin className="h-4 w-4 text-[#d4c09a]" />
                    {apartment.facing}
                  </div>
                </div>

                <div className={metaCardClassName}>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                    Area
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-white/92">
                    <Expand className="h-4 w-4 text-[#d4c09a]" />
                    {apartment.areaSqft} sqft
                  </div>
                </div>

                <div className={metaCardClassName}>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                    Inventory
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-white/92">
                    <span
                      className={`inline-flex h-2.5 w-2.5 rounded-full ${statusStyles.dotClassName}`}
                    />
                    {apartment.status}
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.015))]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-3.5">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.26em] text-white/38">
                      Spatial Schedule
                    </p>
                    <h4 className="mt-1.5 text-[1.05rem] font-semibold tracking-[-0.04em] text-white">
                      Room dimensions
                    </h4>
                  </div>

                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/58">
                    Detailed layout
                  </div>
                </div>

                {dimensionItems.length > 0 ? (
                  <div className="px-5 py-3 sm:py-4">
                    <div className="grid gap-x-6 divide-y divide-white/8 sm:grid-cols-2 sm:divide-y-0">
                      {dimensionItems.map((item, index) => (
                        <div
                          key={item.key}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3 sm:border-b sm:border-white/8"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                              <Ruler className="h-4 w-4 text-[#d6c29d]" />
                            </div>

                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-[0.24em] text-white/32">
                                {String(index + 1).padStart(2, "0")}
                              </p>
                              <p className="truncate text-sm font-medium text-white/88">
                                {item.label}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-semibold tracking-[0.01em] text-[#f2e6cc]">
                              {item.value}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-5 py-6 text-sm text-white/52">
                    Room dimensions are not available for this apartment yet.
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 xl:border-l xl:border-white/10 xl:pl-5">
              <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="border-b border-white/8 px-5 py-4">
                  <p className="text-[10px] uppercase tracking-[0.26em] text-white/38">
                    Private Preview
                  </p>
                  <h4 className="mt-1.5 text-lg font-semibold tracking-[-0.04em] text-white">
                    Curated walkthrough teaser
                  </h4>
                </div>

                <div className="p-4">
                  <div
                    className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03] cursor-pointer"
                    onClick={handleOpenWalkthrough}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleOpenWalkthrough();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="relative aspect-[16/10] w-full">
                      <NextImage
                        src={PANEL_PREVIEW_IMAGE}
                        alt={`${apartment.title} preview`}
                        fill
                        sizes="(max-width: 1280px) 100vw, 480px"
                        className="object-cover transition duration-700 group-hover:scale-[1.025]"
                      />

                      <div className="absolute inset-0 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenWalkthrough();
                          }}
                          className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full border border-white/65 bg-white/82 shadow-[0_18px_34px_rgba(15,23,42,0.14)] backdrop-blur-md transition duration-300 hover:scale-105 hover:bg-white sm:h-[5.25rem] sm:w-[5.25rem]"
                          aria-label="Play preview"
                        >
                          <Play className="ml-1 h-7 w-7 fill-zinc-900 text-zinc-900 sm:h-8 sm:w-8" />
                        </button>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <div className="flex items-end justify-between gap-3 rounded-[18px] border border-white/55 bg-white/70 p-3 backdrop-blur-md">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                              Private View
                            </p>
                            <p className="mt-1 text-sm font-medium text-zinc-900">
                              Interior walkthrough preview
                            </p>
                          </div>

                          <div className="rounded-full border border-white/60 bg-white/85 px-3 py-1.5 text-[11px] font-medium text-zinc-700">
                            Video preview
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-5 py-3.5">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                    Residence Note
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/68">
                    Live stock-linked apartment information is presented in a
                    calmer premium layout so the details feel clear, polished,
                    and easier to absorb at a glance.
                  </p>
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
