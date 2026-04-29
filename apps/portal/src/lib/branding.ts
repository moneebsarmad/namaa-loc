export type SchoolBranding = {
  schoolId: string | null;
  schoolName: string;
  programName: string;
  programShortName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  isFallback: boolean;
};

export const fallbackSchoolBranding: SchoolBranding = {
  schoolId: null,
  schoolName: "namaa",
  programName: "namaa Login",
  programShortName: "namaa",
  logoUrl: "/favicon.ico",
  primaryColor: "#023020",
  secondaryColor: "#3d6b1e",
  accentColor: "#b8860b",
  isFallback: true
};
