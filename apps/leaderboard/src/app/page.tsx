"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import HouseCard from "@/components/HouseCard";
import { useLeaderboardHouses } from "@/app/branding-context";
import { canonicalHouseName, getHouseConfigRecord, getHouseNames } from "@/lib/schoolHouses";

interface House {
  rank: number;
  name: string;
  virtue: string;
  description: string;
  points: number;
  color: string;
  bgColor: string;
  logo?: string | null;
  todayPoints?: number;
}

type StandingsResponse = {
  data?: Array<Record<string, unknown>>;
  warning?: string;
}

const houseVirtues: Record<string, { virtue: string; description: string; bgColor: string }> = {
  "House of Abū Bakr": {
    virtue: "Loyalty",
    description: "Rooted in honesty, unwavering in loyalty to faith and community.",
    bgColor: "#f6f1fb",
  },
  "House of ʿUmar": {
    virtue: "Moral Courage",
    description: "Living with fairness, speaking truth, and acting with courage.",
    bgColor: "#f2f3fb",
  },
  "House of ʿĀʾishah": {
    virtue: "Creativity",
    description: "Igniting creativity that inspires hearts and serves Allah.",
    bgColor: "#fdf1f1",
  },
  "House of Khadījah": {
    virtue: "Wisdom",
    description: "Guided by wisdom, leading with grace and strength.",
    bgColor: "#f1fbf6",
  },
};

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function getAcademicYearStart(referenceDate: Date): Date {
  const year = referenceDate.getMonth() >= 7 ? referenceDate.getFullYear() : referenceDate.getFullYear() - 1;
  return new Date(year, 7, 15);
}

function getAcademicWeek(): number {
  const now = new Date();
  const academicStart = getAcademicYearStart(now);
  const diffTime = now.getTime() - academicStart.getTime();
  const diffWeeks = Math.floor(diffTime / MS_PER_WEEK) + 1;
  return Math.max(1, diffWeeks);
}

