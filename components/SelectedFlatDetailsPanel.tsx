"use client";

import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { forwardRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BedDouble,
  Building2,
  Compass,
  Expand,
  Layers,
  MapPin,
  Play,
  Ruler,
  X,
} from "lucide-react";
import { Cormorant_Garamond } from "next/font/google";
import type { InventoryApartment } from "@/types/inventory";
import { formatBlockLabel } from "@/lib/inventory-display";
import { buildWalkthroughHref } from "@/lib/walkthrough";

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
        "border-[#6f8f5a]/55 bg-[linear-gradient(135deg,#6d945a_0%,#4d7443_52%,#365834_100%)] text-white shadow-[0_12px_24px_rgba(31,66,35,0.28),inset_0_1px_0_rgba(255,255,255,0.24)]",
      dotClassName: "bg-white",
    };
  }

  if (status === "Reserved") {
    return {
      badgeClassName:
        "border-[#c4a667]/45 bg-[#b89043] text-white shadow-[0_8px_18px_rgba(118,83,22,0.18),inset_0_1px_0_rgba(255,255,255,0.24)]",
      dotClassName: "bg-white",
    };
  }

  return {
    badgeClassName:
      "border-[#b7776b]/45 bg-[#9d5d50] text-white shadow-[0_8px_18px_rgba(99,38,31,0.18),inset_0_1px_0_rgba(255,255,255,0.22)]",
    dotClassName: "bg-white",
  };
}

const metaCardClassName =
  "min-w-0 rounded-[22px] border border-[#d9c99c]/70 bg-[#f8f4e8]/82 px-4 py-4 text-[#1f3f2b] shadow-[0_14px_32px_rgba(39,47,34,0.10),inset_0_1px_0_rgba(255,255,255,0.94)] backdrop-blur-md";

