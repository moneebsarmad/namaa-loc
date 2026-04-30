import { createSupabaseServiceRoleClient } from "@namaa-loc/db/server";

import { fallbackSchoolBranding, type SchoolBranding } from "./branding";

function normalizeString(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function loadSchoolBranding(
  schoolId: string | null
): Promise<SchoolBranding> {
  if (!schoolId) {
    return fallbackSchoolBranding;
  }

  try {
    const supabase = createSupabaseServiceRoleClient();

    const [{ data: settingsRaw }, { data: schoolRaw }] = await Promise.all([
      supabase
        .from("school_settings")
        .select(
          "program_name, program_short_name, logo_url, primary_color, secondary_color, accent_color"
        )
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabase.from("schools").select("name").eq("id", schoolId).maybeSingle()
    ]);

    const settings = settingsRaw as
      | {
          program_name?: string | null;
          program_short_name?: string | null;
          logo_url?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          accent_color?: string | null;
        }
      | null;
    const school = schoolRaw as { name?: string | null } | null;

    return {
      schoolId,
      schoolName: normalizeString(school?.name) || fallbackSchoolBranding.schoolName,
      programName:
        normalizeString(settings?.program_name) || fallbackSchoolBranding.programName,
      programShortName:
        normalizeString(settings?.program_short_name) ||
        fallbackSchoolBranding.programShortName,
      logoUrl: normalizeString(settings?.logo_url) || fallbackSchoolBranding.logoUrl,
      primaryColor:
        normalizeString(settings?.primary_color) || fallbackSchoolBranding.primaryColor,
      secondaryColor:
        normalizeString(settings?.secondary_color) ||
        fallbackSchoolBranding.secondaryColor,
      accentColor:
        normalizeString(settings?.accent_color) || fallbackSchoolBranding.accentColor,
      isFallback: false
    };
  } catch {
    return fallbackSchoolBranding;
  }
}
