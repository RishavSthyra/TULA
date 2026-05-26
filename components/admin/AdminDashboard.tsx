"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import {
  BarChart3,
  Building2,
  CircleDot,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Search,
  TowerControl,
  UserCircle2,
  Users,
} from "lucide-react";
import { Bar, Doughnut } from "react-chartjs-2";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type FormEvent,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { AdminUserSummary } from "@/lib/admin-users";
import { useCursorGlow } from "@/lib/useCursorGlow";
import { cn } from "@/lib/utils";
import type {
  InventoryAdminRow,
  InventoryStatus,
  TowerType,
} from "@/types/inventory";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  Tooltip,
);

type AdminDashboardProps = {
  initialInventory: InventoryAdminRow[];
  initialUsers: AdminUserSummary[];
};

type InventorySummary = {
  total: number;
  available: number;
  reserved: number;
  sold: number;
};

type AdminView = "inventory" | "admins";

const statusOptions: InventoryStatus[] = ["Available", "Reserved", "Sold"];
const towerFilters: Array<"All" | TowerType> = ["All", "Tower A", "Tower B"];

const statusTheme: Record<
  InventoryStatus,
  {
    solid: string;
    pill: string;
  }
> = {
  Available: {
    solid: "rgba(52, 211, 153, 0.92)",
    pill: "border-emerald-400/18 bg-emerald-400/10 text-emerald-200",
  },
  Reserved: {
    solid: "rgba(251, 191, 36, 0.92)",
    pill: "border-amber-400/18 bg-amber-400/10 text-amber-200",
  },
  Sold: {
    solid: "rgba(251, 113, 133, 0.92)",
    pill: "border-rose-400/18 bg-rose-400/10 text-rose-200",
  },
};

const cursorGlowDefaults: CSSProperties = {
  ["--glow-x" as string]: "50%",
  ["--glow-y" as string]: "50%",
  ["--glow-opacity" as string]: "0",
} as CSSProperties;

const doughnutOptions: ChartOptions<"doughnut"> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "74%",
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        boxWidth: 10,
        boxHeight: 10,
        color: "rgba(255,255,255,0.76)",
        font: {
          family: "var(--font-open)",
        },
        padding: 18,
        usePointStyle: true,
        pointStyle: "circle",
      },
    },
    tooltip: {
      backgroundColor: "rgba(10,11,15,0.96)",
      borderColor: "rgba(255,255,255,0.08)",
      borderWidth: 1,
      bodyColor: "rgba(255,255,255,0.88)",
      titleColor: "rgba(255,255,255,0.96)",
      displayColors: true,
    },
  },
};

const compactDoughnutOptions: ChartOptions<"doughnut"> = {
  ...doughnutOptions,
  plugins: {
    ...doughnutOptions.plugins,
    legend: {
      display: false,
    },
  },
};

const barOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: "index",
    intersect: false,
  },
  plugins: {
    legend: {
      position: "top",
      align: "start",
      labels: {
        color: "rgba(255,255,255,0.76)",
        font: {
          family: "var(--font-open)",
        },
        padding: 16,
        usePointStyle: true,
        pointStyle: "circle",
      },
    },
    tooltip: {
      backgroundColor: "rgba(10,11,15,0.96)",
      borderColor: "rgba(255,255,255,0.08)",
      borderWidth: 1,
      bodyColor: "rgba(255,255,255,0.88)",
      titleColor: "rgba(255,255,255,0.96)",
    },
  },
  scales: {
    x: {
      stacked: true,
      grid: {
        display: false,
      },
      ticks: {
        color: "rgba(255,255,255,0.44)",
        font: {
          family: "var(--font-open)",
        },
      },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      border: {
        display: false,
      },
      grid: {
        color: "rgba(255,255,255,0.08)",
      },
      ticks: {
        color: "rgba(255,255,255,0.44)",
        precision: 0,
        stepSize: 1,
        font: {
          family: "var(--font-open)",
        },
      },
    },
  },
};

function summarizeInventory(units: InventoryAdminRow[]): InventorySummary {
  return {
    total: units.length,
    available: units.filter((unit) => unit.status === "Available").length,
    reserved: units.filter((unit) => unit.status === "Reserved").length,
    sold: units.filter((unit) => unit.status === "Sold").length,
  };
}

