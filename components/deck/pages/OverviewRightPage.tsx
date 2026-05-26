"use client";

import React, {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Building2, Trees, Home, Landmark, Sparkles } from "lucide-react";

type Props = {
  number?: number;
};

type ChartPoint = {
  name: string;
  value: number;
};

type ChartKey = "lifestyle" | "experience" | "residences";

type TooltipProps = {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { name: string; value: number };
  }>;
  label?: string;
};

const statCards = [
  {
    title: "6+ Acres",
    subtitle: "Open & green living canvas",
    icon: <Trees className="h-4 w-4" />,
  },
  {
    title: "2 Towers",
    subtitle: "Iconic skyline presence",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    title: "G + 36",
    subtitle: "Elevated urban living",
    icon: <Landmark className="h-4 w-4" />,
  },
  {
    title: "444 Homes",
    subtitle: "Private, exclusive inventory",
    icon: <Home className="h-4 w-4" />,
  },
];

const chartViews: Record<ChartKey, ChartPoint[]> = {
  lifestyle: [
    { name: "Arrival", value: 68 },
    { name: "Landscape", value: 74 },
    { name: "Amenities", value: 81 },
    { name: "Recreation", value: 86 },
    { name: "Wellness", value: 91 },
    { name: "Sky Living", value: 96 },
    { name: "Privacy", value: 93 },
    { name: "Overall", value: 98 },
  ],
  experience: [
    { name: "Masterplan", value: 62 },
    { name: "Clubhouse", value: 70 },
    { name: "Pool Deck", value: 79 },
    { name: "Green Zones", value: 88 },
    { name: "Sports", value: 85 },
    { name: "Family Spaces", value: 92 },
    { name: "Views", value: 95 },
    { name: "Signature", value: 97 },
  ],
  residences: [
    { name: "2 BHK", value: 58 },
    { name: "3 BHK", value: 67 },
    { name: "East Facing", value: 76 },
    { name: "West Facing", value: 83 },
    { name: "North Facing", value: 80 },
    { name: "Large Balconies", value: 91 },
    { name: "Layout Flow", value: 94 },
    { name: "Liveability", value: 96 },
  ],
};

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const statReveal = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
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

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-2xl border border-[#d9d2c7] bg-[#faf7f1]/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-neutral-900">
        {payload[0].value}
      </p>
    </div>
  );
}

function useChartVisibilityRefresh<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [chartKey, setChartKey] = useState(0);
  const [ready, setReady] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let raf1 = 0;
    let raf2 = 0;
    let timeout = 0;

    const refresh = () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timeout);

      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setChartKey((prev) => prev + 1);
          setReady(true);
        });
      });

      timeout = window.setTimeout(() => {
        setChartKey((prev) => prev + 1);
        setReady(true);
      }, 220);
    };

    refresh();

    const resizeObserver = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        refresh();
      }
    });

    resizeObserver.observe(element);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          refresh();
        }
      },
      {
        threshold: 0.2,
      }
    );

    intersectionObserver.observe(element);

    const onWindowResize = () => refresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("resize", onWindowResize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timeout);
    };
  }, []);

  return { ref, chartKey, ready };
}