function getAcademicWeekRange(week: number): { start: Date; end: Date } {
  const start = new Date(getAcademicYearStart(new Date()).getTime() + (week - 1) * MS_PER_WEEK);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start.getTime() + MS_PER_WEEK - 1);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatWeekRange(start: Date, end: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export default function Home() {
  const schoolHouses = useLeaderboardHouses();
  const houseConfig = useMemo(() => getHouseConfigRecord(schoolHouses), [schoolHouses]);
  const houseNames = useMemo(() => getHouseNames(schoolHouses), [schoolHouses]);
  const fallbackHouses = useMemo<House[]>(
    () =>
      houseNames.map((name, index) => ({
        rank: index + 1,
        name,
        virtue: houseVirtues[name]?.virtue || "",
        description: houseVirtues[name]?.description || "",
        points: 0,
        color: houseConfig[name]?.color || "#1a1a1a",
        bgColor: houseVirtues[name]?.bgColor || "#f5f5f5",
        logo: houseConfig[name]?.logo || null,
        todayPoints: 0,
      })),
    [houseConfig, houseNames]
  );
  const [houses, setHouses] = useState<House[]>(() => fallbackHouses);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [maxPoints, setMaxPoints] = useState(1);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const fetchIdRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const weekNumber = getAcademicWeek();
  const [selectedWeek, setSelectedWeek] = useState(() => weekNumber);
  const selectedWeekRange = getAcademicWeekRange(selectedWeek);
  const weekOptions = Array.from({ length: weekNumber }, (_, index) => {
    const week = index + 1;
    const range = getAcademicWeekRange(week);
    return {
      week,
      label: `Week ${week}`,
      dates: formatWeekRange(range.start, range.end),
    };
  }).reverse();
  const isCurrentWeek = selectedWeek === weekNumber;
  const isStale = isCurrentWeek && lastUpdated ? Date.now() - new Date(lastUpdated).getTime() > 30 * 60 * 1000 : false;

  useEffect(() => {
    const controller = new AbortController();

    async function fetchHouses() {
      const fetchId = fetchIdRef.current + 1;
      fetchIdRef.current = fetchId;

      if (!hasLoadedRef.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        // Fetch house standings
        const standingsResponse = await fetch(`/api/standings?week=${selectedWeek}`, {
          signal: controller.signal,
        });
        if (!standingsResponse.ok) {
          console.error("Standings fetch error:", standingsResponse.statusText);
          if (fetchId === fetchIdRef.current) {
            setHouses(fallbackHouses);
          }
          return;
        }

        const standingsJson = (await standingsResponse.json()) as StandingsResponse;
        const data = Array.isArray(standingsJson?.data) ? standingsJson.data : [];
        const computedAt = (data?.[0] as Record<string, unknown> | undefined)?.computed_at ?? null;
        if (fetchId === fetchIdRef.current) {
          setLastUpdated(computedAt ? String(computedAt) : null);
          setWarning(typeof standingsJson.warning === "string" ? standingsJson.warning : null);
        }

        const pointsByHouse = new Map<string, number>();

        (data ?? []).forEach((row: Record<string, unknown>) => {
          const houseNameRaw = row.house_name ?? row.house ?? row.name ?? "";
          const houseName = canonicalHouseName(String(houseNameRaw ?? ""), schoolHouses);
          if (!houseConfig[houseName]) {
            return;
          }
          const pointsValue = Number(row.total_points ?? row.points ?? 0) || 0;
          pointsByHouse.set(houseName, (pointsByHouse.get(houseName) || 0) + pointsValue);
        });

        const nextHouses = houseNames
          .map((houseName) => {
            const config = houseConfig[houseName];
            const virtueInfo = houseVirtues[houseName] || {
              virtue: "",
              description: "",
              bgColor: "#f5f5f5",
            };

            return {
              rank: 0,
              name: houseName,
              virtue: virtueInfo.virtue,
              description: virtueInfo.description,
              points: pointsByHouse.get(houseName) || 0,
              color: config?.color || "#1a1a1a",
              bgColor: virtueInfo.bgColor,
              logo: config?.logo || null,
              todayPoints: 0,
            };
          })
          .sort((a, b) => b.points - a.points)
          .map((house, index) => ({
            ...house,
            rank: index + 1,
          }));

        const max = Math.max(...nextHouses.map(h => h.points), 1);
        if (fetchId === fetchIdRef.current) {
          setMaxPoints(max);
          setHouses(nextHouses.length > 0 ? nextHouses : fallbackHouses);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Error fetching houses:", err);
        if (fetchId === fetchIdRef.current) {
          setHouses(fallbackHouses);
        }
      } finally {
        if (fetchId === fetchIdRef.current) {
          setLoading(false);
          setRefreshing(false);
          hasLoadedRef.current = true;
        }
      }
    }

    fetchHouses();

    const refreshInterval = setInterval(fetchHouses, 30000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchHouses();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      controller.abort();
      clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [houseConfig, houseNames, schoolHouses, selectedWeek]);

  useEffect(() => {
    setHouses(fallbackHouses);
  }, [fallbackHouses]);

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 flex flex-col" style={{ background: "#faf9f7" }}>
      {/* Navigation Links */}
      <div className="absolute top-4 right-6 flex items-center gap-2">
        <Link
          href="/house-mvps"
          className="inline-flex items-center gap-2 rounded-full border border-[#B8860B] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#B8860B] transition hover:bg-[#B8860B] hover:text-white"
          style={{ fontFamily: "var(--font-source-sans), 'Source Sans 3', sans-serif" }}
        >
          House MVPs
        </Link>
        <Link
          href="/hall-of-fame"
          className="inline-flex items-center gap-2 rounded-full border border-[#B8860B] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#B8860B] transition hover:bg-[#B8860B] hover:text-white"
          style={{ fontFamily: "var(--font-source-sans), 'Source Sans 3', sans-serif" }}
        >
          Hall of Fame
        </Link>
      </div>

      <div className="max-w-2xl mx-auto w-full flex flex-col flex-1">
        {/* Header */}
        <header className="text-center mb-6 mt-8">
          <h1
            className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-2"
            style={{ fontFamily: "var(--font-poppins), 'Poppins', sans-serif" }}
          >
            House Standings
          </h1>
          <p
            className="text-sm text-[#1a1a1a]/50"
            style={{ fontFamily: "var(--font-source-sans), 'Source Sans 3', sans-serif" }}
          >
            Week {selectedWeek} - {isCurrentWeek ? "Live Leaderboard" : "Selected Leaderboard"}
          </p>
          <p
            className="text-xs text-[#1a1a1a]/40 mt-1"
            style={{ fontFamily: "var(--font-source-sans), 'Source Sans 3', sans-serif" }}
          >
            {formatWeekRange(selectedWeekRange.start, selectedWeekRange.end)}
          </p>
          <p
            className="text-xs text-[#1a1a1a]/40 mt-2"
            style={{ fontFamily: "var(--font-source-sans), 'Source Sans 3', sans-serif" }}
          >
            Last updated {lastUpdated ? new Date(lastUpdated).toLocaleString() : "unavailable"}
          </p>
          {isStale ? (
            <span
              className="inline-flex items-center rounded-full bg-[#B8860B]/10 px-2 py-0.5 text-xs text-[#B8860B] mt-2"
              style={{ fontFamily: "var(--font-source-sans), 'Source Sans 3', sans-serif" }}
            >
              Data delayed
            </span>
          ) : null}
          {warning ? (
            <span
              className="inline-flex items-center rounded-full bg-[#B8860B]/10 px-2 py-0.5 text-xs text-[#B8860B] mt-2"
              style={{ fontFamily: "var(--font-source-sans), 'Source Sans 3', sans-serif" }}
            >
              Weekly data unavailable
            </span>
          ) : null}
        </header>

        <div className="mb-5 flex items-center justify-center gap-3">
          <label
            htmlFor="leaderboard-week"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1a1a1a]/50"
            style={{ fontFamily: "var(--font-source-sans), 'Source Sans 3', sans-serif" }}
          >
            Week
          </label>
          <select
            id="leaderboard-week"
            value={selectedWeek}
            onChange={(event) => setSelectedWeek(Number(event.target.value))}
            className="h-10 min-w-48 rounded-full border border-[#B8860B]/40 bg-white px-4 text-sm font-semibold text-[#1a1a1a] shadow-sm outline-none transition focus:border-[#2D5016] focus:ring-2 focus:ring-[#2D5016]/20"
            style={{ fontFamily: "var(--font-source-sans), 'Source Sans 3', sans-serif" }}
          >
            {weekOptions.map((option) => (
              <option key={option.week} value={option.week}>
                {option.label} ({option.dates})
              </option>
            ))}
          </select>
          {refreshing ? (
            <span
              className="text-xs text-[#1a1a1a]/40"
              style={{ fontFamily: "var(--font-source-sans), 'Source Sans 3', sans-serif" }}
            >
              Updating...
            </span>
          ) : null}
        </div>

        {/* House Cards */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-[#1a1a1a] text-lg">Loading...</p>
            </div>
          ) : (
            houses.map((house) => (
              <HouseCard
                key={house.name}
                house={house}
                maxPoints={maxPoints}
                recentAchievement={null}
              />
            ))
          )}
        </div>

        {/* Attribution */}
        <div className="mt-8 text-center">
          <p
            className="text-xs text-[#1a1a1a]/40"
            style={{ fontFamily: "var(--font-source-sans), 'Source Sans 3', sans-serif" }}
          >
            Powered by Nama Learning Systems
          </p>
        </div>
      </div>
    </div>
  );
}
