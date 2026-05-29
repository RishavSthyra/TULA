"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import QuoteRequestController from "@/components/QuoteRequestController";
import DesktopSiteRail from "@/components/DesktopSiteRail";

function shouldUseMergedChrome() {
  if (typeof window === "undefined") {
    return false;
  }

  const compactViewport = window.matchMedia("(max-width: 1279px)").matches;
  const primaryPointerCoarse = window.matchMedia("(pointer: coarse)").matches;
  const finePointerAvailable =
    window.matchMedia("(pointer: fine)").matches ||
    window.matchMedia("(any-pointer: fine)").matches;

  return (
    compactViewport || (primaryPointerCoarse && !finePointerAvailable)
  );
}

function shouldUseCompactDesktopCtas(pathname: string) {
  if (typeof window === "undefined" || pathname !== "/master-plan") {
    return false;
  }

  return (
    window.matchMedia("(min-width: 1280px) and (max-width: 1699px)").matches &&
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(pointer: coarse)").matches &&
    !window.matchMedia("(any-pointer: coarse)").matches
  );
}

export default function RouteChrome() {
  const pathname = usePathname();
  const [isMasterPlanFlatOpen, setIsMasterPlanFlatOpen] = useState(false);
  const [shouldMergeDockIntoCta, setShouldMergeDockIntoCta] = useState(
    shouldUseMergedChrome,
  );
  const [shouldAddCompactDesktopCtasToDock, setShouldAddCompactDesktopCtasToDock] =
    useState(() => shouldUseCompactDesktopCtas(pathname));
  const isAdminRoute = pathname.startsWith("/admin");
  const isHomeRoute = pathname === "/";
  const isExteriorWalkthroughRoute =
    pathname === "/exterios-walkthrough" ||
    pathname === "/exterior-tour" ||
    pathname === "/exterior-walkthrough";
  const isInteriorWalkthroughRoute = pathname === "/walkthrough";
  const isAmenitiesRoute = pathname === "/amenities";
  const isAreaMapRoute = pathname === "/area-map";
  const isImmersiveRoute =
    pathname === "/tower-hover-test" ||
    pathname === "/project-layout";
  const isDocklessRoute = pathname === "/test";
  const shouldMergeLinksForRoute =
    shouldMergeDockIntoCta ||
    isExteriorWalkthroughRoute ||
    isInteriorWalkthroughRoute;
  const shouldHideDock =
    isHomeRoute ||
    isDocklessRoute ||
    shouldMergeLinksForRoute ||
    (pathname === "/master-plan" &&
      isMasterPlanFlatOpen &&
      !shouldAddCompactDesktopCtasToDock);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const compactViewportMedia = window.matchMedia("(max-width: 1279px)");
    const touchViewportMedia = window.matchMedia("(pointer: coarse)");
    const finePointerMedia = window.matchMedia("(pointer: fine)");
    const anyFinePointerMedia = window.matchMedia("(any-pointer: fine)");
    const syncTouchViewport = () => {
      setShouldMergeDockIntoCta(
        compactViewportMedia.matches ||
          (touchViewportMedia.matches &&
            !finePointerMedia.matches &&
            !anyFinePointerMedia.matches),
      );
    };

    syncTouchViewport();
    compactViewportMedia.addEventListener("change", syncTouchViewport);
    touchViewportMedia.addEventListener("change", syncTouchViewport);
    finePointerMedia.addEventListener("change", syncTouchViewport);
    anyFinePointerMedia.addEventListener("change", syncTouchViewport);

    return () => {
      compactViewportMedia.removeEventListener("change", syncTouchViewport);
      touchViewportMedia.removeEventListener("change", syncTouchViewport);
      finePointerMedia.removeEventListener("change", syncTouchViewport);
      anyFinePointerMedia.removeEventListener("change", syncTouchViewport);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const compactDesktopMedia = window.matchMedia(
      "(min-width: 1280px) and (max-width: 1699px)",
    );
    const finePointerMedia = window.matchMedia("(pointer: fine)");
    const coarsePointerMedia = window.matchMedia("(pointer: coarse)");
    const anyCoarsePointerMedia = window.matchMedia("(any-pointer: coarse)");

    const syncCompactDesktopCtas = () => {
      setShouldAddCompactDesktopCtasToDock(shouldUseCompactDesktopCtas(pathname));
    };

    syncCompactDesktopCtas();
    compactDesktopMedia.addEventListener("change", syncCompactDesktopCtas);
    finePointerMedia.addEventListener("change", syncCompactDesktopCtas);
    coarsePointerMedia.addEventListener("change", syncCompactDesktopCtas);
    anyCoarsePointerMedia.addEventListener("change", syncCompactDesktopCtas);

    return () => {
      compactDesktopMedia.removeEventListener("change", syncCompactDesktopCtas);
      finePointerMedia.removeEventListener("change", syncCompactDesktopCtas);
      coarsePointerMedia.removeEventListener("change", syncCompactDesktopCtas);
      anyCoarsePointerMedia.removeEventListener(
        "change",
        syncCompactDesktopCtas,
      );
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/master-plan" || typeof document === "undefined") {
      return;
    }

    const syncDockVisibility = () => {
      setIsMasterPlanFlatOpen(
        document.body.dataset.masterPlanFlatOpen === "true",
      );
    };

    syncDockVisibility();

    const observer = new MutationObserver(syncDockVisibility);
    observer.observe(document.body, {
      attributeFilter: ["data-master-plan-flat-open"],
      attributes: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [pathname]);

  if (isAdminRoute || isImmersiveRoute) {
    return null;
  }

  return (
    <>
      {!shouldHideDock ? (
        <DesktopSiteRail className="fixed left-6 top-1/2 z-50 -translate-y-1/2 2xl:left-7" />
      ) : null}

      <QuoteRequestController
        mergeRouteLinks={shouldMergeLinksForRoute}
        showCta={!isAmenitiesRoute && !isHomeRoute && !isAreaMapRoute}
      />
    </>
  );
}