const premiumPanelShellClassName =
  "relative isolate overflow-hidden border border-[#d8bd78]/70 bg-[linear-gradient(145deg,rgba(250,248,238,0.96)_0%,rgba(240,237,224,0.94)_48%,rgba(249,246,234,0.98)_100%)] text-[#1f3f2b] shadow-[0_30px_80px_rgba(20,36,25,0.24),inset_0_1px_0_rgba(255,255,255,0.96),inset_0_0_0_1px_rgba(255,255,255,0.30)] backdrop-blur-2xl";

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
  const router = useRouter();
  const dimensionItems = useMemo(
    () => parseRoomDimensions(apartment.roomDimensions),
    [apartment.roomDimensions],
  );
  const statusStyles = getStatusStyles(apartment.status);
  const formattedAreaSqft = `${Math.round(apartment.areaSqft)} sq ft`;
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
      label: "Block",
      value: formatBlockLabel(apartment.tower),
      icon: Building2,
    },
    {
      key: "config",
      label: "Config",
      value: `${apartment.bhk} BHK`,
      icon: BedDouble,
    },
    {
      key: "area",
      label: "Saleable Area",
      value: formattedAreaSqft,
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
      : "pointer-events-auto w-full self-start";
    const compactPanelClassName = desktopEnhancedCompact
      ? `custom-scrollbar flex max-h-[68vh] min-h-0 flex-col overflow-y-auto overscroll-contain rounded-[34px] rounded-tr-[70px] rounded-bl-[26px] ${premiumPanelShellClassName} [-webkit-overflow-scrolling:touch] touch-pan-y 2xl:max-h-[72vh] 2xl:rounded-[38px] 2xl:rounded-tr-[80px]`
      : `flex min-h-0 flex-col overflow-hidden rounded-[28px] rounded-tr-[56px] rounded-bl-[22px] ${premiumPanelShellClassName} sm:rounded-[32px] sm:rounded-tr-[64px] md:rounded-[36px] md:rounded-tr-[72px]`;
    const compactContentClassName = desktopEnhancedCompact
      ? "relative flex min-h-0 flex-col p-6 xl:p-6 2xl:p-7"
      : "relative flex min-h-0 flex-col p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:p-6 sm:pb-[max(env(safe-area-inset-bottom),1.5rem)] md:p-7 md:pb-[max(env(safe-area-inset-bottom),1.75rem)]";
    const compactHeroTitleClassName = desktopEnhancedCompact
      ? `${selectedFlatSerif.className} mt-1 truncate text-[3rem] font-medium leading-[0.88] text-[#21462d] xl:text-[3.2rem] 2xl:text-[3.65rem]`
      : `${selectedFlatSerif.className} mt-1 truncate text-[3.05rem] font-medium leading-[0.88] text-[#21462d] sm:text-[3.45rem]`;
    const compactPillClassName =
      "inline-flex h-10 items-center justify-center rounded-full border border-[#d8bd78]/70 bg-[#f8f4e8]/88 px-4 text-xs font-bold text-[#58715f] shadow-[0_12px_28px_rgba(33,50,35,0.10),inset_0_1px_0_rgba(255,255,255,0.95)] transition hover:bg-white";

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
          <div className="pointer-events-none absolute inset-[9px] rounded-[22px] rounded-tr-[46px] rounded-bl-[18px] border border-[#ead8a4]/55 sm:rounded-[26px] sm:rounded-tr-[54px] md:rounded-[30px] md:rounded-tr-[62px]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_6%,rgba(255,255,255,0.86),transparent_30%),radial-gradient(circle_at_92%_18%,rgba(236,218,169,0.30),transparent_31%),linear-gradient(180deg,rgba(255,255,255,0.28),rgba(232,236,222,0.20))]" />
          <div className={`${ornamentLineClassName} -right-5 top-12 h-36 w-24 rounded-[50%] border-l`} />
          <div className={`${ornamentLineClassName} right-0 top-20 h-24 w-16 rounded-[50%] border-l`} />
          <div className={`${ornamentLineClassName} -bottom-10 -left-7 h-48 w-28 rounded-[50%] border-r`} />

          <div className={`${compactContentClassName} relative z-10`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.38em] text-[#697560]">
                  Selected Flat
                </p>
                <h2 className={compactHeroTitleClassName}>
                  {apartment.title}
                </h2>
                <div className="mt-4 h-px w-16 bg-[#c4a667]" />
                <p className="mt-4 max-w-[18rem] text-sm font-semibold leading-relaxed text-[#687468]">
                  Open the full apartment walkthrough from this residence.
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                {!hideCloseButton ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className={`${compactPillClassName} h-11 w-11 px-0`}
                    aria-label="Close flat details"
                  >
                    <X className="h-5 w-5 stroke-[2.2]" />
                  </button>
                ) : null}

                <span
                  className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[10px] font-bold uppercase tracking-[0.2em] ${statusStyles.badgeClassName}`}
                >
                  <span
                    className={`inline-flex h-1.5 w-1.5 rounded-full ${statusStyles.dotClassName}`}
                  />
                  {apartment.status}
                </span>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              {compactFacts.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.key}
                    className="flex min-w-0 items-center gap-3 rounded-[22px] border border-[#d8bd78]/60 bg-[#f8f4e8]/78 px-3 py-3.5 shadow-[0_14px_30px_rgba(33,50,35,0.10),inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-md"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d2b874]/65 bg-[#f0ead9]/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                      <Icon className="h-4 w-4 text-[#a88a45]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[8px] font-bold uppercase tracking-[0.26em] text-[#9a8054]">
                        {item.label}
                      </p>
                      <p className="mt-1 truncate text-xs font-bold text-[#1f3f2b]">
                        {item.value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[22px] border border-[#d8bd78]/60 bg-[#f8f4e8]/78 px-5 py-4 shadow-[0_14px_30px_rgba(33,50,35,0.09),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-md">
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[#9a8054]">
                  Floor
                </p>
                <p className={`${selectedFlatSerif.className} mt-1 truncate text-3xl font-medium leading-none text-[#21462d]`}>
                  {apartment.floorLabel || apartment.floor}
                </p>
              </div>
              <Layers className="h-6 w-6 text-[#a88a45]" />
            </div>

            {!desktopEnhancedCompact && dimensionItems.length > 0 ? (
              <div className="mt-5 overflow-hidden rounded-[26px] border border-[#d8bd78]/55 bg-[linear-gradient(180deg,rgba(35,65,42,0.96),rgba(28,54,36,0.98))] px-5 py-4 text-[#f5ecd7] shadow-[0_18px_38px_rgba(25,55,34,0.22),inset_0_1px_0_rgba(255,255,255,0.14)]">
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#d9c28a] sm:text-[10px]">
                      Spatial Composition
                    </p>
                    <p className={`${selectedFlatSerif.className} mt-1 text-xl font-semibold leading-none text-[#fff6df] sm:text-2xl`}>
                      Room dimensions
                    </p>
                  </div>

                  <div className="rounded-full border border-[#d9c28a]/35 bg-white/8 px-2 py-1 text-[10px] font-medium text-[#f5ecd7] sm:px-3 sm:py-1.5 sm:text-[11px]">
                    {dimensionItems.length} rooms
                  </div>
                </div>

                <div className="mt-3 pr-1 sm:mt-4">
                  <div className="space-y-2.5 pb-1 sm:space-y-3 sm:pb-1">
                    {dimensionItems.length > 0 ? (
                      dimensionItems.map((item, index) => (
                        <div
                          key={item.key}
                          className="flex items-start justify-between gap-2 border-b border-[#d9c28a]/18 pb-2.5 last:border-b-0 last:pb-0 sm:gap-3 sm:pb-3"
                        >
                          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d9c28a]/30 bg-white/8 sm:h-9 sm:w-9">
                              <Ruler className="h-3.5 w-3.5 text-[#d9c28a] sm:h-4 sm:w-4" />
                            </div>

                            <div className="min-w-0">
                              <p className="text-[9px] uppercase tracking-[0.24em] text-[#d9c28a]/70 sm:text-[10px]">
                                {String(index + 1).padStart(2, "0")}
                              </p>
                              <p className="mt-0.5 truncate text-xs font-medium text-[#fff6df] sm:text-sm">
                                {item.label}
                              </p>
                            </div>
                          </div>

                          <p className="shrink-0 text-right text-xs font-semibold tracking-[0.01em] text-[#f5ecd7] sm:text-sm">
                            {item.value}
                          </p>
                        </div>
                      ))
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-6 pb-0.5">
              <button
                type="button"
                onClick={handleOpenWalkthrough}
                className="group grid w-full grid-cols-[1fr_auto] items-center rounded-full border border-[#d8bd78]/80 bg-[linear-gradient(135deg,#25442d_0%,#17321f_100%)] p-1.5 pl-6 text-left text-xs font-bold uppercase tracking-[0.08em] text-[#fff6df] shadow-[0_18px_42px_rgba(20,55,30,0.30),inset_0_1px_0_rgba(255,255,255,0.16)] transition hover:brightness-[1.06] sm:text-sm"
              >
                <span>Open Walkthrough</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#ead39a]/80 bg-[radial-gradient(circle_at_35%_28%,#f3dfaa_0%,#bd9650_58%,#8d6930_100%)] text-white shadow-[0_10px_24px_rgba(76,52,18,0.28),inset_0_1px_0_rgba(255,255,255,0.38)] transition group-hover:translate-x-0.5">
                  <ArrowRight className="h-5 w-5" />
                </span>
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
      <div
        className={`custom-scrollbar max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[34px] rounded-tr-[72px] rounded-bl-[24px] ${premiumPanelShellClassName} sm:max-h-[calc(100dvh-2rem)] xl:max-h-[min(78dvh,860px)] xl:overflow-hidden`}
      >
        <div className="pointer-events-none absolute inset-[10px] rounded-[26px] rounded-tr-[58px] rounded-bl-[18px] border border-[#ead8a4]/55" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_5%,rgba(255,255,255,0.88),transparent_30%),radial-gradient(circle_at_91%_12%,rgba(236,218,169,0.28),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.24),rgba(232,236,222,0.18))]" />
        <div className={`${ornamentLineClassName} -right-5 top-12 h-40 w-28 rounded-[50%] border-l`} />
        <div className={`${ornamentLineClassName} -bottom-12 -left-8 h-56 w-36 rounded-[50%] border-r`} />

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
                  <h3 className={`${selectedFlatSerif.className} mt-1.5 text-[2.6rem] font-medium leading-none text-[#21462d] sm:text-[3.2rem] xl:text-[3.75rem]`}>
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

              <p className="mt-4 max-w-3xl text-sm font-medium leading-6 text-[#687468] sm:text-[15px]">
                Open the full apartment walkthrough from this residence, with
                live inventory details and dimensional planning data in a
                warm premium presentation.
              </p>
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
                    <span
                      className="inline-flex h-2.5 w-2.5 rounded-full bg-[#5f8d57]"
                    />
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
                    <h4 className={`${selectedFlatSerif.className} mt-1.5 text-2xl font-semibold leading-none text-[#fff6df]`}>
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
                  <h4 className={`${selectedFlatSerif.className} mt-1.5 text-2xl font-semibold leading-none text-[#21462d]`}>
                    Floor-plan preview
                  </h4>
                </div>

                <div className="p-4">
                  <div
                    className="group relative cursor-pointer overflow-hidden rounded-[24px] border border-[#d8bd78]/55 bg-[#f8f4e8]/70"
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
                        src={apartment.floorPlanImage}
                        alt={`${apartment.title} mapped floor plan`}
                        fill
                        sizes="(max-width: 1280px) 100vw, 480px"
                        className="bg-[#f7f3e8] object-contain p-2 transition duration-700 group-hover:scale-[1.015]"
                      />

                      <div className="absolute inset-0 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenWalkthrough();
                          }}
                          className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full border border-[#ead39a]/80 bg-[radial-gradient(circle_at_35%_28%,#f3dfaa_0%,#bd9650_58%,#8d6930_100%)] text-white shadow-[0_18px_34px_rgba(76,52,18,0.24)] transition duration-300 hover:scale-105 sm:h-[5.25rem] sm:w-[5.25rem]"
                          aria-label="Play preview"
                        >
                          <Play className="ml-1 h-7 w-7 fill-white text-white sm:h-8 sm:w-8" />
                        </button>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <div className="flex items-end justify-between gap-3 rounded-[20px] border border-[#d8bd78]/55 bg-[#f8f4e8]/82 p-3 backdrop-blur-md">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.24em] text-[#9a8054]">
                              Private View
                            </p>
                            <p className="mt-1 text-sm font-bold text-[#1f3f2b]">
                              Interior walkthrough preview
                            </p>
                          </div>

                          <div className="rounded-full border border-[#d8bd78]/55 bg-white/55 px-3 py-1.5 text-[11px] font-medium text-[#58715f]">
                            Video preview
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <button
                  type="button"
                  onClick={handleOpenWalkthrough}
                  className="group grid w-full grid-cols-[1fr_auto] items-center rounded-full border border-[#d8bd78]/80 bg-[linear-gradient(135deg,#25442d_0%,#17321f_100%)] p-1.5 pl-6 text-left text-sm font-bold uppercase tracking-[0.08em] text-[#fff6df] shadow-[0_18px_42px_rgba(20,55,30,0.30),inset_0_1px_0_rgba(255,255,255,0.16)] transition hover:brightness-[1.06]"
                >
                  <span>Open Walkthrough</span>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#ead39a]/80 bg-[radial-gradient(circle_at_35%_28%,#f3dfaa_0%,#bd9650_58%,#8d6930_100%)] text-white shadow-[0_10px_24px_rgba(76,52,18,0.28),inset_0_1px_0_rgba(255,255,255,0.38)] transition group-hover:translate-x-0.5">
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

export default SelectedFlatDetailsPanel;
