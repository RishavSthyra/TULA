"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowLeftRight,
  BedDouble,
  Building2,
  Compass,
  Layers3,
  Maximize2,
  Plus,
  Ruler,
  Search,
  X,
} from "lucide-react";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import SignedImage from "@/src/components/common/SignedImage";
import { formatBlockLabel } from "@/lib/inventory-display";
import type { InventoryApartment } from "@/types/inventory";

const comparisonSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
});

const comparisonSans = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

type UnitComparisonPageProps = {
  apartments: InventoryApartment[];
  initialUnitIds?: string[];
};

function unitSummary(unit: InventoryApartment) {
  return `${formatBlockLabel(unit.tower)} · ${unit.bhk} BHK · ${numberFormatter.format(unit.areaSqft)} sq ft`;
}

function parseBathroomCount(unit: InventoryApartment) {
  const unitTypeMatch = unit.unitType.match(/\b(\d+)\s*T\b/i);
  if (unitTypeMatch) {
    return Number(unitTypeMatch[1]);
  }

  const roomLabels = unit.roomDimensions
    .split("|")
    .map((part) => part.split(":")[0]?.trim().toLowerCase())
    .filter(Boolean);

  return (
    roomLabels.filter((label) => label?.includes("toilet")).length || unit.bhk
  );
}

