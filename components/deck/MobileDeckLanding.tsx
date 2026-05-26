"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BedDouble,
  Building2,
  Compass,
  Expand,
  Home,
  Landmark,
  Sparkles,
  Trees,
  ArrowUpRight,
} from "lucide-react";
import CoverHero from "@/assets/Aparttments_Clouds.png";
import { unitPlans } from "@/data/unitPlans";
import { preloadMasterPlanFrameWindow } from "@/lib/masterPlanFramePreload";
import { useSignedAssetUrls } from "@/src/lib/use-signed-assets";

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

const softCardClass =
  "rounded-[22px] border border-white/50 bg-[linear-gradient(180deg,rgba(255,251,244,0.96),rgba(247,238,225,0.92))] shadow-[0_12px_28px_rgba(90,62,24,0.07)]";
const MOBILE_OVERVIEW_IMAGE_URL = "images/bros_1.webp";
const CREDAI_LOGO_URL = "images/credai.png";
const EMPTY_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const statCards = [
  {
    title: "6+ Acres",
    subtitle: "Open green canvas",
    icon: <Trees className="h-4 w-4" />,
  },
  {
    title: "2 Towers",
    subtitle: "Iconic skyline presence",
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    title: "G + 36",
    subtitle: "Elevated urban scale",
    icon: <Landmark className="h-4 w-4" />,
  },
  {
    title: "444 Homes",
    subtitle: "Exclusive inventory",
    icon: <Home className="h-4 w-4" />,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const titleContainer = {
  hidden: {},
  show: {
    transition: {
      delayChildren: 0.14,
      staggerChildren: 0.022,
    },
  },
};

const titleLetter = {
  hidden: {
    opacity: 0,
    y: "0.8em",
  },
  show: {
    opacity: 1,
    y: "0em",
    transition: {
      duration: 0.58,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

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

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[#dbcdb7] bg-[#fffaf2]/95 px-3 py-2 shadow-xl">
      <p className="text-[10px] uppercase tracking-[0.24em] text-[#8f7f6d]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[#221d19]">
        {payload[0].value}
      </p>
    </div>
  );
}

export default function MobileDeckLanding() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<ChartKey>("lifestyle");
  const chartData = useMemo(() => chartViews[activeView], [activeView]);
  const heroTitleLines = ["The New Standard", "of Refined Urban", "Living"];
  const featuredPlans = useMemo(() => unitPlans, []);
  const signedAssetUrls = useSignedAssetUrls([
    CREDAI_LOGO_URL,
    MOBILE_OVERVIEW_IMAGE_URL,
  ]);

  useEffect(() => {
    router.prefetch("/master-plan");
    const cleanupFrameWarmup = preloadMasterPlanFrameWindow(1, {
      batchSize: 3,
      count: 10,
      decode: false,
      initialHighPriorityCount: 3,
    });

    return () => {
      cleanupFrameWarmup();
    };
  }, [router]);

  return (
    <div className="w-full px-1.5 pb-[max(env(safe-area-inset-bottom),5.5rem)] [touch-action:pan-y_pinch-zoom] sm:px-2.5 md:px-3 lg:mx-auto lg:max-w-[1180px] lg:px-4 xl:max-w-full xl:px-0">
      <article className="w-full overflow-hidden rounded-t-[34px] bg-[linear-gradient(180deg,#f8f2ea_0%,#f5ede1_26%,#f8f3ea_58%,#f6efe4_100%)] pt-20 shadow-[0_-8px_36px_rgba(95,62,22,0.08)] sm:rounded-t-[42px] sm:pt-24">
        {/* HERO */}
        <section className="relative flex flex-col items-center justify-center overflow-hidden rounded-t-[34px] px-3 pb-0 pt-5 sm:rounded-t-[42px] sm:px-4 sm:pt-7 md:px-5 lg:px-7">
          {/* <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,249,239,0.98),rgba(255,249,239,0.78)_34%,rgba(214,180,123,0.14)_68%,transparent_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(180deg,rgba(232,213,184,0)_0%,rgba(224,198,152,0.16)_100%)]" /> */}

          <div className="relative z-10 mx-auto flex flex-col items-center justify-center text-center sm:max-w-full md:max-w-full lg:max-w-[48rem]">
            <p className="text-[10px] uppercase tracking-[0.38em] text-[#7f6b58]">
              TRIFECTA VERANZA
            </p>

            <motion.h1
              variants={titleContainer}
              initial="hidden"
              animate="show"
              className="mt-3 text-center font-medium leading-[0.9] tracking-[-0.05em] text-[#171411] font-montserrat text-[1.92rem] sm:text-[3.15rem] md:text-[3.45rem] lg:text-[3.55rem]"
            >
              {heroTitleLines.map((line) => (
                <div key={line} className="flex justify-center overflow-hidden">
                  {line.split("").map((char, index) => (
                    <motion.span
                      key={`${line}-${index}`}
                      variants={titleLetter}
                      className="inline-block pb-2"
                    >
                      {char === " " ? "\u00A0" : char}
                    </motion.span>
                  ))}
                </div>
              ))}
            </motion.h1>

            <div className="mx-auto mt-4 h-px w-24 bg-[linear-gradient(90deg,#b0895d,rgba(176,137,93,0.18))] lg:mx-0" />

            <p className="mx-auto mt-4 max-w-[20rem] text-[13px] leading-6 text-[#60574d] sm:max-w-[24rem] sm:text-[15px] sm:leading-7 lg:max-w-[28rem]">
              Timeless design, elevated lifestyle, and open green living.
            </p>
          </div>

          <div className="relative mt-3 w-full sm:mt-5 sm:h-full">
            <div className="pointer-events-none absolute inset-x-[2%] bottom-[6%] top-[16%] rounded-[82px] bg-[radial-gradient(circle_at_center,rgba(76,53,31,0.18),rgba(76,53,31,0)_72%)] blur-3xl" />
            <Image
              src={CoverHero}
              alt="Trifecta Veranza towers"
              fill
              priority
              className="object-contain object-bottom scale-[1.34] sm:scale-[1.38]"
            />
          </div>
        </section>

        {/* OVERVIEW */}
        <section className="">
          <div className={`${softCardClass} overflow-hidden`}>
            <div className="relative aspect-[1.18] w-full py-6 sm:aspect-[1.5] lg:aspect-[2.05]">
              <Image
                src={signedAssetUrls[MOBILE_OVERVIEW_IMAGE_URL] ?? EMPTY_IMAGE_DATA_URL}
                alt="Project overview"
                fill
                unoptimized
                className="object-[50%_60%]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,13,8,0.02),rgba(18,13,8,0.02)_35%,rgba(18,13,8,0.22)_100%)]" />
            </div>

            <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5 lg:px-6 lg:pb-6 lg:pt-5">
              <p className="text-[10px] uppercase tracking-[0.34em] text-[#7f6b58]">
                Project Overview
              </p>
              <h2 className="mt-2 text-[1.72rem] font-semibold leading-[0.95] tracking-[-0.05em] text-[#171411] sm:text-[2.4rem] lg:max-w-[42rem] lg:text-[2.85rem]">
                Open to sky,
                <br />
                rooted in green.
              </h2>
              <p className="mt-3 max-w-[32rem] text-[13px] leading-6 text-[#5f554c] sm:text-[15px] sm:leading-7 lg:max-w-[44rem]">
                A premium skyrise address shaped around openness, landscape,
                elevation, and a richer everyday living experience.
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:mt-4 sm:px-5 sm:gap-3 lg:grid-cols-4 lg:px-0">
            {statCards.map((item) => (
              <div key={item.title} className={`${softCardClass} p-3.5`}>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-[#eadfcd] bg-[#faf5ec] text-[#57483c]">
                  {item.icon}
                </div>
                <div className="text-[1.15rem] font-semibold leading-none tracking-[-0.04em] text-[#1d1814] sm:text-[1.5rem]">
                  {item.title}
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[#786c61] sm:text-[13px] sm:leading-6">
                  {item.subtitle}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CHART SECTION */}
        <section className="border-y border-[#e7dccb] px-4 py-5 sm:px-6 sm:py-7">
          <div className="max-w-[34rem]">
            <p className="text-[10px] uppercase tracking-[0.34em] text-[#8a7562]">
              Signature Performance
            </p>
            <h3 className="mt-2 text-[1.42rem] font-semibold leading-[1.06] tracking-[-0.04em] text-[#1d1814] sm:text-[1.9rem]">
              A sharper view of lifestyle, experience, and residence appeal.
            </h3>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ["lifestyle", "Lifestyle"],
                ["experience", "Experience"],
                ["residences", "Residences"],
              ] as [ChartKey, string][]
            ).map(([key, label]) => {
              const isActive = activeView === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveView(key)}
                  className={`rounded-full px-3.5 py-2 text-[10px] uppercase tracking-[0.2em] transition ${
                    isActive
                      ? "bg-[#1d1814] text-white shadow-lg"
                      : "border border-[#ddd1bf] bg-white/80 text-[#6f6256]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className={`${softCardClass} mt-4 p-3 sm:p-4`}>
            <div className="h-[12.75rem] w-full sm:h-[16rem]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="mobileOverviewFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#ab5f68"
                        stopOpacity={0.38}
                      />
                      <stop
                        offset="100%"
                        stopColor="#ab5f68"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="#e7ddcf"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#7d6d5d", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#7d6d5d", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#ab5f68"
                    strokeWidth={2.4}
                    fill="url(#mobileOverviewFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* ALL PLANS */}
        <section className="px-4 py-5 sm:px-6 sm:py-7">
          <div className="max-w-[34rem]">
            <p className="text-[10px] uppercase tracking-[0.34em] text-[#8a7562]">
              Residences
            </p>
            <h3 className="mt-2 text-[1.5rem] font-semibold leading-[1.04] tracking-[-0.04em] text-[#1d1814] sm:text-[2rem]">
              Signature home formats, clearly presented for mobile.
            </h3>
            <p className="mt-3 text-[13px] leading-6 text-[#6b6056] sm:text-[15px] sm:leading-7">
              All available plans are shown below in a cleaner compact layout.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            {featuredPlans.map((plan) => (
              <section
                key={plan.id}
                className="overflow-hidden rounded-[24px] border border-[#dcc8bb] bg-[linear-gradient(180deg,rgba(177,106,116,0.97)_0%,rgba(177,106,116,0.97)_33%,rgba(255,250,244,0.99)_33%,rgba(248,242,234,0.99)_100%)] shadow-[0_16px_36px_rgba(90,62,24,0.08)]"
              >
                <div className="px-4 pb-4 pt-4 text-white sm:px-5 sm:pt-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-white/88">
                    <Home className="h-3.5 w-3.5" />
                    Unit Plan
                  </div>

                  <h4 className="mt-3 text-[1.65rem] font-semibold leading-none tracking-[-0.05em] sm:text-[2.1rem]">
                    {plan.series}
                  </h4>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-[16px] border border-white/14 bg-white/8 p-3">
                      <div className="flex items-center gap-2">
                        <BedDouble className="h-4 w-4 text-white/72" />
                        <span className="text-[12px] font-medium">
                          {plan.bhk}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-[16px] border border-white/14 bg-white/8 p-3">
                      <div className="flex items-center gap-2">
                        <Compass className="h-4 w-4 text-white/72" />
                        <span className="text-[12px] font-medium">
                          {plan.facing}
                        </span>
                      </div>
                    </div>

                    <div className="col-span-2 rounded-[16px] border border-white/14 bg-white/8 p-3">
                      <div className="flex items-center gap-2">
                        <Expand className="h-4 w-4 text-white/72" />
                        <span className="text-[12px] font-medium">
                          {plan.areaLabel}: {plan.areaValue}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2.5 border-t border-[#ecdccf] px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                  <div className={`${softCardClass} overflow-hidden p-2.5`}>
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-[#8f7f6d]">
                        2D Layout
                      </p>
                      <div className="rounded-full border border-[#e4d8c9] bg-[#faf4eb] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#7b6a5c]">
                        Plan View
                      </div>
                    </div>
                    <div className="relative aspect-[1.06] w-full">
                      <Image
                        src={plan.image2D}
                        alt={`${plan.series} 2D plan`}
                        fill
                        sizes="(max-width: 780px) 100vw, 720px"
                        className="object-contain"
                      />
                    </div>
                  </div>

                  <div className={`${softCardClass} p-3`}>
                    <div className="mb-2.5 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#a86a72]" />
                      <p className="text-[10px] uppercase tracking-[0.24em] text-[#8f7f6d]">
                        Key Dimensions
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {plan.specs.map((spec, specIndex) => (
                        <div
                          key={`${plan.id}-${spec.name}-${specIndex}`}
                          className="rounded-[14px] border border-[#e3d6c5] bg-white/80 px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h5 className="text-[12px] font-semibold leading-5 text-[#221d19]">
                              {spec.name}
                            </h5>
                            <div className="shrink-0 rounded-full border border-[#e4d8c9] bg-[#faf4eb] px-2.5 py-1 text-[10px] font-medium text-[#5f5448]">
                              {spec.size}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="flex justify-center px-4 pb-2 pt-6 sm:px-6 sm:pt-8">
          <button
            type="button"
            onClick={() => {
              router.prefetch("/master-plan");
              router.push("/master-plan");
            }}
            className="flex w-full max-w-[24rem] items-center justify-center gap-2 rounded-full border border-[#d6c4ab] bg-[linear-gradient(180deg,rgba(255,252,246,0.96),rgba(244,235,222,0.94))] px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-[#4d4033] shadow-[0_18px_40px_rgba(108,76,36,0.12)] transition hover:border-[#c9b18d] hover:bg-[linear-gradient(180deg,rgba(255,252,246,1),rgba(242,231,214,0.98))] sm:max-w-[26rem] sm:text-[12px]"
          >
            Open Masterplan
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </section>

        <motion.div
          variants={fadeUp}
          className="mt-6 flex w-full max-w-4xl flex-wrap items-center justify-center gap-8 sm:mt-8 sm:gap-12"
        >
          <div className="flex items-center justify-center">
            <Image
              src={signedAssetUrls[CREDAI_LOGO_URL] ?? EMPTY_IMAGE_DATA_URL}
              alt="CREDAI logo"
              width={180}
              height={64}
              unoptimized
              className="h-14 w-auto object-contain sm:h-16"
            />
          </div>

          <div className="flex items-center justify-center">
            <Image
              src="/logos/IGBC LOGO 2.png"
              alt="IGBC Member logo"
              width={190}
              height={86}
              className="h-16 w-auto object-contain sm:h-20"
            />
          </div>

          <div className="flex items-center justify-center">
            <Image
              src="/logos/cropped-Registered-Trifecta-Logo.png"
              alt="Registered Trifecta logo"
              width={180}
              height={86}
              className="h-16 w-auto object-contain sm:h-20"
            />
          </div>
        </motion.div>

        {/* END */}
        <section className="relative border-t border-white/35 px-4 py-10 text-center sm:px-6 sm:py-14">
          <div className="mx-auto max-w-[260px]">
            <div className="relative mx-auto aspect-[5.2/2.1] w-full">
              <Image
                src="/Logo_Trifect_Veranza.png"
                alt="Trifecta Veranza"
                fill
                priority
                sizes="260px"
                className="object-contain"
              />
            </div>
          </div>

          <p className="mt-5 text-[10px] uppercase tracking-[0.38em] text-[#8a7562]">
            Off Sarjapur Road
          </p>

          <h3 className="mt-3 text-[1.45rem] font-light tracking-[-0.04em] text-[#4f433d] sm:text-[2rem]">
            Open to sky, rooted in green.
          </h3>

          {/* FIXED BLOCK */}
          <motion.div variants={fadeUp} className="mt-8 px-4 sm:mt-10 sm:px-6">
            <div className="mx-auto max-w-6xl border-t border-[#c8b18f]/28 pt-4 text-center">
              <p className="text-[9px] font-medium uppercase tracking-[0.24em] text-[#7c6458] sm:text-[10px]">
                RERA No: PRM/KA/RERA/1251/308/PR/210126/008418
              </p>

              <p className="mx-auto mt-3 max-w-5xl text-[9px] leading-[1.6] text-[#8b7a70] sm:text-[10px] sm:leading-[1.7]">
                Disclaimer : Trifecta Projects Private Limited is developing
                this project in a phased manner. The details provided herein are
                indicative of the proposed development and are intended for
                informational purposes only. Open & green areas comprise
                amenities, landscapes and clubhouse zones. All visuals are
                artistic conceptualisations intended for illustrative purposes
                and should not be considered exact representations of the final
                product. For detailed information, please get in touch with our
                sales representative. Terms & conditions apply, E&amp;OE. V1
                Feb&apos;26
              </p>
            </div>
          </motion.div>
        </section>
      </article>
    </div>
  );
}