function getShare(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function parseFloorValue(value: string) {
  if (value.toUpperCase() === "G") return 0;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatFloorLabel(value: string) {
  return value.toUpperCase() === "G" ? "Ground" : `Floor ${value}`;
}

export default function AdminDashboard({
  initialInventory,
  initialUsers,
}: AdminDashboardProps) {
  const router = useRouter();
  const glowRootRef = useRef<HTMLDivElement | null>(null);
  const [inventory, setInventory] = useState(initialInventory);
  const [users, setUsers] = useState(initialUsers);
  const [activeView, setActiveView] = useState<AdminView>("inventory");
  const [selectedTower, setSelectedTower] = useState<"All" | TowerType>("All");
  const [searchValue, setSearchValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    displayName: "",
    username: "",
    password: "",
  });
  const [userMessage, setUserMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector("main");

    const previousHtmlHeight = html.style.height;
    const previousHtmlOverflowY = html.style.overflowY;
    const previousBodyHeight = body.style.height;
    const previousBodyMinHeight = body.style.minHeight;
    const previousBodyOverflowY = body.style.overflowY;
    const previousMainHeight = main instanceof HTMLElement ? main.style.height : "";
    const previousMainMinHeight =
      main instanceof HTMLElement ? main.style.minHeight : "";
    const previousMainOverflow =
      main instanceof HTMLElement ? main.style.overflow : "";

    html.style.height = "auto";
    html.style.overflowY = "auto";
    body.style.height = "auto";
    body.style.minHeight = "100%";
    body.style.overflowY = "auto";

    if (main instanceof HTMLElement) {
      main.style.height = "auto";
      main.style.minHeight = "auto";
      main.style.overflow = "visible";
    }

    return () => {
      html.style.height = previousHtmlHeight;
      html.style.overflowY = previousHtmlOverflowY;
      body.style.height = previousBodyHeight;
      body.style.minHeight = previousBodyMinHeight;
      body.style.overflowY = previousBodyOverflowY;

      if (main instanceof HTMLElement) {
        main.style.height = previousMainHeight;
        main.style.minHeight = previousMainMinHeight;
        main.style.overflow = previousMainOverflow;
      }
    };
  }, []);

  useCursorGlow(glowRootRef, { radius: 200 });

  const filteredInventory = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return inventory.filter((unit) => {
      const matchesTower =
        selectedTower === "All" || unit.tower === selectedTower;

      if (!matchesTower) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        unit.flatNumber,
        unit.tower,
        unit.floor,
        unit.bhk,
        unit.facing,
        unit.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [inventory, searchValue, selectedTower]);

  const activeSummary = useMemo(
    () => summarizeInventory(filteredInventory),
    [filteredInventory],
  );

  const floorChart = useMemo(() => {
    const floors = Array.from(
      new Set(filteredInventory.map((unit) => unit.floor)),
    ).sort((left, right) => parseFloorValue(left) - parseFloorValue(right));

    return {
      labels: floors.map(formatFloorLabel),
      datasets: statusOptions.map((status) => ({
        label: status,
        data: floors.map(
          (floor) =>
            filteredInventory.filter(
              (unit) => unit.floor === floor && unit.status === status,
            ).length,
        ),
        backgroundColor: statusTheme[status].solid,
        borderRadius: 10,
        borderSkipped: false,
        maxBarThickness: 18,
      })),
    };
  }, [filteredInventory]);

  const availabilityChart = useMemo(
    () => ({
      labels: statusOptions,
      datasets: [
        {
          data: statusOptions.map((status) =>
            status === "Available"
              ? activeSummary.available
              : status === "Reserved"
                ? activeSummary.reserved
                : activeSummary.sold,
          ),
          backgroundColor: statusOptions.map(
            (status) => statusTheme[status].solid,
          ),
          borderColor: "rgba(8,9,12,0.88)",
          borderWidth: 4,
          hoverOffset: 8,
        },
      ],
    }),
    [activeSummary],
  );

  const towerBreakdown = useMemo(
    () =>
      towerFilters.slice(1).map((tower) => {
        const units = inventory.filter((unit) => unit.tower === tower);
        return {
          tower,
          summary: summarizeInventory(units),
        };
      }),
    [inventory],
  );

  const occupancyRate = activeSummary.total
    ? Math.round(
        ((activeSummary.reserved + activeSummary.sold) / activeSummary.total) *
          100,
      )
    : 0;
  const floorChartWidth = Math.max(560, floorChart.labels.length * 32);

  const scopeLabel =
    selectedTower === "All"
      ? "All towers in scope"
      : `${selectedTower} in scope`;
  const activeAdminCount = users.filter((user) => user.isActive).length;

  const handleUserFormChange = (
    field: "displayName" | "username" | "password",
    value: string,
  ) => {
    setUserForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleStatusChange = async (id: string, status: InventoryStatus) => {
    const previousInventory = inventory;

    setError(null);
    setSavingId(id);
    setInventory((current) =>
      current.map((unit) => (unit.id === id ? { ...unit, status } : unit)),
    );

    try {
      const response = await fetch(`/api/admin/inventory/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "Unable to update status.");
      }
    } catch (updateError) {
      const message =
        updateError instanceof Error
          ? updateError.message
          : "Unable to update inventory status.";
      setError(message);
      setInventory(previousInventory);
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUserMessage(null);
    setIsCreatingUser(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userForm),
      });

      const result = (await response.json()) as {
        message?: string;
        user?: AdminUserSummary;
      };

      if (!response.ok || !result.user) {
        throw new Error(result.message || "Unable to create admin user.");
      }

      setUsers((current) => [result.user!, ...current]);
      setUserForm({
        displayName: "",
        username: "",
        password: "",
      });
      setUserMessage({
        type: "success",
        text: result.message || "Admin user created.",
      });
    } catch (createError) {
      setUserMessage({
        type: "error",
        text:
          createError instanceof Error
            ? createError.message
            : "Unable to create admin user.",
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    startTransition(() => {
      router.push("/admin/login");
      router.refresh();
    });
  };

  return (
    <div
      ref={glowRootRef}
      className="custom-scrollbar relative h-dvh min-h-dvh overflow-y-auto overflow-x-hidden bg-[#08090c] text-white overscroll-contain [-webkit-overflow-scrolling:touch]"
    >
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-140px] top-[-110px] h-[360px] w-[360px] rounded-full bg-[#c9a96b]/12 blur-3xl" />
        <div className="absolute right-[-90px] top-[8%] h-[340px] w-[340px] rounded-full bg-[#b08d57]/10 blur-3xl" />
        <div className="absolute bottom-[-130px] left-[42%] h-[320px] w-[320px] rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative grid min-h-full grid-cols-1 gap-4 xl:grid-cols-[clamp(15rem,14vw,18rem)_minmax(0,1fr)] xl:items-start">
        <aside className="w-full shrink-0 xl:self-start">
          <GlowPanel className="relative flex flex-col border border-white/10 bg-[#0b0c10]/94 px-5 py-5 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl xl:rounded-l-none xl:rounded-r-[34px] xl:border-l-0 sm:px-6 sm:py-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(214,188,136,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_38%,rgba(255,255,255,0.02))]" />

            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-[#d6bc88]/30 bg-[#d6bc88]/10 p-3 text-[#ecd7ae]">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-[#d6bc88]">
                    Veranza Admin
                  </p>
                  <p className="mt-1 text-sm text-white/54">
                    Live inventory workspace
                  </p>
                </div>
              </div>

              <div className="mt-7">
                <h1 className="font-[var(--font-sora)] text-[1.7rem] font-semibold tracking-[-0.05em] text-white">
                  {activeView === "inventory"
                    ? "Inventory control with a cleaner workspace."
                    : "Admin access stays private and controlled."}
                </h1>
                <p className="mt-3 text-[14px] leading-7 text-white/56">
                  {activeView === "inventory"
                    ? "Use the inventory view for tower filters, charts, and live status updates."
                    : "Use the admin access view to create the next login without exposing a public signup page."}
                </p>
              </div>

              <div className="mt-6 space-y-3">
                <RailTab
                  icon={<LayoutDashboard className="h-4 w-4" />}
                  title="Inventory"
                  isActive={activeView === "inventory"}
                  onClick={() => setActiveView("inventory")}
                />
                <RailTab
                  icon={<Users className="h-4 w-4" />}
                  title="Admin Access"
                  isActive={activeView === "admins"}
                  onClick={() => setActiveView("admins")}
                />
              </div>

              {/* <div className="mt-6 space-y-3">
                <RailStrip
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Protected Session"
                  description="Route guard and admin cookie are active."
                />
                <RailStrip
                  icon={<Sparkles className="h-4 w-4" />}
                  title="Live Sync"
                  description="Status edits update the master plan feed."
                />
              </div> */}

              {activeView === "inventory" ? (
                <GlowSurface className="mt-6 rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.26em] text-white/40">
                          Tower Mix
                        </p>
                        <p className="mt-1 text-sm text-white/60">
                          Clean read across both towers
                        </p>
                      </div>
                      <div className="rounded-full border border-[#d6bc88]/20 bg-[#d6bc88]/10 p-2 text-[#ecd7ae]">
                        <Building2 className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {towerBreakdown.map(({ tower, summary: towerSummary }) => (
                        <div
                          key={tower}
                          className="rounded-[20px] border border-white/8 bg-black/10 px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-white">
                              {tower}
                            </p>
                            <p className="text-xs text-white/42">
                              {towerSummary.total} units
                            </p>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <MiniPill label="A" value={towerSummary.available} />
                            <MiniPill label="R" value={towerSummary.reserved} />
                            <MiniPill label="S" value={towerSummary.sold} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlowSurface>
              ) : (
                <GlowSurface className="mt-6 rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.26em] text-white/40">
                          Admin Summary
                        </p>
                        <p className="mt-1 text-sm text-white/60">
                          Active and total admin accounts
                        </p>
                      </div>
                      <div className="rounded-full border border-[#d6bc88]/20 bg-[#d6bc88]/10 p-2 text-[#ecd7ae]">
                        <Users className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-[20px] border border-white/8 bg-black/10 px-3 py-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/36">
                          Active
                        </p>
                        <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
                          {activeAdminCount}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-white/8 bg-black/10 px-3 py-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/36">
                          Total
                        </p>
                        <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
                          {users.length}
                        </p>
                      </div>
                    </div>
                  </div>
                </GlowSurface>
              )}

              <GlowSurface className="group mt-4 rounded-full border border-white/10 bg-white/[0.03] p-2">
                <div className="relative z-10 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#d6bc88]/30 bg-[#d6bc88]/10 text-[#ecd7ae]">
                    <UserCircle2 className="h-6 w-6" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      Admin Session
                    </p>
                    <p className="truncate text-xs text-white/42">
                      Hover for logout
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isPending}
                    className="inline-flex h-10 max-w-[140px] items-center justify-center gap-2 overflow-hidden rounded-full border border-[#d6bc88]/30 bg-[#d6bc88]/12 px-4 text-sm font-medium text-[#f1ddb6] opacity-100 transition-all duration-300 xl:max-w-0 xl:px-0 xl:opacity-0 xl:group-hover:max-w-[140px] xl:group-hover:px-4 xl:group-hover:opacity-100 xl:group-focus-within:max-w-[140px] xl:group-focus-within:px-4 xl:group-focus-within:opacity-100 disabled:opacity-60"
                  >
                    <LogOut className="h-4 w-4" />
                    {isPending ? "Signing out" : "Logout"}
                  </button>
                </div>
              </GlowSurface>
            </div>
          </GlowPanel>
        </aside>

        <main className="w-full min-w-0 px-3 py-3 sm:px-5 sm:py-4 lg:px-6">
          <div className="space-y-4 pb-6">
            <GlowPanel
              className={cn(
                "relative overflow-hidden rounded-[32px] border border-white/10 bg-[#0a0b0f]/92 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl",
                activeView === "inventory" ? "" : "hidden",
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,188,136,0.1),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_34%)]" />

              <div className="relative z-10 flex flex-col gap-5 px-5 py-5 sm:px-6 sm:py-6 lg:px-8">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/34">
                      Visibility Desk
                    </p>
                    <h2 className="mt-3 font-[var(--font-sora)] text-[1.9rem] font-semibold tracking-[-0.05em] text-white">
                      Flat intelligence, cleaner workspace.
                    </h2>
                    <p className="mt-2 max-w-3xl text-[14px] leading-7 text-white/54">
                      The dashboard stays in the same visual system, but the
                      canvas is now focused on quick filtering, richer charts,
                      and faster inventory decisions.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <GlowSurface className="rounded-full border border-white/10 bg-white/[0.03]">
                      <label className="relative z-10 flex h-11 min-w-[220px] items-center gap-2 px-4">
                        <Search className="h-4 w-4 text-white/38" />
                        <input
                          value={searchValue}
                          onChange={(event) =>
                            setSearchValue(event.target.value)
                          }
                          placeholder="Search flat, floor, tower..."
                          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                        />
                      </label>
                    </GlowSurface>

                    <div className="flex flex-wrap gap-2">
                      {towerFilters.map((tower) => (
                        <FilterChip
                          key={tower}
                          isActive={selectedTower === tower}
                          onClick={() => setSelectedTower(tower)}
                        >
                          {tower}
                        </FilterChip>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <HeaderPill icon={<TowerControl className="h-3.5 w-3.5" />}>
                    {scopeLabel}
                  </HeaderPill>
                  <HeaderPill icon={<BarChart3 className="h-3.5 w-3.5" />}>
                    {activeSummary.total} flats matched
                  </HeaderPill>
                </div>
              </div>
            </GlowPanel>

            {error && activeView === "inventory" ? (
              <div className="rounded-[20px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <div
              className={cn(
                "grid gap-4 md:grid-cols-2 xl:grid-cols-4",
                activeView === "admins" ? "" : "hidden",
              )}
            >
              <MetricCard
                label="Active Admins"
                value={activeAdminCount}
                detail="Accounts currently allowed to log in"
              />
              <MetricCard
                label="Total Admins"
                value={users.length}
                detail="All admin logins in the database"
              />
              <MetricCard
                label="Recent Logins"
                value={users.filter((user) => Boolean(user.lastLoginAt)).length}
                detail="Accounts used at least once"
              />
              <MetricCard
                label="Pending First Login"
                value={users.filter((user) => !user.lastLoginAt).length}
                detail="New logins not yet used"
              />
            </div>

            <GlowPanel
              className={cn(
                "rounded-[32px] border border-white/10 bg-[#0a0b0f]/92 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-6",
                activeView === "admins" ? "" : "hidden",
              )}
            >
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/34">
                    Admin Access
                  </p>
                  <h3 className="mt-3 font-[var(--font-sora)] text-[1.45rem] font-semibold tracking-[-0.04em] text-white">
                    Add the next admin login from this private tab.
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-white/52">
                    This screen stays inside the protected dashboard. There is
                    no public signup page.
                  </p>

                  <form
                    onSubmit={handleCreateUser}
                    className="mt-5 grid gap-3 md:grid-cols-3"
                  >
                    <GlowSurface className="rounded-[20px] border border-white/10 bg-white/[0.03]">
                      <input
                        value={userForm.displayName}
                        onChange={(event) =>
                          handleUserFormChange("displayName", event.target.value)
                        }
                        placeholder="Display name"
                        className="relative z-10 h-12 w-full bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/30"
                      />
                    </GlowSurface>

                    <GlowSurface className="rounded-[20px] border border-white/10 bg-white/[0.03]">
                      <input
                        value={userForm.username}
                        onChange={(event) =>
                          handleUserFormChange("username", event.target.value)
                        }
                        placeholder="Username"
                        className="relative z-10 h-12 w-full bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/30"
                      />
                    </GlowSurface>

                    <GlowSurface className="rounded-[20px] border border-white/10 bg-white/[0.03]">
                      <input
                        type="password"
                        value={userForm.password}
                        onChange={(event) =>
                          handleUserFormChange("password", event.target.value)
                        }
                        placeholder="Password"
                        className="relative z-10 h-12 w-full bg-transparent px-4 text-sm text-white outline-none placeholder:text-white/30"
                      />
                    </GlowSurface>

                    <div className="md:col-span-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs leading-6 text-white/42">
                        Usernames are lowercase login IDs. Passwords must be at
                        least 8 characters.
                      </p>
                      <button
                        type="submit"
                        disabled={isCreatingUser}
                        className="inline-flex h-12 items-center justify-center rounded-full border border-[#d6bc88]/30 bg-[#d6bc88]/12 px-5 text-sm font-medium text-[#f1ddb6] transition hover:bg-[#d6bc88]/16 disabled:opacity-60"
                      >
                        {isCreatingUser ? "Creating user..." : "Create admin login"}
                      </button>
                    </div>
                  </form>

                  {userMessage ? (
                    <div
                      className={cn(
                        "mt-4 rounded-[18px] border px-4 py-3 text-sm",
                        userMessage.type === "success"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                          : "border-rose-500/20 bg-rose-500/10 text-rose-200",
                      )}
                    >
                      {userMessage.text}
                    </div>
                  ) : null}
                </div>

                <GlowSurface className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.26em] text-white/34">
                          Current Admins
                        </p>
                        <p className="mt-1 text-sm text-white/56">
                          {users.length} login{users.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="rounded-full border border-[#d6bc88]/20 bg-[#d6bc88]/10 p-2 text-[#ecd7ae]">
                        <UserCircle2 className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="custom-scrollbar mt-4 max-h-[min(48dvh,520px)] space-y-3 overflow-y-auto pr-1">
                      {users.map((user) => (
                        <div
                          key={user.id}
                          className="rounded-[20px] border border-white/8 bg-black/10 px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">
                                {user.displayName || user.username}
                              </p>
                              <p className="mt-1 truncate text-xs text-white/42">
                                @{user.username}
                              </p>
                            </div>
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-200">
                              {user.isActive ? "Active" : "Disabled"}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-col gap-1 text-xs text-white/42">
                            <span>
                              Added {formatAdminDate(user.createdAt)}
                            </span>
                            <span>
                              Last login {formatAdminDate(user.lastLoginAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlowSurface>
              </div>
            </GlowPanel>

            <div
              className={cn(
                "grid gap-4 md:grid-cols-2 2xl:grid-cols-4",
                activeView === "inventory" ? "" : "hidden",
              )}
            >
              <MetricCard
                label="Units In Scope"
                value={activeSummary.total}
                detail={`${scopeLabel}`}
              />
              <MetricCard
                label="Available"
                value={activeSummary.available}
                detail={`${getShare(activeSummary.available, activeSummary.total)} ready to sell`}
              />
              <MetricCard
                label="Reserved"
                value={activeSummary.reserved}
                detail={`${getShare(activeSummary.reserved, activeSummary.total)} held in pipeline`}
              />
              <MetricCard
                label="Sold"
                value={activeSummary.sold}
                detail={`${getShare(activeSummary.sold, activeSummary.total)} fully closed`}
              />
            </div>

            <div
              className={cn(
                "grid gap-4 xl:grid-cols-[minmax(0,0.5fr)_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]",
                activeView === "inventory" ? "" : "hidden",
              )}
            >
              <GlowPanel className="rounded-[32px] border border-white/10 bg-[#0a0b0f]/92 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.4)] backdrop-blur-2xl sm:p-5 xl:p-6">
                <div className="hidden items-start justify-between gap-4 xl:flex">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.26em] text-white/34">
                      Status Split
                    </p>
                    <h3 className="mt-3 font-[var(--font-sora)] text-[1.3rem] font-semibold tracking-[-0.04em] text-white">
                      Availability mix
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-white/52">
                      Hover each segment to inspect the live share of available,
                      reserved, and sold flats.
                    </p>
                  </div>
                  <div className="rounded-full border border-[#d6bc88]/20 bg-[#d6bc88]/10 p-2.5 text-[#ecd7ae]">
                    <CircleDot className="h-4 w-4" />
                  </div>
                </div>

                {activeSummary.total ? (
                  <div className="relative mx-auto h-[280px] w-full max-w-[310px] sm:h-[320px] sm:max-w-[360px] xl:mt-6 xl:h-[280px] xl:max-w-[340px] 2xl:h-[260px] 2xl:max-w-full">
                    <div className="h-full xl:hidden">
                      <Doughnut
                        data={availabilityChart}
                        options={compactDoughnutOptions}
                      />
                    </div>
                    <div className="hidden h-full xl:block">
                      <Doughnut
                        data={availabilityChart}
                        options={doughnutOptions}
                      />
                    </div>
                    <div className="pointer-events-none absolute inset-0 hidden items-center justify-center xl:flex">
                      <div className="text-center">
                        <p className="text-[11px] uppercase tracking-[0.28em] text-white/34">
                          Occupied
                        </p>
                        <p className="mt-2 font-[var(--font-sora)] text-3xl font-semibold tracking-[-0.05em] text-white">
                          {occupancyRate}%
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyChartState message="No flats match the current filter." />
                )}
              </GlowPanel>

              <GlowPanel className="hidden rounded-[32px] border border-white/10 bg-[#0a0b0f]/92 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.4)] backdrop-blur-2xl sm:p-6 xl:block">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.26em] text-white/34">
                      Floor Trends
                    </p>
                    <h3 className="mt-3 font-[var(--font-sora)] text-[1.3rem] font-semibold tracking-[-0.04em] text-white">
                      Status by floor
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-white/52">
                      Stacked bars show where the active scope is still open,
                      reserved, or already closed.
                    </p>
                  </div>
                  <div className="rounded-full border border-[#d6bc88]/20 bg-[#d6bc88]/10 p-2.5 text-[#ecd7ae]">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                </div>

                {activeSummary.total ? (
                  <div className="custom-scrollbar mt-6 overflow-x-auto pb-2">
                    <div className="h-[280px]" style={{ width: `${floorChartWidth}px` }}>
                      <Bar data={floorChart} options={barOptions} />
                    </div>
                  </div>
                ) : (
                  <EmptyChartState message="Charts will appear when flats match the current filter." />
                )}
              </GlowPanel>
            </div>

            <GlowPanel
              className={cn(
                "relative overflow-visible rounded-[32px] border border-white/10 bg-[#0a0b0f]/92 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl",
                activeView === "inventory" ? "" : "hidden",
              )}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_28%)]" />

              <div className="relative z-10 border-b border-white/10 px-5 py-5 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.26em] text-white/34">
                      Flat Inventory
                    </p>
                    <h3 className="mt-2 font-[var(--font-sora)] text-[1.45rem] font-semibold tracking-[-0.04em] text-white">
                      Editable unit status table
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-white/52">
                      Only availability changes here. Flat metadata stays
                      untouched, so the public inventory remains stable.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusLegend status="Available" />
                    <StatusLegend status="Reserved" />
                    <StatusLegend status="Sold" />
                  </div>
                </div>
              </div>

              {filteredInventory.length ? (
                <div className="relative z-10 px-5 py-5 sm:px-6 sm:py-6 lg:px-8">
                  <GlowSurface className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.02]">
                    <div className="custom-scrollbar max-h-[min(66dvh,720px)] overflow-auto">
                      <table className="min-w-[880px] border-collapse text-sm lg:min-w-full">
                        <thead className="sticky top-0 z-10 bg-[#111317]/96 backdrop-blur-xl">
                          <tr className="border-b border-white/10">
                            <TableHead>Flat</TableHead>
                            <TableHead>Tower</TableHead>
                            <TableHead>Floor</TableHead>
                            <TableHead>BHK</TableHead>
                            <TableHead>Facing</TableHead>
                            <TableHead>Area</TableHead>
                            <TableHead>Status</TableHead>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInventory.map((unit) => (
                            <tr
                              key={unit.id}
                              className="border-b border-white/6 bg-transparent transition hover:bg-white/[0.025]"
                            >
                              <TableCell strong>
                                {(unit.flatNumber || "Unknown").toUpperCase()}
                              </TableCell>
                              <TableCell>{unit.tower}</TableCell>
                              <TableCell>{unit.floor}</TableCell>
                              <TableCell>{unit.bhk}</TableCell>
                              <TableCell>{unit.facing}</TableCell>
                              <TableCell>{unit.areaSqft} sqft</TableCell>
                              <td className="px-4 py-3 sm:px-5">
                                <div className="flex flex-wrap items-center gap-3">
                                  <StatusPill status={unit.status} />

                                  <GlowSurface className="rounded-[16px] border border-white/10 bg-white/[0.03]">
                                    <select
                                      value={unit.status}
                                      onChange={(event) =>
                                        handleStatusChange(
                                          unit.id,
                                          event.target.value as InventoryStatus,
                                        )
                                      }
                                      className="relative z-10 h-11 min-w-[140px] bg-transparent px-3.5 text-sm text-white outline-none"
                                    >
                                      {statusOptions.map((status) => (
                                        <option
                                          key={status}
                                          value={status}
                                          className="bg-[#111317] text-white"
                                        >
                                          {status}
                                        </option>
                                      ))}
                                    </select>
                                  </GlowSurface>

                                  {savingId === unit.id ? (
                                    <LoaderCircle className="h-4 w-4 animate-spin text-[#d6bc88]" />
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </GlowSurface>
                </div>
              ) : (
                <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-10">
                  <EmptyChartState message="No flats matched the current search and tower filter." />
                </div>
              )}
            </GlowPanel>
          </div>
        </main>
      </div>
    </div>
  );
}

function formatAdminDate(value: string | null) {
  if (!value) {
    return "not yet";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "unknown";
  }

  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function GlowPanel({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <GlowSurface className={cn("relative", className)} {...props}>
      {children}
    </GlowSurface>
  );
}

function GlowSurface({
  children,
  className,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-cursor-glow
      {...props}
      style={{ ...cursorGlowDefaults, ...style }}
      className={cn("relative", className)}
    >
      <GlowBorder />
      {children}
    </div>
  );
}

function GlowBorder() {
  return (
    <span
      aria-hidden="true"
      className="glow-border-layer pointer-events-none absolute inset-0 rounded-[inherit] opacity-[var(--glow-opacity)] transition-opacity duration-150"
      style={{
        padding: "1px",
        background:
          "radial-gradient(170px circle at var(--glow-x) var(--glow-y), rgba(214,188,136,0.95), rgba(214,188,136,0.42) 28%, rgba(214,188,136,0.12) 50%, transparent 70%)",
        WebkitMask:
          "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
      }}
    />
  );
}

function RailTab({
  icon,
  title,
  isActive,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-[22px] border p-4 text-left transition",
        isActive
          ? "border-[#d6bc88]/30 bg-[#d6bc88]/10 shadow-[0_18px_36px_rgba(0,0,0,0.16)]"
          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "rounded-full p-2",
            isActive
              ? "border border-[#d6bc88]/20 bg-[#d6bc88]/12 text-[#ecd7ae]"
              : "border border-white/10 bg-black/10 text-white/72",
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-white ">{title}</p>
        </div>
      </div>
    </button>
  );
}

function MiniPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/72">
      <span className="text-white/38">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </span>
  );
}

function HeaderPill({
  children,
  icon,
}: {
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs text-white/68">
      <span className="text-[#ecd7ae]">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <GlowSurface className="rounded-[28px] border border-white/10 bg-[#0a0b0f]/92 p-5 shadow-[0_25px_70px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
      <div className="relative z-10">
        <p className="text-[11px] uppercase tracking-[0.28em] text-white/36">
          {label}
        </p>
        <p className="mt-4 font-[var(--font-sora)] text-4xl font-semibold tracking-[-0.05em] text-white">
          {value}
        </p>
        <p className="mt-3 text-sm leading-6 text-white/50">{detail}</p>
      </div>
    </GlowSurface>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-[26px] border border-dashed border-white/10 bg-white/[0.02] px-6 text-center text-sm leading-6 text-white/44">
      {message}
    </div>
  );
}

function FilterChip({
  children,
  isActive,
  onClick,
}: {
  children: ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-cursor-glow
      style={cursorGlowDefaults}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-full border px-4 py-2.5 text-[12px] font-medium transition",
        isActive
          ? "border-[#d6bc88]/38 bg-[#d6bc88]/12 text-[#f1ddb6]"
          : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.05]",
      )}
    >
      <GlowBorder />
      <span className="relative z-10">{children}</span>
    </button>
  );
}

function StatusLegend({ status }: { status: InventoryStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        statusTheme[status].pill,
      )}
    >
      <CircleDot className="h-3 w-3" />
      {status}
    </span>
  );
}

function StatusPill({ status }: { status: InventoryStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        statusTheme[status].pill,
      )}
    >
      <CircleDot className="h-3 w-3" />
      {status}
    </span>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-4 text-left text-[11px] font-medium uppercase tracking-[0.24em] text-white/42 sm:px-5">
      {children}
    </th>
  );
}

function TableCell({
  children,
  strong = false,
}: {
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-4 text-[14px] text-white/58 sm:px-5",
        strong && "font-medium tracking-[0.04em] text-white",
      )}
    >
      {children}
    </td>
  );
}
