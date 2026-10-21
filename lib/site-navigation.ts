export type SiteNavHref =
  | "/"
  | "/project-overview"
  | "/area-map"
  | "/amenities"
  | "/master-plan"
  | "/exterior-walkthrough"
  | "/interior-kitchen-foyer";

export type SiteNavItem = {
  href: SiteNavHref;
  label: string;
  matches?: string[];
};

export const siteNavItems: SiteNavItem[] = [
  { href: "/", label: "Home" },
  { href: "/project-overview", label: "Overview" },
  { href: "/area-map", label: "Location" },
  { href: "/amenities", label: "Amenities" },
  { href: "/master-plan", label: "Master Plan" },
  {
    href: "/exterior-walkthrough",
    label: "Walkthrough",
    matches: [
      "/exterios-walkthrough",
      "/exterior-tour",
      "/exterior-walkthrough",
    ],
  },
  {
    href: "/interior-kitchen-foyer",
    label: "Interior Tour",
    matches: ["/walkthrough", "/interior-kitchen-foyer"],
  },
] as const;

export function isSiteNavItemActive(pathname: string, item: SiteNavItem) {
  if (item.href === "/") {
    return pathname === "/";
  }

  if (item.matches?.includes(pathname)) {
    return true;
  }

  return pathname === item.href;
}

export function isExteriorWalkthroughPath(pathname: string) {
  return (
    pathname === "/exterios-walkthrough" ||
    pathname === "/exterior-tour" ||
    pathname === "/exterior-walkthrough"
  );
}

export function isAnyWalkthroughPath(pathname: string) {
  return (
    pathname === "/walkthrough" ||
    pathname === "/interior-kitchen-foyer" ||
    isExteriorWalkthroughPath(pathname)
  );
}
