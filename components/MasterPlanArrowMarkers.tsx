"use client";

import { memo } from "react";
import { MapPin } from "lucide-react";
import type { MasterPlanArrowPoint } from "@/data/masterPlanArrowPoints";

type Props = {
  points: MasterPlanArrowPoint[];
  className?: string;
};

function ArrowMarker({ point }: { point: MasterPlanArrowPoint }) {
  return (
    <div
      className="pointer-events-none absolute z-[4]"
      style={{
        left: `${point.x}%`,
        top: `${point.y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="group relative flex items-center justify-center">
        <button
          type="button"
          aria-label={point.label ?? point.id}
          className="pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/88 text-zinc-900 shadow-[0_12px_30px_rgba(15,23,42,0.16)] backdrop-blur-xl transition duration-200 hover:scale-105 hover:bg-white md:h-11 md:w-11"
        >
          <MapPin className="relative z-10 h-4 w-4 text-[#8f7550] md:h-4.5 md:w-4.5" />
        </button>

        {point.label ? (
          <div className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/45 bg-black/62 px-2.5 py-1 text-[10px] font-medium text-white opacity-0 shadow-[0_10px_26px_rgba(15,23,42,0.20)] backdrop-blur-md transition duration-200 group-hover:translate-y-0 group-hover:opacity-100">
            {point.label}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MasterPlanArrowMarkersBase({ points, className }: Props) {
  return (
    <div className={`pointer-events-none absolute inset-0 z-[4] ${className ?? ""}`}>
      {points.map((point) => (
        <ArrowMarker key={point.id} point={point} />
      ))}
    </div>
  );
}

const MasterPlanArrowMarkers = memo(MasterPlanArrowMarkersBase);

export default MasterPlanArrowMarkers;