function SelectedUnitRow({
  index,
  unit,
  onChange,
  onRemove,
}: {
  index: number;
  unit: InventoryApartment | null;
  onChange: () => void;
  onRemove: () => void;
}) {
  if (!unit) {
    return (
      <button
        type="button"
        onClick={onChange}
        className="flex min-h-20 w-full items-center gap-3 rounded-xl border border-dashed border-[#717453]/45 bg-white/25 px-4 text-left transition hover:bg-white/55"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#535730] text-white">
          <Plus className="h-3.5 w-3.5" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-[#535730]">
            Add residence {index}
          </span>
          <span className="mt-0.5 block text-[11px] text-black/50">
            Choose from available units
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="group relative flex min-h-20 items-center gap-3 rounded-xl border border-[#717453]/45 bg-white/48 px-3 pr-11">
      <button
        type="button"
        onClick={onChange}
        className="absolute inset-0 rounded-xl"
        aria-label={`Change ${unit.title}`}
      />
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#535730] text-xs font-bold text-white">
        {index}
      </span>
      <span className="pointer-events-none relative h-12 w-14 shrink-0">
        <SignedImage
          src={unit.floorPlanImage}
          placeholderSrc={null}
          alt=""
          fill
          sizes="56px"
          className="object-contain mix-blend-multiply"
        />
      </span>
      <span className="pointer-events-none min-w-0">
        <span className="block truncate text-sm font-semibold text-[#535730]">
          {unit.title}
        </span>
        <span className="mt-1 block truncate text-[10px] text-black/50">
          {unitSummary(unit)}
        </span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-3 z-10 grid h-7 w-7 place-items-center rounded-full text-[#535730]/65 transition hover:bg-[#535730]/10 hover:text-[#535730]"
        aria-label={`Remove ${unit.title}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function UnitPlanCard({
  index,
  unit,
  onChoose,
  onZoom,
}: {
  index: number;
  unit: InventoryApartment | null;
  onChoose: () => void;
  onZoom: () => void;
}) {
  if (!unit) {
    return (
      <button
        type="button"
        onClick={onChoose}
        className="flex min-h-[25rem] flex-col items-center justify-center gap-3 rounded-2xl bg-white/88 text-[#535730] shadow-[0_16px_40px_rgba(50,53,31,0.08)] transition hover:bg-white"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full border border-[#717453]/35">
          <Plus className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-[0.14em]">
          Select residence {index}
        </span>
      </button>
    );
  }

  return (
    <motion.article
      layout
      className="grid min-h-[25rem] grid-rows-[4.5rem_minmax(0,1fr)_3.5rem] overflow-hidden rounded-2xl bg-white/94 shadow-[0_16px_40px_rgba(50,53,31,0.08)]"
    >
      <header className="flex items-center gap-3 border-b border-black/[0.06] px-5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#535730] text-xs font-bold text-white">
          {index}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold text-[#535730]">
            {unit.title}
          </span>
          <span className="mt-0.5 block truncate text-[10px] text-black/48">
            {unitSummary(unit)} · Floor {unit.floorLabel || unit.floor}
          </span>
        </span>
      </header>
      <button
        type="button"
        onClick={onZoom}
        className="relative min-h-0 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#717453]"
        aria-label={`Enlarge ${unit.title} floor plan`}
      >
        <SignedImage
          src={unit.floorPlanImage}
          placeholderSrc={null}
          alt={`${unit.title} floor plan`}
          fill
          sizes="(max-width: 767px) 90vw, 40vw"
          className="object-contain px-7 py-4 mix-blend-multiply transition-transform duration-300 hover:scale-[1.02]"
        />
      </button>
      <footer className="mx-5 mb-3 flex items-center justify-between border-t border-[#717453]/20 pt-3 text-[11px] font-semibold text-black/55">
        <span>{unit.status}</span>
        <button
          type="button"
          onClick={onZoom}
          className="inline-flex items-center gap-2 transition hover:text-[#535730]"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Enlarge plan
        </button>
      </footer>
    </motion.article>
  );
}

function FactList({ unit }: { unit: InventoryApartment }) {
  const facts = [
    { icon: BedDouble, label: "Bedrooms", value: String(unit.bhk) },
    {
      icon: Layers3,
      label: "Bathrooms",
      value: String(parseBathroomCount(unit)),
    },
    {
      icon: Ruler,
      label: "Saleable area",
      value: `${numberFormatter.format(unit.areaSqft)} sq ft`,
    },
    {
      icon: Ruler,
      label: "Carpet area",
      value: `${numberFormatter.format(unit.carpetAreaSqft)} sq ft`,
    },
    {
      icon: Building2,
      label: "Balcony",
      value: `${numberFormatter.format(unit.balconyAreaSqft)} sq ft`,
    },
    { icon: Compass, label: "Facing", value: unit.facing },
    {
      icon: Building2,
      label: "Floor",
      value: unit.floorLabel || String(unit.floor),
    },
  ];

  return (
    <dl className="divide-y divide-black/[0.07]">
      {facts.map((fact) => {
        const Icon = fact.icon;
        return (
          <div
            key={fact.label}
            className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 py-2.5 text-xs"
          >
            <Icon className="h-3.5 w-3.5 text-[#717453]" strokeWidth={1.6} />
            <dt className="text-black/55">{fact.label}</dt>
            <dd className="text-right font-semibold text-[#4d5036]">
              {fact.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function DifferenceSummary({
  left,
  right,
}: {
  left: InventoryApartment;
  right: InventoryApartment;
}) {
  const metrics = [
    {
      label: "Saleable area",
      leftValue: left.areaSqft,
      rightValue: right.areaSqft,
      suffix: "sq ft",
    },
    {
      label: "Carpet area",
      leftValue: left.carpetAreaSqft,
      rightValue: right.carpetAreaSqft,
      suffix: "sq ft",
    },
    {
      label: "Balcony",
      leftValue: left.balconyAreaSqft,
      rightValue: right.balconyAreaSqft,
      suffix: "sq ft",
    },
    {
      label: "Floor level",
      leftValue: left.floor,
      rightValue: right.floor,
      suffix: "floors",
    },
    {
      label: "Price",
      leftValue: left.priceLakhs,
      rightValue: right.priceLakhs,
      suffix: "L",
    },
  ];

  return (
    <section className="border-y border-black/[0.07] py-4 md:border-x md:border-y-0 md:px-5 md:py-0">
      <h3 className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-[#535730]">
        Key differences
      </h3>
      <div className="mt-3 divide-y divide-black/[0.07]">
        {metrics.map((metric) => {
          const difference = metric.leftValue - metric.rightValue;
          const isSame = Math.abs(difference) < 0.01;
          const leadingUnit = difference > 0 ? left : right;
          return (
            <div key={metric.label} className="py-2.5 text-center">
              <p className="text-[10px] text-black/45">{metric.label}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#4d5036]">
                {isSame
                  ? "Same"
                  : `${leadingUnit.title} +${numberFormatter.format(Math.abs(difference))} ${metric.suffix}`}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ResidencePicker({
  apartments,
  selectedIds,
  slot,
  onClose,
  onSelect,
}: {
  apartments: InventoryApartment[];
  selectedIds: Array<string | null>;
  slot: number;
  onClose: () => void;
  onSelect: (unit: InventoryApartment) => void;
}) {
  const [search, setSearch] = useState("");
  const otherSelectedId = selectedIds[slot === 0 ? 1 : 0];
  const filteredApartments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return apartments.filter(
      (unit) =>
        unit.id !== otherSelectedId &&
        (!query ||
          [
            unit.title,
            unit.unitKey,
            unit.tower,
            unit.floorLabel,
            unit.bhk,
          ].some((value) => String(value).toLowerCase().includes(query))),
    );
  }, [apartments, otherSelectedId, search]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[120]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-[#282b18]/30 backdrop-blur-[3px]"
        aria-label="Close residence selector"
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-y-0 left-0 flex w-[min(92vw,30rem)] flex-col bg-[#efebe4] p-5 shadow-[18px_0_45px_rgba(42,45,24,0.16)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#717453]">
              Residence {slot + 1}
            </p>
            <h2
              className={`${comparisonSerif.className} mt-1 text-3xl text-[#33360f]`}
            >
              Select a residence
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-[#717453]/25"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="mt-6 flex h-11 items-center gap-2 rounded-xl border border-[#717453]/30 bg-white/55 px-3">
          <Search className="h-4 w-4 text-[#717453]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
            placeholder="Unit, floor, block or BHK"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-black/40"
          />
        </label>
        <div className="custom-scrollbar mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {filteredApartments.map((unit) => (
            <button
              key={unit.id}
              type="button"
              onClick={() => onSelect(unit)}
              className="grid w-full grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-[#717453]/22 bg-white/42 p-2 text-left transition hover:border-[#717453]/55 hover:bg-white/75"
            >
              <span className="relative h-11 w-13">
                <SignedImage
                  src={unit.floorPlanImage}
                  placeholderSrc={null}
                  alt=""
                  fill
                  sizes="52px"
                  className="object-contain mix-blend-multiply"
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#535730]">
                  {unit.title}
                </span>
                <span className="mt-1 block truncate text-[10px] text-black/50">
                  {unitSummary(unit)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}

export default function UnitComparisonPage({
  apartments,
  initialUnitIds = [],
}: UnitComparisonPageProps) {
  const router = useRouter();
  const validInitialIds = initialUnitIds
    .filter((id) => apartments.some((unit) => unit.id === id))
    .slice(0, 2);
  const [selectedIds, setSelectedIds] = useState<Array<string | null>>([
    validInitialIds[0] ?? null,
    validInitialIds[1] ?? null,
  ]);
  const [pickerSlot, setPickerSlot] = useState<number | null>(
    validInitialIds.length === 0 ? 0 : validInitialIds.length === 1 ? 1 : null,
  );
  const [expandedUnit, setExpandedUnit] = useState<InventoryApartment | null>(
    null,
  );
  const apartmentMap = useMemo(
    () => new Map(apartments.map((unit) => [unit.id, unit])),
    [apartments],
  );
  const selectedUnits = selectedIds.map((id) =>
    id ? (apartmentMap.get(id) ?? null) : null,
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("units");
    selectedIds.forEach((id) => {
      if (id) url.searchParams.append("units", id);
    });
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [selectedIds]);

  useEffect(() => {
    if (!expandedUnit) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedUnit(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedUnit]);

  const updateSlot = (slot: number, id: string | null) => {
    setSelectedIds((current) => {
      const next = [...current];
      next[slot] = id;
      return next;
    });
  };

  return (
    <main
      className={`${comparisonSans.className} min-h-[100dvh] bg-[radial-gradient(circle_at_78%_12%,rgba(122,144,111,0.22),transparent_32%),linear-gradient(135deg,#efeee8,#dfe3da)] text-black`}
    >
      <div className="mx-auto grid min-h-[100dvh] max-w-[112rem] lg:grid-cols-[clamp(24rem,28vw,30rem)_minmax(0,1fr)]">
        <aside className="border-b border-[#717453]/14 bg-[#efebe4]/88 p-6 backdrop-blur-xl lg:border-b-0 lg:border-r lg:pb-8 lg:pl-32 lg:pr-8 lg:pt-8">
          <p
            className={`${comparisonSerif.className} text-2xl font-semibold tracking-[0.04em] text-[#294733]`}
          >
            TULA
          </p>
          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#717453]">
            Whispers of Trees
          </p>
          <button
            type="button"
            onClick={() => router.push("/master-plan")}
            className="mt-8 inline-flex items-center gap-2 text-xs font-medium text-black/70 transition hover:text-[#535730]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to residences
          </button>
          <div className="mt-8">
            <h1
              className={`${comparisonSerif.className} text-4xl font-semibold text-[#33360f]`}
            >
              Compare Residences
            </h1>
            <p className="mt-2 max-w-xs text-xs leading-5 text-black/60">
              Side-by-side comparison of your selected homes.
            </p>
          </div>
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#535730]">
                Selected residences
              </h2>
              <button
                type="button"
                onClick={() => setSelectedIds([null, null])}
                className="text-[10px] font-semibold text-[#535730]/65 hover:text-[#535730]"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-2">
              <SelectedUnitRow
                index={1}
                unit={selectedUnits[0]}
                onChange={() => setPickerSlot(0)}
                onRemove={() => updateSlot(0, null)}
              />
              <SelectedUnitRow
                index={2}
                unit={selectedUnits[1]}
                onChange={() => setPickerSlot(1)}
                onRemove={() => updateSlot(1, null)}
              />
            </div>
          </section>
        </aside>

        <section className="grid min-h-0 gap-4 p-4 sm:p-6 lg:grid-rows-[minmax(25rem,1fr)_auto] lg:overflow-hidden lg:px-8 lg:pb-8 lg:pt-24">
          <div className="relative grid min-h-0 gap-4 md:grid-cols-2">
            <UnitPlanCard
              index={1}
              unit={selectedUnits[0]}
              onChoose={() => setPickerSlot(0)}
              onZoom={() =>
                selectedUnits[0] && setExpandedUnit(selectedUnits[0])
              }
            />
            <UnitPlanCard
              index={2}
              unit={selectedUnits[1]}
              onChoose={() => setPickerSlot(1)}
              onZoom={() =>
                selectedUnits[1] && setExpandedUnit(selectedUnits[1])
              }
            />
            <button
              type="button"
              disabled={!selectedUnits[0] || !selectedUnits[1]}
              onClick={() => setSelectedIds(([left, right]) => [right, left])}
              className="absolute left-1/2 top-1/2 z-20 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/75 bg-[#535730] text-white shadow-xl transition hover:scale-105 disabled:opacity-35 md:grid"
              aria-label="Swap compared residences"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 rounded-2xl bg-white/84 p-5 shadow-[0_16px_40px_rgba(50,53,31,0.07)] backdrop-blur-lg md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.72fr)_minmax(0,1fr)]">
            {selectedUnits[0] ? (
              <FactList unit={selectedUnits[0]} />
            ) : (
              <p className="grid min-h-32 place-items-center text-xs text-black/45">
                Select residence 1
              </p>
            )}
            {selectedUnits[0] && selectedUnits[1] ? (
              <DifferenceSummary
                left={selectedUnits[0]}
                right={selectedUnits[1]}
              />
            ) : (
              <div className="hidden md:block" aria-hidden="true" />
            )}
            {selectedUnits[1] ? (
              <FactList unit={selectedUnits[1]} />
            ) : (
              <p className="grid min-h-32 place-items-center text-xs text-black/45">
                Select residence 2
              </p>
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {pickerSlot !== null ? (
          <ResidencePicker
            apartments={apartments}
            selectedIds={selectedIds}
            slot={pickerSlot}
            onClose={() => setPickerSlot(null)}
            onSelect={(unit) => {
              updateSlot(pickerSlot, unit.id);
              setPickerSlot(null);
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {expandedUnit ? (
          <motion.div
            className="fixed inset-0 z-[140] flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              onClick={() => setExpandedUnit(null)}
              className="absolute inset-0 bg-[#202315]/78 backdrop-blur-md"
              aria-label="Close enlarged floor plan"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="pointer-events-none relative h-[88dvh] w-[92vw] max-w-6xl"
            >
              <SignedImage
                src={expandedUnit.floorPlanImage}
                placeholderSrc={null}
                alt={`${expandedUnit.title} enlarged floor plan`}
                fill
                sizes="92vw"
                className="object-contain drop-shadow-[0_28px_70px_rgba(0,0,0,0.45)]"
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
