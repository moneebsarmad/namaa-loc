import type { Metadata } from "next";
import { headers } from "next/headers";
import type { CSSProperties } from "react";
import { Poppins, Source_Sans_3 } from "next/font/google";

import AutoRotate from "@/components/AutoRotate";
import { LeaderboardSchoolProvider } from "@/app/branding-context";
import { fallbackSchoolBranding } from "@/lib/branding";
import { loadSchoolBranding } from "@/lib/loadSchoolBranding";
import { loadSchoolHouses } from "@/lib/loadSchoolHouses";

import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600"],
});

function normalizeSchoolId(value: string | null | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function resolveSchoolContext() {
  const requestHeaders = await headers();
  const schoolId = normalizeSchoolId(requestHeaders.get("x-school-id"));

  if (!schoolId) {
    return {
      schoolId: null,
      branding: fallbackSchoolBranding,
      houses: [],
    };
  }

  const [branding, houses] = await Promise.all([
    loadSchoolBranding(schoolId),
    loadSchoolHouses(schoolId),
  ]);

  return { schoolId, branding, houses };
}

export async function generateMetadata(): Promise<Metadata> {
  const { branding } = await resolveSchoolContext();
  return {
    title: `${branding.programName} Leaderboard`,
    description: `${branding.schoolName} leaderboard display`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { schoolId, branding, houses } = await resolveSchoolContext();

  return (
    <html lang="en">
      <body
        className={`${poppins.variable} ${sourceSans.variable} antialiased`}
        style={
          {
            "--school-primary": branding.primaryColor,
            "--school-secondary": branding.secondaryColor,
            "--school-accent": branding.accentColor,
            "--school-logo-url": `url(${branding.logoUrl})`,
          } as CSSProperties
        }
      >
        <LeaderboardSchoolProvider schoolId={schoolId} branding={branding} houses={houses}>
          <AutoRotate />
          {children}
        </LeaderboardSchoolProvider>
      </body>
    </html>
  );
}
