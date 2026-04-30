import { NextResponse } from "next/server";

import { createSupabaseServiceRoleClient } from "@namaa-loc/db/server";

type StandingsRow = {
  house: string | null;
  total_points: number | null;
  computed_at: string | null;
};

type MeritRow = {
  house: string | null;
  points: number | null;
  timestamp: string | null;
};

const demoStandings: StandingsRow[] = [
  { house: "House of Abū Bakr", total_points: 4985, computed_at: null },
  { house: "House of ʿUmar", total_points: 4175, computed_at: null },
  { house: "House of ʿĀʾishah", total_points: 3995, computed_at: null },
  { house: "House of Khadījah", total_points: 3480, computed_at: null }
];

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function getAcademicYearStart(referenceDate: Date) {
  const year = referenceDate.getMonth() >= 7 ? referenceDate.getFullYear() : referenceDate.getFullYear() - 1;
  return new Date(year, 7, 15);
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveWeekRange(value: string | null) {
  if (!value) return null;

  const week = Number(value);
  if (!Number.isInteger(week) || week < 1 || week > 53) return null;

  const start = new Date(getAcademicYearStart(new Date()).getTime() + (week - 1) * MS_PER_WEEK);
  const end = new Date(start.getTime() + MS_PER_WEEK - 1);

  return {
    week,
    startDate: toDateValue(start),
    endDate: toDateValue(end)
  };
}

function demoRows(): StandingsRow[] {
  return demoStandings.map((row) => ({ ...row }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weekRange = resolveWeekRange(searchParams.get("week"));
  const schoolId = request.headers.get("x-school-id")?.trim() || null;

  if (!schoolId) {
    return NextResponse.json({ data: [], period: weekRange, source: "missing-school" }, { status: 404 });
  }

  try {
    const supabase = createSupabaseServiceRoleClient();

    if (weekRange) {
      const { data, error } = await supabase
        .from("merit_log")
        .select("school_id, house, points, timestamp")
        .eq("school_id", schoolId)
        .gte("date_of_event", weekRange.startDate)
        .lte("date_of_event", weekRange.endDate);

      if (error || !data) {
        return NextResponse.json({
          data: [],
          period: weekRange,
          source: "weekly",
          warning: "Weekly standings are unavailable."
        });
      }

      const totals = new Map<string, number>();
      let latestTimestamp: string | null = null;

      (data as MeritRow[]).forEach((row) => {
        const house = String(row.house || "").trim();
        if (!house) return;

        totals.set(house, (totals.get(house) || 0) + (Number(row.points ?? 0) || 0));

        if (row.timestamp && (!latestTimestamp || row.timestamp > latestTimestamp)) {
          latestTimestamp = row.timestamp;
        }
      });

      const weeklyData: StandingsRow[] = Array.from(totals.entries())
        .map(([house, totalPoints]) => ({
          house,
          total_points: totalPoints,
          computed_at: latestTimestamp
        }))
        .sort((a, b) => Number(b.total_points ?? 0) - Number(a.total_points ?? 0));

      return NextResponse.json({ data: weeklyData, period: weekRange, source: "weekly" });
    }

    const { data, error } = await supabase
      .from("house_standings_cache")
      .select("house, total_points, computed_at")
      .eq("school_id", schoolId)
      .order("total_points", { ascending: false });

    if (error || !data) {
      return NextResponse.json({ data: demoRows(), period: null, source: "demo" });
    }

    return NextResponse.json({ data, period: null, source: "cache" });
  } catch (error) {
    console.error("Standings route error:", error);
    return NextResponse.json({ data: demoRows(), period: null, source: "demo" });
  }
}
