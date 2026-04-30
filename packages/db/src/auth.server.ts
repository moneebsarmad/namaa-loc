import "server-only";

import { headers } from "next/headers";

function normalizeSchoolId(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getCurrentSchoolId(): Promise<string | null> {
  const requestHeaders = await headers();
  return normalizeSchoolId(requestHeaders.get("x-school-id"));
}

export function assertSchoolMatch(
  expectedSchoolId: string | null | undefined,
  currentSchoolId: string | null
): boolean {
  const expected = normalizeSchoolId(expectedSchoolId);
  const current = normalizeSchoolId(currentSchoolId);

  if (!expected || !current) {
    return false;
  }

  return expected === current;
}

export async function withSchoolScope<T>(
  handler: (schoolId: string) => Promise<T> | T
): Promise<T> {
  const schoolId = await getCurrentSchoolId();

  if (!schoolId) {
    throw new Error("Missing school context.");
  }

  return handler(schoolId);
}
