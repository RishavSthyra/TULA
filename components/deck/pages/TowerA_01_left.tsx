"use client";

import React, {
  forwardRef,
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import Image, { type StaticImageData } from "next/image";
import { motion } from "framer-motion";
import { Compass, Building2, Ruler, Home } from "lucide-react";

type Props = {
  number?: number;
  series: string;
  towerA: string;
  towerB?: string;
  bhk: string;
  facing: string;
  areaLabel: string;
  areaValue: string;
  description: string;
  image2D: StaticImageData;
};

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.08,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 26 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const fadeRight = {
  hidden: { opacity: 0, x: -26 },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const imageReveal = {
  hidden: {
    opacity: 0,
    scale: 0.92,
    x: 40,
    y: 16,
    rotate: -2,
  },
  show: {
    opacity: 1,
    scale: 1,
    x: 0,
    y: 0,
    rotate: 0,
    transition: {
      duration: 1.15,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const infoCard = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const FLOORPLAN_MIN_ZOOM = 1;
const FLOORPLAN_MAX_ZOOM = 3;
const FLOORPLAN_ZOOM_STEP = 0.16;

const UnitPlanLeftPage = forwardRef<HTMLDivElement, Props>(
  (
    {
      number: _number,
      series,
      towerA,
      towerB,
      bhk,
      facing,
      areaLabel,
      areaValue,
      description,
      image2D,
    },
    ref
  ) => {
    void _number;

    const floorplanFrameRef = useRef<HTMLDivElement | null>(null);
    const floorplanDragRef = useRef<{
      pointerId: number | null;
      startX: number;
      startY: number;
      startPanX: number;
      startPanY: number;
    }>({
      pointerId: null,
      startX: 0,
      startY: 0,
      startPanX: 0,
      startPanY: 0,
    });
    const [floorplanZoom, setFloorplanZoom] = useState(FLOORPLAN_MIN_ZOOM);
    const [floorplanPan, setFloorplanPan] = useState({ x: 0, y: 0 });
    const [floorplanTransformOrigin, setFloorplanTransformOrigin] = useState(
      "50% 50%",
    );
    const [isFloorplanDragging, setIsFloorplanDragging] = useState(false);

    const clampFloorplanPan = useCallback(
      (zoomValue: number, panValue: { x: number; y: number }) => {
        const frame = floorplanFrameRef.current;

        if (!frame || zoomValue <= FLOORPLAN_MIN_ZOOM) {
          return { x: 0, y: 0 };
        }

        const maxX = ((zoomValue - 1) * frame.clientWidth) / 2;
        const maxY = ((zoomValue - 1) * frame.clientHeight) / 2;

        return {
          x: Math.min(Math.max(panValue.x, -maxX), maxX),
          y: Math.min(Math.max(panValue.y, -maxY), maxY),
        };
      },
      [],
    );

    const resetFloorplanZoom = useCallback(() => {
      setFloorplanZoom(FLOORPLAN_MIN_ZOOM);
      setFloorplanPan({ x: 0, y: 0 });
      setFloorplanTransformOrigin("50% 50%");
      setIsFloorplanDragging(false);
      floorplanDragRef.current.pointerId = null;
    }, []);

    const handleFloorplanWheel = useCallback(
      (event: ReactWheelEvent<HTMLDivElement>) => {
        const frame = floorplanFrameRef.current;

        if (!frame) {
          return;
        }

        event.preventDefault();

        const bounds = frame.getBoundingClientRect();
        const relativeX = ((event.clientX - bounds.left) / bounds.width) * 100;
        const relativeY = ((event.clientY - bounds.top) / bounds.height) * 100;

        setFloorplanTransformOrigin(`${relativeX}% ${relativeY}%`);
        setFloorplanZoom((currentZoom) => {
          const nextZoom = Math.min(
            FLOORPLAN_MAX_ZOOM,
            Math.max(
              FLOORPLAN_MIN_ZOOM,
              currentZoom +
                (event.deltaY < 0 ? FLOORPLAN_ZOOM_STEP : -FLOORPLAN_ZOOM_STEP),
            ),
          );

          setFloorplanPan((currentPan) =>
            clampFloorplanPan(nextZoom, currentPan),
          );

          return Number(nextZoom.toFixed(2));
        });
      },
      [clampFloorplanPan],
    );

    const handleFloorplanPointerDown = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (floorplanZoom <= FLOORPLAN_MIN_ZOOM) {
          return;
        }

        floorplanDragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startPanX: floorplanPan.x,
          startPanY: floorplanPan.y,
        };
        setIsFloorplanDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      [floorplanPan.x, floorplanPan.y, floorplanZoom],
    );

    const handleFloorplanPointerMove = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (
          floorplanDragRef.current.pointerId !== event.pointerId ||
          floorplanZoom <= FLOORPLAN_MIN_ZOOM
        ) {
          return;
        }

        const deltaX = event.clientX - floorplanDragRef.current.startX;
        const deltaY = event.clientY - floorplanDragRef.current.startY;

        setFloorplanPan(
          clampFloorplanPan(floorplanZoom, {
            x: floorplanDragRef.current.startPanX + deltaX,
            y: floorplanDragRef.current.startPanY + deltaY,
          }),
        );
      },
      [clampFloorplanPan, floorplanZoom],
    );

    const handleFloorplanPointerUp = useCallback(
      (event: ReactPointerEvent<HTMLDivElement>) => {
        if (floorplanDragRef.current.pointerId !== event.pointerId) {
          return;
        }

        floorplanDragRef.current.pointerId = null;
        setIsFloorplanDragging(false);

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      },
      [],
    );

    return (
      <div
        ref={ref}
        className="h-full w-full overflow-hidden rounded-2xl lg:rounded-l-2xl lg:rounded-r-none bg-[#f6f1e8]"
      >
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="relative grid h-full min-h-0 grid-rows-[auto_1fr] lg:grid-cols-[36%_64%] lg:grid-rows-1 xl:grid-cols-[32%_68%] [@media(min-width:1280px)_and_(max-width:1899px)]:grid-cols-[30%_70%] min-[1700px]:xl:grid-cols-[36%_64%]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.55),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(171,95,104,0.08),transparent_24%)]" />

          <motion.div
            variants={fadeRight}
            className="relative flex min-h-0 flex-col overflow-hidden bg-[#ab5f68] px-3 py-4 text-white sm:px-4 sm:py-5 md:px-5 md:py-6 lg:h-full lg:justify-between lg:px-7 lg:py-8 xl:px-6 xl:py-7 [@media(min-width:1280px)_and_(max-width:1899px)]:px-5 [@media(min-width:1280px)_and_(max-width:1899px)]:py-6 min-[1700px]:xl:px-8 min-[1700px]:xl:py-10"
          >
            <div className="absolute inset-0 opacity-20">
              <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl sm:h-52 sm:w-52 lg:h-72 lg:w-72" />
              <div className="absolute right-0 top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl sm:top-12 sm:h-36 sm:w-36 lg:top-16 lg:h-48 lg:w-48" />
            </div>

            <div className="absolute inset-x-0 bottom-0 h-px bg-white/15 lg:inset-y-0 lg:right-0 lg:left-auto lg:h-auto lg:w-px" />

            <div className="relative z-10 min-h-0">
              <motion.div
                variants={fadeUp}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[8px] uppercase tracking-[0.18em] text-white/80 backdrop-blur-sm sm:gap-2 sm:px-2.5 sm:py-1.5 sm:text-[9px] md:text-[10px] md:tracking-[0.22em] lg:px-3 lg:tracking-[0.28em] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[8px] [@media(min-width:1280px)_and_(max-width:1899px)]:tracking-[0.2em]"
              >
                <Home className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Unit Plan
              </motion.div>

              <motion.div variants={fadeUp} className="mt-3 sm:mt-4 md:mt-5 lg:mt-6 [@media(min-width:1280px)_and_(max-width:1899px)]:mt-4">
                <p className="text-[1.55rem] font-semibold leading-none tracking-[-0.05em] sm:text-[1.8rem] md:text-[2.05rem] lg:text-[2.5rem] xl:text-[2rem] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[1.65rem] min-[1700px]:xl:text-4xl">
                  {series}
                </p>
                <p className="mt-2 max-w-full text-[11px] leading-4 text-white/75 sm:max-w-[340px] sm:text-[12px] sm:leading-5 md:max-w-[420px] md:text-[13px] lg:max-w-[220px] lg:text-sm lg:leading-6 [@media(min-width:1280px)_and_(max-width:1899px)]:max-w-[190px] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[12px] [@media(min-width:1280px)_and_(max-width:1899px)]:leading-5">
                  {description}
                </p>
              </motion.div>

              <motion.div
                variants={infoCard}
                className="mt-4 flex flex-col gap-4 sm:mt-5 sm:gap-5 md:mt-6 md:gap-5 lg:mt-8 lg:gap-8 [@media(min-width:1280px)_and_(max-width:1899px)]:mt-6 [@media(min-width:1280px)_and_(max-width:1899px)]:gap-6"
              >
                <div className="rounded-2xl p-0 backdrop-blur-sm">
                  <div className="flex items-start gap-2 sm:gap-2.5 md:gap-3">
                    <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/80 sm:h-4 sm:w-4" />
                    <div className="min-w-0">
                      <p className="text-[8px] uppercase tracking-[0.16em] text-white/60 sm:text-[9px] sm:tracking-[0.2em] md:text-[10px] md:tracking-[0.24em] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[8px] [@media(min-width:1280px)_and_(max-width:1899px)]:tracking-[0.2em]">
                        Tower Series
                      </p>

                      <div className="mt-1.5 grid grid-cols-1 gap-0.5 sm:mt-2 md:grid-cols-2 md:gap-3 lg:grid-cols-1 lg:gap-0 [@media(min-width:1280px)_and_(max-width:1899px)]:mt-1.5">
                        <p className="text-[1rem] font-medium leading-tight sm:text-[1.2rem] md:text-[1.25rem] lg:text-[1.6rem] xl:text-[1.45rem] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[1.18rem] min-[1700px]:xl:text-2xl">
                          {towerA}
                        </p>
                        {towerB ? (
                          <p className="text-[1rem] font-medium leading-tight sm:text-[1.2rem] md:text-[1.25rem] lg:text-[1.6rem] xl:text-[1.45rem] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[1.18rem] min-[1700px]:xl:text-2xl">
                            {towerB}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-1 lg:gap-8 [@media(min-width:1280px)_and_(max-width:1899px)]:gap-6">
                  <div className="rounded-2xl p-0 backdrop-blur-sm">
                    <div className="flex items-start gap-2 sm:gap-2.5 md:gap-3">
                      <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/80 sm:h-4 sm:w-4" />
                      <div className="min-w-0">
                        <p className="text-[8px] uppercase tracking-[0.16em] text-white/60 sm:text-[9px] sm:tracking-[0.2em] md:text-[10px] md:tracking-[0.24em] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[8px] [@media(min-width:1280px)_and_(max-width:1899px)]:tracking-[0.2em]">
                          Configuration
                        </p>
                        <p className="mt-1.5 text-[1.15rem] font-semibold leading-tight sm:mt-2 sm:text-[1.4rem] md:text-[1.55rem] lg:text-[2rem] xl:text-[2rem] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[1.55rem] min-[1700px]:xl:text-3xl">
                          {bhk}
                        </p>
                        <p className="mt-0.5 text-[12px] text-white/85 sm:mt-1 sm:text-[13px] md:text-[14px] lg:text-base xl:text-[15px] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[13px] min-[1700px]:xl:text-lg">
                          {facing}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl p-0">
                    <div className="flex items-start gap-2 sm:gap-2.5 md:gap-3">
                      <Ruler className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/80 sm:h-4 sm:w-4" />
                      <div className="min-w-0">
                        <p className="text-[8px] uppercase tracking-[0.16em] text-white/60 sm:text-[9px] sm:tracking-[0.2em] md:text-[10px] md:tracking-[0.24em] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[8px] [@media(min-width:1280px)_and_(max-width:1899px)]:tracking-[0.2em]">
                          {areaLabel}
                        </p>
                        <p className="mt-1.5 text-[1.15rem] font-semibold leading-tight sm:mt-2 sm:text-[1.4rem] md:text-[1.55rem] lg:text-[2rem] xl:text-[2rem] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[1.55rem] min-[1700px]:xl:text-3xl">
                          {areaValue}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div
              variants={fadeUp}
              className="relative z-10 mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-[8px] uppercase tracking-[0.16em] text-white/70 sm:mt-5 sm:pt-4 sm:text-[9px] sm:tracking-[0.2em] md:text-[10px] md:tracking-[0.24em] lg:mt-3 lg:border-t-0 lg:pt-0 lg:tracking-[0.28em] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[8px] [@media(min-width:1280px)_and_(max-width:1899px)]:tracking-[0.2em]"
            >
              <span>Veranza</span>
              <span className="text-right">Floor Series</span>
            </motion.div>
          </motion.div>

          <div className="relative flex min-h-0 items-center justify-center px-2 py-3 sm:px-3 sm:py-4 md:px-4 md:py-5 lg:h-full lg:px-6 lg:py-6 xl:px-8 xl:py-8 [@media(min-width:1280px)_and_(max-width:1899px)]:px-6 [@media(min-width:1280px)_and_(max-width:1899px)]:py-6">
            <div className="absolute inset-0">
              <motion.div
                variants={fadeUp}
                className="absolute left-[8%] top-[10%] h-16 w-16 rounded-full bg-[#d9c9bd]/35 blur-3xl sm:h-20 sm:w-20 md:h-24 md:w-24 lg:h-28 lg:w-28"
              />
              <motion.div
                variants={fadeUp}
                className="absolute bottom-[10%] right-[10%] h-20 w-20 rounded-full bg-[#ab5f68]/10 blur-3xl sm:h-24 sm:w-24 md:h-28 md:w-28 lg:h-36 lg:w-36"
              />
            </div>

            <motion.div
              variants={imageReveal}
              className="relative z-10 flex h-full w-full min-h-0 items-center justify-center"
            >
              <motion.div
                ref={floorplanFrameRef}
                onWheel={handleFloorplanWheel}
                onDoubleClick={resetFloorplanZoom}
                onPointerDown={handleFloorplanPointerDown}
                onPointerMove={handleFloorplanPointerMove}
                onPointerUp={handleFloorplanPointerUp}
                onPointerCancel={handleFloorplanPointerUp}
                whileHover={
                  floorplanZoom <= FLOORPLAN_MIN_ZOOM
                    ? { scale: 1.015, y: -4 }
                    : undefined
                }
                transition={{ duration: 0.3 }}
                className={`relative h-[240px] w-[92%] overflow-hidden sm:h-[300px] sm:w-[90%] md:h-[380px] md:w-[88%] lg:h-[80%] lg:w-[84%] xl:h-[74%] xl:w-[88%] [@media(min-width:1280px)_and_(max-width:1899px)]:h-[70%] [@media(min-width:1280px)_and_(max-width:1899px)]:w-[90%] min-[1700px]:xl:h-[82%] min-[1700px]:xl:w-[82%] ${
                  floorplanZoom > FLOORPLAN_MIN_ZOOM
                    ? isFloorplanDragging
                      ? "cursor-grabbing"
                      : "cursor-grab"
                    : "cursor-zoom-in"
                }`}
                style={{
                  touchAction:
                    floorplanZoom > FLOORPLAN_MIN_ZOOM ? "none" : "pan-y",
                }}
              >
                <motion.div
                  animate={{
                    scale: floorplanZoom,
                    x: floorplanPan.x,
                    y: floorplanPan.y,
                  }}
                  transition={
                    isFloorplanDragging
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 240, damping: 28 }
                  }
                  style={{ transformOrigin: floorplanTransformOrigin }}
                  className="absolute inset-0"
                >
                  <Image
                    src={image2D}
                    alt={`${series} 2D unit floor plan`}
                    fill
                    priority
                    className="pointer-events-none object-contain drop-shadow-[0_18px_35px_rgba(0,0,0,0.10)]"
                  />
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }
);

UnitPlanLeftPage.displayName = "UnitPlanLeftPage";

export default UnitPlanLeftPage;
