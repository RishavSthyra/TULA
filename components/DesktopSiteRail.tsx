"use client";

import Image from "next/image";
import { Cormorant_Garamond } from "next/font/google";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Footprints,
  Heart,
  House,
  Leaf,
  MapPin,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import {
  type SiteNavHref,
  isSiteNavItemActive,
  siteNavItems,
} from "@/lib/site-navigation";
import { cn } from "@/lib/utils";

const railSerif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
});

const railItemIcons: Record<SiteNavHref, typeof House> = {
  "/": House,
  "/project-overview": Building2,
  "/area-map": MapPin,
  "/amenities": Heart,
  "/master-plan": UserRound,
  "/exterior-walkthrough": Footprints,
} as const;

type DesktopSiteRailProps = {
  className?: string;
};

export default function DesktopSiteRail({
  className,
}: DesktopSiteRailProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside
      className={cn(
        "desktop-site-rail relative hidden flex-col items-center overflow-visible rounded-t-[2.5rem] rounded-bl-[2.15rem] rounded-br-[5rem] border border-[#dcc58d]/80 bg-[linear-gradient(180deg,rgba(251,249,241,0.988)_0%,rgba(244,240,229,0.965)_100%)] text-[#2e4932] shadow-[0_18px_46px_rgba(18,32,20,0.16),inset_0_1px_0_rgba(255,255,255,0.98)] xl:flex 2xl:rounded-br-[5.45rem]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-t-[2.5rem] rounded-bl-[2.15rem] rounded-br-[5rem] 2xl:rounded-br-[5.45rem]">
        <div className="absolute inset-[6px] rounded-t-[2rem] rounded-bl-[1.8rem] rounded-br-[4.35rem] border border-[#efdfba]/60 2xl:rounded-br-[4.8rem]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent_0%,rgba(204,178,121,0.08)_100%)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <Image 
        src={'https://cdn.sthyra.com/TULA/Images/Whisper_of_Tree_Logo_Gold%202.avif'}
        className="h-auto w-auto"
        width={100}
        height={100}
        alt="logo siderail tula whisper of trees"
        >
        </Image>
        {/* <div className="desktop-site-rail__brand-mark flex items-center justify-center rounded-full border border-[#d4c193]/75 bg-[#f9f5e8]/94 shadow-[0_8px_18px_rgba(34,52,36,0.06)]">
          <Leaf
            className="desktop-site-rail__brand-icon text-[#54724f]"
            strokeWidth={1.6}
          />
        </div>
        <p
          className={`${railSerif.className} desktop-site-rail__title leading-none text-[#2a4732]`}
        >
          TULA
        </p> */}
      </div>

      <div className="desktop-site-rail__nav relative z-10 flex flex-col items-center">
        {siteNavItems.map((item) => {
          const Icon = railItemIcons[item.href];
          const isActive = isSiteNavItemActive(pathname, item);

          return (
            <div key={item.label} className="group relative flex items-center">
              <button
                type="button"
                onClick={() => router.push(item.href)}
                className={
                  isActive
                    ? "desktop-site-rail__nav-button desktop-site-rail__nav-button--active flex items-center justify-center rounded-full border border-[#7b9365]/70 bg-[radial-gradient(circle_at_32%_25%,#69895e_0%,#45603c_58%,#2a452d_100%)] text-white shadow-[0_10px_22px_rgba(33,57,36,0.2),inset_0_1px_0_rgba(255,255,255,0.18)]"
                    : "desktop-site-rail__nav-button desktop-site-rail__nav-button--inactive flex items-center justify-center rounded-full text-[#4f6850] transition hover:bg-[#f5efdf] hover:text-[#24402c]"
                }
                aria-label={item.label}
              >
                <Icon
                  className={
                    isActive
                      ? "desktop-site-rail__nav-icon desktop-site-rail__nav-icon--active"
                      : "desktop-site-rail__nav-icon desktop-site-rail__nav-icon--inactive"
                  }
                  strokeWidth={isActive ? 2 : 1.8}
                />
              </button>
              <div className="pointer-events-none absolute left-[calc(100%+0.8rem)] top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#dfcfaa]/75 bg-[linear-gradient(180deg,rgba(251,249,241,0.97),rgba(241,237,226,0.94))] px-3 py-1.5 text-[0.66rem] font-semibold tracking-[0.12em] text-[#4a5d47] opacity-0 shadow-[0_14px_28px_rgba(30,46,30,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] transition duration-200 group-hover:translate-y-[-50%] group-hover:opacity-100">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="desktop-site-rail__divider relative z-10 h-px bg-[#d7c89d]" />

      <div className="desktop-site-rail__filter group relative z-10 flex flex-col items-center">
        <button
          type="button"
          onClick={() => router.push("/master-plan")}
          className="flex flex-col items-center"
        >
          <span className="desktop-site-rail__filter-button flex items-center justify-center rounded-full border border-white/85 bg-[linear-gradient(180deg,#ffffff_0%,#f2eee4_100%)] text-[#5f6d59] shadow-[0_10px_22px_rgba(28,42,28,0.11)]">
            <SlidersHorizontal
              className="desktop-site-rail__filter-icon"
              strokeWidth={1.8}
            />
          </span>
          <span className="desktop-site-rail__filter-label font-medium tracking-[0.08em] text-[#6e7868]">
            Filters
          </span>
        </button>
        <div className="desktop-site-rail__filter-tooltip pointer-events-none absolute left-[calc(100%+0.8rem)] z-20 -translate-y-1/2 whitespace-nowrap rounded-full border border-[#dfcfaa]/75 bg-[linear-gradient(180deg,rgba(251,249,241,0.97),rgba(241,237,226,0.94))] px-3 py-1.5 text-[0.66rem] font-semibold tracking-[0.12em] text-[#4a5d47] opacity-0 shadow-[0_14px_28px_rgba(30,46,30,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] transition duration-200 group-hover:opacity-100">
          Open Filters
        </div>
      </div>

      <div className="desktop-site-rail__leaf relative z-10 flex w-full items-end justify-center">
        <Image
          src="/LEAF UI.png"
          alt=""
          width={260}
          height={520}
          sizes="96px"
          className="h-full w-auto max-w-none object-contain object-bottom opacity-[0.8]"
        />
      </div>
    </aside>
  );
}