const OverviewRightPage = forwardRef<HTMLDivElement, Props>(
  ({ number: _number }, ref) => {
    void _number;
    const [activeView, setActiveView] = useState<ChartKey>("lifestyle");
    const chartData = useMemo(() => chartViews[activeView], [activeView]);
    const { ref: chartWrapRef, chartKey, ready } =
      useChartVisibilityRefresh<HTMLDivElement>();

    return (
      <div
        ref={ref}
        className="h-full w-full overflow-y-auto rounded-[24px] bg-[#f6f1e8] md:overflow-hidden md:rounded-2xl"
      >
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="relative flex min-h-full flex-col px-4 py-4 sm:px-5 sm:py-5 md:h-full md:min-h-0 md:px-6 md:py-6 xl:px-5 xl:py-5 [@media(min-width:1280px)_and_(max-width:1899px)]:px-4 [@media(min-width:1280px)_and_(max-width:1899px)]:py-4 min-[1700px]:xl:px-7 min-[1700px]:xl:py-7"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.75),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(216,201,178,0.18),transparent_28%)]" />

          <div className="relative z-10 grid min-h-full grid-rows-[auto_auto_auto_auto_auto] gap-3 sm:gap-4 md:h-full md:min-h-0 md:grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] xl:gap-3.5 [@media(min-width:1280px)_and_(max-width:1899px)]:gap-2.5">
            <motion.div
              variants={fadeUp}
              className="flex items-start justify-between gap-3 sm:gap-4"
            >
              <div className="max-w-full md:max-w-[80%] xl:max-w-[82%]">
                <p className="mb-1.5 text-[9px] uppercase tracking-[0.28em] text-neutral-500 sm:mb-2 sm:text-[10px] sm:tracking-[0.34em] xl:tracking-[0.38em] [@media(min-width:1280px)_and_(max-width:1899px)]:mb-1 [@media(min-width:1280px)_and_(max-width:1899px)]:text-[8px] [@media(min-width:1280px)_and_(max-width:1899px)]:tracking-[0.32em]">
                  Project Overview
                </p>

                <h2 className="max-w-[560px] text-[1.55rem] font-semibold leading-[0.98] tracking-[-0.04em] text-neutral-900 sm:text-[2rem] md:text-[2.15rem] xl:max-w-[620px] xl:text-[2.12rem] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[1.72rem] min-[1700px]:xl:text-[2.45rem]">
                  Open to sky,
                  <br />
                  rooted in green.
                </h2>

                <p className="mt-2 max-w-[520px] text-[11px] leading-5 text-neutral-600 sm:mt-3 sm:text-[13px] sm:leading-6 md:text-sm xl:max-w-[560px] xl:text-sm [@media(min-width:1280px)_and_(max-width:1899px)]:mt-2 [@media(min-width:1280px)_and_(max-width:1899px)]:text-[11px] [@media(min-width:1280px)_and_(max-width:1899px)]:leading-5">
                  A premium skyrise address designed around openness,
                  landscape, elevation, and a richer everyday living
                  experience.
                </p>
              </div>

              <motion.div
                whileHover={{ y: -2 }}
                className="hidden rounded-full border border-[#d8cdbf] bg-white/70 px-3 py-1.5 text-[9px] uppercase tracking-[0.22em] text-neutral-600 shadow-sm backdrop-blur-sm md:flex xl:px-4 xl:py-2 xl:text-[10px] xl:tracking-[0.28em] [@media(min-width:1280px)_and_(max-width:1899px)]:px-3 [@media(min-width:1280px)_and_(max-width:1899px)]:py-1.5 [@media(min-width:1280px)_and_(max-width:1899px)]:text-[8px]"
              >
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                Veranza
              </motion.div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-3 xl:gap-4 [@media(min-width:1280px)_and_(max-width:1899px)]:grid-cols-1 [@media(min-width:1280px)_and_(max-width:1899px)]:gap-2"
            >
              {statCards.map((item) => (
                <motion.div
                  key={item.title}
                  variants={statReveal}
                  whileHover={{ y: -4, scale: 1.01 }}
                  transition={{ duration: 0.25 }}
                  className="group rounded-[1rem] border border-[#ded6ca] bg-white/70 p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] backdrop-blur-sm sm:rounded-[1.2rem] sm:p-3.5 xl:rounded-[1.4rem] xl:p-4 [@media(min-width:1280px)_and_(max-width:1899px)]:flex [@media(min-width:1280px)_and_(max-width:1899px)]:items-center [@media(min-width:1280px)_and_(max-width:1899px)]:gap-3 [@media(min-width:1280px)_and_(max-width:1899px)]:rounded-[0.95rem] [@media(min-width:1280px)_and_(max-width:1899px)]:px-3 [@media(min-width:1280px)_and_(max-width:1899px)]:py-2"
                >
                  <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full border border-[#e6dfd4] bg-[#f8f4ee] text-neutral-700 transition-transform duration-300 group-hover:scale-110 sm:mb-4 sm:h-8 sm:w-8 xl:mb-5 xl:h-9 xl:w-9 [@media(min-width:1280px)_and_(max-width:1899px)]:mb-0 [@media(min-width:1280px)_and_(max-width:1899px)]:h-8 [@media(min-width:1280px)_and_(max-width:1899px)]:w-8 [@media(min-width:1280px)_and_(max-width:1899px)]:shrink-0">
                    {item.icon}
                  </div>

                  <div className="min-w-0">
                    <div className="text-[1.05rem] font-semibold leading-none tracking-[-0.05em] text-neutral-900 sm:text-[1.35rem] md:text-[1.45rem] xl:text-[1.75rem] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[1.05rem]">
                      {item.title}
                    </div>

                    <p className="mt-1 max-w-[180px] text-[10px] leading-4 text-neutral-500 sm:mt-2 sm:text-[11px] sm:leading-5 xl:text-xs [@media(min-width:1280px)_and_(max-width:1899px)]:mt-0.5 [@media(min-width:1280px)_and_(max-width:1899px)]:max-w-none [@media(min-width:1280px)_and_(max-width:1899px)]:text-[10px] [@media(min-width:1280px)_and_(max-width:1899px)]:leading-4">
                      {item.subtitle}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="flex flex-wrap items-center gap-2"
            >
              {(
                [
                  ["lifestyle", "Lifestyle curve"],
                  ["experience", "Experience index"],
                  ["residences", "Residence appeal"],
                ] as [ChartKey, string][]
              ).map(([key, label]) => {
                const isActive = activeView === key;

                return (
                  <motion.button
                    key={key}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    whileHover={{ y: -1 }}
                    onClick={() => setActiveView(key)}
                    className={`rounded-full px-3 py-1.5 text-[9px] uppercase tracking-[0.18em] transition-all duration-300 sm:px-4 sm:py-2 sm:text-[10px] sm:tracking-[0.22em] xl:px-4 xl:py-2 xl:text-[10px] xl:tracking-[0.26em] [@media(min-width:1280px)_and_(max-width:1899px)]:px-3 [@media(min-width:1280px)_and_(max-width:1899px)]:py-1.5 [@media(min-width:1280px)_and_(max-width:1899px)]:text-[8px] [@media(min-width:1280px)_and_(max-width:1899px)]:tracking-[0.2em] ${
                      isActive
                        ? "bg-neutral-900 text-white shadow-lg"
                        : "border border-[#ddd3c6] bg-white/70 text-neutral-600"
                    }`}
                  >
                    {label}
                  </motion.button>
                );
              })}
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="flex min-h-0 flex-col overflow-hidden"
            >
              <div className="mb-2 flex shrink-0 items-end justify-between gap-3 sm:gap-4 [@media(min-width:1280px)_and_(max-width:1899px)]:mb-1.5">
                <div className="min-w-0">
                  <p className="text-[9px] uppercase tracking-[0.22em] text-neutral-500 sm:text-[10px] sm:tracking-[0.26em] xl:tracking-[0.3em] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[8px]">
                    Signature Performance
                  </p>
                  <h3 className="mt-1 text-sm font-medium tracking-[-0.03em] text-neutral-900 sm:text-[15px] md:text-base xl:text-lg [@media(min-width:1280px)_and_(max-width:1899px)]:text-[13px]">
                    {activeView === "lifestyle" &&
                      "Landscape-led living score"}
                    {activeView === "experience" &&
                      "Holistic amenity experience"}
                    {activeView === "residences" &&
                      "Home configuration desirability"}
                  </h3>
                </div>

                <p className="hidden max-w-[220px] text-right text-[11px] leading-5 text-neutral-500 md:block xl:text-xs [@media(min-width:1280px)_and_(max-width:1899px)]:max-w-[170px] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[10px] [@media(min-width:1280px)_and_(max-width:1899px)]:leading-4">
                  Interactive visual layer for the overview spread.
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden rounded-[1.2rem] border border-[#ddd4c8] bg-white/75 p-2.5 shadow-[0_15px_45px_rgba(0,0,0,0.05)] backdrop-blur-sm sm:rounded-[1.5rem] sm:p-3.5 xl:h-[228px] xl:flex-none xl:rounded-[1.8rem] xl:p-4 [@media(min-width:1280px)_and_(max-width:1899px)]:h-[255px] [@media(min-width:1280px)_and_(max-width:1899px)]:rounded-[1.25rem] [@media(min-width:1280px)_and_(max-width:1899px)]:p-3 min-[1700px]:xl:h-auto min-[1700px]:xl:flex-1">
                <div
                  ref={chartWrapRef}
                  className="h-full w-full min-h-[220px] min-w-0 sm:min-h-[240px] md:min-h-[260px] xl:min-h-[180px] [@media(min-width:1280px)_and_(max-width:1899px)]:min-h-[220px] min-[1700px]:xl:min-h-0"
                >
                  {ready && (
                    <ResponsiveContainer
                      key={`${activeView}-${chartKey}`}
                      width="100%"
                      height="100%"
                    >
                      <AreaChart
                        data={chartData}
                        margin={{ top: 12, right: 4, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="overviewLineFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#5f6f52"
                              stopOpacity={0.38}
                            />
                            <stop
                              offset="55%"
                              stopColor="#8f9779"
                              stopOpacity={0.18}
                            />
                            <stop
                              offset="100%"
                              stopColor="#d8d3c7"
                              stopOpacity={0.02}
                            />
                          </linearGradient>
                        </defs>

                        <CartesianGrid
                          vertical={false}
                          stroke="#e8e0d5"
                          strokeDasharray="4 8"
                        />

                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: "#7a746d" }}
                          padding={{ left: 0, right: 0 }}
                          dy={8}
                          interval={0}
                        />

                        <YAxis hide domain={[50, 100]} />

                        <Tooltip
                          cursor={{
                            stroke: "#7d8668",
                            strokeWidth: 1.2,
                            strokeDasharray: "4 6",
                          }}
                          content={<CustomTooltip />}
                        />

                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#5f6f52"
                          strokeWidth={4}
                          fill="url(#overviewLineFill)"
                          isAnimationActive
                          animationDuration={1400}
                          animationEasing="ease-out"
                          dot={false}
                          activeDot={{
                            r: 5,
                            stroke: "#5f6f52",
                            strokeWidth: 2,
                            fill: "#f6f1e8",
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 [@media(min-width:1280px)_and_(max-width:1899px)]:gap-2.5"
            >
              <div>
                <p className="text-[9px] uppercase tracking-[0.22em] text-neutral-500 sm:text-[10px] sm:tracking-[0.26em] xl:tracking-[0.3em] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[8px]">
                  Residence Mix
                </p>
                <p className="mt-1.5 text-[12px] text-neutral-700 sm:mt-2 sm:text-sm [@media(min-width:1280px)_and_(max-width:1899px)]:mt-1 [@media(min-width:1280px)_and_(max-width:1899px)]:text-[11px]">
                  2 & 3 BHK expansive skyrise residences
                </p>
              </div>

              <div className="text-left md:text-right">
                <p className="text-[9px] uppercase tracking-[0.22em] text-neutral-500 sm:text-[10px] sm:tracking-[0.26em] xl:tracking-[0.3em] [@media(min-width:1280px)_and_(max-width:1899px)]:text-[8px]">
                  Positioning
                </p>
                <p className="mt-1.5 text-[12px] text-neutral-700 sm:mt-2 sm:text-sm [@media(min-width:1280px)_and_(max-width:1899px)]:mt-1 [@media(min-width:1280px)_and_(max-width:1899px)]:text-[11px]">
                  Designed for openness, elevation, and lifestyle depth
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }
);

OverviewRightPage.displayName = "OverviewRightPage";

export default OverviewRightPage;
