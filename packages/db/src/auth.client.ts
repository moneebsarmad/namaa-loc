function normalizeSchoolId(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getSchoolIdFromHeaderValue(value: string | null | undefined): string | null {
  return normalizeSchoolId(value);
}

export function getSchoolIdFromCookieValue(value: string | null | undefined): string | null {
  return normalizeSchoolId(value);
}
