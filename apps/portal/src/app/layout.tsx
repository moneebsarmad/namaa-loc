import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./providers";
import SupabaseEnvBanner from "../components/SupabaseEnvBanner";

// <!-- TODO Phase 3: read from school_settings -->
const systemName = process.env.NEXT_PUBLIC_SYSTEM_NAME || '{{PROGRAM_NAME}}'
// <!-- TODO Phase 3: read from school_settings -->
const schoolName = process.env.NEXT_PUBLIC_SCHOOL_NAME || '{{SCHOOL_NAME}}'

export const metadata: Metadata = {
  title: systemName,
  description: `${systemName} web experience for ${schoolName}`,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          {children}
          <SupabaseEnvBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
