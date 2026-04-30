"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLeaderboardBranding, useLeaderboardHouses, useLeaderboardSchoolId } from "@/app/branding-context";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { canonicalHouseName, getHouseConfigRecord, getHouseNames } from "@/lib/schoolHouses";

interface StudentEntry {
  houseName: string;
  studentName: string;
  points: number;
  rank?: number | null;
}

const houseBgColors: Record<string, string> = {
  "House of Abū Bakr": "#f6f1fb",
  "House of ʿUmar": "#f2f3fb",
  "House of ʿĀʾishah": "#fdf1f1",
  "House of Khadījah": "#f1fbf6",
};


export default function HouseMvpsPage() {
  const branding = useLeaderboardBranding();
  const schoolId = useLeaderboardSchoolId();
  const schoolHouses = useLeaderboardHouses();
  const houseConfig = useMemo(() => getHouseConfigRecord(schoolHouses), [schoolHouses]);
  const houseNames = useMemo(() => getHouseNames(schoolHouses), [schoolHouses]);
  const [students, setStudents] = useState<StudentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const fetchingRef = useRef(false);

  useEffect(() => {
    const supabaseClient = getSupabaseBrowserClient();
    if (!supabaseClient) {
      setErrorMessage("Supabase is not configured for the leaderboard yet.");
      setLoading(false);
      return;
    }
    const supabase = supabaseClient;

    if (!schoolId) {
      setErrorMessage("School not found.");
      setLoading(false);
      return;
    }

    function getRowValue(
      row: Record<string, unknown>,
      keys: string[]
    ): unknown {
      for (const key of keys) {
        if (key in row) {
          return row[key];
        }
      }
      const normalizedKeys = Object.keys(row).reduce<Record<string, string>>(
        (acc, key) => {
          acc[key.toLowerCase()] = key;
          return acc;
        },
        {}
      );
      for (const key of keys) {
        const normalized = normalizedKeys[key.toLowerCase()];
        if (normalized) {
          return row[normalized];
        }
      }
      return undefined;
    }

    async function fetchTopStudents() {
      if (fetchingRef.current) {
        return;
      }
      fetchingRef.current = true;
      try {
        const { data, error } = await supabase
          .from("top_students_per_house")
          .select("*")
          .eq("school_id", schoolId);

        if (error) {
          setErrorMessage("Unable to load House MVPs right now.");
          console.error("Supabase error:", error);
          return;
        }

        const normalized =
          data?.map((row: Record<string, unknown>) => {
            const houseNameRaw =
              getRowValue(row, ["house"]) ?? "";
            const studentNameRaw =
              getRowValue(row, ["student_name"]) ?? "";
            const pointsRaw =
              getRowValue(row, ["total_points"]) ?? 0;
            const rankRaw =
              getRowValue(row, ["house_rank"]) ?? NaN;

            const houseName = canonicalHouseName(String(houseNameRaw ?? ""), schoolHouses);
            const studentName =
              String(studentNameRaw ?? "").trim() ||
              "Unnamed Student";
            const pointsValue = Number(pointsRaw) || 0;
            const rankValue = Number(rankRaw);

            return {
              houseName,
              studentName,
              points: pointsValue,
              rank: Number.isFinite(rankValue) ? rankValue : null,
            };
          }) ?? [];

        setStudents(normalized);
      } catch (err) {
        console.error("Error fetching House MVPs:", err);
        setErrorMessage("Unable to load House MVPs right now.");
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    }

    fetchTopStudents();

    const channel = supabase
      .channel("house-mvps-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merit_log", filter: `school_id=eq.${schoolId}` },
        () => {
          fetchTopStudents();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students", filter: `school_id=eq.${schoolId}` },
        () => {
          fetchTopStudents();
        }
      )
      .subscribe();

    const refreshInterval = setInterval(fetchTopStudents, 30000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchTopStudents();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [branding, schoolId, schoolHouses]);

  const grouped = useMemo(() => {
    const groups: Record<string, StudentEntry[]> = {};
    students.forEach((entry) => {
      if (!groups[entry.houseName]) {
        groups[entry.houseName] = [];
      }
      groups[entry.houseName].push(entry);
    });

    Object.values(groups).forEach((houseStudents) => {
      houseStudents.sort((a, b) => {
        if (a.rank != null && b.rank != null) {
          return a.rank - b.rank;
        }
        if (a.rank != null) {
          return -1;
        }
        if (b.rank != null) {
          return 1;
        }
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return a.studentName.localeCompare(b.studentName);
      });
    });

    return groups;
  }, [students]);

  const houseOrder = useMemo(() => {
    const configured = houseNames;
    const extras = Object.keys(grouped).filter(
      (houseName) => !configured.includes(houseName)
    );
    return [...configured, ...extras.sort()];
  }, [grouped, houseNames]);

  // Always show all houses, even if empty
  const visibleHouses = houseOrder;

  return (
    <div
      className="min-h-screen py-6 px-4 sm:px-6 lg:px-8 starry-bg flex flex-col"
      style={{ background: "var(--color-soft-gray)" }}
    >
      <div className="max-w-6xl mx-auto w-full flex-1">
        <div className="absolute top-4 right-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[#B8860B] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#B8860B] transition hover:bg-[#B8860B] hover:text-white"
            style={{ fontFamily: "var(--font-source-sans), 'Source Sans 3', sans-serif" }}
          >
            Back to Leaderboard
          </Link>
        </div>
        <header className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <Image
              src={branding.logoUrl}
              alt={`${branding.schoolName} Crest`}
              width={90}
              height={90}
              className="drop-shadow-lg"
              priority
            />
          </div>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl text-[#1a1a1a] mb-2 gold-underline pb-1"
            style={{
              fontFamily: "var(--font-poppins), 'Poppins', sans-serif",
            }}
          >
            House MVPs
          </h1>
          <p
            className="text-lg sm:text-xl mt-3"
            style={{
              color: "var(--color-forest)",
              fontFamily: "var(--font-poppins), 'Poppins', sans-serif",
            }}
          >
            Top 5 students from each house
          </p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-[#1a1a1a] text-lg">Loading House MVPs...</p>
          </div>
        ) : errorMessage ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-[#1a1a1a] text-lg">{errorMessage}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleHouses.length === 0 ? (
              <div className="col-span-2 flex items-center justify-center py-12">
                <p className="text-[#1a1a1a] text-lg">No MVPs found yet.</p>
              </div>
            ) : (
              visibleHouses.map((houseName) => {
              const baseConfig = houseConfig[houseName];
              const config = {
                color: baseConfig?.color || "#333333",
                bgColor: houseBgColors[houseName] || "#f6f5f2",
                logo: baseConfig?.logo || null,
              };
              const houseStudents = grouped[houseName] || [];

              return (
                <div
                  key={houseName}
                  className="relative rounded-lg overflow-hidden shadow-lg float-card"
                  style={{
                    borderLeft: `5px solid ${config.color}`,
                    background: config.bgColor || houseBgColors[houseName] || "#f6f5f2",
                  }}
                >
                  <div className="p-5 pr-28">
                    <h2
                      className="text-2xl font-bold mb-2"
                      style={{
                    color: config.color,
                    fontFamily:
                      "var(--font-poppins), 'Poppins', sans-serif",
                  }}
                    >
                      {houseName}
                    </h2>
                    <ol className="space-y-2">
                      {houseStudents.length === 0 ? (
                        <li
                          className="text-sm"
                          style={{
                            color: "var(--color-muted)",
                            fontFamily:
                              "var(--font-source-sans), 'Source Sans 3', sans-serif",
                          }}
                        >
                          No MVPs found yet.
                        </li>
                      ) : (
                        houseStudents.slice(0, 5).map((student, index) => (
                          <li
                            key={`${houseName}-${student.studentName}-${index}`}
                            className="flex items-center justify-between text-sm"
                            style={{
                              color: "var(--color-dark)",
                              fontFamily:
                                "var(--font-source-sans), 'Source Sans 3', sans-serif",
                            }}
                          >
                            <span>
                              {student.rank ?? index + 1}. {student.studentName}
                            </span>
                            <span className="font-semibold">
                              {student.points.toLocaleString()}
                            </span>
                          </li>
                        ))
                      )}
                    </ol>
                  </div>
                  {config.logo ? (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-20 h-20">
                      <Image
                        src={config.logo}
                        alt={`${houseName} Logo`}
                        width={80}
                        height={80}
                        className="object-contain"
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
