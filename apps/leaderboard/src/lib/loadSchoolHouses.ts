import { createSupabaseServiceRoleClient } from "@namaa-loc/db/server";

import type { SchoolHouseRecord } from "./schoolHouses";

export async function loadSchoolHouses(
  schoolId: string | null
): Promise<SchoolHouseRecord[]> {
  if (!schoolId) {
    return [];
  }

  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data } = await supabase
      .from("houses")
      .select("name, display_name, value, color, icon_url, sort_order, is_active")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("sort_order");

    return (data || []) as SchoolHouseRecord[];
  } catch {
    return [];
  }
}
