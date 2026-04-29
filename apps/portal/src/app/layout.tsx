import type { Metadata } from "next";
import { headers } from "next/headers";
import { Nunito_Sans } from "next/font/google";
import type { CSSProperties } from "react";
import "./globals.css";
import { AuthProvider } from "./providers";
import { SchoolBrandingProvider } from "./branding-context";
import SupabaseEnvBanner from "../components/SupabaseEnvBanner";
import { loadSchoolBranding } from "../lib/loadSchoolBranding";

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const branding = await loadSchoolBranding(requestHeaders.get("x-school-id"));

  return {
    title: branding.programName,
    description: `${branding.programName} web experience for ${branding.schoolName}`
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const branding = await loadSchoolBranding(requestHeaders.get("x-school-id"));

  return (
    <html lang="en">
      <body
        className={`${nunitoSans.variable} antialiased`}
        style={{
          ["--school-primary" as any]: branding.primaryColor,
          ["--school-secondary" as any]: branding.secondaryColor,
          ["--school-accent" as any]: branding.accentColor
        } as CSSProperties}
      >
        <SchoolBrandingProvider branding={branding}>
          <AuthProvider>
            {children}
            <SupabaseEnvBanner />
          </AuthProvider>
        </SchoolBrandingProvider>
      </body>
    </html>
  );
}
